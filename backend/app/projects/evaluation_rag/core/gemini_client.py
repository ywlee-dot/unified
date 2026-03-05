"""Gemini API client with retry logic."""

import logging

from google import genai
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

logger = logging.getLogger(__name__)


class GeminiClient:
    """Client for interacting with Gemini API."""

    def __init__(
        self,
        api_key: str,
        model_name: str = "gemini-2.5-flash",
    ) -> None:
        if not api_key or not api_key.strip():
            raise ValueError("api_key cannot be empty")

        self.api_key = api_key
        self.model_name = model_name
        self.client = genai.Client(api_key=api_key)

        logger.info(f"Initialized GeminiClient with model: {model_name}")

    def generate_content(
        self,
        prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        max_retries: int = 3,
        response_mime_type: str | None = None,
    ) -> str:
        logger.info(f"Generating content with Gemini (model: {self.model_name}, mime_type: {response_mime_type})")

        @retry(
            stop=stop_after_attempt(max_retries),
            wait=wait_exponential(multiplier=1, min=2, max=10),
            retry=retry_if_exception_type(Exception),
            reraise=True,
        )
        def _generate_with_retry():
            try:
                config = {
                    "temperature": temperature,
                    "max_output_tokens": max_tokens,
                }

                if response_mime_type:
                    config["response_mime_type"] = response_mime_type

                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config=config,
                )

                if not response.text or not response.text.strip():
                    raise ValueError(f"Received empty response from Gemini API.")

                return response.text

            except Exception as e:
                logger.error(f"Gemini API error: {e}", exc_info=True)
                raise

        try:
            result = _generate_with_retry()
            logger.info(f"Successfully generated content from Gemini ({len(result)} chars)")
            return result
        except Exception as e:
            logger.error(f"Failed to generate content after {max_retries} retries: {e}")
            raise
