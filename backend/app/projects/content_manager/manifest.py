from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="content-manager",
    name="콘텐츠 관리",
    description="콘텐츠 CRUD 및 발행 워크플로우 관리",
    version="1.0.0",
    project_type="standard",
    icon="file-text",
    color="#EC4899",
    enabled=True,
    router_module="app.projects.content_manager.router",
)
