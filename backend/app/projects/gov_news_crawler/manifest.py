from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="gov-news-crawler",
    name="정부 뉴스 크롤링",
    description="정부 기관 및 공공 뉴스를 자동으로 수집하고 분석",
    version="1.0.0",
    project_type="standard",
    icon="newspaper",
    color="#10B981",
    enabled=True,
    router_module="app.projects.gov_news_crawler.router",
)
