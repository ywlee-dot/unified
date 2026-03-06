"""SQLAlchemy models for evaluation-rag project."""

from sqlalchemy import Float, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models.base import BaseEntity


class EvaluationRagModel(BaseEntity):
    """Evaluation result stored in database."""

    __tablename__ = "evaluation_rag_evaluations"

    input_data: Mapped[str] = mapped_column(Text, nullable=False)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    context: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    issues: Mapped[dict | None] = mapped_column(JSON, default=[])
    improvements: Mapped[dict | None] = mapped_column(JSON, default=[])
    item_scores: Mapped[list | None] = mapped_column(JSON, default=[])
    max_possible_score: Mapped[float | None] = mapped_column(Float, nullable=True)
