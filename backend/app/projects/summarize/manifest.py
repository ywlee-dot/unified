from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="summarize",
    name="텍스트 요약",
    description="n8n 워크플로우를 통해 텍스트를 요약합니다",
    version="1.0.0",
    project_type="n8n",
    icon="file-text",
    color="#8B5CF6",
    enabled=True,
    router_module="app.projects.summarize.router",
    n8n_config={
        "n8n_account": 1,
        "webhook_path": "/webhook/summarize",
        "workflows": [
            {"id": "summarize", "name": "텍스트 요약", "trigger_type": "manual"},
        ],
    },
)
