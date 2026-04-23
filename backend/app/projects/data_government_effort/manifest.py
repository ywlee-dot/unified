from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="data-government-effort",
    name="데이터기반행정 활성화 제고 노력",
    description="데이터기반행정 활성화 제고 노력 정성보고서를 증빙자료로부터 AI가 자동 작성 - n8n 워크플로우 연동",
    version="1.0.0",
    project_type="n8n",
    icon="landmark",
    color="#7C3AED",
    enabled=True,
    router_module="app.projects.data_government_effort.router",
    n8n_config={
        "n8n_account": 1,
        "webhook_base": "http://168.107.58.30",
        "webhook_path": "/webhook/data-government-effort",
        "workflows": [
            {
                "id": "data-government-effort-main",
                "name": "데이터기반행정 활성화 제고 노력 실행",
                "trigger_type": "manual",
            },
        ],
    },
)
