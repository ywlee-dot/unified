"""Evaluation engine using Gemini."""

import logging
from .gemini_client import GeminiClient
from .prompt_builder import PromptBuilder
from .result_parser import ResultParser, EvaluationResult

logger = logging.getLogger(__name__)


class EvaluationEngine:
    """Service for evaluating data using Gemini and RAG context."""

    def __init__(
        self,
        api_key: str,
        model_name: str = "gemini-2.5-flash",
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> None:
        self.gemini_client = GeminiClient(api_key=api_key, model_name=model_name)
        self.prompt_builder = PromptBuilder()
        self.result_parser = ResultParser()
        self.temperature = temperature
        self.max_tokens = max_tokens

        logger.info(f"Initialized EvaluationEngine with model: {model_name}")

    def evaluate(
        self, input_data: str, context: str, category: str | None = None
    ) -> EvaluationResult:
        logger.info(f"Starting evaluation process (category: {category or 'none'})")

        try:
            prompt = self.prompt_builder.build_evaluation_prompt(
                input_data, context, category=category
            )
        except ValueError as e:
            logger.error(f"Failed to build prompt: {e}")
            raise

        try:
            response_text = self.gemini_client.generate_content(
                prompt=prompt,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                response_mime_type="application/json",
            )
        except Exception as e:
            logger.error(f"Failed to generate evaluation: {e}")
            raise

        try:
            result = self.result_parser.parse(response_text)
            logger.info(
                f"Evaluation completed. Score: {result.score}, "
                f"Issues: {len(result.issues)}, Improvements: {len(result.improvements)}"
            )
            return result
        except ValueError as e:
            logger.error(f"Failed to parse evaluation result: {e}")
            raise
