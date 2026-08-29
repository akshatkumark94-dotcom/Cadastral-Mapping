"""
Database persistence and GeoJSON storage layer for Cadastral AI Mapper.
Smart India Hackathon 2026 — Hierarchical Multi-City & Mini-Segment Support
"""

import json
import sqlite3
from pathlib import Path
from typing import List, Dict, Any, Optional
from ml_pipeline.config import (
    PROCESSED_DATA_DIR,
    BASE_DIR,
    REGIONS,
    get_all_regions,
    get_region,
    get_segment
)

DB_DIR = BASE_DIR / "backend" / "db"
DB_FILE = DB_DIR / "cadastral.sqlite"


def get_db_connection() -> sqlite3.Connection:
    """Returns a connection to the SQLite database with Row factory enabled."""
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_FILE))
    conn.row_factory = sqlite3.Row
    return conn


def init_db(force_reseed: bool = False):
    """
    Initializes SQLite database with region and segment column schema.
    Seeds records from data/processed/ingested_buildings.geojson or triggers ingestion.
    """
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS parcels (
            id TEXT PRIMARY KEY,
            ulpin TEXT NOT NULL,
            survey_no TEXT NOT NULL,
            owner_name TEXT,
            land_use TEXT,
            region TEXT NOT NULL,
            region_name TEXT,
            segment TEXT NOT NULL,
            segment_name TEXT,
            area_sqm REAL,
            perimeter_m REAL,
            status TEXT DEFAULT 'pending',
            confidence_score REAL DEFAULT 0.90,
            extracted_date TEXT,
            source TEXT,
            geometry_json TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_parcels_region_segment ON parcels(region, segment)")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conflicts (
            id TEXT PRIMARY KEY,
            conflict_id TEXT NOT NULL,
            conflict_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            region TEXT NOT NULL,
            segment TEXT NOT NULL,
            parcels_involved_json TEXT NOT NULL,
            overlap_area_sqm REAL,
            description TEXT,
            suggested_action TEXT,
            status TEXT DEFAULT 'UNRESOLVED',
            detected_at TEXT,
            geometry_json TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_conflicts_region_segment ON conflicts(region, segment)")

    conn.commit()

    # Check if seeding is required
    cursor.execute("SELECT COUNT(*) as count FROM parcels")
    parcel_count = cursor.fetchone()["count"]

    if parcel_count == 0 or force_reseed:
        print("[Database] Initializing and seeding multi-city segment database...")
        _seed_from_ingested_data(conn)

    conn.close()
    print("[Database] SQLite database initialized at:", DB_FILE)


def _seed_from_ingested_data(conn: sqlite3.Connection):
    """
    Seeds the database from data/processed/ingested_buildings.geojson.
    If the file does not exist, runs the ingestion pipeline to generate it.
    """
    combined_file = PROCESSED_DATA_DIR / "ingested_buildings.geojson"

    if not combined_file.exists():
        from scripts.download_open_buildings import process_all_segments
        process_all_segments()

    cursor = conn.cursor()

    if combined_file.exists():
        with open(combined_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            for feat in data.get("features", []):
                p_id = feat.get("id") or feat["properties"].get("id")
                props = feat.get("properties", {})
                geom_json = json.dumps(feat.get("geometry", {}))

                region = props.get("region", "delhi")
                segment = props.get("segment", "karol_bagh")
                region_name = props.get("region_name", region.title())
                segment_name = props.get("segment_name", segment.replace("_", " ").title())

                cursor.execute("""
                    INSERT OR REPLACE INTO parcels (
                        id, ulpin, survey_no, owner_name, land_use, region, region_name,
                        segment, segment_name, area_sqm, perimeter_m, status,
                        confidence_score, extracted_date, source, geometry_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    p_id,
                    props.get("ulpin", "UNKNOWN"),
                    props.get("survey_no", "100"),
                    props.get("owner_name", "Public"),
                    props.get("land_use", "Residential"),
                    region,
                    region_name,
                    segment,
                    segment_name,
                    props.get("area_sqm", 0.0),
                    props.get("perimeter_m", 0.0),
                    props.get("status", "pending"),
                    props.get("confidence_score", 0.90),
                    props.get("extracted_date", "2026-02-28"),
                    props.get("source", "OpenBuildings-Ingested"),
                    geom_json
                ))

                # If parcel is flagged, create corresponding conflict entry
                if props.get("status") == "flagged":
                    c_id = f"CONF-{p_id}"
                    cursor.execute("""
                        INSERT OR REPLACE INTO conflicts (
                            id, conflict_id, conflict_type, severity, region, segment,
                            parcels_involved_json, overlap_area_sqm, description,
                            suggested_action, status, detected_at, geometry_json
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNRESOLVED', CURRENT_TIMESTAMP, ?)
                    """, (
                        c_id,
                        c_id,
                        "OVERLAP_DISPUTE",
                        "HIGH",
                        region,
                        segment,
                        json.dumps([p_id]),
                        round(props.get("area_sqm", 120.0) * 0.18, 2),
                        f"Boundary overlap detected for {p_id} in {segment_name}",
                        "CLIP_TO_MEDIAN_EDGE",
                        geom_json
                    ))

    conn.commit()


# =============================================================================================
# REGION & SEGMENT QUERY FUNCTIONS
# =============================================================================================

def get_regions_list() -> List[Dict[str, Any]]:
    """Returns list of all configured city regions with metadata and segment counts."""
    regions_out = []
    for key, reg in REGIONS.items():
        segments = reg.get("segments", {})
        regions_out.append({
            "key": key,
            "name": reg.get("name", key.title()),
            "state_code": reg.get("state_code", "00"),
            "district_code": reg.get("district_code", "000"),
            "segment_count": len(segments),
            "segments": [
                {
                    "key": s_key,
                    "name": s_val.get("name", s_key),
                    "min_lat": s_val.get("min_lat", 0.0),
                    "max_lat": s_val.get("max_lat", 0.0),
                    "min_lon": s_val.get("min_lon", 0.0),
                    "max_lon": s_val.get("max_lon", 0.0)
                }
                for s_key, s_val in segments.items()
            ]
        })
    return regions_out


def get_segments_by_region(region_key: str) -> Optional[List[Dict[str, Any]]]:
    """Returns list of mini-segments for a given city."""
    reg = get_region(region_key)
    if not reg:
        return None
    segments = reg.get("segments", {})
    return [
        {
            "key": s_key,
            "name": s_val.get("name", s_key),
            "region_key": region_key,
            "region_name": reg.get("name", region_key),
            "min_lat": s_val.get("min_lat", 0.0),
            "max_lat": s_val.get("max_lat", 0.0),
            "min_lon": s_val.get("min_lon", 0.0),
            "max_lon": s_val.get("max_lon", 0.0)
        }
        for s_key, s_val in segments.items()
    ]


def db_get_all_parcels(
    status_filter: Optional[str] = None,
    region: Optional[str] = None,
    segment: Optional[str] = None,
    search: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieves parcels filtered by region, segment, status, or search term."""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM parcels WHERE 1=1"
    params = []

    if region:
        query += " AND region = ?"
        params.append(region.lower())

    if segment:
        query += " AND segment = ?"
        params.append(segment.lower())

    if status_filter and status_filter != "all":
        query += " AND status = ?"
        params.append(status_filter.lower())

    if search:
        query += " AND (LOWER(survey_no) LIKE ? OR LOWER(ulpin) LIKE ? OR LOWER(owner_name) LIKE ?)"
        s = f"%{search.lower()}%"
        params.extend([s, s, s])

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    features = []
    for r in rows:
        features.append({
            "type": "Feature",
            "id": r["id"],
            "properties": {
                "id": r["id"],
                "ulpin": r["ulpin"],
                "survey_no": r["survey_no"],
                "owner_name": r["owner_name"],
                "land_use": r["land_use"],
                "region": r["region"],
                "region_name": r["region_name"],
                "segment": r["segment"],
                "segment_name": r["segment_name"],
                "area_sqm": r["area_sqm"],
                "perimeter_m": r["perimeter_m"],
                "status": r["status"],
                "confidence_score": r["confidence_score"],
                "extracted_date": r["extracted_date"],
                "source": r["source"]
            },
            "geometry": json.loads(r["geometry_json"])
        })
    return features


def db_get_parcel_by_id(parcel_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM parcels WHERE id = ?", (parcel_id,))
    r = cursor.fetchone()
    conn.close()

    if not r:
        return None

    return {
        "type": "Feature",
        "id": r["id"],
        "properties": {
            "id": r["id"],
            "ulpin": r["ulpin"],
            "survey_no": r["survey_no"],
            "owner_name": r["owner_name"],
            "land_use": r["land_use"],
            "region": r["region"],
            "region_name": r["region_name"],
            "segment": r["segment"],
            "segment_name": r["segment_name"],
            "area_sqm": r["area_sqm"],
            "perimeter_m": r["perimeter_m"],
            "status": r["status"],
            "confidence_score": r["confidence_score"],
            "extracted_date": r["extracted_date"],
            "source": r["source"]
        },
        "geometry": json.loads(r["geometry_json"])
    }


def db_save_parcel(parcel: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    p_id = parcel.get("id") or parcel["properties"].get("id")
    props = parcel.get("properties", {})
    geom_json = json.dumps(parcel.get("geometry", {}))

    cursor.execute("""
        INSERT OR REPLACE INTO parcels (
            id, ulpin, survey_no, owner_name, land_use, region, region_name,
            segment, segment_name, area_sqm, perimeter_m, status, confidence_score,
            extracted_date, source, geometry_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    """, (
        p_id,
        props.get("ulpin", "UNKNOWN"),
        props.get("survey_no", "100"),
        props.get("owner_name", "Public"),
        props.get("land_use", "Residential"),
        props.get("region", "delhi"),
        props.get("region_name", props.get("region", "delhi").title()),
        props.get("segment", "karol_bagh"),
        props.get("segment_name", props.get("segment", "karol_bagh").replace("_", " ").title()),
        props.get("area_sqm", 0.0),
        props.get("perimeter_m", 0.0),
        props.get("status", "pending"),
        props.get("confidence_score", 0.90),
        props.get("extracted_date", "2026-02-28"),
        props.get("source", "AI-SAM-HighRes"),
        geom_json
    ))
    conn.commit()
    conn.close()


def db_get_all_conflicts(
    status_filter: Optional[str] = None,
    region: Optional[str] = None,
    segment: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieves conflicts filtered by region, segment, and status."""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM conflicts WHERE 1=1"
    params = []

    if region:
        query += " AND region = ?"
        params.append(region.lower())

    if segment:
        query += " AND segment = ?"
        params.append(segment.lower())

    if status_filter:
        query += " AND status = ?"
        params.append(status_filter)

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    features = []
    for r in rows:
        features.append({
            "type": "Feature",
            "id": r["id"],
            "properties": {
                "conflict_id": r["conflict_id"],
                "conflict_type": r["conflict_type"],
                "severity": r["severity"],
                "region": r["region"],
                "segment": r["segment"],
                "parcels_involved": json.loads(r["parcels_involved_json"]),
                "overlap_area_sqm": r["overlap_area_sqm"],
                "description": r["description"],
                "suggested_action": r["suggested_action"],
                "status": r["status"],
                "detected_at": r["detected_at"]
            },
            "geometry": json.loads(r["geometry_json"])
        })
    return features


def db_update_conflict_status(conflict_id: str, status: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE conflicts SET status = ? WHERE id = ? OR conflict_id = ?", (status, conflict_id, conflict_id))
    conn.commit()
    conn.close()
