"""Phase 1 메인 파이프라인"""

import argparse
import json
from datetime import datetime
from pathlib import Path

from loguru import logger

from .catalog_parser import CatalogParser
from .config import settings
from .document_loader import DocumentLoaderFactory, DocType
from .preprocessor import Preprocessor
from .vector_store import VectorStore


class Phase1Pipeline:
    """Phase 1: 지식 기반 구축 파이프라인"""

    def __init__(self, rebuild: bool = False):
        self.rebuild = rebuild
        self.preprocessor = Preprocessor()
        self.vector_store = VectorStore()
        self.report_data = {
            "timestamp": datetime.now().isoformat(),
            "status": "running",
            "collections": {},
            "warnings": [],
            "errors": [],
        }

    def _setup_logging(self) -> None:
        """로깅 설정"""
        log_file = settings.paths.logs_dir / f"phase1_{datetime.now():%Y%m%d_%H%M%S}.log"
        settings.paths.logs_dir.mkdir(parents=True, exist_ok=True)

        logger.add(
            log_file,
            format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}",
            level="DEBUG",
            rotation="10 MB"
        )

    def _validate_inputs(self) -> dict:
        """입력 폴더 검증"""
        validation = {
            "institutions": {
                "path": settings.paths.institutions_dir,
                "exists": settings.paths.institutions_dir.exists(),
                "files": [],
            },
            "data_catalog": {
                "path": settings.paths.data_catalog_dir,
                "exists": settings.paths.data_catalog_dir.exists(),
                "files": [],
            },
            "analysis_cases": {
                "path": settings.paths.analysis_cases_dir,
                "exists": settings.paths.analysis_cases_dir.exists(),
                "files": [],
            },
        }

        supported_ext = DocumentLoaderFactory.get_supported_extensions()

        for doc_type, info in validation.items():
            if info["exists"]:
                for f in info["path"].rglob("*"):
                    if f.is_file() and f.suffix.lower() in supported_ext:
                        info["files"].append(str(f.name))

        logger.info("입력 검증 완료")
        for doc_type, info in validation.items():
            file_count = len(info["files"])
            status = "OK" if file_count > 0 else "비어있음"
            logger.info(f"  {doc_type}: {status} ({file_count}개 파일)")

            if not info["exists"]:
                self.report_data["warnings"].append(f"{doc_type} 폴더가 존재하지 않음")
            elif file_count == 0:
                self.report_data["warnings"].append(f"{doc_type} 폴더에 처리 가능한 파일이 없음")

        return validation

    def _process_collection(self, doc_type: DocType) -> dict:
        """특정 컬렉션 처리"""
        dir_mapping = {
            "institutions": settings.paths.institutions_dir,
            "data_catalog": settings.paths.data_catalog_dir,
            "analysis_cases": settings.paths.analysis_cases_dir,
        }

        dir_path = dir_mapping[doc_type]
        collection_stats = {
            "documents_processed": 0,
            "chunks_created": 0,
            "errors": [],
        }

        if not dir_path.exists():
            logger.warning(f"{doc_type} 디렉토리가 존재하지 않음: {dir_path}")
            return collection_stats

        all_chunks = []

        for doc in DocumentLoaderFactory.load_directory(dir_path, doc_type):
            try:
                chunks = self.preprocessor.process(doc)
                all_chunks.extend(chunks)
                collection_stats["documents_processed"] += 1
                logger.debug(f"처리 완료: {doc.source} -> {len(chunks)} 청크")
            except Exception as e:
                error_msg = f"문서 처리 실패 ({doc.source}): {e}"
                logger.error(error_msg)
                collection_stats["errors"].append(error_msg)
                self.report_data["errors"].append(error_msg)

        if all_chunks:
            added = self.vector_store.add_chunks(all_chunks, doc_type)
            collection_stats["chunks_created"] = added

        logger.info(
            f"{doc_type} 처리 완료: "
            f"{collection_stats['documents_processed']}개 문서, "
            f"{collection_stats['chunks_created']}개 청크"
        )

        return collection_stats

    def run(self) -> dict:
        """파이프라인 실행"""
        self._setup_logging()
        logger.info("=" * 50)
        logger.info("Phase 1 파이프라인 시작")
        logger.info("=" * 50)

        # 1. 입력 검증
        logger.info("Step 1: 입력 검증")
        self._validate_inputs()

        # 2. 리빌드 옵션 처리
        if self.rebuild:
            logger.info("리빌드 모드: 기존 컬렉션 초기화")
            self.vector_store.reset_all()

        # 3. 각 컬렉션 처리
        for doc_type in ["institutions", "data_catalog", "analysis_cases"]:
            logger.info(f"Step 2: {doc_type} 처리 중...")
            stats = self._process_collection(doc_type)
            self.report_data["collections"][doc_type] = stats

        # 4. 카탈로그 구조화 인덱스 생성 (catalog_index.json)
        logger.info("Step 3: 카탈로그 구조화 인덱스 생성...")
        catalog_stats = self._build_catalog_index()
        self.report_data["catalog_index"] = catalog_stats

        # 5. 최종 통계
        final_stats = self.vector_store.get_stats()
        self.report_data["final_stats"] = final_stats
        self.report_data["status"] = "completed"

        # 6. 리포트 저장
        self._save_report()

        logger.info("=" * 50)
        logger.info("Phase 1 파이프라인 완료")
        logger.info(f"최종 통계: {final_stats}")
        logger.info("=" * 50)

        return self.report_data

    def _build_catalog_index(self) -> dict:
        """data_catalog XLSX → catalog_index.json 생성"""
        catalog_dir = settings.paths.data_catalog_dir
        if not catalog_dir.exists():
            logger.warning("data_catalog 디렉토리 없음 — catalog_index 생성 스킵")
            return {"status": "skipped", "reason": "디렉토리 없음"}

        parser = CatalogParser()
        catalog_index = parser.parse_directory(catalog_dir)

        if not catalog_index:
            logger.warning("파싱된 카탈로그 없음 — XLSX 파일을 확인하세요")
            return {"status": "empty", "institutions": 0, "tables": 0}

        parser.save_catalog_index(catalog_index, settings.paths.catalog_index_path)

        total_tables = sum(len(v) for v in catalog_index.values())
        total_cols = sum(
            len(t.get("columns", []))
            for v in catalog_index.values()
            for t in v
        )
        stats = {
            "status": "completed",
            "path": str(settings.paths.catalog_index_path),
            "institutions": len(catalog_index),
            "tables": total_tables,
            "columns": total_cols,
        }
        logger.info(
            f"catalog_index 생성 완료: "
            f"{stats['institutions']}개 기관, {stats['tables']}개 테이블, {stats['columns']}개 컬럼"
        )
        return stats

    def _save_report(self) -> Path:
        """리포트 저장"""
        settings.paths.reports_dir.mkdir(parents=True, exist_ok=True)
        report_file = settings.paths.reports_dir / f"phase1_report_{datetime.now():%Y%m%d_%H%M%S}.json"

        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(self.report_data, f, ensure_ascii=False, indent=2)

        logger.info(f"리포트 저장됨: {report_file}")
        return report_file

    def test_search(self, query: str, n_results: int = 5) -> list[dict]:
        """검색 테스트"""
        logger.info(f"검색 테스트: '{query}'")

        stats = self.vector_store.get_stats()
        total_chunks = sum(stats.values())

        if total_chunks == 0:
            logger.warning("벡터 저장소가 비어있습니다. 먼저 파이프라인을 실행하세요.")
            return []

        results = self.vector_store.search(query, n_results=n_results)

        print(f"\n검색 쿼리: '{query}'")
        print(f"검색 결과 ({len(results)}건):")
        print("-" * 50)

        for i, result in enumerate(results, 1):
            print(f"\n[{i}] 유사도: {result['score']:.4f}")
            print(f"    컬렉션: {result['collection']}")
            print(f"    출처: {result['metadata'].get('file_name', 'N/A')}")
            if result['metadata'].get('institution_name'):
                print(f"    기관: {result['metadata']['institution_name']}")
            content_preview = result['content'][:200].encode('utf-8', errors='replace').decode('utf-8')
            print(f"    내용: {content_preview}...")

        return results


def main():
    """CLI 진입점"""
    parser = argparse.ArgumentParser(description="Phase 1: RAG 지식 기반 구축")
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="기존 벡터 DB를 삭제하고 재구축"
    )
    parser.add_argument(
        "--test-search",
        type=str,
        help="검색 테스트 쿼리"
    )
    parser.add_argument(
        "--n-results",
        type=int,
        default=5,
        help="검색 결과 수 (기본값: 5)"
    )

    args = parser.parse_args()

    pipeline = Phase1Pipeline(rebuild=args.rebuild)

    if args.test_search:
        # 검색 테스트만 실행
        pipeline.test_search(args.test_search, n_results=args.n_results)
    else:
        # 전체 파이프라인 실행
        report = pipeline.run()

        # 완료 후 테스트 검색
        print("\n기본 검색 테스트 수행 중...")
        pipeline.test_search("데이터 분석 협력", n_results=3)


if __name__ == "__main__":
    main()
