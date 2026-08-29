# Cadastral AI Mapper — Data Sources Guide

This document details the spatial, raster, and vector data sources utilized by the **Cadastral AI Mapper** platform for automated land parcel extraction, validation, and ULPIN registry management in India.

---

## 1. Google Open Buildings Dataset
- **Description:** Large-scale building footprints extracted from high-resolution satellite imagery across the Global South using convolutional neural networks and transformer models.
- **Coverage:** India (v3 dataset covers urban and rural geographies).
- **Format:** CSV / GeoJSON / Cloud-Optimized GeoTIFF (COG).
- **Confidence Scores:** Provided per polygon (0.50 to 1.00). Filtered at `>= 0.70` for cadastral candidate generation.
- **Integration:** Automated download script via `scripts/download_buildings.py`.

---

## 2. Bhuvan (ISRO National Geo-Portal)
- **Description:** Geo-spatial platform by the Indian Space Research Organisation (ISRO) providing multi-resolution Earth observation data, Cartosat imagery (up to 2.5m/0.65m GSD), and cadastral web map services (WMS/WFS).
- **Services:**
  - **Bhuvan 2D/3D WMS:** `https://bhuvan-vec1.nrsc.gov.in/bhuvan/wms`
  - **Thematic Services:** Land Use Land Cover (LULC 1:50k), Geomorphology, and Cadastral Overlays (where state DILRMP digitized).
- **Usage in Cadastral AI Mapper:** Reference satellite base maps and state boundary alignment.

---

## 3. OpenStreetMap (OSM)
- **Description:** Collaborative global vector database containing road networks, administrative boundaries, natural features, and building outlines.
- **Query Method:** Overpass API / OSMnx.
- **Usage in Pipeline:**
  - Highway and road centerlines to prevent parcel overlapping with public right-of-way corridors.
  - Baseline comparison for newly extracted AI building footprints.

---

## 4. DILRMP & ULPIN (Digital India Land Records Modernization Programme)
- **Standard:** 14-digit Unique Land Parcel Identification Number (ULPIN) defined by the Department of Land Resources (DoLR), Ministry of Rural Development, Government of India.
- **Algorithmic Structure:**
  1. **State Code (2 Digits):** Census state code (e.g. `29` for Karnataka, `27` for Maharashtra).
  2. **District Code (3 Digits):** Census district identifier (e.g. `572` for Bengaluru Urban).
  3. **Spatial Geohash (8 Alphanumeric Chars):** Base32 encoded centroid coordinates at sub-meter precision.
  4. **Check Character (1 Char):** Modulo-32 / CRC verification digit.
- **Implementation:** Implemented in `ml_pipeline/id_generator.py`.

---

## 5. ESA Copernicus Sentinel-2
- **Description:** Multi-spectral optical imagery with 10m spatial resolution across VNIR bands.
- **Revisit Time:** 5 days.
- **Usage:** Broad-area land use land cover (LULC) classification and historical vegetation / water body change monitoring.
