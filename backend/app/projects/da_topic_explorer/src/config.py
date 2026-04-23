"""설정 관리 모듈"""

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings


class PathConfig(BaseSettings):
    """경로 설정"""
    base_dir: Path = Field(default_factory=lambda: Path(__file__).parent.parent)

    @property
    def input_dir(self) -> Path:
        return self.base_dir / "input"

    @property
    def institutions_dir(self) -> Path:
        return self.input_dir / "institutions"

    @property
    def data_catalog_dir(self) -> Path:
        return self.input_dir / "data_catalog"

    @property
    def analysis_cases_dir(self) -> Path:
        return self.input_dir / "analysis_cases"

    @property
    def db_dir(self) -> Path:
        return self.base_dir / "db" / "chroma_db"

    @property
    def output_dir(self) -> Path:
        return self.base_dir / "output"

    @property
    def reports_dir(self) -> Path:
        return self.output_dir / "reports"

    @property
    def logs_dir(self) -> Path:
        return self.output_dir / "logs"

    @property
    def catalog_index_path(self) -> Path:
        """Phase 1에서 생성되는 구조화 카탈로그 JSON 경로"""
        return self.output_dir / "catalog_index.json"


class EmbeddingConfig(BaseSettings):
    """임베딩 모델 설정"""
    model_name: str = "intfloat/multilingual-e5-large"
    device: Literal["cpu", "cuda", "mps"] = "cpu"
    normalize_embeddings: bool = True
    query_prefix: str = "query: "
    passage_prefix: str = "passage: "


class ChunkingConfig(BaseSettings):
    """청킹 설정"""
    chunk_size: int = 500
    chunk_overlap: int = 100
    separators: list[str] = Field(default=["\n\n", "\n", ".", "。", " ", ""])


class ChromaDBConfig(BaseSettings):
    """ChromaDB 설정"""
    collection_prefix: str = "phase1"

    @property
    def institutions_collection(self) -> str:
        return f"{self.collection_prefix}_institutions"

    @property
    def data_catalog_collection(self) -> str:
        return f"{self.collection_prefix}_data_catalog"

    @property
    def analysis_cases_collection(self) -> str:
        return f"{self.collection_prefix}_analysis_cases"


class Settings(BaseSettings):
    """전체 설정"""
    paths: PathConfig = Field(default_factory=PathConfig)
    embedding: EmbeddingConfig = Field(default_factory=EmbeddingConfig)
    chunking: ChunkingConfig = Field(default_factory=ChunkingConfig)
    chromadb: ChromaDBConfig = Field(default_factory=ChromaDBConfig)

    class Config:
        env_prefix = "ANALYSIS_"


# 전역 설정 인스턴스
settings = Settings()
