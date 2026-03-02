"""Dynamic module loader for project plugins."""

from __future__ import annotations

import importlib
import logging

logger = logging.getLogger(__name__)


def load_module(module_path: str):
    """Dynamically import and return a module by dotted path."""
    try:
        return importlib.import_module(module_path)
    except ImportError:
        logger.exception("Failed to load module: %s", module_path)
        return None
