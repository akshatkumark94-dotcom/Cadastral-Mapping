"""
Data Ingestion Script: Download Satellite Imagery Tiles
Downloads high-resolution aerial/satellite tiles for a given region (Bhuvan / Esri / Sentinel-2)
and stitches them for AI model segmentation inference.
"""

import math
import requests
from pathlib import Path
from ml_pipeline.config import RAW_DATA_DIR, DEFAULT_BBOX


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


def download_sample_area_imagery(bbox: dict = DEFAULT_BBOX, zoom: int = 17) -> Path:
    """
    Downloads imagery tiles for the bounding box and saves them to data/raw/imagery/.
    """
    imagery_dir = RAW_DATA_DIR / "imagery"
    imagery_dir.mkdir(parents=True, exist_ok=True)

    min_lat, max_lat = bbox["min_lat"], bbox["max_lat"]
    min_lon, max_lon = bbox["min_lon"], bbox["max_lon"]

    x_min, y_min = deg2num(max_lat, min_lon, zoom)
    x_max, y_max = deg2num(min_lat, max_lon, zoom)

    print(f"[Data-Track] Downloading satellite tiles for Zoom level {zoom} (X: {x_min}-{x_max}, Y: {y_min}-{y_max})...")

    downloaded = 0
    for x in range(min(x_min, x_max), max(x_min, x_max) + 1):
        for y in range(min(y_min, y_max), max(y_min, y_max) + 1):
            tile_path = imagery_dir / f"tile_{zoom}_{x}_{y}.jpg"
            if not tile_path.exists():
                success = download_tile(x, y, zoom, tile_path)
                if success:
                    downloaded += 1

    print(f"[Data-Track] Successfully downloaded {downloaded} satellite tile(s) to {imagery_dir}")
    return imagery_dir


if __name__ == "__main__":
    download_sample_area_imagery()
