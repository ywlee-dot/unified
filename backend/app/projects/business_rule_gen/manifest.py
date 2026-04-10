from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="business-rule-gen",
    name="업무규칙 자동 생성",
    description="컬럼정의서(Excel)를 업로드하면 AI가 데이터 품질 업무규칙을 자동 생성",
    version="1.0.0",
    project_type="n8n",
    icon="git-merge",
    color="#8B5CF6",
    enabled=True,
    router_module="app.projects.business_rule_gen.router",
    n8n_config={
        "n8n_account": 1,
        "webhook_base": "http://168.107.58.30",
        "webhook_path": "/webhook/business_rule_gen",
        "workflows": [
            {
                "id": "business-rule-gen-main",
                "name": "업무규칙 자동 생성 실행",
                "trigger_type": "manual",
            },
        ],
    },
)
