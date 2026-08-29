"""
Data Ingestion Script: Download Satellite Imagery Tiles per Mini-Segment
Smart India Hackathon 2026 — Cadastral AI Mapper
"""

import math
import sys
import argparse
import requests
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml_pipeline.config import RAW_DATA_DIR, get_all_segments, get_segment


def deg2num(lat_deg: float, lon_deg: float, zoom: int):
    """Converts latitude and longitude to Slippy Map tile numbers."""
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return (xtile, ytile)


def download_tile(x: int, y: int, z: int, out_path: Path) -> bool:
    """Downloads an individual satellite tile from open XYZ service."""
    url = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    headers = {"User-Agent": "CadastralAIMapper-SIH2026/1.0"}
    try:
        r = requests.get(url, headers=headers, timeout=15)
        if r.status_code == 200:
            with open(out_path, "wb") as f:
                f.write(r.content)
            return True
    except Exception as e:
        print(f"Tile ({x}, {y}, {z}) download error: {e}")
    return False


def download_segment_imagery(region_key: str, segment_key: str, bbox: dict, zoom: int = 17) -> Path:
    """
    Downloads imagery tiles for a specific mini-segment.
    """
    imagery_dir = RAW_DATA_DIR / "imagery" / f"{region_key}_{segment_key}"
    imagery_dir.mkdir(parents=True, exist_ok=True)

    min_lat = bbox.get("min_lat", 0.0)
    max_lat = bbox.get("max_lat", 0.0)
    min_lon = bbox.get("min_lon", 0.0)
    max_lon = bbox.get("max_lon", 0.0)

    if min_lat == 0.0 or max_lat == 0.0 or min_lon == 0.0 or max_lon == 0.0:
        print(f"[Imagery] Placeholder coordinates for {region_key} > {segment_key}. Skipping tile download.")
        return imagery_dir

    x_min, y_min = deg2num(max_lat, min_lon, zoom)
    x_max, y_max = deg2num(min_lat, max_lon, zoom)

    downloaded = 0
    for x in range(min(x_min, x_max), max(x_min, x_max) + 1):
        for y in range(min(y_min, y_max), max(y_min, y_max) + 1):
            tile_path = imagery_dir / f"tile_{zoom}_{x}_{y}.jpg"
            if not tile_path.exists():
                success = download_tile(x, y, zoom, tile_path)
                if success:
                    downloaded += 1

    print(f"[Imagery] Downloaded {downloaded} tile(s) for {region_key} > {segment_key} into {imagery_dir}")
    return imagery_dir


def main():
    parser = argparse.ArgumentParser(description="Download satellite imagery for city segments.")
    parser.add_argument("--region", type=str, default=None, help="Target city region key (e.g. delhi)")
    parser.add_argument("--segment", type=str, default=None, help="Target mini-segment key (e.g. karol_bagh)")
    parser.add_argument("--zoom", type=int, default=17, help="Tile zoom level (default: 17)")
    args = parser.parse_args()

    if args.region and args.segment:
        seg = get_segment(args.region, args.segment)
        if seg:
            download_segment_imagery(args.region, args.segment, seg, zoom=args.zoom)
    else:
        for r_key, s_key, s_dict in get_all_segments():
            download_segment_imagery(r_key, s_key, s_dict, zoom=args.zoom)


if __name__ == "__main__":
    main()
