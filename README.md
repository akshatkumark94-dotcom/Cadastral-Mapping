# Cadastral AI Mapper — SIH 2026 Prototype

[![Smart India Hackathon 2026](https://img.shields.io/badge/SIH-2026-blue.svg)](https://www.sih.gov.in/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com)
[![Leaflet](https://img.shields.io/badge/Frontend-Leaflet.js-199900.svg)](https://leafletjs.com/)
[![GeoPandas](https://img.shields.io/badge/Spatial-GeoPandas%20%26%20Shapely-3B82F6.svg)](https://geopandas.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An AI-enabled automated cadastral mapping platform engineered for high-resolution parcel boundary extraction, topological conflict arbitration, and automated **ULPIN** (Unique Land Parcel Identification Number) generation for the **Digital India Land Records Modernization Programme (DILRMP)**.

---

## 🌟 Key Features

1. **AI Parcel Segmentation:**
   - Deep learning building footprint extraction powered by Meta's **Segment Anything Model (SAM)** and computer vision adaptive contour vectorizers.
   - Converts high-resolution satellite orthomosaics / drone imagery into GeoJSON polygon boundaries.

2. **Topological Conflict Engine:**
   - Automated boundary overlap, gap, and sliver detection using **Shapely & GeoPandas**.
   - Live geometric conflict arbitration with median-edge clipping and vertex snapping algorithms.

3. **Standardized 14-Digit ULPIN Generation:**
   - Generates Bhuvan/DILRMP-compliant 14-character alphanumeric land identifiers based on centroid coordinates and geohash hashing.

4. **Interactive GIS Review Dashboard:**
   - Real-time **Leaflet.js** map viewport with high-resolution satellite imagery (Esri World Imagery / Carto Dark).
   - Dynamic parcel inspector, conflict alert badges, surveyor approval workflow, and one-click GeoJSON dataset export.

5. **RESTful Geospatial API:**
   - **FastAPI** backend with automatic SQLite / SpatiaLite spatial persistence and OpenAPI documentation.

---

## 👥 Team Track Division (4–6 Developers)

| Track | Module | Responsibilities |
|---|---|---|
| 🛰️ **Data Track** | `scripts/`, `data/` | Google Open Buildings ingestion, OSM roads, Sentinel-2 / Bhuvan tile downloads, dataset preparation |
| 🧠 **ML Track** | `ml_pipeline/` | SAM inference, OpenCV contour fallback, geometric topology validator, ULPIN hashing |
| ⚡ **Backend Track** | `backend/` | FastAPI REST routes, GeoJSON serialization, SQLite database persistence, analytics |
| 🎨 **Frontend Track**| `frontend/` | Leaflet.js map controls, dark/glassmorphic GIS UI, conflict resolver, surveyor approval flow |

---

## 🏗️ Architectural File Structure

```
cadastral-ai-mapper/
├── README.md                  # Project overview, installation, and architecture
├── .gitignore                 # VCS exclusions for ML weights, rasters, and SQLite DBs
├── requirements.txt           # Python GIS, ML, and API dependencies
├── run_dev.sh                 # Linux/macOS dev launcher (FastAPI + Web Dashboard)
├── run_dev.bat                # Windows PowerShell / CMD dev launcher
├── data/
│   ├── raw/                   # Raw satellite rasters and uncleaned datasets
│   ├── processed/             # Cleaned vector GeoJSON files
│   └── sample_area/           # Baseline urban sample area (Koramangala, Bengaluru)
│       ├── sample_parcels.geojson
│       ├── sample_conflicts.geojson
│       └── sample_roads.geojson
├── notebooks/
│   └── exploration.ipynb      # Interactive Jupyter notebook for GIS data & ML exploration
├── ml_pipeline/
│   ├── __init__.py
│   ├── config.py              # Bounding boxes, CRS definitions (EPSG:4326/3857), ML settings
│   ├── segmentation.py        # SAM + CV contour footprint segmentation pipeline
│   ├── geometry.py            # Geometric overlap/gap conflict validator & clipping
│   ├── id_generator.py        # 14-digit ULPIN generator engine
│   └── checkpoints/           # Model weights directory (e.g. sam_vit_b.pth)
├── backend/
│   ├── __init__.py
│   ├── main.py                # FastAPI entrypoint, CORS, analytics endpoint (/api/stats)
│   ├── routes/
│   │   ├── parcels.py         # Parcel GeoJSON CRUD, approvals, AI trigger
│   │   └── conflicts.py       # Topology dispute retrieval and auto-resolution
│   ├── models/
│   │   └── schemas.py         # Pydantic validation schemas
│   └── db/
│       └── database.py        # SQLite persistence and sample data seeder
├── frontend/
│   ├── index.html             # Interactive GIS Web Dashboard
│   ├── style.css              # Dark glassmorphic styling and responsive map layout
│   └── app.js                 # Leaflet map manager, API client, layer rendering
├── scripts/
│   ├── download_buildings.py  # Google Open Buildings & OSM footprint ingestion
│   ├── download_roads.py      # OSM road network extraction
│   └── download_imagery.py    # Satellite tile fetcher (Bhuvan/Esri/Sentinel-2)
└── docs/
    ├── data_sources.md        # Reference specifications for Bhuvan, OSM, DILRMP
    ├── architecture.md        # Technical architecture diagram and database schema
    └── demo_script.md         # 5-minute hackathon jury pitch & walkthrough script
```

---

## 🚀 Quick Setup & Launch

### 1. Clone & Create Virtual Environment
```bash
# Clone the repository
git clone <repo-url>
cd cadastral-ai-mapper

# Create and activate virtual environment
python -m venv venv

# On Linux/macOS:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Launch Development Servers

#### On Linux / macOS:
```bash
chmod +x run_dev.sh
./run_dev.sh
```

#### On Windows:
```cmd
run_dev.bat
```

#### Or Run Manually:
```bash
# Terminal 1 - Backend API (Port 8000)
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 - Frontend Dashboard (Port 3000)
python -m http.server 3000 --directory frontend
```

---

## 🌐 Access Points

- **Interactive GIS Dashboard:** [http://localhost:3000](http://localhost:3000)
- **FastAPI Interactive Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **FastAPI ReDoc Reference:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 📡 REST API Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/parcels` | Retrieve all cadastral parcels as GeoJSON (supports `?status=` & `?search=`) |
| `GET` | `/api/parcels/{id}` | Get specific parcel details by ID |
| `POST` | `/api/parcels` | Create new parcel with auto-computed ULPIN and area |
| `PUT` | `/api/parcels/{id}` | Update parcel metadata or boundary coordinates |
| `POST` | `/api/parcels/{id}/approve` | Surveyor approval of parcel boundary |
| `POST` | `/api/parcels/run-segmentation` | Trigger AI boundary extraction pipeline |
| `GET` | `/api/conflicts` | List detected topology overlaps and micro-gaps |
| `POST` | `/api/conflicts/detect` | Run live all-pairs topology conflict check |
| `POST` | `/api/conflicts/{id}/resolve` | Auto-resolve overlap dispute via median edge clipping |
| `GET` | `/api/stats` | System KPIs (total parcels, area in hectares, approval rate) |

---

## 🧪 Testing

To run automated checks on the ML pipeline and ULPIN generator:
```bash
# Test ULPIN generation
python -c "from ml_pipeline.id_generator import generate_ulpin; print('ULPIN:', generate_ulpin(12.9351, 77.6201))"

# Test Topology conflict engine
python -c "from ml_pipeline.geometry import detect_topology_conflicts; print('Topology engine operational.')"

# Initialize SQLite database
python -c "from backend.db.database import init_db; init_db()"
```

---

## 📄 License
This project is licensed under the MIT License — see the `LICENSE` file for details. Built for **Smart India Hackathon 2026**.
