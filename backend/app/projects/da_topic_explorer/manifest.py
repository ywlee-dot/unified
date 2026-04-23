from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="da-topic-explorer",
    name="공유데이터 분석주제 탐색",
    description="기관 프로파일과 데이터 카탈로그를 AI가 분석하여 기관 간 협력 가능한 분석 주제를 도출하고 계획서를 자동 생성",
    version="0.5.0",
    project_type="standard",
    icon="compass",
    color="#6366F1",
    enabled=True,
    router_module="app.projects.da_topic_explorer.router",
)
