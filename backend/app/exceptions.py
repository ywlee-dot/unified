"""Common exception handlers for the FastAPI application."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class ProjectNotFoundError(Exception):
    """Raised when a project resource is not found."""

    def __init__(self, resource: str, resource_id: str):
        self.resource = resource
        self.resource_id = resource_id
        super().__init__(f"{resource} not found: {resource_id}")


class ProjectValidationError(Exception):
    """Raised when project input validation fails."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers on the FastAPI app."""

    @app.exception_handler(ProjectNotFoundError)
    async def project_not_found_handler(
        _request: Request, exc: ProjectNotFoundError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "error": f"{exc.resource} not found",
                "detail": str(exc),
                "status_code": 404,
            },
        )

    @app.exception_handler(ProjectValidationError)
    async def project_validation_handler(
        _request: Request, exc: ProjectValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": "Validation error",
                "detail": exc.message,
                "status_code": 422,
            },
        )
