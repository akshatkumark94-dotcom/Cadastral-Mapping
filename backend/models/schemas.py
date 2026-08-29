"""
Data schemas and Pydantic validation models for Cadastral AI Mapper.
"""

from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field


class GeoJSONGeometry(BaseModel):
    type: Literal["Polygon", "MultiPolygon", "LineString", "Point"]
    coordinates: List[Any]


class ParcelProperties(BaseModel):
    id: str
    ulpin: str
    survey_no: str
    owner_name: Optional[str] = "Unknown / Unassigned"
    land_use: Optional[str] = "Residential"
    area_sqm: float
    perimeter_m: float
    status: Literal["approved", "pending", "flagged", "rejected"] = "pending"
    confidence_score: float = 0.90
    extracted_date: Optional[str] = None
    source: Optional[str] = "AI-SAM-HighRes"


class ParcelFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: str
    properties: ParcelProperties
    geometry: GeoJSONGeometry


class ParcelFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    name: Optional[str] = "cadastral_parcels"
    features: List[ParcelFeature]


class ParcelCreateRequest(BaseModel):
    survey_no: str
    owner_name: Optional[str] = "New Owner"
    land_use: Optional[str] = "Residential"
    geometry: GeoJSONGeometry
    state_code: Optional[str] = "29"
    district_code: Optional[str] = "572"


class ParcelUpdateRequest(BaseModel):
    owner_name: Optional[str] = None
    land_use: Optional[str] = None
    status: Optional[Literal["approved", "pending", "flagged", "rejected"]] = None
    geometry: Optional[GeoJSONGeometry] = None


class ConflictFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: str
    properties: Dict[str, Any]
    geometry: GeoJSONGeometry


class ConflictFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    name: Optional[str] = "cadastral_conflicts"
    features: List[ConflictFeature]


class ConflictResolveRequest(BaseModel):
    resolution_method: Literal["CLIP_TO_MEDIAN_EDGE", "PRIORITIZE_PRIMARY", "SNAP_VERTICES", "MANUAL_SPLIT"] = "CLIP_TO_MEDIAN_EDGE"
    primary_parcel_id: Optional[str] = None
    notes: Optional[str] = None


class StatsResponse(BaseModel):
    total_parcels: int
    approved_parcels: int
    pending_parcels: int
    flagged_parcels: int
    total_conflicts: int
    total_surveyed_area_sqm: float
    total_surveyed_area_hectares: float
    ai_confidence_average: float
    system_status: str = "ONLINE"
