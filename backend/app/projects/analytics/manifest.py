from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="analytics",
    name="분석 대시보드",
    description="수집된 데이터를 시각화하고 분석 리포트 제공",
    version="1.0.0",
    project_type="standard",
    icon="bar-chart-2",
    color="#8B5CF6",
    enabled=True,
    router_module="app.projects.analytics.router",
)
