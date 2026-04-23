"""텍스트 전처리 모듈"""

import re
import unicodedata
from dataclasses import dataclass, field

from loguru import logger

from .config import settings
from .document_loader import Document


@dataclass
class TextChunk:
    """텍스트 청크 데이터 클래스"""
    content: str
    metadata: dict = field(default_factory=dict)
    chunk_index: int = 0

    @property
    def id(self) -> str:
        """청크 고유 ID 생성"""
        source = self.metadata.get("source", "unknown")
        return f"{source}_{self.chunk_index}"


class TextCleaner:
    """텍스트 정제 클래스"""

    @staticmethod
    def normalize_unicode(text: str) -> str:
        """유니코드 정규화 (NFC)"""
        return unicodedata.normalize("NFC", text)

    @staticmethod
    def clean_whitespace(text: str) -> str:
        """공백 정리"""
        # 연속된 공백을 단일 공백으로
        text = re.sub(r"[ \t]+", " ", text)
        # 연속된 줄바꿈을 최대 2개로
        text = re.sub(r"\n{3,}", "\n\n", text)
        # 줄 시작/끝 공백 제거
        lines = [line.strip() for line in text.split("\n")]
        return "\n".join(lines)

    @staticmethod
    def remove_special_chars(text: str) -> str:
        """특수 제어 문자 제거"""
        # 널 문자 및 기타 제어 문자 제거
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
        return text

    @staticmethod
    def clean_korean_spacing(text: str) -> str:
        """한국어 문장 부호 주변 공백 정리"""
        # 마침표, 쉼표 뒤 공백 확보
        text = re.sub(r"([.。,，])([^\s\d])", r"\1 \2", text)
        return text

    @classmethod
    def clean(cls, text: str) -> str:
        """전체 정제 파이프라인"""
        text = cls.remove_special_chars(text)
        text = cls.normalize_unicode(text)
        text = cls.clean_whitespace(text)
        text = cls.clean_korean_spacing(text)
        return text.strip()


class SemanticChunker:
    """의미 단위 청킹 클래스"""

    def __init__(
        self,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        separators: list[str] | None = None
    ):
        self.chunk_size = chunk_size or settings.chunking.chunk_size
        self.chunk_overlap = chunk_overlap or settings.chunking.chunk_overlap
        self.separators = separators or settings.chunking.separators

    def _split_text(self, text: str, separators: list[str]) -> list[str]:
        """재귀적 텍스트 분할"""
        if not separators:
            return [text]

        separator = separators[0]
        remaining_separators = separators[1:]

        if separator == "":
            # 문자 단위 분할
            return list(text)

        splits = text.split(separator)

        # 빈 문자열 제거하고 구분자 복원
        result = []
        for i, split in enumerate(splits):
            if split:
                # 마지막이 아니면 구분자 다시 붙이기
                if i < len(splits) - 1 and separator not in [" "]:
                    result.append(split + separator)
                else:
                    result.append(split)

        return result

    def _merge_splits(self, splits: list[str]) -> list[str]:
        """분할된 텍스트를 청크 크기에 맞게 병합"""
        chunks = []
        current_chunk = []
        current_length = 0

        for split in splits:
            split_length = len(split)

            if current_length + split_length > self.chunk_size:
                if current_chunk:
                    chunk_text = "".join(current_chunk)
                    chunks.append(chunk_text)

                    # 오버랩 처리
                    overlap_text = chunk_text[-self.chunk_overlap:] if self.chunk_overlap > 0 else ""
                    current_chunk = [overlap_text] if overlap_text else []
                    current_length = len(overlap_text)

            current_chunk.append(split)
            current_length += split_length

        # 마지막 청크 추가
        if current_chunk:
            chunks.append("".join(current_chunk))

        return chunks

    def chunk(self, text: str) -> list[str]:
        """텍스트를 청크로 분할"""
        if len(text) <= self.chunk_size:
            return [text]

        # 재귀적 분할
        splits = self._split_text(text, self.separators)

        # 더 작은 청크가 필요한 경우 재귀 분할
        final_splits = []
        for split in splits:
            if len(split) > self.chunk_size:
                # 다음 구분자로 재분할
                remaining_seps = self.separators[self.separators.index(self.separators[0]) + 1:]
                if remaining_seps:
                    sub_splits = self._split_text(split, remaining_seps)
                    final_splits.extend(sub_splits)
                else:
                    # 강제 분할
                    for i in range(0, len(split), self.chunk_size - self.chunk_overlap):
                        final_splits.append(split[i:i + self.chunk_size])
            else:
                final_splits.append(split)

        # 병합
        return self._merge_splits(final_splits)


class MetadataTagger:
    """메타데이터 태깅 클래스"""

    DOC_TYPE_MAPPING = {
        "institutions": "기관 프로파일",
        "data_catalog": "데이터 카탈로그",
        "analysis_cases": "분석 사례",
    }

    @classmethod
    def extract_institution_from_filename(cls, filename: str) -> str | None:
        """파일명에서 기관명 추출"""
        # 언더스코어로 분리된 첫 부분을 기관명으로 간주
        # 예: "산업인력공단_메타데이터.xlsx" -> "산업인력공단"
        parts = filename.split("_")
        if len(parts) > 1:
            return parts[0]
        return None

    @classmethod
    def tag(cls, document: Document) -> Document:
        """문서에 메타데이터 태깅"""
        # 문서 유형 한글 태그
        if document.doc_type:
            document.metadata["doc_type_kr"] = cls.DOC_TYPE_MAPPING.get(
                document.doc_type, document.doc_type
            )

        # 파일명에서 기관명 추출 (아직 없는 경우)
        if "institution_name" not in document.metadata:
            filename = document.metadata.get("file_name", "")
            institution = cls.extract_institution_from_filename(filename)
            if institution:
                document.metadata["institution_name"] = institution

        return document


class Preprocessor:
    """전처리 파이프라인"""

    def __init__(self):
        self.cleaner = TextCleaner()
        self.chunker = SemanticChunker()
        self.tagger = MetadataTagger()

    def process(self, document: Document) -> list[TextChunk]:
        """문서 전처리 및 청킹"""
        # 1. 메타데이터 태깅
        document = self.tagger.tag(document)

        # 2. 텍스트 정제
        cleaned_text = self.cleaner.clean(document.content)

        if not cleaned_text:
            logger.warning(f"정제 후 텍스트가 비어있음: {document.source}")
            return []

        # 3. 청킹
        chunks_text = self.chunker.chunk(cleaned_text)

        # 4. TextChunk 객체 생성
        chunks = []
        for idx, chunk_text in enumerate(chunks_text):
            chunk = TextChunk(
                content=chunk_text,
                metadata=document.metadata.copy(),
                chunk_index=idx
            )
            chunks.append(chunk)

        logger.debug(f"문서 처리 완료: {document.source} -> {len(chunks)} 청크")
        return chunks
