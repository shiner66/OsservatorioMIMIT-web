from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter

from ..models import LocalitaSearchRequest, PositionSearchRequest, SearchResponse
from ..services import csv_fetcher, mise_proxy

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/search", tags=["search"])


MISE_EFFECTIVE_RADIUS_M = 5000  # MISE cappa lato server intorno ai 5 km


def _enrich_from_csv(results: list[dict], snap) -> list[dict]:
    """Riempi address/municipality/province/brand/name mancanti dall'anagrafica CSV."""
    if not snap.stations:
        return results
    out: list[dict] = []
    for s in results:
        sid = s.get("id")
        st = snap.stations.get(sid) if sid is not None else None
        if st:
            merged = dict(s)
            if not merged.get("address"):
                merged["address"] = st.indirizzo
            if not merged.get("municipality"):
                merged["municipality"] = st.comune
            if not merged.get("province"):
                merged["province"] = st.provincia
            if not merged.get("brand"):
                merged["brand"] = st.bandiera
            if not merged.get("name"):
                merged["name"] = st.nome
            out.append(merged)
        else:
            out.append(s)
    return out


def _merge_results(mise: list[dict], csv_rows: list[dict], radius_m: int) -> list[dict]:
    radius_km = radius_m / 1000.0
    by_id: dict[int, dict] = {}
    for s in mise:
        sid = s.get("id")
        if sid is None:
            continue
        d = s.get("distance")
        if d is not None:
            try:
                if float(d) > radius_km:
                    continue
            except (TypeError, ValueError):
                pass
        by_id[sid] = s
    for s in csv_rows:
        sid = s.get("id")
        if sid is None or sid in by_id:
            continue
        by_id[sid] = s
    out = list(by_id.values())
    out.sort(key=lambda s: (s.get("distance") is None, s.get("distance") or 1e9))
    return out


@router.post("/position", response_model=SearchResponse)
async def search_position(req: PositionSearchRequest) -> SearchResponse:
    mise_results: list[dict] = []
    mise_failed = False
    try:
        mise_results = await mise_proxy.search_zone(
            lat=req.lat,
            lon=req.lon,
            radius_m=min(req.radius, MISE_EFFECTIVE_RADIUS_M),
            fuel=req.fuel,
            order=req.order,
        )
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("MISE API non disponibile: %s", exc)
        mise_failed = True

    # Usa la snapshot CSV corrente (non bloccante); se stale, avvia refresh in background.
    snap = csv_fetcher.get_snapshot()
    if not snap.stations or csv_fetcher.is_stale():
        csv_fetcher.schedule_refresh()
    mise_results = _enrich_from_csv(mise_results, snap)

    need_csv = req.radius > MISE_EFFECTIVE_RADIUS_M or mise_failed or not mise_results
    csv_rows: list[dict] = []
    if need_csv:
        csv_rows = csv_fetcher.stations_near(snap, req.lat, req.lon, req.radius)
        if req.fuel:
            csv_rows = [
                {**s, "fuels": [f for f in s["fuels"] if f["name"].lower() == req.fuel.lower()]}
                for s in csv_rows
            ]
            csv_rows = [s for s in csv_rows if s["fuels"]]

    merged = _merge_results(mise_results, csv_rows, req.radius)

    if mise_failed and csv_rows:
        return SearchResponse(
            results=merged,
            source="csv_fallback",
            degraded=True,
            message="API in tempo reale non disponibile: prezzi dal CSV (aggiornato alle 08:00).",
        )
    if not merged:
        return SearchResponse(results=[], source="mise_api", degraded=mise_failed)
    # Se stiamo mescolando MISE + CSV oltre i 5 km, segnalalo
    degraded = req.radius > MISE_EFFECTIVE_RADIUS_M and bool(csv_rows)
    msg = (
        "Oltre i 5 km i prezzi provengono dal CSV giornaliero (non in tempo reale)."
        if degraded
        else None
    )
    return SearchResponse(results=merged, source="mise_api", degraded=degraded, message=msg)


@router.post("/localita", response_model=SearchResponse)
async def search_localita(req: LocalitaSearchRequest) -> SearchResponse:
    try:
        results = await mise_proxy.search_area(
            region=req.region,
            province=req.province,
            town=req.town,
            fuel=req.fuel,
            order=req.order,
        )
        return SearchResponse(results=results, source="mise_api", degraded=False)
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("MISE API localita non disponibile: %s", exc)
        return SearchResponse(
            results=[],
            source="csv_fallback",
            degraded=True,
            message="Ricerca per località non disponibile offline. Usa la ricerca per posizione.",
        )
