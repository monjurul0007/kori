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

from kori.config import Env, get_settings
from kori.db.session import make_engine, make_sessionmaker
from kori.seed.run import seed
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


@app.command("seed")
def seed_command(
    email: Annotated[str, typer.Option(help="Demo user's email")] = "demo@kori.local",
    months: Annotated[int, typer.Option(help="Calendar months of data, ending this month")] = 6,
    seed_value: Annotated[int, typer.Option("--seed", help="Random seed")] = 42,
    reset: Annotated[bool, typer.Option(help="Delete the user's transactions first")] = False,
    i_know_this_is_prod: Annotated[
        bool, typer.Option("--i-know-this-is-prod", help="Allow seeding when KORI_ENV=production")
    ] = False,
) -> None:
    """Fill a demo user with deterministic fake spending, including 3 planted anomalies."""
    if get_settings().env is Env.PRODUCTION and not i_know_this_is_prod:
        typer.echo("Refusing to seed demo data when KORI_ENV=production", err=True)
        raise typer.Exit(1)
    with open_session() as db:
        password = None
        if get_user_by_email(db, email) is None:
            password = typer.prompt(
                "Password for the new demo user", hide_input=True, confirmation_prompt=True
            )
        try:
            result = seed(
                db, email=email, password=password, months=months, seed=seed_value, reset=reset
            )
        except ValueError as exc:
            typer.echo(str(exc), err=True)
            raise typer.Exit(1) from exc
    typer.echo(f"Seeded {result.transactions} transactions for {result.user.email}")
