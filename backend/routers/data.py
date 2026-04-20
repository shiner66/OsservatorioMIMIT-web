from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..services import csv_fetcher

router = APIRouter(prefix="/api/data", tags=["data"])


@router.get("/stats")
async def stats() -> dict:
    snap = await csv_fetcher.refresh()
    return {
        "stats": csv_fetcher.compute_stats(snap),
        "totalStations": len(snap.stations),
        "csvLastUpdate": snap.last_update.isoformat() if snap.last_update else None,
    }


@router.get("/cheapest")
async def cheapest(
    fuel: str = Query(..., description="Nome carburante esatto, es. Benzina"),
    n: int = Query(20, ge=1, le=100),
    mode: Optional[str] = Query(None, pattern="^(self|served)?$"),
) -> dict:
    snap = await csv_fetcher.refresh()
    if not snap.stations:
        raise HTTPException(status_code=503, detail="Dati CSV non disponibili")
    is_self: Optional[bool] = None
    if mode == "self":
        is_self = True
    elif mode == "served":
        is_self = False
    return {"results": csv_fetcher.cheapest(snap, fuel=fuel, n=n, is_self=is_self)}


@router.post("/refresh")
async def refresh_csv() -> dict:
    snap = await csv_fetcher.refresh(force=True)
    return {
        "stationsLoaded": len(snap.stations),
        "pricesLoaded": len(snap.prices),
        "csvLastUpdate": snap.last_update.isoformat() if snap.last_update else None,
    }
