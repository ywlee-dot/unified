from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="report-generator",
    name="리포트 생성기",
    description="n8n 워크플로우를 통해 자동 리포트 생성",
    version="1.0.0",
    project_type="n8n",
    icon="file-text",
    color="#10B981",
    enabled=True,
    router_module="app.projects.report_generator.router",
    n8n_config={
        "n8n_account": 2,
        "webhook_path": "/webhook/report-generator",
        "workflows": [
            {"id": "generate-daily", "name": "일간 리포트 생성", "trigger_type": "manual"},
            {"id": "generate-weekly", "name": "주간 리포트 생성", "trigger_type": "manual"},
        ],
    },
)
