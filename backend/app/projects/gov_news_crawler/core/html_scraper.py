"""HTML scraper for government news pages using httpx + BeautifulSoup."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup


_DATE_PATTERNS = [
    (r"(\d{4})\.(\d{1,2})\.(\d{1,2})", "%Y.%m.%d"),
    (r"(\d{4})-(\d{1,2})-(\d{1,2})", "%Y-%m-%d"),
    (r"(\d{4})/(\d{1,2})/(\d{1,2})", "%Y/%m/%d"),
]


def _parse_korean_date(text: str) -> datetime | None:
    """Try to extract a date from a Korean-formatted date string."""
    if not text:
        return None
    text = text.strip()
    for pattern, fmt in _DATE_PATTERNS:
        m = re.search(pattern, text)
        if m:
            try:
                date_str = m.group(0).replace("/", ".").replace("-", ".")
                # Normalise to YYYY.MM.DD
                parts = re.split(r"[.\-/]", date_str)
                normalized = f"{parts[0]}.{int(parts[1]):02d}.{int(parts[2]):02d}"
                return datetime.strptime(normalized, "%Y.%m.%d").replace(
                    tzinfo=timezone.utc
                )
            except (ValueError, IndexError):
                continue
    return None


def _infer_source_type(url: str) -> str:
    if "gov.kr" in url or "go.kr" in url:
        return "government"
    return "news"


class HTMLScraper:
    """Scrape article listings from HTML pages using CSS selectors."""

    async def fetch(
        self, source_url: str, config: dict, source_name: str = ""
    ) -> list[dict]:
        """Fetch and parse articles from *source_url* using CSS selectors in *config*.

        Config keys (all optional except listSelector):
            listSelector   - CSS selector for each article row/card
            titleSelector  - CSS selector for title (relative to item)
            linkSelector   - CSS selector for link element (relative to item)
            dateSelector   - CSS selector for date element (relative to item)
            summarySelector - CSS selector for summary/excerpt (relative to item)
        """
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=15.0,
            headers={"User-Agent": "GovNewsCrawler/1.0"},
        ) as client:
            response = await client.get(source_url)
            response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        source_type = _infer_source_type(source_url)

        list_selector = config.get("listSelector", "")
        if not list_selector:
            return []

        items = soup.select(list_selector)
        articles: list[dict] = []

        for item in items:
            # Title
            title = ""
            title_sel = config.get("titleSelector", "")
            if title_sel:
                el = item.select_one(title_sel)
                title = el.get_text(strip=True) if el else ""

            # Link
            link = ""
            link_sel = config.get("linkSelector", "")
            if link_sel:
                el = item.select_one(link_sel)
                if el:
                    href = el.get("href", "")
                    link = urljoin(source_url, href) if href else ""
            # Fallback: first anchor in item
            if not link:
                a = item.find("a")
                if a:
                    href = a.get("href", "")
                    link = urljoin(source_url, href) if href else ""

            # Date
            published_at: datetime | None = None
            date_sel = config.get("dateSelector", "")
            if date_sel:
                el = item.select_one(date_sel)
                if el:
                    published_at = _parse_korean_date(el.get_text(strip=True))

            # Summary
            summary = ""
            summary_sel = config.get("summarySelector", "")
            if summary_sel:
                el = item.select_one(summary_sel)
                summary = el.get_text(strip=True) if el else ""

            if not title and not link:
                continue

            articles.append(
                {
                    "title": title,
                    "url": link,
                    "content": summary,
                    "author": "",
                    "published_at": published_at,
                    "source_name": source_name,
                    "source_type": source_type,
                }
            )

        return articles
