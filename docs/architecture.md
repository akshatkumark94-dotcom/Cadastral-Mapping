# Cadastral AI Mapper — Technical Architecture

This document describes the high-level system architecture, data processing workflows, and component boundaries for the **Cadastral AI Mapper** platform developed for Smart India Hackathon 2026.

---

## 1. System Overview

```
                      +---------------------------------------+
                      |   Drone Orthomosaics / Satellite WMS  |
                      |   (Bhuvan / Sentinel-2 / Cartosat)    |
                      +-------------------+-------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                         ML & GIS Processing Pipeline                              |
|                                                                                   |
|   +------------------------------------+   +----------------------------------+   |
|   |  SAM (Segment Anything Model)      |   |  Topology Validation Engine      |   |
|   |  - Automatic Mask Generation       |-->|  - Overlap Intersection Matrix   |   |
|   |  - Contours & Vector Extraction    |   |  - Sliver & Micro-gap Detection  |   |
|   +------------------------------------+   +-----------------+----------------+   |
|                                                              |                    |
|                                            +-----------------v----------------+   |
|                                            |  ULPIN Generator Engine          |   |
|                                            |  - Geohash Coordinate Hashing    |   |
|                                            |  - DILRMP 14-Digit Standard      |   |
|                                            +-----------------+----------------+   |
+--------------------------------------------------------------|--------------------+
                                                               |
                                                               v
+-----------------------------------------------------------------------------------+
|                            FastAPI Backend Server                                 |
|                                                                                   |
|   +-----------------------+   +------------------------+   +------------------+   |
|   |   /api/parcels        |   |   /api/conflicts       |   |   /api/stats     |   |
|   |   - GeoJSON CRUD      |   |   - Overlap Detection  |   |   - KPI Metrics  |   |
|   |   - Surveyor Approval |   |   - Auto-Clip Edge     |   |   - Land Area Ha |   |
|   +-----------------------+   +------------------------+   +------------------+   |
|                               |                                                   |
|                 +-------------v--------------+                                    |
|                 |   SQLite / SpatiaLite DB   |                                    |
|                 +----------------------------+                                    |
+-----------------------------------------------------------------------------------+
                               |
                               | (JSON / REST API)
                               v
+-----------------------------------------------------------------------------------+
|                        Frontend Web Map Dashboard                                 |
|                                                                                   |
|   +-----------------------+   +------------------------+   +------------------+   |
|   |  Leaflet.js Map       |   |  Parcel Inspector      |   |  Dispute Matrix  |   |
|   |  - Esri Satellite WMS |   |  - ULPIN Registry      |   |  - Conflict List |   |
|   |  - Dynamic GeoJSON    |   |  - Surveyor Approvals  |   |  - Auto-Resolve  |   |
|   +-----------------------+   +------------------------+   +------------------+   |
+-----------------------------------------------------------------------------------+
```

---

## 2. Track Breakdown & Responsibilities

### Data Track (`scripts/`, `data/`)
- Ingests building footprints from Google Open Buildings and OpenStreetMap via Overpass API.
- Downloads satellite imagery tiles from Bhuvan / Esri WMS services.
- Structures spatial data in standard GeoJSON format (`EPSG:4326` WGS84).

### ML Pipeline Track (`ml_pipeline/`)
- **Segmentation (`segmentation.py`):** Uses Meta's Segment Anything Model (SAM) with a fallback OpenCV adaptive vectorizer to generate building footprints from raster tiles.
- **Topology Engine (`geometry.py`):** Uses Shapely and GeoPandas to compute all-pairs intersection matrices, identify illegal parcel overlaps (`> 2.0 sq.m`), and detect micro-gaps.
- **ULPIN Engine (`id_generator.py`):** Converts polygon centroids into 14-digit nationwide land parcel identifiers complying with Digital India Land Records standards.

### Backend Track (`backend/`)
- Built with **FastAPI** for asynchronous REST operations.
- GeoJSON FeatureCollection serialization for spatial query responses.
- Automated seed loader that initializes SQLite with realistic sample cadastral boundaries.

### Frontend Track (`frontend/`)
- Built with **Vanilla HTML5/CSS3/JS** and **Leaflet.js**.
- High-performance vector rendering for parcel boundaries, conflict highlights, and road networks.
- Two-way interaction: Live conflict resolution, property editing, and approval workflow.

---

## 3. Database Schema

### `parcels` Table
| Column | Type | Description |
|---|---|---|
| `id` | TEXT (PK) | Unique internal parcel ID |
| `ulpin` | TEXT | 14-character nationwide ULPIN |
| `survey_no` | TEXT | Revenue survey number |
| `owner_name` | TEXT | Landowner name |
| `land_use` | TEXT | Residential / Commercial / Agricultural |
| `area_sqm` | REAL | Metric area in square meters |
| `perimeter_m` | REAL | Metric perimeter in meters |
| `status` | TEXT | `approved` \| `pending` \| `flagged` \| `rejected` |
| `confidence_score`| REAL | AI prediction confidence (0.00 - 1.00) |
| `geometry_json` | TEXT | GeoJSON geometry object string |

### `conflicts` Table
| Column | Type | Description |
|---|---|---|
| `id` | TEXT (PK) | Conflict ID |
| `conflict_type` | TEXT | `OVERLAP_DISPUTE` \| `SLIVER_GAP` |
| `severity` | TEXT | `HIGH` \| `MEDIUM` \| `LOW` |
| `parcels_involved_json`| TEXT | JSON array of conflicting parcel IDs |
| `overlap_area_sqm` | REAL | Overlap area in square meters |
| `status` | TEXT | `UNRESOLVED` \| `RESOLVED` |
| `geometry_json` | TEXT | Intersection polygon GeoJSON |
