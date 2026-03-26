from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="bid-monitor",
    name="입찰공고 모니터링",
    description="나라장터 입찰공고를 자동 모니터링하고 키워드 매칭 시 Discord 알림 전송",
    version="1.0.0",
    project_type="standard",
    icon="bell-alert",
    color="#6366F1",
    enabled=True,
    router_module="app.projects.bid_monitor.router",
)
