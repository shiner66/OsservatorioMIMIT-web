from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Optional

import httpx

from .cache import mise_cache

logger = logging.getLogger(__name__)

OSPZ_BASE = "https://carburanti.mise.gov.it/ospzApi"
ZONE_ENDPOINT = f"{OSPZ_BASE}/search/zone"
AREA_ENDPOINT = f"{OSPZ_BASE}/search/area"

# fuelId standard — varianti premium brand sono volutamente escluse
FUEL_ID_MAP: dict[int, str] = {
    1: "Benzina",
    2: "Gasolio",
    3: "Metano",
    4: "GPL",
    394: "HVO",
    424: "HVO",
}

MISE_TTL_SECONDS = 5 * 60
TIMEOUT = httpx.Timeout(15.0, connect=5.0)
USER_AGENT = "OsservaprezziWeb/1.0"


def _cache_key(prefix: str, payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True).encode("utf-8")
    return f"{prefix}:{hashlib.sha1(raw).hexdigest()}"


def _normalize_results(raw: dict[str, Any], fuel_filter: Optional[str] = None) -> list[dict]:
    out: list[dict] = []
    for item in raw.get("results") or []:
        loc = item.get("location") or {}
        lat = loc.get("lat")
        lng = loc.get("lng")
        if lat is None or lng is None:
            continue
        fuels_in = item.get("fuels") or []
        fuels: list[dict] = []
        for f in fuels_in:
            fid = f.get("fuelId")
            name = FUEL_ID_MAP.get(fid) if fid is not None else f.get("name")
            if name is None:
                continue
            if fuel_filter and name.lower() != fuel_filter.lower():
                continue
            price = f.get("price")
            if price is None:
                continue
            fuels.append(
                {
                    "name": name,
                    "isSelf": bool(f.get("isSelf", False)),
                    "price": float(price),
                    "fuelId": fid,
                }
            )
        if fuel_filter and not fuels:
            continue
        out.append(
            {
                "id": item.get("id"),
                "brand": item.get("brand"),
                "name": item.get("name") or item.get("brand"),
                "address": item.get("address"),
                "municipality": item.get("municipality") or item.get("city"),
                "province": item.get("province"),
                "lat": lat,
                "lng": lng,
                "distance": item.get("distance"),
                "insertDate": item.get("insertDate"),
                "fuels": fuels,
            }
        )
    return out


async def search_zone(
    lat: float,
    lon: float,
    radius_m: int = 5000,
    fuel: Optional[str] = None,
    order: str = "asc",
) -> list[dict]:
    payload = {
        "priceOrder": order,
        "points": [{"lat": lat, "lng": lon}],
        "radius": radius_m,
    }
    key = _cache_key("zone", {**payload, "fuel": fuel})
    cached = mise_cache.get(key)
    if cached is not None:
        return cached

    async with httpx.AsyncClient(timeout=TIMEOUT, headers={"User-Agent": USER_AGENT}) as client:
        resp = await client.post(ZONE_ENDPOINT, json=payload)
        resp.raise_for_status()
        data = resp.json()

    results = _normalize_results(data, fuel_filter=fuel)
    mise_cache.set(key, results, MISE_TTL_SECONDS)
    return results


async def search_area(
    region: Optional[int],
    province: Optional[str],
    town: Optional[str],
    fuel: Optional[str] = None,
    order: str = "asc",
) -> list[dict]:
    payload: dict[str, Any] = {"priceOrder": order}
    if region is not None:
        payload["region"] = region
    if province:
        payload["province"] = province
    if town:
        payload["town"] = town
    key = _cache_key("area", {**payload, "fuel": fuel})
    cached = mise_cache.get(key)
    if cached is not None:
        return cached

    async with httpx.AsyncClient(timeout=TIMEOUT, headers={"User-Agent": USER_AGENT}) as client:
        resp = await client.post(AREA_ENDPOINT, json=payload)
        resp.raise_for_status()
        data = resp.json()

    results = _normalize_results(data, fuel_filter=fuel)
    mise_cache.set(key, results, MISE_TTL_SECONDS)
    return results
