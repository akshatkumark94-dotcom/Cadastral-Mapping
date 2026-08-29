"""
Parcel API endpoints for Cadastral AI Mapper.
Handles GeoJSON retrieval, manual edits, parcel approval, and AI segmentation triggers.
"""

from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from shapely.geometry import shape, mapping
from backend.models.schemas import (
    ParcelFeatureCollection,
    ParcelFeature,
    ParcelCreateRequest,
    ParcelUpdateRequest
)
from backend.db.database import (
    db_get_all_parcels,
    db_get_parcel_by_id,
    db_save_parcel,
    init_db
)
from ml_pipeline.id_generator import generate_ulpin
from ml_pipeline.geometry import calculate_metric_metrics, simplify_polygon
from ml_pipeline.segmentation import ParcelSegmenter
import numpy as np

router = APIRouter(prefix="/api/parcels", tags=["Parcels"])


@router.get("", response_model=ParcelFeatureCollection)
def get_parcels(
    status: Optional[str] = Query(None, description="Filter by status: approved, pending, flagged, rejected"),
    search: Optional[str] = Query(None, description="Search by Survey No, Owner, or ULPIN")
):
    """Retrieves all cadastral parcels as a GeoJSON FeatureCollection."""
    parcels = db_get_all_parcels(status_filter=status)
    if search:
        s = search.lower()
        parcels = [
            p for p in parcels
            if s in p["properties"].get("survey_no", "").lower()
            or s in p["properties"].get("ulpin", "").lower()
            or s in p["properties"].get("owner_name", "").lower()
        ]
    return {"type": "FeatureCollection", "name": "cadastral_parcels", "features": parcels}


@router.get("/{parcel_id}", response_model=ParcelFeature)
def get_parcel(parcel_id: str):
    """Retrieves a single parcel by ID."""
    parcel = db_get_parcel_by_id(parcel_id)
    if not parcel:
        raise HTTPException(status_code=404, detail=f"Parcel with ID '{parcel_id}' not found.")
    return parcel


@router.post("", response_model=ParcelFeature, status_code=201)
def create_parcel(payload: ParcelCreateRequest):
    """Creates a new cadastral parcel with automatic ULPIN and area calculation."""
    try:
        geom = shape(payload.geometry.dict())
        if not geom.is_valid:
            geom = geom.buffer(0)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid geometry: {e}")

    area_sqm, perimeter_m = calculate_metric_metrics(geom)
    ulpin = generate_ulpin(geom, state_code=payload.state_code or "29", district_code=payload.district_code or "572")
    parcel_id = f"PARCEL-{ulpin[-8:]}"

    new_feature = {
        "type": "Feature",
        "id": parcel_id,
        "properties": {
            "id": parcel_id,
            "ulpin": ulpin,
            "survey_no": payload.survey_no,
            "owner_name": payload.owner_name or "Unassigned Owner",
            "land_use": payload.land_use or "Residential",
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


@router.put("/{parcel_id}", response_model=ParcelFeature)
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


@router.post("/{parcel_id}/approve", response_model=ParcelFeature)
def approve_parcel(parcel_id: str):
    """Surveyor action: Approves AI-extracted or pending parcel boundary."""
    parcel = db_get_parcel_by_id(parcel_id)
    if not parcel:
        raise HTTPException(status_code=404, detail=f"Parcel '{parcel_id}' not found.")
    parcel["properties"]["status"] = "approved"
    db_save_parcel(parcel)
    return parcel


@router.post("/{parcel_id}/reject", response_model=ParcelFeature)
def reject_parcel(parcel_id: str):
    """Surveyor action: Rejects parcel boundary."""
    parcel = db_get_parcel_by_id(parcel_id)
    if not parcel:
        raise HTTPException(status_code=404, detail=f"Parcel '{parcel_id}' not found.")
    parcel["properties"]["status"] = "rejected"
    db_save_parcel(parcel)
    return parcel


@router.post("/run-segmentation", response_model=ParcelFeatureCollection)
def trigger_ai_segmentation():
    """
    Triggers AI Segmentation (SAM / CV pipeline) across the designated survey tile.
    Generates new candidate building footprints, computes ULPINs, and commits to database.
    """
    segmenter = ParcelSegmenter()

    # Generate synthetic high-resolution building footprints in urban sample grid
    mock_canvas = np.zeros((800, 1000, 3), dtype=np.uint8)
    import cv2
    if cv2 is not None:
        cv2.rectangle(mock_canvas, (120, 150), (280, 320), (255, 255, 255), -1)
        cv2.rectangle(mock_canvas, (320, 150), (480, 320), (255, 255, 255), -1)
        cv2.rectangle(mock_canvas, (520, 180), (750, 400), (255, 255, 255), -1)
        cv2.rectangle(mock_canvas, (140, 420), (350, 650), (255, 255, 255), -1)
        cv2.rectangle(mock_canvas, (400, 450), (720, 700), (255, 255, 255), -1)

    generated_parcels = segmenter.segment_image(mock_canvas)

    # Save to database
    for p in generated_parcels:
        db_save_parcel(p)

    all_parcels = db_get_all_parcels()
    return {"type": "FeatureCollection", "name": "cadastral_parcels", "features": all_parcels}


@router.post("/reseed")
def reseed_database():
    """Resets database with baseline sample dataset."""
    init_db(force_reseed=True)
    return {"message": "Database successfully reseeded with baseline sample area parcels."}
