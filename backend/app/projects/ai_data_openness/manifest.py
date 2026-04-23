from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="ai-data-openness",
    name="AI 친화·고가치 데이터 개방 보고서",
    description="개방 데이터 목록(Excel)을 업로드하면 AI가 친화·고가치 데이터를 선정하고 첨부2 보고서를 자동 생성",
    version="1.0.0",
    project_type="standard",
    icon="file-search",
    color="#0EA5E9",
    enabled=True,
    router_module="app.projects.ai_data_openness.router",
)
