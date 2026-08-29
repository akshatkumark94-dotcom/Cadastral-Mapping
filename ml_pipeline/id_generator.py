"""
ULPIN (Unique Land Parcel Identification Number) Generator
Implements standard compliant 14-character unique land parcel ID generation
based on geospatial coordinates, geohash, and national cadastral standards (DILRMP/Bhuvan).
"""

import hashlib
import math
from typing import Tuple, Union
from typing import Tuple, Union, Any

try:
    from shapely.geometry import Polygon, MultiPolygon
    SHAPELY_AVAILABLE = True
except ImportError:
    Polygon = None
    MultiPolygon = None
    SHAPELY_AVAILABLE = False

# Standard Base32 alphabet used in geohash systems
BASE32 = "0123456789BCDFGHJKLMNPQRSTUVWXYZ"


def encode_geohash(latitude: float, longitude: float, precision: int = 8) -> str:
    """
    Encodes latitude and longitude into standard geohash string.
    """
    lat_interval = [-90.0, 90.0]
    lon_interval = [-180.0, 180.0]
    geohash = []
    bits = [16, 8, 4, 2, 1]
    bit = 0
    ch = 0
    even = True

    while len(geohash) < precision:
        if even:
            mid = (lon_interval[0] + lon_interval[1]) / 2
            if longitude > mid:
                ch |= bits[bit]
                lon_interval[0] = mid
            else:
                lon_interval[1] = mid
        else:
            mid = (lat_interval[0] + lat_interval[1]) / 2
            if latitude > mid:
                ch |= bits[bit]
                lat_interval[0] = mid
            else:
                lat_interval[1] = mid

        even = not even
        if bit < 4:
            bit += 1
        else:
            geohash.append(BASE32[ch])
            bit = 0
            ch = 0

    return "".join(geohash)


def calculate_centroid(geom: Union[Polygon, MultiPolygon]) -> Tuple[float, float]:
    """
    Calculates latitude, longitude of a Shapely geometry centroid.
    """
    centroid = geom.centroid
    return centroid.y, centroid.x


def generate_ulpin(
    lat_or_geom: Union[float, Polygon, MultiPolygon],
    lon: float = None,
    state_code: str = "29",
    district_code: str = "572",
    prefix_format: bool = True
) -> str:
    """
    Generates a 14-character alphanumeric ULPIN for a given parcel location or polygon.

    Format: [State: 2 digits][District: 3 digits][Geohash Coord Hash: 8 chars][Check digit: 1 char]
    Total Length: 14 characters

    Example output: 29-572-TD4K9X2A or 29572TD4K9X28A
    """
    if SHAPELY_AVAILABLE and Polygon is not None and isinstance(lat_or_geom, (Polygon, MultiPolygon)):
        lat, lng = calculate_centroid(lat_or_geom)
    else:
        lat = float(lat_or_geom)
        lng = float(lon)

    # Validate coordinate bounds
    lat = max(min(lat, 90.0), -90.0)
    lng = max(min(lng, 180.0), -180.0)

    # Generate 8-character coordinate geohash
    gh = encode_geohash(lat, lng, precision=8)

    # Compute a deterministic Luhn-style / CRC check digit
    combined_raw = f"{state_code}{district_code}{gh}"
    sha_hash = hashlib.sha256(combined_raw.encode("utf-8")).hexdigest()
    checksum_char = BASE32[int(sha_hash[:2], 16) % len(BASE32)]

    if prefix_format:
        # User-friendly formatted view: SS-DDD-XXXXXXXX-C
        return f"{state_code[:2]}-{district_code[:3]}-{gh[:6]}-{gh[6:]}{checksum_char}"
    else:
        # Standard contiguous 14-character key
        raw_ulpin = f"{state_code[:2]}{district_code[:3]}{gh}{checksum_char}"
        return raw_ulpin[:14]


def parse_ulpin(ulpin_str: str) -> dict:
    """
    Parses a ULPIN string and extracts state code, district code, and coordinate components.
    """
    clean_str = ulpin_str.replace("-", "").strip().upper()
    return {
        "raw": clean_str,
        "state_code": clean_str[:2] if len(clean_str) >= 2 else None,
        "district_code": clean_str[2:5] if len(clean_str) >= 5 else None,
        "coord_hash": clean_str[5:13] if len(clean_str) >= 13 else None,
        "checksum": clean_str[13:] if len(clean_str) >= 14 else None,
        "is_valid": len(clean_str) == 14
    }


if __name__ == "__main__":
    test_lat, test_lon = 12.93510, 77.62010
    sample_ulpin = generate_ulpin(test_lat, test_lon)
    print(f"Generated ULPIN for ({test_lat}, {test_lon}): {sample_ulpin}")
    print(f"Parsed metadata: {parse_ulpin(sample_ulpin)}")
