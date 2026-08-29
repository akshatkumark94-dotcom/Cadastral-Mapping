"""
Parcel & Region API endpoints for Cadastral AI Mapper.
Hierarchical Multi-City & Mini-Segment Support (SIH 2026).
"""

from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from shapely.geometry import shape, mapping
from backend.models.schemas import (
    ParcelFeatureCollection,
    ParcelFeature,
    ParcelCreateRequest,
    ParcelUpdateRequest,
    RegionListResponse,
    SegmentListResponse
)
from backend.db.database import (
    db_get_all_parcels,
    db_get_parcel_by_id,
    db_save_parcel,
    get_regions_list,
    get_segments_by_region,
    init_db
)
from ml_pipeline.config import get_region, get_segment
from ml_pipeline.id_generator import generate_ulpin
from ml_pipeline.geometry import calculate_metric_metrics, simplify_polygon
from ml_pipeline.segmentation import ParcelSegmenter
import numpy as np

router = APIRouter(tags=["Parcels & Regions"])


# =============================================================================================
# REGION & SEGMENT ROUTES
# =============================================================================================

@router.get("/api/regions", response_model=RegionListResponse)
def list_regions():
    """Returns list of all configured city regions (Delhi, Ghaziabad, Meerut, Panipat) with metadata."""
    regions_data = get_regions_list()
    return {"regions": regions_data}


@router.get("/api/regions/{region_key}/segments", response_model=SegmentListResponse)
def list_region_segments(region_key: str):
    """Returns list of all mini-segments (sub-areas/wards) inside a given city."""
    reg = get_region(region_key)
    if not reg:
        raise HTTPException(status_code=404, detail=f"City region '{region_key}' not found.")

    segments = get_segments_by_region(region_key)
    return {
        "region_key": region_key,
        "region_name": reg.get("name", region_key.title()),
        "segments": segments or []
    }


# =============================================================================================
# PARCEL ROUTES (SCOPED BY REGION & MINI-SEGMENT)
# =============================================================================================

@router.get("/api/parcels", response_model=ParcelFeatureCollection)
def get_parcels(
    region: Optional[str] = Query(None, description="Filter by City Region (e.g. delhi, ghaziabad, meerut, panipat)"),
    segment: Optional[str] = Query(None, description="Filter by Mini-Segment (e.g. karol_bagh, indirapuram)"),
    status: Optional[str] = Query(None, description="Filter by status: approved, pending, flagged, rejected"),
    search: Optional[str] = Query(None, description="Search by Survey No, Owner, or ULPIN")
):
    """Retrieves cadastral parcels as GeoJSON FeatureCollection, filtered by region & segment."""
    parcels = db_get_all_parcels(
        status_filter=status,
        region=region,
        segment=segment,
        search=search
    )
    return {"type": "FeatureCollection", "name": "cadastral_parcels", "features": parcels}


@router.get("/api/parcels/{parcel_id}", response_model=ParcelFeature)
def get_parcel(parcel_id: str):
    """Retrieves a single parcel by ID."""
    parcel = db_get_parcel_by_id(parcel_id)
    if not parcel:
        raise HTTPException(status_code=404, detail=f"Parcel with ID '{parcel_id}' not found.")
    return parcel


@router.post("/api/parcels", response_model=ParcelFeature, status_code=201)
def create_parcel(payload: ParcelCreateRequest):
    """Creates a new cadastral parcel scoped to a city and mini-segment."""
    try:
        geom = shape(payload.geometry.dict())
        if not geom.is_valid:
            geom = geom.buffer(0)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid geometry: {e}")

    area_sqm, perimeter_m = calculate_metric_metrics(geom)
    ulpin = generate_ulpin(geom, state_code=payload.state_code or "07", district_code=payload.district_code or "001")
    region_key = (payload.region or "delhi").lower()
    segment_key = (payload.segment or "karol_bagh").lower()
    parcel_id = f"PARCEL-{region_key[:3].upper()}-{segment_key[:3].upper()}-{ulpin[-6:]}"

    new_feature = {
        "type": "Feature",
        "id": parcel_id,
        "properties": {
            "id": parcel_id,
            "ulpin": ulpin,
            "survey_no": payload.survey_no,
            "owner_name": payload.owner_name or "Unassigned Owner",
            "land_use": payload.land_use or "Residential",
            "region": region_key,
            "region_name": region_key.title(),
            "segment": segment_key,
            "segment_name": segment_key.replace("_", " ").title(),
            "area_sqm": area_sqm,
            "perimeter_m": perimeter_m,
            "status": "pending",
            "confidence_score": 1.0,
            "extracted_date": "2026-02-28",
            "source": "Manual-Survey-Entry"
        },
        "geometry": mapping(geom)
    }

    db_save_parcel(new_feature)
    return new_feature


