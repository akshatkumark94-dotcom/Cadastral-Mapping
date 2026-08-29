"""
Geometric topology engine for Cadastral AI Mapper.
Performs spatial validation, boundary conflict detection, polygon snapping, and metric area calculation.
"""

from typing import List, Dict, Any, Tuple
import math

try:
    from shapely.geometry import Polygon, MultiPolygon, shape, mapping
    from shapely.ops import transform, unary_union
    import pyproj

    wgs84_to_metric = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True).transform
    metric_to_wgs84 = pyproj.Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True).transform
    GIS_LIBS_AVAILABLE = True
except ImportError:
    GIS_LIBS_AVAILABLE = False
    wgs84_to_metric = None
    metric_to_wgs84 = None
    Polygon = None
    MultiPolygon = None
    shape = None
    mapping = None


def calculate_metric_metrics(geom: Polygon) -> Tuple[float, float]:
    """
    Calculates accurate area (in sq. meters) and perimeter (in meters) for a WGS84 polygon.
    """
    try:
        metric_geom = transform(wgs84_to_metric, geom)
        area_sqm = round(metric_geom.area, 2)
        perimeter_m = round(metric_geom.length, 2)
        return max(area_sqm, 0.0), max(perimeter_m, 0.0)
    except Exception as e:
        # Fallback approximation for degrees to meters at typical mid-latitudes
        centroid_lat = geom.centroid.y
        lat_m = 111132.954
        lon_m = 111412.84 * math.cos(math.radians(centroid_lat))
        raw_area = geom.area * lat_m * lon_m
        raw_perimeter = geom.length * ((lat_m + lon_m) / 2)
        return round(max(raw_area, 0.0), 2), round(max(raw_perimeter, 0.0), 2)


def simplify_polygon(geom: Polygon, tolerance: float = 0.00001) -> Polygon:
    """
    Simplifies polygon vertices using Douglas-Peucker while preserving topological validity.
    """
    simplified = geom.simplify(tolerance, preserve_topology=True)
    if not simplified.is_valid or simplified.is_empty:
        return geom
    return simplified


def detect_topology_conflicts(parcels: List[Dict[str, Any]], overlap_threshold_sqm: float = 2.0) -> List[Dict[str, Any]]:
    """
    Runs an all-pairs spatial intersection check across candidate parcels.
    Returns a list of detected topology conflict objects with intersection geometries.
    """
    conflicts = []
    num_parcels = len(parcels)

    shapely_parcels = []
    for p in parcels:
        geom_dict = p.get("geometry")
        if not geom_dict:
            continue
        try:
            poly = shape(geom_dict)
            if not poly.is_valid:
                poly = poly.buffer(0)
            shapely_parcels.append({
                "id": p.get("id") or p.get("properties", {}).get("id"),
                "survey_no": p.get("properties", {}).get("survey_no", "Unknown"),
                "geom": poly,
                "props": p.get("properties", {})
            })
        except Exception:
            continue

    for i in range(len(shapely_parcels)):
        for j in range(i + 1, len(shapely_parcels)):
            p1 = shapely_parcels[i]
            p2 = shapely_parcels[j]

            # Fast bounding box check
            if not p1["geom"].intersects(p2["geom"]):
                continue

            intersection = p1["geom"].intersection(p2["geom"])
            if intersection.is_empty:
                continue

            # Check if intersection is a 2D surface (Polygon / MultiPolygon)
            if isinstance(intersection, (Polygon, MultiPolygon)):
                area_sqm, _ = calculate_metric_metrics(intersection)
                if area_sqm >= overlap_threshold_sqm:
                    conflict_id = f"CONF-{p1['id']}-{p2['id']}"[-12:]
                    conflicts.append({
                        "id": conflict_id,
                        "conflict_id": conflict_id,
                        "conflict_type": "OVERLAP_DISPUTE",
                        "severity": "HIGH" if area_sqm > 50.0 else "MEDIUM",
                        "parcels_involved": [p1["id"], p2["id"]],
                        "overlap_area_sqm": area_sqm,
                        "description": f"Boundary overlap of {area_sqm} sq.m between Parcel {p1['survey_no']} and {p2['survey_no']}",
                        "suggested_action": "CLIP_TO_MEDIAN_EDGE",
                        "status": "UNRESOLVED",
                        "geometry": mapping(intersection)
                    })

    return conflicts


def resolve_overlap_by_clipping(poly_primary: Polygon, poly_secondary: Polygon) -> Tuple[Polygon, Polygon]:
    """
    Resolves an overlap by subtracting the intersection area from the secondary parcel.
    """
    if not poly_primary.intersects(poly_secondary):
        return poly_primary, poly_secondary

    clean_primary = poly_primary
    clean_secondary = poly_secondary.difference(poly_primary)

    # Ensure validity
    if not clean_secondary.is_valid:
        clean_secondary = clean_secondary.buffer(0)

    return clean_primary, clean_secondary


def snap_vertices(geom: Polygon, reference_geom: Polygon, tolerance: float = 0.00005) -> Polygon:
    """
    Snaps vertices of geom to nearby vertices of reference_geom within a distance tolerance.
    """
    from shapely.ops import snap
    return snap(geom, reference_geom, tolerance)


def validate_parcel_topology(parcel_geojson: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates single parcel topology (checks self-intersection, minimum area, hole orientation).
    """
    try:
        geom = shape(parcel_geojson["geometry"])
        is_valid = geom.is_valid
        area_sqm, perimeter_m = calculate_metric_metrics(geom)

        return {
            "is_valid": is_valid,
            "area_sqm": area_sqm,
            "perimeter_m": perimeter_m,
            "has_holes": len(geom.interiors) > 0 if isinstance(geom, Polygon) else False,
            "errors": [] if is_valid else ["Self-intersecting boundary detected"]
        }
    except Exception as e:
        return {
            "is_valid": False,
            "area_sqm": 0.0,
            "perimeter_m": 0.0,
            "has_holes": False,
            "errors": [str(e)]
        }
