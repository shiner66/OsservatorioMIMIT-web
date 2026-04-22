from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


FuelName = Literal["Benzina", "Gasolio", "GPL", "Metano", "HVO", "Gasolio Riscaldamento"]


class PositionSearchRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    radius: int = Field(
        5000,
        ge=500,
        le=30000,
        description=(
            "Raggio in metri. L'API MIMIT in tempo reale copre al massimo 10 km "
            "(MISE_EFFECTIVE_RADIUS_M); oltre tale soglia i prezzi provengono dal "
            "CSV giornaliero e la risposta avrà degraded=True."
        ),
    )
    fuel: Optional[str] = None
    order: Literal["asc", "desc"] = "asc"


class LocalitaSearchRequest(BaseModel):
    region: Optional[int] = None
    province: Optional[str] = None
    town: Optional[str] = None
    fuel: Optional[str] = None
    order: Literal["asc", "desc"] = "asc"


class FuelPrice(BaseModel):
    name: str
    isSelf: bool
    price: float
    fuelId: Optional[int] = None


class Station(BaseModel):
    id: int
    brand: Optional[str] = None
    name: Optional[str] = None
    address: Optional[str] = None
    municipality: Optional[str] = None
    province: Optional[str] = None
    lat: float
    lng: float
    distance: Optional[float] = None
    insertDate: Optional[str] = None
    fuels: list[FuelPrice] = []


class SearchResponse(BaseModel):
    results: list[Station]
    source: Literal["mise_api", "csv_fallback"] = "mise_api"
    degraded: bool = False
    message: Optional[str] = None
    effectiveRadius: Optional[int] = Field(
        None,
        description=(
            "Raggio effettivo usato per la ricerca MIMIT (in metri). "
            "Può essere inferiore al raggio richiesto per via del cap a 10 km dell'API."
        ),
    )


class FuelStat(BaseModel):
    fuel: str
    avgSelf: Optional[float] = None
    avgServed: Optional[float] = None
    count: int


class StatsResponse(BaseModel):
    stats: list[FuelStat]
    totalStations: int
    csvLastUpdate: Optional[str] = None


class HealthResponse(BaseModel):
    status: str = "ok"
    csvLastUpdate: Optional[str] = None
    stationsLoaded: int = 0
    csvStatus: Literal["idle", "downloading", "parsing", "ready", "failed"] = "idle"
    csvMessage: Optional[str] = None
