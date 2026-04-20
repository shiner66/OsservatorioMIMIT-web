from __future__ import annotations

import logging
import os
import sys
import threading
import time
import webbrowser
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .models import HealthResponse
from .routers import data, geo, search
from .services import csv_fetcher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("carburanti")


def _static_dir() -> Path:
    # PyInstaller: risorse estratte in sys._MEIPASS/static
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    candidate = base / "static"
    if candidate.is_dir():
        return candidate
    fallback = Path(__file__).resolve().parent / "static"
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback


def create_app() -> FastAPI:
    app = FastAPI(
        title="Osservaprezzi Carburanti",
        description="UI moderna sui dati MIMIT + API Osservaprezzi",
        version="1.0.0",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(data.router)
    app.include_router(search.router)
    app.include_router(geo.router)

    @app.get("/api/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        snap = csv_fetcher.get_snapshot()
        return HealthResponse(
            status="ok",
            csvLastUpdate=snap.last_update.isoformat() if snap.last_update else None,
            stationsLoaded=len(snap.stations),
        )

    static_dir = _static_dir()
    index = static_dir / "index.html"

    assets_dir = static_dir / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", include_in_schema=False)
    async def root() -> FileResponse | JSONResponse:
        if index.exists():
            return FileResponse(index)
        return JSONResponse(
            {
                "status": "backend_only",
                "message": "Frontend non buildato. Esegui `bash build.sh` oppure `npm run dev` in frontend/.",
            }
        )

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str) -> FileResponse | JSONResponse:
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "not found"}, status_code=404)
        asset = static_dir / full_path
        if asset.is_file():
            return FileResponse(asset)
        if index.exists():
            return FileResponse(index)
        return JSONResponse({"detail": "frontend non disponibile"}, status_code=404)

    return app


app = create_app()


def _open_browser(url: str, delay: float = 1.0) -> None:
    def _open() -> None:
        time.sleep(delay)
        try:
            webbrowser.open_new(url)
        except Exception:
            pass

    threading.Thread(target=_open, daemon=True).start()


def main() -> None:
    port = int(os.environ.get("PORT", "8765"))
    host = os.environ.get("HOST", "127.0.0.1")
    url = f"http://{host if host != '0.0.0.0' else 'localhost'}:{port}"
    logger.info("Osservaprezzi Carburanti in ascolto su %s", url)
    if os.environ.get("CARBURANTI_OPEN_BROWSER", "1") == "1":
        _open_browser(url)
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
