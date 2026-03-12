from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="data-pipeline",
    name="데이터 파이프라인",
    description="n8n 워크플로우를 통해 데이터 ETL 파이프라인 실행",
    version="1.0.0",
    project_type="n8n",
    icon="git-merge",
    color="#6366F1",
    enabled=True,
    router_module="app.projects.data_pipeline.router",
    n8n_config={
        "n8n_account": 1,
        "webhook_path": "/webhook/data-pipeline",
        "workflows": [
            {"id": "etl-daily", "name": "일간 ETL 파이프라인", "trigger_type": "scheduled"},
            {"id": "sync-external", "name": "외부 DB 동기화", "trigger_type": "manual"},
            {"id": "data-cleanup", "name": "데이터 정리", "trigger_type": "manual"},
        ],
    },
)
