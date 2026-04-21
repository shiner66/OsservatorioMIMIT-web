from __future__ import annotations

import argparse
import logging
import os
import socket
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

    @app.on_event("startup")
    async def _warmup_csv() -> None:
        # Scarica i CSV MIMIT in background: la prima ricerca non deve
        # bloccarsi su download di ~60 MB.
        csv_fetcher.schedule_refresh()

    @app.get("/api/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        snap = csv_fetcher.get_snapshot()
        st = csv_fetcher.get_status()
        return HealthResponse(
            status="ok",
            csvLastUpdate=snap.last_update.isoformat() if snap.last_update else None,
            stationsLoaded=len(snap.stations),
            csvStatus=st["status"],
            csvMessage=st["message"],
        )

    static_dir = _static_dir()
    index = static_dir / "index.html"

    assets_dir = static_dir / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", include_in_schema=False, response_model=None)
    async def root() -> FileResponse | JSONResponse:
        if index.exists():
            return FileResponse(index)
        return JSONResponse(
            {
                "status": "backend_only",
                "message": "Frontend non buildato. Esegui `bash build.sh` oppure `npm run dev` in frontend/.",
            }
        )

    @app.get("/{full_path:path}", include_in_schema=False, response_model=None)
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


def _lan_addresses() -> list[str]:
    """Restituisce gli IPv4 non-loopback raggiungibili sulla LAN."""
    addrs: set[str] = set()
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, family=socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127."):
                addrs.add(ip)
    except socket.gaierror:
        pass
    # Fallback: connessione UDP fittizia per scoprire l'IP "di uscita".
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("8.8.8.8", 80))
            addrs.add(s.getsockname()[0])
        finally:
            s.close()
    except OSError:
        pass
    return sorted(addrs)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="carburanti",
        description="Osservaprezzi Carburanti — server locale + UI web",
    )
    parser.add_argument(
        "--host",
        default=os.environ.get("HOST"),
        help="Indirizzo di bind esplicito (es. 192.168.1.10). Default: 0.0.0.0 (tutte le interfacce).",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PORT", "8765")),
        help="Porta TCP (default: 8765)",
    )
    parser.add_argument(
        "--local-only",
        action="store_true",
        help="Bind solo su 127.0.0.1: il server sarà raggiungibile solo da questo PC.",
    )
    parser.add_argument(
        "--lan",
        action="store_true",
        help="Deprecato: oggi è il default. Mantenuto per compatibilità.",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Non aprire automaticamente il browser all'avvio.",
    )
    args = parser.parse_args(argv)

    if args.local_only:
        host = "127.0.0.1"
    elif args.host:
        host = args.host
    else:
        host = "0.0.0.0"
    port = args.port

    local_url = f"http://localhost:{port}"
    logger.info("Osservaprezzi Carburanti in ascolto su %s", local_url)
    if host != "127.0.0.1":
        ips = _lan_addresses()
        if ips:
            for ip in ips:
                logger.info("  LAN: http://%s:%d", ip, port)
        else:
            logger.info("  LAN: http://<tuo-ip>:%d (impossibile rilevare l'IP)", port)
        logger.info(
            "Se non riesci a connetterti da un altro dispositivo, controlla il firewall sulla porta %d.",
            port,
        )

    should_open = not args.no_browser and os.environ.get("CARBURANTI_OPEN_BROWSER", "1") == "1"
    if should_open:
        _open_browser(local_url)

    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
