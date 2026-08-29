"""
Pipeline configuration settings, GIS constants, and Multi-City Region Hierarchy for Cadastral AI Mapper.
Smart India Hackathon 2026

=============================================================================================
HOW TO OBTAIN REAL BOUNDING BOX COORDINATES FOR A MINI-SEGMENT USING GOOGLE MAPS:
=============================================================================================
1. Open Google Maps (https://maps.google.com) in your browser.
2. Navigate to your target city and zoom into the specific mini-segment (e.g. Karol Bagh).
3. Identify the rectangular boundary covering the target parcel/block survey area:
   - Step A: RIGHT-CLICK the BOTTOM-LEFT (South-West) corner of the area.
             Click the latitude/longitude numbers at the top of the popup menu to copy them.
             The first value is 'min_lat', the second value is 'min_lon'.
   - Step B: RIGHT-CLICK the TOP-RIGHT (North-East) corner of the area.
             Click the latitude/longitude numbers at the top of the popup menu to copy them.
             The first value is 'max_lat', the second value is 'max_lon'.
4. Paste the 4 copied coordinate values into the respective segment definition below.
   Example:
     "min_lat": 28.6480, "max_lat": 28.6580,
     "min_lon": 77.1850, "max_lon": 77.1980
=============================================================================================
"""

from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional

# Base Directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
SEGMENTS_DATA_DIR = PROCESSED_DATA_DIR / "segments"
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
APPROX_POLY_EPSILON_RATIO = 0.005
DEFAULT_CONFIDENCE_THRESHOLD = 0.70

# Spatial Coordinate Systems
SOURCE_CRS = "EPSG:4326"        # WGS84 Latitude/Longitude
METRIC_CRS = "EPSG:3857"        # Web Mercator for metric calculation

# Standard State Census Codes
STATE_PREFIXES = {
    "Delhi": "07",
    "Uttar Pradesh": "09",
    "Haryana": "06",
    "Karnataka": "29",
    "Maharashtra": "27"
}

# =============================================================================================
# MULTI-CITY REGION HIERARCHY & MINI-SEGMENTS
# Region (City) -> Mini-Segment (Sub-area/Ward/Block) -> Parcels / Buildings / Roads
# =============================================================================================
REGIONS: Dict[str, Dict[str, Any]] = {
    "delhi": {
        "name": "Delhi",
        "state_code": "07",
        "district_code": "001",
        "segments": {
            "karol_bagh": {
                "name": "Karol Bagh",
                "min_lat": 0.0, "max_lat": 0.0,
                "min_lon": 0.0, "max_lon": 0.0
            },
            "dwarka_sector12": {
                "name": "Dwarka Sector 12",
                "min_lat": 0.0, "max_lat": 0.0,
                "min_lon": 0.0, "max_lon": 0.0
            },
            "connaught_place": {
                "name": "Connaught Place",
                "min_lat": 0.0, "max_lat": 0.0,
                "min_lon": 0.0, "max_lon": 0.0
            }
        }
    },
    "ghaziabad": {
        "name": "Ghaziabad",
        "state_code": "09",
        "district_code": "013",
        "segments": {
            "indirapuram": {
                "name": "Indirapuram",
                "min_lat": 0.0, "max_lat": 0.0,
                "min_lon": 0.0, "max_lon": 0.0
            },
            "vaishali": {
                "name": "Vaishali",
                "min_lat": 0.0, "max_lat": 0.0,
                "min_lon": 0.0, "max_lon": 0.0
            }
        }
    },
    "meerut": {
        "name": "Meerut",
        "state_code": "09",
        "district_code": "007",
        "segments": {
            "civil_lines": {
                "name": "Civil Lines",
                "min_lat": 0.0, "max_lat": 0.0,
                "min_lon": 0.0, "max_lon": 0.0
            },
            "shastri_nagar": {
                "name": "Shastri Nagar",
                "min_lat": 0.0, "max_lat": 0.0,
                "min_lon": 0.0, "max_lon": 0.0
            }
        }
    },
    "panipat": {
        "name": "Panipat",
        "state_code": "06",
        "district_code": "004",
        "segments": {
            "model_town": {
                "name": "Model Town",
                "min_lat": 0.0, "max_lat": 0.0,
                "min_lon": 0.0, "max_lon": 0.0
            },
            "sector13_17": {
                "name": "Sector 13-17",
                "min_lat": 0.0, "max_lat": 0.0,
                "min_lon": 0.0, "max_lon": 0.0
            }
        }
    }
}


# =============================================================================================
# HELPER FUNCTIONS FOR REGIONS & SEGMENTS
# =============================================================================================

def get_all_segments() -> List[Tuple[str, str, Dict[str, Any]]]:
    """
    Flattens the nested region structure into a list of tuples:
    [(region_key, segment_key, segment_dict), ...]
    Useful for ingestion scripts looping through all cities and mini-segments.
    """
    segment_list = []
    for region_key, region_data in REGIONS.items():
        for segment_key, segment_data in region_data.get("segments", {}).items():
            combined_segment_info = dict(segment_data)
            combined_segment_info["region_key"] = region_key
            combined_segment_info["region_name"] = region_data.get("name", region_key)
            combined_segment_info["state_code"] = region_data.get("state_code", "00")
            combined_segment_info["district_code"] = region_data.get("district_code", "000")
            segment_list.append((region_key, segment_key, combined_segment_info))
    return segment_list


def get_all_regions() -> Dict[str, Dict[str, Any]]:
    """Returns the full REGIONS dictionary."""
    return REGIONS


def get_region(region_key: str) -> Optional[Dict[str, Any]]:
    """Returns configuration for a specific city region."""
    return REGIONS.get(region_key.lower())


def get_segment(region_key: str, segment_key: str) -> Optional[Dict[str, Any]]:
    """Returns configuration for a specific mini-segment inside a city region."""
    region = get_region(region_key)
    if not region:
        return None
    segment = region.get("segments", {}).get(segment_key.lower())
    if not segment:
        return None
    res = dict(segment)
    res["region_key"] = region_key
    res["region_name"] = region.get("name", region_key)
    res["state_code"] = region.get("state_code", "00")
    res["district_code"] = region.get("district_code", "000")
    return res
