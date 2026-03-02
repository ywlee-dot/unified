"""Shared utility functions."""

import math


def paginate_list(items: list, page: int = 1, page_size: int = 20) -> dict:
    """Paginate a list of items and return pagination metadata."""
    total = len(items)
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "items": items[start:end],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }
