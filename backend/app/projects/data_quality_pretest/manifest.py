from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="data-quality-pretest",
    name="값진단 사전예외처리",
    description="값진단 사전예외처리 - n8n 워크플로우 연동",
    version="1.0.0",
    project_type="n8n",
    icon="workflow",
    color="#10B981",
    enabled=True,
    router_module="app.projects.data_quality_pretest.router",
    n8n_config={
        "n8n_account": 1,
        "webhook_path": "/webhook/data_quality_pretest",
        "workflows": [
            {"id": "data-quality-pretest-main", "name": "값진단 사전예외처리 실행", "trigger_type": "manual"},
        ],
    },
)
