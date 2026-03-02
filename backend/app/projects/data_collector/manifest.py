from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="data-collector",
    name="데이터 수집기",
    description="외부 API 및 웹 소스에서 데이터를 수집하여 저장",
    version="1.0.0",
    project_type="standard",
    icon="database",
    color="#3B82F6",
    enabled=True,
    router_module="app.projects.data_collector.router",
)
