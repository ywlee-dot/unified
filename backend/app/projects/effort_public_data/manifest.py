from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="effort-public-data",
    name="공유데이터 제공 노력",
    description="공유데이터 제공 노력 - n8n 워크플로우 연동",
    version="1.0.0",
    project_type="n8n",
    icon="database",
    color="#6366F1",
    enabled=True,
    router_module="app.projects.effort_public_data.router",
    n8n_config={
        "n8n_account": 1,
        "webhook_path": "/effort_public-data",
        "workflows": [
            {"id": "effort-public-data-main", "name": "공유데이터 제공 노력 실행", "trigger_type": "manual"},
        ],
    },
)
