"""URL and title deduplication utilities."""

import hashlib
import re
from urllib.parse import urlparse, urlunparse

from .config import TITLE_SIMILARITY_THRESHOLD


def normalize_url(url: str) -> str:
    """Remove fragment, strip trailing slash, lowercase."""
    parsed = urlparse(url.lower())
    normalized = parsed._replace(fragment="")
    path = normalized.path.rstrip("/")
    normalized = normalized._replace(path=path)
    return urlunparse(normalized)


def generate_url_hash(url: str) -> str:
    """Return SHA-256 hex digest of the normalized URL."""
    normalized = normalize_url(url)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def levenshtein_distance(s1: str, s2: str) -> int:
    """Standard DP edit-distance algorithm."""
    m, n = len(s1), len(s2)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev = dp[0]
        dp[0] = i
        for j in range(1, n + 1):
            temp = dp[j]
            if s1[i - 1] == s2[j - 1]:
                dp[j] = prev
            else:
                dp[j] = 1 + min(prev, dp[j], dp[j - 1])
            prev = temp
    return dp[n]


def calculate_similarity(s1: str, s2: str) -> float:
    """Return 1 - distance/max_length.  Returns 1.0 for two empty strings."""
    max_len = max(len(s1), len(s2))
    if max_len == 0:
        return 1.0
    return 1.0 - levenshtein_distance(s1, s2) / max_len


def normalize_title(title: str) -> str:
    """Lowercase and remove punctuation while keeping Korean characters."""
    lowered = title.lower()
    # Keep alphanumeric, spaces, and Korean Unicode ranges
    cleaned = re.sub(
        r"[^\w\s\uAC00-\uD7A3\u3131-\u3163\u1100-\u11FF]",
        "",
        lowered,
    )
    return cleaned.strip()


def are_titles_similar(
    t1: str,
    t2: str,
    threshold: float = TITLE_SIMILARITY_THRESHOLD,
) -> bool:
    """Return True if the two titles are similar enough to be considered duplicates."""
    return calculate_similarity(normalize_title(t1), normalize_title(t2)) >= threshold
