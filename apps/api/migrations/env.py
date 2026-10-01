from alembic import context
from sqlalchemy import create_engine

from kori.config import get_settings
from kori.db.base import Base

config = context.config
# Import every model module here so autogenerate can see its tables.
target_metadata = Base.metadata


def _url() -> str:
    # Tests set `url` on the Alembic config to target the test database.
    return config.attributes.get("url") or get_settings().database_url


def run_migrations_offline() -> None:
    context.configure(url=_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(_url())
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
