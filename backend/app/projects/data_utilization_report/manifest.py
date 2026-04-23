from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="data-utilization-report",
    name="공공데이터 활용도 제고 정성보고서",
    description="공공데이터 평가 1-4-3 활용지원 지표 정성보고서를 PDF 증빙자료로부터 AI가 자동 작성",
    version="1.0.0",
    project_type="n8n",
    icon="bar-chart-3",
    color="#059669",
    enabled=True,
    router_module="app.projects.data_utilization_report.router",
    n8n_config={
        "n8n_account": 1,
        "webhook_base": "http://168.107.58.30",
        "webhook_path": "/webhook/data_utilization_report",
        "workflows": [
            {
                "id": "data-utilization-report-main",
                "name": "공공데이터 활용도 제고 정성보고서 작성",
                "trigger_type": "manual",
            },
        ],
    },
)
