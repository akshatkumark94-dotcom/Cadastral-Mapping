# Cadastral AI Mapper — Data Sources & Hierarchical Region Guide

This document details the spatial data sources, coordinate retrieval methods, and the multi-city hierarchical structure utilized by **Cadastral AI Mapper** (Smart India Hackathon 2026).

---

## 🏙️ Hierarchical Spatial Architecture

Cadastral AI Mapper organizes land records across a 3-tier hierarchy:

$$\text{Region (City)} \longrightarrow \text{Mini-Segment (Sub-area/Ward/Block)} \longrightarrow \text{Parcels / Footprints / Roads}$$

### Supported Regions & Mini-Segments

| Region (City) | State & District Code | Mini-Segments (Sub-areas / Wards) | Primary Land Use |
|---|---|---|---|
| **Delhi** | `07-001` (Delhi NCT) | • `karol_bagh`<br>• `dwarka_sector12`<br>• `connaught_place` | High-density Commercial, Mixed-Use & Residential |
| **Ghaziabad** | `09-013` (Uttar Pradesh) | • `indirapuram`<br>• `vaishali` | Planned Group Housing & High-rise Residential |
| **Meerut** | `09-007` (Uttar Pradesh) | • `civil_lines`<br>• `shastri_nagar` | Institutional, Commercial & Suburban Parcels |
| **Panipat** | `06-004` (Haryana) | • `model_town`<br>• `sector13_17` | Industrial & Urban Residential Sectors |

---

## 📍 How to Obtain Mini-Segment Bounding Boxes (Google Maps)

To configure real coordinate bounds for any mini-segment in [`ml_pipeline/config.py`](file:///c:/Users/aksha/OneDrive/Desktop/Cadastral%20Mapping/ml_pipeline/config.py):

1. Open **[Google Maps](https://maps.google.com)** in your browser.
2. Search for the target city and zoom into the specific neighborhood / block (e.g. *Karol Bagh, New Delhi*).
3. Identify the rectangular boundary covering your survey zone:
   - **South-West Corner (Bottom-Left):** Right-click the bottom-left corner of the area on the map. Click the latitude/longitude numbers at the top of the popup menu to copy them. The first number is `min_lat`, the second number is `min_lon`.
   - **North-East Corner (Top-Right):** Right-click the top-right corner of the area on the map. Click the coordinates to copy them. The first number is `max_lat`, the second number is `max_lon`.
4. Paste the 4 values into the corresponding segment definition in `ml_pipeline/config.py`:
   ```python
   "karol_bagh": {
       "name": "Karol Bagh",
       "min_lat": 28.6480, "max_lat": 28.6580,
       "min_lon": 77.1850, "max_lon": 77.1980
   }
   ```
5. Re-run `python scripts/download_open_buildings.py` to automatically fetch and clip building footprints for the new bounding boxes.

---

## 🛰️ Data Ingestion Sources

### 1. Google Open Buildings Dataset
- **Format:** Vector Polygon Footprints / CSV.
- **Coverage:** Nationwide coverage across India with model confidence scores $\ge 0.70$.
- **Ingestion:** Managed via `scripts/download_open_buildings.py`.

### 2. OpenStreetMap (OSM) via Overpass API
- **Building Footprints:** Extracted via Overpass `way["building"]` queries.
- **Road Centerlines:** Extracted via Overpass `way["highway"]` queries to establish public right-of-way boundaries and road alignments.

### 3. Digital India Land Records (DILRMP) & ULPIN Standards
- **Standard:** 14-digit Unique Land Parcel Identification Number (ULPIN) generated based on state code, district code, and sub-meter centroid geohash encoding.
- **Format:** `SS-DDD-XXXXXXXX-C` (e.g., `07-001-TD4K9X2A-Q`).

### 4. Satellite Imagery Providers
- **Esri World Imagery:** High-resolution sub-meter optical satellite tiles for visual ground truth.
- **ISRO Bhuvan & Copernicus Sentinel-2:** Multi-spectral open earth observation tiles for land cover classification.
