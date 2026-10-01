"""Dump the API's OpenAPI spec to a file without starting a server."""

import json
import sys
from pathlib import Path

from kori.config import Settings
from kori.main import create_app


def main() -> None:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("openapi.json")
    # Building the app never connects to the database, so a placeholder URL keeps the export
    # independent of the caller's environment (and therefore reproducible in CI).
    settings = Settings(database_url="postgresql+psycopg://kori:kori@localhost:5432/kori")
    spec = create_app(settings).openapi()
    target.write_text(json.dumps(spec, indent=2, sort_keys=True) + "\n")


if __name__ == "__main__":
    main()
