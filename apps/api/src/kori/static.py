"""Serve the built web app (SPA) from the same process as the API.

Only active when `KORI_STATIC_DIR` points at a directory (the production image sets it).
"""

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, Response

IMMUTABLE = "public, max-age=31536000, immutable"
NO_CACHE = "no-cache"


def register_static(app: FastAPI, static_dir: str | None) -> None:
    """Register last: the catch-all must come after every API route."""
    if not static_dir:
        return
    root = Path(static_dir).resolve()
    index = root / "index.html"
    if not index.is_file():
        raise RuntimeError(f"KORI_STATIC_DIR has no index.html: {root}")

    @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    def serve_web(path: str, request: Request) -> Response:
        # Unknown /api/* stays a 404 problem+json (via the shared HTTPException handler).
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404)
        candidate = (root / path).resolve()
        if candidate.is_file() and candidate.is_relative_to(root) and candidate != index:
            # Vite fingerprints everything in assets/, so it never changes under the same name.
            immutable = candidate.is_relative_to(root / "assets")
            return FileResponse(
                candidate, headers={"Cache-Control": IMMUTABLE if immutable else NO_CACHE}
            )
        # A missing file with an extension is a real 404; only app routes fall back to the SPA.
        if "text/html" in request.headers.get("accept", "") and "." not in Path(path).name:
            return FileResponse(index, headers={"Cache-Control": NO_CACHE})
        raise HTTPException(status_code=404)
