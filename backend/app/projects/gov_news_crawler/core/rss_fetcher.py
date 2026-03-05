"""RSS feed fetcher using feedparser."""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any


def _strip_html(text: str) -> str:
    """Remove HTML tags from a string."""
    return re.sub(r"<[^>]+>", "", text or "").strip()


def _parse_date(value: Any) -> datetime | None:
    """Try to parse a date value from feedparser (struct_time or string)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    # feedparser gives time.struct_time via published_parsed / updated_parsed
    import time as _time

    if isinstance(value, _time.struct_time):
        try:
            ts = _time.mktime(value)
            return datetime.fromtimestamp(ts, tz=timezone.utc)
        except Exception:
            return None
    if isinstance(value, str):
        try:
            return parsedate_to_datetime(value)
        except Exception:
            return None
    return None


def _infer_source_type(url: str) -> str:
    """Return 'government' for Korean government domains, else 'news'."""
    if "gov.kr" in url or "go.kr" in url:
        return "government"
    return "news"


def _parse_feed(source_url: str, source_name: str) -> list[dict]:
    """Synchronous feedparser call — run via asyncio.to_thread."""
    import feedparser  # type: ignore

    feed = feedparser.parse(source_url)
    source_type = _infer_source_type(source_url)

    articles: list[dict] = []
    for entry in feed.entries:
        title = _strip_html(getattr(entry, "title", "") or "")
        link = getattr(entry, "link", "") or ""

        # Prefer full content over summary
        content = ""
        if hasattr(entry, "content") and entry.content:
            content = _strip_html(entry.content[0].get("value", ""))
        if not content:
            content = _strip_html(getattr(entry, "summary", "") or "")

        author = getattr(entry, "author", "") or ""

        # Date: use parsed struct_time when available
        published_at = _parse_date(
            getattr(entry, "published_parsed", None)
            or getattr(entry, "updated_parsed", None)
        )

        articles.append(
            {
                "title": title,
                "url": link,
                "content": content,
                "author": author,
                "published_at": published_at,
                "source_name": source_name,
                "source_type": source_type,
            }
        )

    return articles


class RSSFetcher:
    """Fetch and parse articles from an RSS/Atom feed."""

    async def fetch(self, source_url: str, source_name: str = "") -> list[dict]:
        """Return a list of article dicts from the given RSS feed URL."""
        return await asyncio.to_thread(_parse_feed, source_url, source_name)
