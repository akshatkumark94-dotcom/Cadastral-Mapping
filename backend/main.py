"""
Cadastral AI Mapper - FastAPI Application Entrypoint
Smart India Hackathon 2026 Prototype
Hierarchical Multi-City & Mini-Segment Support (Delhi, Ghaziabad, Meerut, Panipat)
"""

from typing import Optional
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from backend.routes.parcels import router as parcels_router
from backend.routes.conflicts import router as conflicts_router
from backend.db.database import init_db, db_get_all_parcels, db_get_all_conflicts
from backend.models.schemas import StatsResponse

app = FastAPI(
    title="Cadastral AI Mapper API",
    description="Multi-City AI-enabled automated cadastral boundary extraction, topology conflict resolution, and ULPIN registry.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for frontend dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Sub-Routers
app.include_router(parcels_router)
app.include_router(conflicts_router)


@app.on_event("startup")
def on_startup():
    """Initializes database schema and multi-city segment data on server launch."""
    init_db()


@app.get("/")
def root_status():
    """Root status endpoint."""
    return {
        "project": "Cadastral AI Mapper",
        "edition": "Smart India Hackathon 2026",
        "version": "2.0.0",
        "hierarchy": "Region (City) -> Mini-Segment (Sub-area/Ward) -> Parcels",
        "status": "ONLINE",
        "api_docs": "/docs",
        "endpoints": {
            "regions": "/api/regions",
            "parcels": "/api/parcels",
            "conflicts": "/api/conflicts",
            "stats": "/api/stats"
        }
    }


@app.get("/api/stats", response_model=StatsResponse, tags=["Analytics"])
def get_system_stats(
    region: Optional[str] = Query(None, description="Filter stats by City Region"),
    segment: Optional[str] = Query(None, description="Filter stats by Mini-Segment")
):
    """Returns real-time analytics on surveyed land, approval rates, and conflicts for selected region/segment."""
    parcels = db_get_all_parcels(region=region, segment=segment)
    conflicts = db_get_all_conflicts(region=region, segment=segment)

    total_parcels = len(parcels)
    approved = sum(1 for p in parcels if p["properties"].get("status") == "approved")
    pending = sum(1 for p in parcels if p["properties"].get("status") == "pending")
    flagged = sum(1 for p in parcels if p["properties"].get("status") == "flagged")
    unresolved_conflicts = sum(1 for c in conflicts if c["properties"].get("status") == "UNRESOLVED")

    total_area_sqm = sum(p["properties"].get("area_sqm", 0.0) for p in parcels)
    total_hectares = round(total_area_sqm / 10000.0, 4)

    confidences = [p["properties"].get("confidence_score", 0.9) for p in parcels]
    avg_confidence = round(sum(confidences) / len(confidences), 2) if confidences else 0.92

    return {
        "total_parcels": total_parcels,
        "approved_parcels": approved,
        "pending_parcels": pending,
        "flagged_parcels": flagged,
        "total_conflicts": unresolved_conflicts,
        "total_surveyed_area_sqm": round(total_area_sqm, 2),
        "total_surveyed_area_hectares": total_hectares,
        "ai_confidence_average": avg_confidence,
        "region_filter": region or "all",
        "segment_filter": segment or "all",
        "system_status": "ONLINE"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
