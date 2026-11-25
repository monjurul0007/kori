import subprocess
import sys


def run_in_fresh_interpreter(code: str) -> subprocess.CompletedProcess[str]:
    # A fresh interpreter, because other tests import the models and would hide the bug.
    return subprocess.run(  # noqa: S603
        [sys.executable, "-c", code],
        capture_output=True,
        text=True,
        check=False,
    )


def test_cli_registers_every_model_so_foreign_keys_resolve() -> None:
    result = run_in_fresh_interpreter(
        "import kori.cli\n"
        "from sqlalchemy.orm import configure_mappers\n"
        "configure_mappers()\n"
        "from kori.db.base import Base\n"
        "Base.metadata.sorted_tables\n"
    )

    assert result.returncode == 0, result.stderr


def test_cli_knows_the_recurring_rules_table() -> None:
    result = run_in_fresh_interpreter(
        "import kori.cli\n"
        "from kori.db.base import Base\n"
        "assert 'recurring_rules' in Base.metadata.tables\n"
    )

    assert result.returncode == 0, result.stderr
