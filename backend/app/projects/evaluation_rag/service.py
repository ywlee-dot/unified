"""Service layer for evaluation-rag project."""

import asyncio
import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

from .core.chunk_store import ChunkStore
from .core.embedding_service import EmbeddingService
from .core.evaluation_engine import EvaluationEngine
from .core.file_parser import FileParser
from .core.pinecone_service import PineconeService
from .core.prompt_builder import PromptBuilder
from .core.query_processor import QueryProcessor
from .core.rag_chain import RAGChain
from .core.retrieval_service import RetrievalService
from .models import EvaluationRagModel
from .schemas import (
    EvaluationListResponse,
    EvaluationResponse,
    EvaluationStatsResponse,
    ImprovementItemSchema,
)

logger = logging.getLogger(__name__)


class EvaluationRagService:
    """Service for RAG-based evaluation."""

    def _get_gemini_api_key(self) -> str:
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            raise ValueError("GEMINI_API_KEY가 설정되지 않았습니다.")
        return api_key

    def _build_rag_chain(self) -> RAGChain:
        api_key = self._get_gemini_api_key()
        pinecone_api_key = settings.PINECONE_API_KEY
        if not pinecone_api_key:
            raise ValueError("PINECONE_API_KEY가 설정되지 않았습니다.")

        embedding_service = EmbeddingService(api_key=api_key)
        pinecone_service = PineconeService(
            api_key=pinecone_api_key,
            environment="us-east-1",
            index_name=settings.PINECONE_INDEX_NAME,
            dimension=3072,
            metric="cosine",
        )
        query_processor = QueryProcessor(embedding_service=embedding_service)
        retrieval_service = RetrievalService(
            pinecone_service=pinecone_service,
            embedding_service=embedding_service,
        )
        chunk_store = ChunkStore()
        return RAGChain(
            query_processor=query_processor,
            retrieval_service=retrieval_service,
            chunk_store=chunk_store,
        )

    def _build_evaluation_engine(self) -> EvaluationEngine:
        api_key = self._get_gemini_api_key()
        return EvaluationEngine(
            api_key=api_key,
            model_name=settings.GEMINI_MODEL,
        )

    async def evaluate(
        self,
        db: AsyncSession,
        input_data: str,
        query: str,
        category: str | None = None,
    ) -> EvaluationResponse:
        """Run RAG-based evaluation."""
        rag_chain = self._build_rag_chain()
        engine = self._build_evaluation_engine()

        rag_result = await asyncio.to_thread(
            rag_chain.run, query=query, top_k=5, category=category
        )

        context = rag_result["context"]
        final_category = rag_result.get("category")

        eval_result = await asyncio.to_thread(
            engine.evaluate,
            input_data=input_data,
            context=context,
            category=final_category,
        )

        row = EvaluationRagModel(
            input_data=input_data,
            query=query,
            context=context,
            category=final_category,
            summary=eval_result.summary,
            score=eval_result.score,
            issues=eval_result.issues,
            improvements=[imp.model_dump() for imp in eval_result.improvements],
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)

        return self._to_response(row)

    async def evaluate_file(
        self,
        db: AsyncSession,
        file_content: bytes,
        filename: str,
        query: str,
        category: str | None = None,
    ) -> EvaluationResponse:
        """Run RAG-based evaluation on an uploaded file."""
        input_data = await asyncio.to_thread(
            FileParser.parse_file, "", file_content, filename
        )

        return await self.evaluate(
            db=db,
            input_data=input_data,
            query=query,
            category=category,
        )

    async def evaluate_simple(
        self,
        db: AsyncSession,
        input_data: str,
        query: str,
        category: str | None = None,
    ) -> EvaluationResponse:
        """Run simple evaluation without RAG (uses query as context)."""
        engine = self._build_evaluation_engine()

        default_criteria = {
            "quality": "데이터 품질 평가: 정확성, 완전성, 일관성, 적시성을 기준으로 평가합니다.",
            "openness": "개방·활용 평가: 데이터 개방 수준, 접근성, 활용 편의성을 기준으로 평가합니다.",
            "analysis": "분석·활용 평가: 데이터 분석 가능성, 정책 활용도를 기준으로 평가합니다.",
            "sharing": "공유 평가: 데이터 공유 체계, 협력 수준을 기준으로 평가합니다.",
            "management": "관리체계 평가: 데이터 관리 조직, 교육, 추진 기반을 기준으로 평가합니다.",
        }
        context = default_criteria.get(category, query) if category else query

        eval_result = await asyncio.to_thread(
            engine.evaluate,
            input_data=input_data,
            context=context,
            category=category,
        )

        row = EvaluationRagModel(
            input_data=input_data,
            query=query,
            context=context,
            category=category,
            summary=eval_result.summary,
            score=eval_result.score,
            issues=eval_result.issues,
            improvements=[imp.model_dump() for imp in eval_result.improvements],
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)

        return self._to_response(row)

    async def get_evaluations(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
    ) -> EvaluationListResponse:
        """Get paginated list of evaluations."""
        count_result = await db.execute(
            select(func.count()).select_from(EvaluationRagModel)
        )
        total = count_result.scalar_one()

        offset = (page - 1) * page_size
        result = await db.execute(
            select(EvaluationRagModel)
            .order_by(EvaluationRagModel.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        rows = result.scalars().all()

        return EvaluationListResponse(
            evaluations=[self._to_response(r) for r in rows],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get_evaluation(
        self,
        db: AsyncSession,
        evaluation_id: str,
    ) -> EvaluationResponse | None:
        """Get a single evaluation by ID."""
        result = await db.execute(
            select(EvaluationRagModel).where(EvaluationRagModel.id == evaluation_id)
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        return self._to_response(row)

    async def get_stats(self, db: AsyncSession) -> EvaluationStatsResponse:
        """Get evaluation service statistics."""
        count_result = await db.execute(
            select(func.count()).select_from(EvaluationRagModel)
        )
        total = count_result.scalar_one()

        avg_result = await db.execute(
            select(func.avg(EvaluationRagModel.score))
        )
        avg_score = avg_result.scalar_one()

        pinecone_connected = False
        try:
            if settings.PINECONE_API_KEY:
                pinecone_connected = True
        except Exception:
            pass

        return EvaluationStatsResponse(
            total_evaluations=total,
            average_score=round(avg_score, 1) if avg_score is not None else None,
            pinecone_connected=pinecone_connected,
        )

    def _to_response(self, row: EvaluationRagModel) -> EvaluationResponse:
        issues = row.issues if isinstance(row.issues, list) else []
        improvements_raw = row.improvements if isinstance(row.improvements, list) else []
        improvements = []
        for imp in improvements_raw:
            if isinstance(imp, dict):
                improvements.append(ImprovementItemSchema(**imp))

        return EvaluationResponse(
            id=row.id,
            summary=row.summary,
            score=row.score,
            issues=issues,
            improvements=improvements,
            input_data=row.input_data,
            query=row.query,
            context=row.context,
            category=row.category,
            created_at=row.created_at,
        )
