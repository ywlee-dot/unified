"""
LLM Provider 추상화 레이어.
Claude, OpenAI, Gemini 등 다양한 LLM API를 동일 인터페이스로 사용.
"""

from abc import ABC, abstractmethod
import os


class LLMProvider(ABC):
    """LLM API 추상 인터페이스."""

    @abstractmethod
    def evaluate(self, system_prompt: str, user_prompt: str) -> str:
        """시스템 프롬프트와 사용자 프롬프트를 받아 응답을 반환."""
        ...

    @abstractmethod
    def name(self) -> str:
        """프로바이더 이름 반환."""
        ...


class ClaudeProvider(LLMProvider):
    def __init__(self, api_key: str | None = None, model: str = "claude-sonnet-4-20250514"):
        import anthropic
        self.client = anthropic.Anthropic(api_key=api_key or os.getenv("ANTHROPIC_API_KEY"))
        self.model = model

    def evaluate(self, system_prompt: str, user_prompt: str) -> str:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return response.content[0].text

    def name(self) -> str:
        return f"Claude ({self.model})"


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str | None = None, model: str = "gpt-4o"):
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))
        self.model = model

    def evaluate(self, system_prompt: str, user_prompt: str) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=4096,
        )
        return response.choices[0].message.content

    def name(self) -> str:
        return f"OpenAI ({self.model})"


class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str | None = None, model: str = "gemini-2.5-flash"):
        from google import genai
        self.client = genai.Client(api_key=api_key or os.getenv("GEMINI_API_KEY"))
        self.model = model

    def evaluate(self, system_prompt: str, user_prompt: str) -> str:
        response = self.client.models.generate_content(
            model=self.model,
            contents=user_prompt,
            config={"system_instruction": system_prompt, "max_output_tokens": 4096},
        )
        return response.text

    def name(self) -> str:
        return f"Gemini ({self.model})"


PROVIDERS = {
    "claude": ClaudeProvider,
    "openai": OpenAIProvider,
    "gemini": GeminiProvider,
}


def get_provider(name: str = "claude", **kwargs) -> LLMProvider:
    """이름으로 프로바이더 인스턴스를 생성."""
    if name not in PROVIDERS:
        raise ValueError(f"지원하지 않는 프로바이더: {name}. 사용 가능: {list(PROVIDERS.keys())}")
    return PROVIDERS[name](**kwargs)
