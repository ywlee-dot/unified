from pydantic import BaseModel


class TriggerResponse(BaseModel):
    success: bool
    data: dict


class RunStatusResponse(BaseModel):
    run_id: str
    workflow_id: str
    workflow_name: str
    status: str
    started_at: str | None = None
    finished_at: str | None = None
    result_data: dict | None = None
    download_url: str | None = None
    error_message: str | None = None
