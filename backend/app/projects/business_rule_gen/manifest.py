from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="business-rule-gen",
    name="업무규칙 자동 생성",
    description="업무규칙 자동 생성 프로젝트 - n8n 워크플로우 연동",
    version="1.0.0",
    project_type="n8n",
    icon="git-merge",
    color="#8B5CF6",
    enabled=True,
    router_module="app.projects.business_rule_gen.router",
    n8n_config={
        "n8n_account": 1,
        "webhook_path": "/webhook/business_rule_gen",
        "workflows": [
            {"id": "business-rule-gen-main", "name": "업무규칙 자동 생성 실행", "trigger_type": "manual"},
        ],
    },
)
