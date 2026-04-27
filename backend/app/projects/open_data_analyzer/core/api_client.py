"""
Gemini API 클라이언트

모든 단계에서 사용되는 Gemini API 호출 및
응답 파싱 로직을 중앙에서 관리합니다.
"""

import json
import re
import time
from typing import Any, Dict

import requests

from .config import (
    GEMINI_BASE_URL,
    GEMINI_MODEL,
    GEMINI_TIMEOUT_SECONDS,
    GEMINI_MAX_RETRIES,
    GEMINI_RETRY_BACKOFF,
)


def call_gemini(
    prompt: str,
    api_key: str,
    model: str = GEMINI_MODEL,
    base_url: str = GEMINI_BASE_URL,
) -> Dict[str, Any]:
    url = f"{base_url.rstrip('/')}/models/{model}:generateContent"
    headers = {
        "x-goog-api-key": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.0,
            "topP": 0.1,
            "responseMimeType": "application/json",
        },
    }

    timeout = GEMINI_TIMEOUT_SECONDS
    max_retries = GEMINI_MAX_RETRIES
    backoff = GEMINI_RETRY_BACKOFF

    last_err: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            response = requests.post(
                url, headers=headers, json=payload, timeout=timeout
            )
            if response.status_code == 429:
                raise requests.exceptions.HTTPError(
                    "429 Too Many Requests", response=response
                )
            response.raise_for_status()
            data = response.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return parse_json_content(text)
        except requests.exceptions.ReadTimeout as exc:
            last_err = exc
            if attempt >= max_retries:
                break
            time.sleep(backoff * (attempt + 1))
        except requests.exceptions.HTTPError as exc:
            last_err = exc
            retry_after = None
            if exc.response is not None:
                retry_after = exc.response.headers.get("Retry-After")
            if attempt >= max_retries:
                break
            if retry_after:
                try:
                    time.sleep(float(retry_after))
                except ValueError:
                    time.sleep(backoff * (attempt + 1))
            else:
                time.sleep(backoff * (attempt + 1))
        except requests.exceptions.RequestException as exc:
            last_err = exc
            break

    if last_err:
        raise last_err
    raise RuntimeError("Gemini API 요청 실패")


def parse_json_content(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(text[start : end + 1])
