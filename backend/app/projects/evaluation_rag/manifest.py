from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="evaluation-rag",
    name="평가편람",
    description="AI 기반 공공데이터 평가 - RAG와 Gemini를 활용한 평가편람 기반 자동 평가",
    version="1.0.0",
    project_type="standard",
    icon="clipboard-check",
    color="#7c3aed",
    enabled=True,
    router_module="app.projects.evaluation_rag.router",
)
