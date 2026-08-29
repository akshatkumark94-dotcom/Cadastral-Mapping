"""
Database persistence and GeoJSON storage layer for Cadastral AI Mapper.
Provides SQLite database integration with fallback JSON serialization and automatic sample seeding.
"""

import json
import sqlite3
from pathlib import Path
from typing import List, Dict, Any, Optional
from ml_pipeline.config import SAMPLE_AREA_DIR, BASE_DIR

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
    Initializes SQLite tables for parcels, conflicts, and audit logs.
    Automatically seeds initial records from sample_area/ if tables are empty.
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

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conflicts (
            id TEXT PRIMARY KEY,
            conflict_id TEXT NOT NULL,
            conflict_type TEXT NOT NULL,
            severity TEXT NOT NULL,
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

    conn.commit()

    # Check if seeding is required
    cursor.execute("SELECT COUNT(*) as count FROM parcels")
    parcel_count = cursor.fetchone()["count"]

    if parcel_count == 0 or force_reseed:
        print("[Database] Seeding initial parcels and conflicts from sample_area...")
        _seed_from_sample_files(conn)

    conn.close()
    print("[Database] SQLite database initialized at:", DB_FILE)


def _seed_from_sample_files(conn: sqlite3.Connection):
    """Reads sample_parcels.geojson and sample_conflicts.geojson and inserts into DB."""
    sample_parcels_file = SAMPLE_AREA_DIR / "sample_parcels.geojson"
    sample_conflicts_file = SAMPLE_AREA_DIR / "sample_conflicts.geojson"

    cursor = conn.cursor()

    if sample_parcels_file.exists():
        with open(sample_parcels_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            for feat in data.get("features", []):
                p_id = feat.get("id") or feat["properties"].get("id")
                props = feat.get("properties", {})
                geom_json = json.dumps(feat.get("geometry", {}))

                cursor.execute("""
                    INSERT OR REPLACE INTO parcels (
                        id, ulpin, survey_no, owner_name, land_use, area_sqm,
                        perimeter_m, status, confidence_score, extracted_date, source, geometry_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    p_id,
                    props.get("ulpin", "UNKNOWN"),
                    props.get("survey_no", "100"),
                    props.get("owner_name", "Public"),
                    props.get("land_use", "Residential"),
                    props.get("area_sqm", 0.0),
                    props.get("perimeter_m", 0.0),
                    props.get("status", "pending"),
                    props.get("confidence_score", 0.90),
                    props.get("extracted_date", "2026-02-15"),
                    props.get("source", "SampleSeed"),
                    geom_json
                ))

    if sample_conflicts_file.exists():
        with open(sample_conflicts_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            for feat in data.get("features", []):
                c_id = feat.get("id") or feat["properties"].get("conflict_id")
                props = feat.get("properties", {})
                parcels_involved = json.dumps(props.get("parcels_involved", []))
                geom_json = json.dumps(feat.get("geometry", {}))

                cursor.execute("""
                    INSERT OR REPLACE INTO conflicts (
                        id, conflict_id, conflict_type, severity, parcels_involved_json,
                        overlap_area_sqm, description, suggested_action, status, detected_at, geometry_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    c_id,
                    props.get("conflict_id", c_id),
                    props.get("conflict_type", "OVERLAP_DISPUTE"),
                    props.get("severity", "MEDIUM"),
                    parcels_involved,
                    props.get("overlap_area_sqm", 0.0),
                    props.get("description", "Overlap detected"),
                    props.get("suggested_action", "CLIP_TO_MEDIAN_EDGE"),
                    props.get("status", "UNRESOLVED"),
                    props.get("detected_at", "2026-02-18T14:00:00Z"),
                    geom_json
                ))

    conn.commit()


# Database Queries Helper Functions
def db_get_all_parcels(status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if status_filter:
        cursor.execute("SELECT * FROM parcels WHERE status = ?", (status_filter,))
    else:
        cursor.execute("SELECT * FROM parcels")
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
            id, ulpin, survey_no, owner_name, land_use, area_sqm,
            perimeter_m, status, confidence_score, extracted_date, source, geometry_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    """, (
        p_id,
        props.get("ulpin", "UNKNOWN"),
        props.get("survey_no", "100"),
        props.get("owner_name", "Public"),
        props.get("land_use", "Residential"),
        props.get("area_sqm", 0.0),
        props.get("perimeter_m", 0.0),
        props.get("status", "pending"),
        props.get("confidence_score", 0.90),
        props.get("extracted_date", "2026-02-15"),
        props.get("source", "AI-SAM-HighRes"),
        geom_json
    ))
    conn.commit()
    conn.close()


def db_get_all_conflicts(status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if status_filter:
        cursor.execute("SELECT * FROM conflicts WHERE status = ?", (status_filter,))
    else:
        cursor.execute("SELECT * FROM conflicts")
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
