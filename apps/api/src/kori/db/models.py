"""Imports every model module so SQLAlchemy can resolve foreign keys between them.

Entry points that don't load the API routers (the `kori` CLI) import this module. Without it a
table such as `recurring_rules` is unknown when another model refers to it.
"""

from kori.auth import models as _auth  # noqa: F401
from kori.budgets import models as _budgets  # noqa: F401
from kori.categories import models as _categories  # noqa: F401
from kori.jobs import models as _jobs  # noqa: F401
from kori.payment_methods import models as _payment_methods  # noqa: F401
from kori.recurring import models as _recurring  # noqa: F401
from kori.tags import models as _tags  # noqa: F401
from kori.transactions import models as _transactions  # noqa: F401
from kori.users import models as _users  # noqa: F401
