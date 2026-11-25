import subprocess
import sys

CONFIGURE_MAPPERS_AFTER_IMPORTING_CLI = (
    "import kori.cli\n"
    "from sqlalchemy.orm import configure_mappers\n"
    "configure_mappers()\n"
    "from kori.db.base import Base\n"
    "Base.metadata.sorted_tables\n"
)


def test_cli_registers_every_model_so_foreign_keys_resolve() -> None:
    # A fresh interpreter, because other tests import the models and would hide the bug.
    result = subprocess.run(  # noqa: S603
        [sys.executable, "-c", CONFIGURE_MAPPERS_AFTER_IMPORTING_CLI],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr


def test_cli_knows_the_recurring_rules_table() -> None:
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import kori.cli\nfrom kori.db.base import Base\n"
            "assert 'recurring_rules' in Base.metadata.tables",
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
