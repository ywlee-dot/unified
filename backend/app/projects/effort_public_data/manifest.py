from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="effort-public-data",
    name="공유데이터 제공 노력",
    project_type="n8n",
    router_module="app.projects.effort_public_data.router",
    n8n_config={
        "webhook_path": "/effort_public-data",
        "n8n_account": 2,
    },
)
