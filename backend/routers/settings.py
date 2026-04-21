from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from . import search as search_router

router = APIRouter(prefix="/api/settings", tags=["settings"])


class AdvancedSettingsResponse(BaseModel):
    miseMaxRadiusM: int
    miseMaxRadiusDefaultM: int
    miseHardCapM: int


class AdvancedSettingsUpdate(BaseModel):
    miseMaxRadiusM: int = Field(..., ge=500, le=50000)


@router.get("", response_model=AdvancedSettingsResponse)
def get_settings() -> AdvancedSettingsResponse:
    return AdvancedSettingsResponse(
        miseMaxRadiusM=search_router.get_mise_max_radius_m(),
        miseMaxRadiusDefaultM=search_router.MISE_RADIUS_DEFAULT_M,
        miseHardCapM=search_router.MISE_RADIUS_HARD_CAP_M,
    )


@router.post("", response_model=AdvancedSettingsResponse)
def update_settings(body: AdvancedSettingsUpdate) -> AdvancedSettingsResponse:
    search_router.set_mise_max_radius_m(body.miseMaxRadiusM)
    return get_settings()
