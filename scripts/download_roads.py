"""
Data Ingestion Script: Download Road Networks per City / Mini-Segment
Smart India Hackathon 2026 — Cadastral AI Mapper

Extracts road centerlines for cadastral overlay alignment across mini-segments.
"""

import json
import sys
import argparse
import requests
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml_pipeline.config import RAW_DATA_DIR, PROCESSED_DATA_DIR, SEGMENTS_DATA_DIR, get_all_segments, get_segment


def download_osm_roads_for_segment(region_key: str, segment_key: str, bbox: dict) -> Path:
    """
    Downloads highway and road network lines for a specific mini-segment.
    """
    SEGMENTS_DATA_DIR.mkdir(parents=True, exist_ok=True)
    min_lat = bbox.get("min_lat", 0.0)
    max_lat = bbox.get("max_lat", 0.0)
    min_lon = bbox.get("min_lon", 0.0)
    max_lon = bbox.get("max_lon", 0.0)

    if min_lat == 0.0 or max_lat == 0.0 or min_lon == 0.0 or max_lon == 0.0:
        # Generate baseline sample road lines for visualization
        base_lats = {
            "delhi": (28.6400, 77.2000),
            "ghaziabad": (28.6692, 77.4538),
            "meerut": (28.9845, 77.7064),
            "panipat": (29.3909, 76.9635)
        }
        b_lat, b_lon = base_lats.get(region_key, (28.6000, 77.2000))
        features = [
            {
                "type": "Feature",
                "id": f"ROAD-{region_key[:3].upper()}-{segment_key[:3].upper()}-01",
                "properties": {
                    "name": f"Main Arterial Avenue ({segment_key.replace('_', ' ').title()})",
                    "highway": "primary",
                    "region": region_key,
                    "segment": segment_key
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [b_lon - 0.0005, b_lat + 0.0006],
                        [b_lon + 0.0015, b_lat + 0.0006]
                    ]
                }
            }
        ]
        out_file = SEGMENTS_DATA_DIR / f"{region_key}_{segment_key}_roads.geojson"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump({"type": "FeatureCollection", "features": features}, f, indent=2)
        return out_file

    overpass_query = f"""
    [out:json][timeout:25];
    (
      way["highway"]({min_lat},{min_lon},{max_lat},{max_lon});
    );
    out body;
    >;
    out skel qt;
    """
    url = "https://overpass-api.de/api/interpreter"
    try:
        response = requests.post(url, data={"data": overpass_query}, timeout=30)
        if response.status_code != 200:
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
                        "id": f"ROAD-{region_key[:3].upper()}-{segment_key[:3].upper()}-{idx:03d}",
                        "properties": {
                            "name": tags.get("name", f"Road Line {idx}"),
                            "highway": tags.get("highway", "residential"),
                            "region": region_key,
                            "segment": segment_key
                        },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": coords
                        }
                    })
                    idx += 1

        out_file = SEGMENTS_DATA_DIR / f"{region_key}_{segment_key}_roads.geojson"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump({"type": "FeatureCollection", "features": features}, f, indent=2)
        return out_file
    except Exception as e:
        print(f"Error downloading roads for {region_key} > {segment_key}: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description="Download road networks for city segments.")
    parser.add_argument("--region", type=str, default=None, help="Target city region key (e.g. delhi)")
    parser.add_argument("--segment", type=str, default=None, help="Target mini-segment key (e.g. karol_bagh)")
    args = parser.parse_args()

    if args.region and args.segment:
        seg = get_segment(args.region, args.segment)
        if seg:
            download_osm_roads_for_segment(args.region, args.segment, seg)
    else:
        for r_key, s_key, s_dict in get_all_segments():
            download_osm_roads_for_segment(r_key, s_key, s_dict)
            print(f"Processed roads for {r_key} > {s_key}")


if __name__ == "__main__":
    main()
