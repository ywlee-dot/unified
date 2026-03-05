from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="open-data-analyzer",
    name="개방 가능 여부 판단",
    description="엑셀 테이블 정의서를 업로드하면 LLM이 5단계로 공공데이터 개방 가능 여부를 판단",
    version="1.0.0",
    project_type="standard",
    icon="shield-check",
    color="#059669",
    enabled=True,
    router_module="app.projects.open_data_analyzer.router",
)
