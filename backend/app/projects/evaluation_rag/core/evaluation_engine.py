"""Evaluation engine using Gemini."""

import logging
from .gemini_client import GeminiClient
from .prompt_builder import PromptBuilder
from .result_parser import ResultParser, EvaluationResult, MultiItemEvaluationResult

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

    def evaluate_items(
        self,
        input_data: str,
        items: list[dict],
        category_ko: str | None = None,
    ) -> MultiItemEvaluationResult:
        """Evaluate input data against specific evaluation items (0-10 per item)."""
        logger.info(
            f"Starting item evaluation (items: {len(items)}, category: {category_ko or 'none'})"
        )

        if len(items) > 8:
            batch_size = 8
            batches = [items[i:i + batch_size] for i in range(0, len(items), batch_size)]
            logger.info(f"Splitting {len(items)} items into {len(batches)} batches")
            results = []
            for idx, batch in enumerate(batches):
                logger.info(f"Processing batch {idx + 1}/{len(batches)} ({len(batch)} items)")
                batch_result = self._evaluate_items_batch(batch, input_data, category_ko)
                results.append(batch_result)
            merged = self._merge_results(results)
            logger.info(
                f"Item evaluation completed. Total items: {len(merged.item_scores)}, "
                f"Scores: {[s.score for s in merged.item_scores]}"
            )
            return merged

        return self._evaluate_items_batch(items, input_data, category_ko)

    def _evaluate_items_batch(
        self,
        items: list[dict],
        input_data: str,
        category_ko: str | None,
    ) -> MultiItemEvaluationResult:
        try:
            prompt = self.prompt_builder.build_item_evaluation_prompt(
                input_data, items, category_ko=category_ko
            )
        except ValueError as e:
            logger.error(f"Failed to build item evaluation prompt: {e}")
            raise

        try:
            response_text = self.gemini_client.generate_content(
                prompt=prompt,
                temperature=0.1,
                max_tokens=8192,
                response_mime_type="application/json",
            )
        except Exception as e:
            logger.error(f"Failed to generate item evaluation: {e}")
            raise

        try:
            result = self.result_parser.parse_multi_item(response_text)
            logger.info(
                f"Item evaluation batch completed. Items: {len(result.item_scores)}, "
                f"Scores: {[s.score for s in result.item_scores]}"
            )
            return result
        except ValueError as e:
            logger.error(f"Failed to parse item evaluation result: {e}")
            raise

    def _merge_results(self, results: list[MultiItemEvaluationResult]) -> MultiItemEvaluationResult:
        all_scores = []
        for r in results:
            all_scores.extend(r.item_scores)
        combined_summary = " ".join(r.summary for r in results)
        return MultiItemEvaluationResult(summary=combined_summary, item_scores=all_scores)
