from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="notifications",
    name="알림 서비스",
    description="다양한 채널(이메일, SMS, 웹훅)로 알림 발송 및 관리",
    version="1.0.0",
    project_type="standard",
    icon="bell",
    color="#F59E0B",
    enabled=True,
    router_module="app.projects.notifications.router",
)
