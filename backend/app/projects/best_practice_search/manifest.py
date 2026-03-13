from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="best-practice-search",
    name="민간 활용 우수사례 검색 서비스",
    description="민간 활용 우수사례 검색 서비스 프로젝트 - n8n 워크플로우 연동",
    version="1.0.0",
    project_type="n8n",
    icon="sparkles",
    color="#3182f6",
    enabled=True,
    router_module="app.projects.best_practice_search.router",
    n8n_config={
        "n8n_account": 1,
        "webhook_path": "/webhook/best_practice_search",
        "workflows": [
            {"id": "best-practice-search-main", "name": "민간 활용 우수사례 검색 서비스 실행", "trigger_type": "manual"},
        ],
    },
)
