"""
Pipeline configuration settings and GIS constants for Cadastral AI Mapper.
"""

from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
SAMPLE_AREA_DIR = DATA_DIR / "sample_area"
CHECKPOINTS_DIR = BASE_DIR / "ml_pipeline" / "checkpoints"

# SAM Model Settings
SAM_CHECKPOINT_TYPE = "vit_b"  # options: vit_h, vit_l, vit_b
SAM_CHECKPOINT_URLS = {
    "vit_h": "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth",
    "vit_l": "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_l_0b3195.pth",
    "vit_b": "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth",
}
SAM_CHECKPOINT_PATH = CHECKPOINTS_DIR / f"sam_{SAM_CHECKPOINT_TYPE}.pth"

# Inference parameters
MIN_CONTOUR_AREA_PIXELS = 150
APPROX_POLY_EPSILON_RATIO = 0.005  # Polygon simplification ratio
DEFAULT_CONFIDENCE_THRESHOLD = 0.70

# Spatial Coordinate Systems
SOURCE_CRS = "EPSG:4326"        # WGS84 Latitude/Longitude
METRIC_CRS = "EPSG:3857"        # Pseudo-Mercator for area calculation (or local UTM e.g. EPSG:32643)

# Default Sample Bounding Box (Bengaluru, Karnataka)
DEFAULT_BBOX = {
    "min_lat": 12.9340,
    "max_lat": 12.9360,
    "min_lon": 77.6190,
    "max_lon": 77.6220,
    "name": "Koramangala Block 4, Bengaluru, India",
    "state_code": "29",          # Karnataka Census State Code
    "district_code": "572"      # Bengaluru Urban
}

# ULPIN Standards
ULPIN_LENGTH = 14
STATE_PREFIXES = {
    "Karnataka": "29",
    "Maharashtra": "27",
    "Gujarat": "24",
    "Tamil Nadu": "33",
    "Telangana": "36",
    "Delhi": "07"
}
