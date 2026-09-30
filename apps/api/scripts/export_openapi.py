"""Dump the API's OpenAPI spec to a file without starting a server."""

import json
import sys
from pathlib import Path

from kori.main import create_app


def main() -> None:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("openapi.json")
    spec = create_app().openapi()
    target.write_text(json.dumps(spec, indent=2, sort_keys=True) + "\n")


if __name__ == "__main__":
    main()
