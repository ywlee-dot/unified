from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="test1",
    name="테스트1",
    description="테스트1 프로젝트 - n8n 워크플로우 연동",
    version="1.0.0",
    project_type="n8n",
    icon="workflow",
    color="#10B981",
    enabled=True,
    router_module="app.projects.test1.router",
    n8n_config={
        "n8n_account": 2,
        "webhook_path": "/webhook/data_quality_pretest",
        "workflows": [
            {"id": "test1-main", "name": "테스트1 실행", "trigger_type": "manual"},
        ],
    },
)
