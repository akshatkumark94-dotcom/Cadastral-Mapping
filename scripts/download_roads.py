"""
Data Ingestion Script: Download Road Networks
Queries OSM Overpass API or OSMnx to extract road centerlines for cadastral overlay alignment.
"""

import json
import requests
from pathlib import Path
from ml_pipeline.config import RAW_DATA_DIR, PROCESSED_DATA_DIR, DEFAULT_BBOX


def download_osm_roads(bbox: dict = DEFAULT_BBOX) -> Path:
    """
    Downloads highway and road network lines within bounding box.
    """
    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)

    min_lat, max_lat = bbox["min_lat"], bbox["max_lat"]
    min_lon, max_lon = bbox["min_lon"], bbox["max_lon"]

    print(f"[Data-Track] Fetching OSM road network for BBox: ({min_lat}, {min_lon}) to ({max_lat}, {max_lon})...")

    overpass_query = f"""
    [out:json][timeout:25];
    (
      way["highway"]({min_lat},{min_lon},{max_lat},{max_lon});
    );
    out body;
    >;
    out skel qt;
    """

    overpass_url = "https://overpass-api.de/api/interpreter"
    try:
        response = requests.post(overpass_url, data={"data": overpass_query}, timeout=30)
        if response.status_code != 200:
            print(f"[Data-Track] Overpass returned status {response.status_code}.")
            return None

        osm_data = response.json()
        nodes = {n["id"]: (n["lon"], n["lat"]) for n in osm_data.get("elements", []) if n["type"] == "node"}
        features = []
        idx = 1

        for elem in osm_data.get("elements", []):
            if elem["type"] == "way" and "nodes" in elem:
                coords = [nodes[n_id] for n_id in elem["nodes"] if n_id in nodes]
                if len(coords) >= 2:
                    tags = elem.get("tags", {})
                    features.append({
                        "type": "Feature",
                        "id": f"ROAD-{idx:03d}",
                        "properties": {
                            "road_id": f"ROAD-{idx:03d}",
                            "name": tags.get("name", f"Road Line {idx}"),
                            "highway": tags.get("highway", "residential"),
                            "surface": tags.get("surface", "paved")
                        },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": coords
                        }
                    })
                    idx += 1

        out_file = PROCESSED_DATA_DIR / "ingested_roads.geojson"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump({
                "type": "FeatureCollection",
                "name": "osm_ingested_roads",
                "features": features
            }, f, indent=2)

        print(f"[Data-Track] Ingested {len(features)} road lines to {out_file}")
        return out_file
    except Exception as e:
        print(f"[Data-Track] Road download error: {e}")
        return None


if __name__ == "__main__":
    download_osm_roads()
