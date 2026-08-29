"""
Topology Conflicts API endpoints for Cadastral AI Mapper.
Detects overlaps, gaps, slivers and provides automated geometric conflict resolutions.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from shapely.geometry import shape, mapping
from backend.models.schemas import (
    ConflictFeatureCollection,
    ConflictFeature,
    ConflictResolveRequest
)
from backend.db.database import (
    db_get_all_conflicts,
    db_update_conflict_status,
    db_get_all_parcels,
    db_get_parcel_by_id,
    db_save_parcel,
    get_db_connection
)
from ml_pipeline.geometry import (
    detect_topology_conflicts,
    resolve_overlap_by_clipping,
    calculate_metric_metrics
)
import json

router = APIRouter(prefix="/api/conflicts", tags=["Topology Conflicts"])


@router.get("", response_model=ConflictFeatureCollection)
def get_conflicts(status: Optional[str] = Query(None, description="Filter by status: UNRESOLVED, RESOLVED")):
    """Retrieves all detected topology conflicts as a GeoJSON FeatureCollection."""
    conflicts = db_get_all_conflicts(status_filter=status)
    return {"type": "FeatureCollection", "name": "cadastral_conflicts", "features": conflicts}


@router.post("/detect", response_model=ConflictFeatureCollection)
def run_live_conflict_detection():
    """
    Executes live topology conflict matrix analysis across all currently registered parcels.
    Persists new conflicts to the database.
    """
    parcels = db_get_all_parcels()
    detected = detect_topology_conflicts(parcels, overlap_threshold_sqm=1.0)

    conn = get_db_connection()
    cursor = conn.cursor()
    for conf in detected:
        c_id = conf["id"]
        geom_json = json.dumps(conf["geometry"])
        parcels_json = json.dumps(conf["parcels_involved"])
        cursor.execute("""
            INSERT OR REPLACE INTO conflicts (
                id, conflict_id, conflict_type, severity, parcels_involved_json,
                overlap_area_sqm, description, suggested_action, status, detected_at, geometry_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'UNRESOLVED', CURRENT_TIMESTAMP, ?)
        """, (
            c_id, c_id, conf["conflict_type"], conf["severity"], parcels_json,
            conf["overlap_area_sqm"], conf["description"], conf["suggested_action"], geom_json
        ))
    conn.commit()
    conn.close()

    all_conflicts = db_get_all_conflicts()
    return {"type": "FeatureCollection", "name": "cadastral_conflicts", "features": all_conflicts}


@router.post("/{conflict_id}/resolve")
def resolve_conflict(conflict_id: str, payload: ConflictResolveRequest):
    """
    Applies geometric topology resolution (e.g. boundary clipping, edge snapping) to resolve dispute.
    """
    conflicts = db_get_all_conflicts()
    target_conflict = next((c for c in conflicts if c["id"] == conflict_id or c["properties"].get("conflict_id") == conflict_id), None)

    if not target_conflict:
        raise HTTPException(status_code=404, detail=f"Conflict '{conflict_id}' not found.")

    parcels_involved = target_conflict["properties"].get("parcels_involved", [])
    if len(parcels_involved) >= 2:
        p1_id = payload.primary_parcel_id or parcels_involved[0]
        p2_id = parcels_involved[1] if parcels_involved[0] == p1_id else parcels_involved[0]

        parcel1 = db_get_parcel_by_id(p1_id)
        parcel2 = db_get_parcel_by_id(p2_id)

        if parcel1 and parcel2:
            try:
                poly1 = shape(parcel1["geometry"])
                poly2 = shape(parcel2["geometry"])

                if payload.resolution_method == "CLIP_TO_MEDIAN_EDGE" or payload.resolution_method == "PRIORITIZE_PRIMARY":
                    # Clip secondary parcel geometry
                    clean_p1, clean_p2 = resolve_overlap_by_clipping(poly1, poly2)

                    area1, perim1 = calculate_metric_metrics(clean_p1)
                    area2, perim2 = calculate_metric_metrics(clean_p2)

                    parcel1["geometry"] = mapping(clean_p1)
                    parcel1["properties"]["area_sqm"] = area1
                    parcel1["properties"]["perimeter_m"] = perim1
                    parcel1["properties"]["status"] = "approved"

                    parcel2["geometry"] = mapping(clean_p2)
                    parcel2["properties"]["area_sqm"] = area2
                    parcel2["properties"]["perimeter_m"] = perim2
                    parcel2["properties"]["status"] = "approved"

                    db_save_parcel(parcel1)
                    db_save_parcel(parcel2)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error executing geometric resolution: {e}")

    db_update_conflict_status(conflict_id, "RESOLVED")

    return {
        "message": f"Conflict {conflict_id} resolved successfully using {payload.resolution_method}.",
        "status": "RESOLVED",
        "conflict_id": conflict_id
    }
