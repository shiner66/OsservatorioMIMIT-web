from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, Query

from ..services import geo

router = APIRouter(prefix="/api/geo", tags=["geo"])


@router.get("/reverse")
async def reverse(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)) -> dict:
    try:
        return await geo.reverse(lat, lon)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Nominatim error: {exc}")


@router.get("/search")
async def search(q: str = Query(..., min_length=2, max_length=120)) -> list[dict]:
    try:
        return await geo.search(q)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Nominatim error: {exc}")
