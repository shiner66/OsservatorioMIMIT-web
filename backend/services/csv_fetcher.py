from __future__ import annotations

import asyncio
import csv
import io
import logging
import math
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx
import pandas as pd


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))

logger = logging.getLogger(__name__)

ANAGRAFICA_URL = "https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv"
PREZZI_URL = "https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv"
MEDIE_URL = "https://www.mimit.gov.it/images/stories/carburanti/MediaRegionaleStradale.csv"

CACHE_DIR = Path(os.environ.get("CARBURANTI_CACHE", Path.home() / ".carburanti" / "cache"))
CSV_TTL_SECONDS = 60 * 60  # 1h
USER_AGENT = "OsservaprezziWeb/1.0 (+https://github.com/shiner66/osservatoriomimit-web)"


@dataclass
class StationRecord:
    id: int
    gestore: Optional[str]
    bandiera: Optional[str]
    tipo: Optional[str]
    nome: Optional[str]
    indirizzo: Optional[str]
    comune: Optional[str]
    provincia: Optional[str]
    lat: float
    lng: float


@dataclass
class PriceRecord:
    id: int
    fuel: str
    price: float
    isSelf: bool
    dtComu: Optional[str]


@dataclass
class CsvSnapshot:
    stations: dict[int, StationRecord] = field(default_factory=dict)
    prices: list[PriceRecord] = field(default_factory=list)
    last_update: Optional[datetime] = None


_state: dict = {
    "snapshot": CsvSnapshot(),
    "fetched_at": 0.0,
    "refresh_task": None,
    # Stato per la UI: idle | downloading | parsing | ready | failed
    "status": "idle",
    "status_message": None,
}
_lock = asyncio.Lock()


def _set_status(status: str, message: Optional[str] = None) -> None:
    _state["status"] = status
    _state["status_message"] = message


def get_status() -> dict:
    return {"status": _state["status"], "message": _state["status_message"]}


def _to_float(value: object) -> Optional[float]:
    if value is None:
        return None
    s = str(value).strip().replace(",", ".")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _ensure_cache_dir() -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return CACHE_DIR


async def _download(url: str) -> bytes:
    headers = {"User-Agent": USER_AGENT, "Accept": "text/csv, */*"}
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, headers=headers) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content


def _cache_path(name: str) -> Path:
    return _ensure_cache_dir() / name


async def _fetch_to_disk(url: str, filename: str) -> bytes:
    path = _cache_path(filename)
    try:
        data = await _download(url)
        path.write_bytes(data)
        return data
    except Exception as exc:  # pragma: no cover - network issues
        logger.warning("download fallito %s: %s", url, exc)
        if path.exists():
            logger.info("uso copia cache su disco %s", path)
            return path.read_bytes()
        raise


def _parse_anagrafica(raw: bytes) -> dict[int, StationRecord]:
    text = raw.decode("utf-8", errors="replace")
    # La prima riga del CSV MIMIT spesso contiene una data di estrazione,
    # l'header vero inizia con "idImpianto".
    lines = text.splitlines()
    header_idx = 0
    for i, line in enumerate(lines[:5]):
        if line.lower().startswith("idimpianto"):
            header_idx = i
            break
    cleaned = "\n".join(lines[header_idx:])
    reader = csv.DictReader(io.StringIO(cleaned), delimiter="|")
    out: dict[int, StationRecord] = {}
    for row in reader:
        raw_id = (row.get("idImpianto") or "").strip()
        if not raw_id:
            continue
        try:
            sid = int(raw_id)
        except ValueError:
            continue
        lat = _to_float(row.get("Latitudine") or row.get("latitudine"))
        lng = _to_float(row.get("Longitudine") or row.get("longitudine"))
        if lat is None or lng is None:
            continue
        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            continue
        if lat == 0 and lng == 0:
            continue
        out[sid] = StationRecord(
            id=sid,
            gestore=(row.get("Gestore") or row.get("gestore") or "").strip() or None,
            bandiera=(row.get("Bandiera") or "").strip() or None,
            tipo=(row.get("Tipo Impianto") or row.get("Tipo") or "").strip() or None,
            nome=(row.get("Nome Impianto") or row.get("nome") or "").strip() or None,
            indirizzo=(row.get("Indirizzo") or row.get("indirizzo") or "").strip() or None,
            comune=(row.get("Comune") or row.get("comune") or "").strip() or None,
            provincia=(row.get("Provincia") or row.get("provincia") or "").strip() or None,
            lat=lat,
            lng=lng,
        )
    return out


