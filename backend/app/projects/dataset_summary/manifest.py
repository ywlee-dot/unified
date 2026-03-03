from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="dataset-summary",
    name="개방데이터 설명/키워드 자동생성",
    description="데이터셋 정의서(Excel/CSV)를 업로드하면 LLM이 키워드 8개와 설명문을 자동 생성",
    version="1.0.0",
    project_type="standard",
    icon="sparkles",
    color="#8B5CF6",
    enabled=True,
    router_module="app.projects.dataset_summary.router",
)
