"""
LandSentinel FastAPI Platform & Integration Hub (A4 Skeleton)
Strictly adheres to docs/contracts.md
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# Import routers
from app.routers import (
    projects,
    predictions,
    dashboard,
    map as map_router,
    alerts,
    tasks,
    admin,
    audit,
    me
)

app = FastAPI(
    title="LandSentinel API",
    description="Risk Prediction, Monitoring, and Governance Platform for Land Acquisition",
    version="1.0.0"
)

# Configure CORS
cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
origins = [origin.strip() for origin in cors_origins_raw.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health endpoint
@app.get("/health", tags=["Health"])
def health_check():
    stub_mode = os.getenv("STUB_MODE", "true").lower() in ("true", "1")
    return {
        "status": "ok",
        "service": "LandSentinel Backend",
        "stub_mode": stub_mode
    }

# Include all routers without prefix
app.include_router(projects.router)
app.include_router(predictions.router)
app.include_router(dashboard.router)
app.include_router(map_router.router)
app.include_router(alerts.router)
app.include_router(tasks.router)
app.include_router(admin.router)
app.include_router(audit.router)
app.include_router(me.router)