def _parse_prezzi(raw: bytes) -> tuple[list[PriceRecord], Optional[datetime]]:
    text = raw.decode("utf-8", errors="replace")
    lines = text.splitlines()
    header_idx = 0
    for i, line in enumerate(lines[:5]):
        if line.lower().startswith("idimpianto"):
            header_idx = i
            break
    cleaned = "\n".join(lines[header_idx:])
    reader = csv.DictReader(io.StringIO(cleaned), delimiter="|")
    out: list[PriceRecord] = []
    latest: Optional[datetime] = None
    for row in reader:
        raw_id = (row.get("idImpianto") or "").strip()
        if not raw_id:
            continue
        try:
            sid = int(raw_id)
        except ValueError:
            continue
        price = _to_float(row.get("prezzo"))
        if price is None or price <= 0:
            continue
        fuel = (row.get("descCarburante") or "").strip()
        if not fuel:
            continue
        is_self = (row.get("isSelf") or "").strip() == "1"
        dt_raw = (row.get("dtComu") or "").strip()
        dt_iso: Optional[str] = None
        if dt_raw:
            try:
                parsed = datetime.strptime(dt_raw, "%d/%m/%Y %H:%M:%S")
                dt_iso = parsed.isoformat()
                if latest is None or parsed > latest:
                    latest = parsed
            except ValueError:
                dt_iso = None
        out.append(PriceRecord(id=sid, fuel=fuel, price=price, isSelf=is_self, dtComu=dt_iso))
    return out, latest


async def refresh(force: bool = False) -> CsvSnapshot:
    """Scarica e parsifica i CSV; usa cache disco con TTL."""
    now = time.time()
    if not force and (now - _state["fetched_at"]) < CSV_TTL_SECONDS and _state["snapshot"].stations:
        return _state["snapshot"]

    async with _lock:
        now = time.time()
        if not force and (now - _state["fetched_at"]) < CSV_TTL_SECONDS and _state["snapshot"].stations:
            return _state["snapshot"]

        try:
            _set_status("downloading", "Scarico anagrafica impianti (MIMIT)…")
            ana_bytes = await _fetch_to_disk(ANAGRAFICA_URL, "anagrafica.csv")
            _set_status("downloading", "Scarico listino prezzi (MIMIT)…")
            prz_bytes = await _fetch_to_disk(PREZZI_URL, "prezzi.csv")
        except Exception as exc:
            logger.error("refresh CSV fallito: %s", exc)
            _state["fetched_at"] = now
            _set_status("failed", f"Download CSV fallito: {exc}")
            return _state["snapshot"]

        _set_status("parsing", "Elaboro dati CSV…")
        stations = _parse_anagrafica(ana_bytes)
        prices, latest = _parse_prezzi(prz_bytes)
        snap = CsvSnapshot(stations=stations, prices=prices, last_update=latest)
        _state["snapshot"] = snap
        _state["fetched_at"] = now
        logger.info(
            "CSV aggiornato: %d impianti, %d prezzi, ultimo aggiornamento %s",
            len(stations),
            len(prices),
            latest.isoformat() if latest else "n/d",
        )
        _set_status("ready", None)
        return snap


