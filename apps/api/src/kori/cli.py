"""The `kori` command line. Users are created here because there is no signup endpoint."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

import typer
from sqlalchemy.orm import Session

from kori.config import get_settings
from kori.db.session import make_engine, make_sessionmaker
from kori.users.service import create_user

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
