from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="ai-case-report",
    name="AI 도입활용 사례 정성보고서 작성",
    description="AI 도입활용 사례 정성보고서 작성 프로젝트 - n8n 워크플로우 연동",
    version="1.0.0",
    project_type="n8n",
    icon="file-text",
    color="#F59E0B",
    enabled=True,
    router_module="app.projects.ai_case_report.router",
    n8n_config={
        "n8n_account": 1,
        "webhook_path": "/webhook/ai_case_report",
        "workflows": [
            {"id": "ai-case-report-main", "name": "AI 도입활용 사례 정성보고서 작성 실행", "trigger_type": "manual"},
        ],
    },
)