def schedule_refresh(force: bool = False) -> None:
    """Avvia refresh() in background senza bloccare il chiamante.

    Se c'è già un task attivo non ne crea un altro (niente dog-pile).
    """
    task = _state.get("refresh_task")
    if task is not None and not task.done():
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    _state["refresh_task"] = loop.create_task(refresh(force=force))


def is_stale() -> bool:
    return (time.time() - _state["fetched_at"]) >= CSV_TTL_SECONDS


def get_snapshot() -> CsvSnapshot:
    return _state["snapshot"]


def compute_stats(snap: CsvSnapshot) -> list[dict]:
    if not snap.prices:
        return []
    df = pd.DataFrame(
        [
            {"id": p.id, "fuel": p.fuel, "price": p.price, "isSelf": p.isSelf}
            for p in snap.prices
        ]
    )
    rows: list[dict] = []
    for fuel, group in df.groupby("fuel"):
        self_prices = group.loc[group["isSelf"], "price"]
        served_prices = group.loc[~group["isSelf"], "price"]
        rows.append(
            {
                "fuel": fuel,
                "avgSelf": round(float(self_prices.mean()), 4) if not self_prices.empty else None,
                "avgServed": round(float(served_prices.mean()), 4) if not served_prices.empty else None,
                "count": int(len(group)),
            }
        )
    rows.sort(key=lambda r: r["fuel"])
    return rows


def cheapest(snap: CsvSnapshot, fuel: str, n: int = 20, is_self: Optional[bool] = None) -> list[dict]:
    if not snap.prices or not snap.stations:
        return []
    filtered = [p for p in snap.prices if p.fuel.lower() == fuel.lower()]
    if is_self is not None:
        filtered = [p for p in filtered if p.isSelf == is_self]
    filtered.sort(key=lambda p: p.price)
    out: list[dict] = []
    seen: set[int] = set()
    for p in filtered:
        if p.id in seen:
            continue
        station = snap.stations.get(p.id)
        if not station:
            continue
        seen.add(p.id)
        out.append(
            {
                "id": station.id,
                "brand": station.bandiera,
                "name": station.nome,
                "address": station.indirizzo,
                "municipality": station.comune,
                "province": station.provincia,
                "lat": station.lat,
                "lng": station.lng,
                "fuel": p.fuel,
                "price": p.price,
                "isSelf": p.isSelf,
                "dtComu": p.dtComu,
            }
        )
        if len(out) >= n:
            break
    return out


def stations_near(snap: CsvSnapshot, lat: float, lng: float, radius_m: int) -> list[dict]:
    """Fallback geografico usando il CSV. Ritorna stazioni con distanza in km."""
    if not snap.stations:
        return []
    radius_km = radius_m / 1000.0
    deg = radius_km / 111.0  # bbox prefilter per velocità
    prices_by_id: dict[int, list[PriceRecord]] = {}
    for p in snap.prices:
        prices_by_id.setdefault(p.id, []).append(p)
    out: list[dict] = []
    for st in snap.stations.values():
        if abs(st.lat - lat) > deg or abs(st.lng - lng) > deg:
            continue
        dist = _haversine_km(lat, lng, st.lat, st.lng)
        if dist > radius_km:
            continue
        fuels = [
            {"name": p.fuel, "isSelf": p.isSelf, "price": p.price}
            for p in prices_by_id.get(st.id, [])
        ]
        if not fuels:
            continue
        # insertDate: usa il dtComu più recente tra i prezzi (ISO string)
        latest = None
        for p in prices_by_id.get(st.id, []):
            if p.dtComu and (latest is None or p.dtComu > latest):
                latest = p.dtComu
        out.append(
            {
                "id": st.id,
                "brand": st.bandiera,
                "name": st.nome,
                "address": st.indirizzo,
                "municipality": st.comune,
                "province": st.provincia,
                "lat": st.lat,
                "lng": st.lng,
                "distance": round(dist, 2),
                "insertDate": latest,
                "fuels": fuels,
            }
        )
    out.sort(key=lambda s: s["distance"])
    return out
