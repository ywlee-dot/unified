import asyncio
import importlib
import logging
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import settings
from app.shared.models.base import Base
from app.shared.models.n8n_execution import N8nExecutionModel  # noqa: F401
from app.shared.models.user import User  # noqa: F401

logger = logging.getLogger("alembic.env")

# Auto-discover project models
projects_dir = Path(__file__).resolve().parent.parent / "app" / "projects"
if projects_dir.is_dir():
    for project_path in sorted(projects_dir.iterdir()):
        if project_path.is_dir() and (project_path / "models.py").exists():
            module_name = f"app.projects.{project_path.name}.models"
            try:
                importlib.import_module(module_name)
            except Exception as e:
                logger.warning("Failed to import %s: %s", module_name, e)

# Alembic Config object
config = context.config

# Set the sqlalchemy url from app settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# SQLAlchemy MetaData for autogenerate support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async engine."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
