"""
LandSentinel FastAPI Platform & Integration Hub (A4 Skeleton)
Strictly adheres to docs/contracts.md
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

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
    me,
    cad
)

class LandSentinelFastAPI(FastAPI):
    """
    Subclass FastAPI to expose all flat routes via .routes for contract introspection,
    unpacking Starlette _IncludedRouter entries while preserving standard dispatching.
    """
    @property
    def routes(self):
        all_routes = []
        for r in self.router.routes:
            if hasattr(r, "original_router"):
                all_routes.extend(r.original_router.routes)
            else:
                all_routes.append(r)
        return all_routes


app = LandSentinelFastAPI(
    title="LandSentinel API",
    description="Risk Prediction, Monitoring, and Governance Platform for Land Acquisition",
    version="1.0.0"
)

# Configure CORS (permits localhost, LAN IPs e.g. 192.168.x.x, and custom origins)
cors_origins_raw = os.getenv("CORS_ORIGINS", "")
origins = [origin.strip() for origin in cors_origins_raw.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else [],
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error."}
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
app.include_router(cad.router)

