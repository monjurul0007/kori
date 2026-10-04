"""The `kori` command line. Users are created here because there is no signup endpoint.

TODO(signup-policy): when public signup is wanted, decide who may register (invite only,
allow-list, or open) and add password rules (minimum length, breached-password check). Until
then this command is the only way to create a user and applies no password policy.
"""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

import typer
from sqlalchemy.orm import Session

from kori.config import get_settings
from kori.db.session import make_engine, make_sessionmaker
from kori.users.defaults import seed_defaults
from kori.users.service import create_user, get_user_by_email

app = typer.Typer(no_args_is_help=True, add_completion=False)


@contextmanager
def open_session() -> Iterator[Session]:
    engine = make_engine(get_settings().database_url)
    try:
        with make_sessionmaker(engine)() as session:
            yield session
            session.commit()
    finally:
        engine.dispose()


@app.callback()
def main() -> None:
    """Kori administration."""


@app.command("create-user")
def create_user_command(
    email: Annotated[str, typer.Option(help="Login email (stored lowercased)")],
    name: Annotated[str, typer.Option(help="Display name")],
) -> None:
    """Create a user. The password is prompted for twice, never passed as an argument."""
    password = typer.prompt("Password", hide_input=True, confirmation_prompt=True)
    with open_session() as db:
        try:
            user = create_user(db, email=email, display_name=name, password=password)
        except ValueError as exc:
            typer.echo(str(exc), err=True)
            raise typer.Exit(1) from exc
    typer.echo(f"Created user {user.email}")


@app.command("ensure-defaults")
def ensure_defaults_command(
    email: Annotated[str, typer.Option(help="Email of the existing user")],
) -> None:
    """Add any missing default categories and payment methods for an existing user."""
    with open_session() as db:
        user = get_user_by_email(db, email)
        if user is None:
            typer.echo(f"No user with email {email}", err=True)
            raise typer.Exit(1)
        seed_defaults(db, user)
    typer.echo(f"Defaults are in place for {user.email}")
