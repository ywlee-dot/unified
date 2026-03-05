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
