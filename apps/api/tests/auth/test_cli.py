from collections.abc import Iterator
from contextlib import contextmanager

import pytest
from sqlalchemy.orm import Session
from typer.testing import CliRunner

from kori import cli
from kori.auth import passwords
from kori.users.service import get_user_by_email

runner = CliRunner()


@pytest.fixture(autouse=True)
def _use_test_db(db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    @contextmanager
    def open_session() -> Iterator[Session]:
        yield db

    monkeypatch.setattr(cli, "open_session", open_session)


def test_create_user_prompts_for_password_twice(db: Session) -> None:
    result = runner.invoke(
        cli.app,
        ["create-user", "--email", "New@Example.com", "--name", "New"],
        input="s3cret-pass\ns3cret-pass\n",
    )
    assert result.exit_code == 0, result.output
    user = get_user_by_email(db, "new@example.com")
    assert user is not None
    assert user.display_name == "New"
    assert passwords.verify_password(user.password_hash, "s3cret-pass")
    assert "s3cret-pass" not in result.output


def test_create_user_has_no_password_option() -> None:
    result = runner.invoke(
        cli.app, ["create-user", "--email", "a@b.co", "--name", "A", "--password", "x"]
    )
    assert result.exit_code != 0


def test_create_user_reports_duplicates() -> None:
    args = ["create-user", "--email", "dup@example.com", "--name", "D"]
    runner.invoke(cli.app, args, input="pw-one-two\npw-one-two\n")
    again = runner.invoke(cli.app, args, input="pw-one-two\npw-one-two\n")
    assert again.exit_code == 1
