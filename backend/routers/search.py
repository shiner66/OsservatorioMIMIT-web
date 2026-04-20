from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter

from ..models import LocalitaSearchRequest, PositionSearchRequest, SearchResponse
from ..services import csv_fetcher, mise_proxy

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/search", tags=["search"])


@router.post("/position", response_model=SearchResponse)
async def search_position(req: PositionSearchRequest) -> SearchResponse:
    try:
        results = await mise_proxy.search_zone(
            lat=req.lat,
            lon=req.lon,
            radius_m=req.radius,
            fuel=req.fuel,
            order=req.order,
        )
        return SearchResponse(results=results, source="mise_api", degraded=False)
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("MISE API non disponibile, fallback CSV: %s", exc)
        snap = await csv_fetcher.refresh()
        fallback = csv_fetcher.stations_near(snap, req.lat, req.lon, req.radius)
        if req.fuel:
            fallback = [
                {
                    **s,
                    "fuels": [f for f in s["fuels"] if f["name"].lower() == req.fuel.lower()],
                }
                for s in fallback
            ]
            fallback = [s for s in fallback if s["fuels"]]
        return SearchResponse(
            results=fallback,
            source="csv_fallback",
            degraded=True,
            message="API in tempo reale non disponibile: mostro dati CSV (aggiornati alle 08:00).",
        )


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
