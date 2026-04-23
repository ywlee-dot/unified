from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="survey-platform",
    name="설문조사 생성·분석",
    description="Excel 템플릿 기반 설문 생성, 웹 응답 수집, Gemini AI 분석 리포트 자동 생성",
    version="0.8.0",
    project_type="standard",
    icon="clipboard-list",
    color="#F59E0B",
    enabled=True,
    router_module="app.projects.survey_platform.router",
)
