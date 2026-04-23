"""공공데이터 활용도 제고 정성보고서 Pydantic 스키마."""

from pydantic import BaseModel


class TriggerResponse(BaseModel):
    run_id: str
    status: str
    message: str


class ExecutionStatus(BaseModel):
    run_id: str
    workflow_id: str
    workflow_name: str
    status: str
    started_at: str | None = None
    finished_at: str | None = None
    result_data: dict | None = None
    download_url: str | None = None
    error_message: str | None = None
