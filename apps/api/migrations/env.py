from alembic import context
from sqlalchemy import create_engine

from kori.auth import models as _auth  # noqa: F401
from kori.categories import models as _categories  # noqa: F401
from kori.config import get_settings
from kori.db.base import Base
from kori.payment_methods import models as _payment_methods  # noqa: F401
from kori.tags import models as _tags  # noqa: F401
from kori.transactions import models as _transactions  # noqa: F401
from kori.users import models as _users  # noqa: F401

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