@router.put("/api/parcels/{parcel_id}", response_model=ParcelFeature)
def update_parcel(parcel_id: str, payload: ParcelUpdateRequest):
    """Updates metadata or geometry of an existing parcel."""
    parcel = db_get_parcel_by_id(parcel_id)
    if not parcel:
        raise HTTPException(status_code=404, detail=f"Parcel '{parcel_id}' not found.")

    props = parcel["properties"]
    if payload.owner_name is not None:
        props["owner_name"] = payload.owner_name
    if payload.land_use is not None:
        props["land_use"] = payload.land_use
    if payload.status is not None:
        props["status"] = payload.status

    if payload.geometry is not None:
        try:
            new_geom = shape(payload.geometry.dict())
            if not new_geom.is_valid:
                new_geom = new_geom.buffer(0)
            area_sqm, perimeter_m = calculate_metric_metrics(new_geom)
            props["area_sqm"] = area_sqm
            props["perimeter_m"] = perimeter_m
            parcel["geometry"] = mapping(new_geom)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid geometry update: {e}")

    parcel["properties"] = props
    db_save_parcel(parcel)
    return parcel


@router.post("/api/parcels/{parcel_id}/approve", response_model=ParcelFeature)
def approve_parcel(parcel_id: str):
    """Surveyor action: Approves AI-extracted or pending parcel boundary."""
    parcel = db_get_parcel_by_id(parcel_id)
    if not parcel:
        raise HTTPException(status_code=404, detail=f"Parcel '{parcel_id}' not found.")
    parcel["properties"]["status"] = "approved"
    db_save_parcel(parcel)
    return parcel


@router.post("/api/parcels/{parcel_id}/reject", response_model=ParcelFeature)
def reject_parcel(parcel_id: str):
    """Surveyor action: Rejects parcel boundary."""
    parcel = db_get_parcel_by_id(parcel_id)
    if not parcel:
        raise HTTPException(status_code=404, detail=f"Parcel '{parcel_id}' not found.")
    parcel["properties"]["status"] = "rejected"
    db_save_parcel(parcel)
    return parcel


@router.post("/api/parcels/run-segmentation", response_model=ParcelFeatureCollection)
def trigger_ai_segmentation(
    region: Optional[str] = Query("delhi", description="Target city region"),
    segment: Optional[str] = Query("karol_bagh", description="Target mini-segment")
):
    """
    Triggers AI Segmentation across the selected mini-segment.
    Generates new candidate building footprints, computes ULPINs, and updates database.
    """
    segmenter = ParcelSegmenter()
    seg_info = get_segment(region, segment) or {
        "name": segment.replace("_", " ").title(),
        "state_code": "07",
        "district_code": "001"
    }

    # Generate synthetic vector footprints in segment area
    mock_canvas = np.zeros((800, 1000, 3), dtype=np.uint8)
    import cv2
    if cv2 is not None:
        cv2.rectangle(mock_canvas, (120, 150), (280, 320), (255, 255, 255), -1)
        cv2.rectangle(mock_canvas, (320, 150), (480, 320), (255, 255, 255), -1)
        cv2.rectangle(mock_canvas, (520, 180), (750, 400), (255, 255, 255), -1)
        cv2.rectangle(mock_canvas, (140, 420), (350, 650), (255, 255, 255), -1)

    generated_parcels = segmenter.segment_image(mock_canvas)

    for idx, p in enumerate(generated_parcels, 1):
        p_id = f"AI-{region[:3].upper()}-{segment[:3].upper()}-{idx:04d}"
        p["id"] = p_id
        p["properties"]["id"] = p_id
        p["properties"]["region"] = region
        p["properties"]["region_name"] = region.title()
        p["properties"]["segment"] = segment
        p["properties"]["segment_name"] = seg_info.get("name", segment)
        db_save_parcel(p)

    all_parcels = db_get_all_parcels(region=region, segment=segment)
    return {"type": "FeatureCollection", "name": "cadastral_parcels", "features": all_parcels}


@router.post("/api/parcels/reseed")
def reseed_database():
    """Resets database with fresh multi-city mini-segment datasets."""
    init_db(force_reseed=True)
    return {"message": "Database successfully reseeded with multi-city mini-segments."}
