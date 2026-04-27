"""Backward-compatible re-export.

The execution record is now generalized in ``process_execution`` and used
across both n8n-driven and in-process services.
"""

from app.shared.models.process_execution import (
    N8nExecutionModel,
    ProcessExecutionModel,
)

__all__ = ["N8nExecutionModel", "ProcessExecutionModel"]
