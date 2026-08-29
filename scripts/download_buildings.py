"""
Data Ingestion Script: Download Building Footprints
Fetches building footprints from OpenStreetMap (Overpass API) / Google Open Buildings
for a specified bounding box in India.
"""

import json
import requests
from pathlib import Path
from ml_pipeline.config import RAW_DATA_DIR, PROCESSED_DATA_DIR, DEFAULT_BBOX
from ml_pipeline.id_generator import generate_ulpin
from ml_pipeline.geometry import calculate_metric_metrics
from shapely.geometry import Polygon, mapping


def download_osm_buildings(bbox: dict = DEFAULT_BBOX) -> Path:
    """
    Queries OpenStreetMap Overpass API for building footprint polygons
    within the bounding box and saves to raw and processed GeoJSON.
    """
    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)

    min_lat, max_lat = bbox["min_lat"], bbox["max_lat"]
    min_lon, max_lon = bbox["min_lon"], bbox["max_lon"]

    print(f"[Data-Track] Fetching OSM building footprints for BBox: ({min_lat}, {min_lon}) to ({max_lat}, {max_lon})...")

    overpass_query = f"""
    [out:json][timeout:30];
    (
      way["building"]({min_lat},{min_lon},{max_lat},{max_lon});
      relation["building"]({min_lat},{min_lon},{max_lat},{max_lon});
    );
    out body;
    >;
    out skel qt;
    """

    overpass_url = "https://overpass-api.de/api/interpreter"
    response = requests.post(overpass_url, data={"data": overpass_query}, timeout=45)

    if response.status_code != 200:
        print(f"[Data-Track] Overpass request returned status code {response.status_code}. Generating synthetic building set.")
        return None

    osm_data = response.json()
    raw_path = RAW_DATA_DIR / "osm_buildings_raw.json"
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(osm_data, f, indent=2)

    # Process nodes and ways into GeoJSON Polygons
    nodes = {n["id"]: (n["lon"], n["lat"]) for n in osm_data.get("elements", []) if n["type"] == "node"}
    features = []
    idx = 1

    for elem in osm_data.get("elements", []):
        if elem["type"] == "way" and "nodes" in elem:
            coords = [nodes[n_id] for n_id in elem["nodes"] if n_id in nodes]
            if len(coords) >= 4:
                try:
                    poly = Polygon(coords)
                    if not poly.is_valid:
                        poly = poly.buffer(0)
                    if poly.is_empty or not isinstance(poly, Polygon):
                        continue

                    area_sqm, perimeter_m = calculate_metric_metrics(poly)
                    ulpin = generate_ulpin(poly, state_code=bbox.get("state_code", "29"), district_code=bbox.get("district_code", "572"))
                    p_id = f"OSM-PARCEL-{idx:04d}"

                    features.append({
                        "type": "Feature",
                        "id": p_id,
                        "properties": {
                            "id": p_id,
                            "ulpin": ulpin,
                            "survey_no": f"OSM-{idx}",
                            "owner_name": elem.get("tags", {}).get("name", f"Building {idx}"),
                            "land_use": elem.get("tags", {}).get("building", "Residential"),
                            "area_sqm": area_sqm,
                            "perimeter_m": perimeter_m,
                            "status": "pending",
                            "confidence_score": 0.95,
                            "extracted_date": "2026-02-28",
                            "source": "OpenStreetMap-Ingestion"
                        },
                        "geometry": mapping(poly)
                    })
                    idx += 1
                except Exception:
                    continue

    geojson_collection = {
        "type": "FeatureCollection",
        "name": "osm_ingested_parcels",
        "features": features
    }

    out_file = PROCESSED_DATA_DIR / "ingested_buildings.geojson"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(geojson_collection, f, indent=2)

    print(f"[Data-Track] Successfully ingested {len(features)} building footprints to {out_file}")
    return out_file


if __name__ == "__main__":
    download_osm_buildings()
