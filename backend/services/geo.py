from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx

from .cache import geo_cache

NOMINATIM = "https://nominatim.openstreetmap.org"
USER_AGENT = "OsservaprezziWeb/1.0 (contact: github.com/shiner66/osservatoriomimit-web)"
GEO_TTL_SECONDS = 24 * 3600

_last_call = {"t": 0.0}
_rate_lock = asyncio.Lock()


async def _throttle() -> None:
    # Nominatim policy: max 1 req/s per identificato user-agent.
    async with _rate_lock:
        now = time.monotonic()
        delta = now - _last_call["t"]
        if delta < 1.1:
            await asyncio.sleep(1.1 - delta)
        _last_call["t"] = time.monotonic()


async def reverse(lat: float, lon: float) -> dict[str, Any]:
    key = f"rev:{round(lat, 5)}:{round(lon, 5)}"
    cached = geo_cache.get(key)
    if cached is not None:
        return cached
    await _throttle()
    params = {"lat": lat, "lon": lon, "format": "json", "zoom": 14, "addressdetails": 1}
    async with httpx.AsyncClient(timeout=15.0, headers={"User-Agent": USER_AGENT}) as client:
        resp = await client.get(f"{NOMINATIM}/reverse", params=params)
        resp.raise_for_status()
        data = resp.json()
    geo_cache.set(key, data, GEO_TTL_SECONDS)
    return data


async def search(query: str) -> list[dict[str, Any]]:
    q = query.strip()
    key = f"search:{q.lower()}"
    cached = geo_cache.get(key)
    if cached is not None:
        return cached
    await _throttle()
    params = {"q": q, "format": "json", "countrycodes": "it", "limit": 8, "addressdetails": 1}
    async with httpx.AsyncClient(timeout=15.0, headers={"User-Agent": USER_AGENT}) as client:
        resp = await client.get(f"{NOMINATIM}/search", params=params)
        resp.raise_for_status()
        data = resp.json()
    geo_cache.set(key, data, GEO_TTL_SECONDS)
    return data
