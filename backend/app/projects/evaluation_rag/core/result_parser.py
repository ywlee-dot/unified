"""Parser for Gemini evaluation results."""

import json
import logging
import re
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)


class ImprovementItem(BaseModel):
    """Individual improvement item."""

    category: str = Field(..., description="Category of improvement")
    issue: str = Field(..., description="Specific issue identified")
    recommendation: str = Field(..., description="Actionable recommendation")
    priority: str = Field(..., description="Priority level")

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        allowed = ["critical", "high", "medium", "low"]
        if v.lower() not in allowed:
            logger.warning(f"Invalid priority '{v}', defaulting to 'medium'")
            return "medium"
        return v.lower()


class EvaluationResult(BaseModel):
    """Structured evaluation result from Gemini."""

    summary: str = Field(..., description="Overall evaluation summary")
    issues: list[str] = Field(default_factory=list, description="List of issues found")
    improvements: list[ImprovementItem] = Field(
        default_factory=list, description="List of improvements"
    )
    score: int = Field(..., ge=0, le=100, description="Evaluation score (0-100)")


class ItemScore(BaseModel):
    """Individual item evaluation score."""

    item_id: str = Field(..., description="Evaluation item ID")
    item_name: str = Field(..., description="Evaluation item name")
    score: int = Field(..., ge=0, description="Item score (0 to max_score)")
    max_score: int = Field(default=10, description="Maximum possible score for this item")
    reasoning: str = Field(default="", description="Scoring rationale")
    issues: list[str] = Field(default_factory=list, description="Issues found")
    improvements: list[str] = Field(default_factory=list, description="Improvement suggestions")

    @field_validator("score")
    @classmethod
    def validate_score_range(cls, v: int, info) -> int:
        max_s = info.data.get("max_score", 10)
        if v > max_s:
            logger.warning(f"Score {v} exceeds max_score {max_s}, clamping")
            return max_s
        return v


class MultiItemEvaluationResult(BaseModel):
    """Structured result from multi-item evaluation."""

    summary: str = Field(..., description="Overall evaluation summary")
    item_scores: list[ItemScore] = Field(..., description="Per-item scores")


class ResultParser:
    """Parse and validate Gemini evaluation results."""

    def parse(self, gemini_response: str) -> EvaluationResult:
        logger.info("Starting to parse Gemini response")

        try:
            json_str = self._extract_json(gemini_response)
        except ValueError as e:
            logger.error(f"Failed to extract JSON: {e}")
            raise

        try:
            data = json.loads(json_str)
            logger.info(f"Successfully parsed JSON. Keys: {list(data.keys())}")
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            raise ValueError(f"Invalid JSON in response: {e}") from e

        required_fields = ["summary", "score"]
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            raise ValueError(f"Missing required fields in response: {', '.join(missing_fields)}")

        score = data.get("score", 0)
        if not isinstance(score, int) or not 0 <= score <= 100:
            raise ValueError(f"Invalid score: must be an integer between 0 and 100, got: {score}")

        try:
            result = EvaluationResult(**data)
            logger.info(
                f"Parsed evaluation result. Score: {result.score}, "
                f"Issues: {len(result.issues)}, Improvements: {len(result.improvements)}"
            )
            return result
        except Exception as e:
            logger.error(f"Failed to parse into Pydantic model: {e}", exc_info=True)
            raise ValueError(f"Failed to parse evaluation result: {e}") from e

    def parse_multi_item(self, gemini_response: str) -> MultiItemEvaluationResult:
        logger.info("Starting to parse multi-item Gemini response")

        try:
            json_str = self._extract_json(gemini_response)
        except ValueError as e:
            logger.error(f"Failed to extract JSON: {e}")
            raise

        try:
            data = json.loads(json_str)
            logger.info(f"Successfully parsed JSON. Keys: {list(data.keys())}")
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            raise ValueError(f"Invalid JSON in response: {e}") from e

        required_fields = ["summary", "item_scores"]
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            raise ValueError(f"Missing required fields in response: {', '.join(missing_fields)}")

        if not data["item_scores"]:
            raise ValueError("item_scores must not be empty")

        for item in data["item_scores"]:
            raw_score = item.get("score")
            max_s = item.get("max_score", 10)
            # Convert float scores to int (Gemini sometimes returns 7.5 etc.)
            if isinstance(raw_score, float):
                item["score"] = round(raw_score)
                raw_score = item["score"]
            if isinstance(raw_score, int) and not (0 <= raw_score <= max_s):
                clamped = max(0, min(max_s, raw_score))
                logger.warning(
                    f"Item '{item.get('item_id', '?')}' score {raw_score} out of range "
                    f"(max={max_s}), clamping to {clamped}"
                )
                item["score"] = clamped

        try:
            result = MultiItemEvaluationResult(**data)
            logger.info(
                f"Parsed multi-item evaluation result. Items: {len(result.item_scores)}"
            )
            return result
        except Exception as e:
            logger.error(f"Failed to parse into MultiItemEvaluationResult: {e}", exc_info=True)
            raise ValueError(f"Failed to parse multi-item evaluation result: {e}") from e

    def _extract_json(self, text: str) -> str:
        if not text or not text.strip():
            raise ValueError("Empty response from Gemini API")

        json_match = re.search(r"```json\s*\n(.*?)\n```", text, re.DOTALL)
        if json_match:
            return json_match.group(1).strip()

        code_match = re.search(r"```\s*\n(.*?)\n```", text, re.DOTALL)
        if code_match:
            potential_json = code_match.group(1).strip()
            if potential_json.startswith("{") and potential_json.endswith("}"):
                return potential_json

        first_brace = text.find("{")
        last_brace = text.rfind("}")
        if first_brace != -1 and last_brace != -1 and first_brace < last_brace:
            return text[first_brace:last_brace + 1]

        return text.strip()
