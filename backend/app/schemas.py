"""
Pydantic schemas adhering strictly to docs/contracts.md
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Auth / Profile
# ---------------------------------------------------------------------------
class UserProfile(BaseModel):
    user_id: str
    full_name: str
    role: str
    district: Optional[str] = None

# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------
class ProjectListItem(BaseModel):
    project_id: str
    name: str
    district: str
    type: str
    current_stage: str
    risk_score: Optional[int] = None
    band: Optional[str] = None
    top_driver: Optional[str] = None

class ProjectDetail(BaseModel):
    project: Dict[str, Any]
    parcels: List[Dict[str, Any]]
    cases: List[Dict[str, Any]]
    approvals: List[Dict[str, Any]]
    compensation: Dict[str, Any]

class ProjectCreateRequest(BaseModel):
    project: Dict[str, Any]
    parcels: List[Dict[str, Any]] = Field(default_factory=list)
    approvals: List[Dict[str, Any]] = Field(default_factory=list)

class ProjectCreateResponse(BaseModel):
    project_id: str

class ProjectApproveResponse(BaseModel):
    status: str
    message: str

class ProjectPatchRequest(BaseModel):
    project: Optional[Dict[str, Any]] = None
    parcels: Optional[List[Dict[str, Any]]] = None
    cases: Optional[List[Dict[str, Any]]] = None
    approvals: Optional[List[Dict[str, Any]]] = None
    compensation: Optional[Dict[str, Any]] = None

# ---------------------------------------------------------------------------
# Prediction / What-If (Section 4 of contract)
# ---------------------------------------------------------------------------
class DriverItem(BaseModel):
    feature: str
    label: str
    impact: float
    direction: str
    plain_text: str

class RecommendationItem(BaseModel):
    driver: str
    action: str

class PredictionObject(BaseModel):
    project_id: str
    created_at: str
    risk_score: int
    band: str
    delay_probability: float
    expected_delay_days: int
    stage_probabilities: Dict[str, float]
    drivers: List[DriverItem]
    recommendations: List[RecommendationItem]
    model_version: str

class WhatIfChanges(BaseModel):
    compensation_pending_pct: Optional[float] = None
    litigation_cases: Optional[int] = None
    docs_incomplete_pct: Optional[float] = None
    approval_days_pending: Optional[int] = None

class WhatIfRequest(BaseModel):
    changes: WhatIfChanges

class WhatIfResponse(BaseModel):
    current_score: int
    new_score: int
    change: int

# ---------------------------------------------------------------------------
# Dashboard & Map
# ---------------------------------------------------------------------------
class BandDistribution(BaseModel):
    Low: int
    Medium: int
    High: int

class TopRiskItem(BaseModel):
    project_id: str
    name: str
    risk_score: int
    top_driver: str

class DashboardSummaryResponse(BaseModel):
    total_projects: int
    high_risk_projects: int
    avg_risk_score: float
    projects_with_alerts: int
    band_distribution: BandDistribution
    top_risk: List[TopRiskItem]

class DistrictRiskItem(BaseModel):
    district: str
    avg_risk: float
    project_count: int
    high_risk_count: int

class TrendItem(BaseModel):
    month: str
    avg_risk: float

class MapProjectItem(BaseModel):
    project_id: str
    name: str
    lat: float
    lon: float
    risk_score: int
    band: str
    top_driver: str

# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------
class AlertItem(BaseModel):
    alert_id: str
    project_id: str
    project_name: str
    district: str
    reason: str
    risk_score: int
    previous_score: Optional[int] = None
    status: str
    created_at: str

class AlertAckResponse(BaseModel):
    status: str
    alert_id: str

# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------
class TaskCreateRequest(BaseModel):
    project_id: str
    assigned_to: str
    action: str
    deadline: str

class TaskCreateResponse(BaseModel):
    task_id: str

class TaskItem(BaseModel):
    task_id: str
    project_id: str
    project_name: str
    action: str
    assigned_by: str
    assigned_to: str
    deadline: str
    status: str
    remarks: Optional[str] = None

class TaskPatchRequest(BaseModel):
    status: Optional[str] = None
    remarks: Optional[str] = None

# ---------------------------------------------------------------------------
# Admin & Retraining
# ---------------------------------------------------------------------------
class AdminUploadResponse(BaseModel):
    filename: str
    rows: int
    columns: List[str]

class RetrainRequest(BaseModel):
    file: str

class RetrainStatusResponse(BaseModel):
    state: str
    result: Optional[Dict[str, Any]] = None

class ModelVersionItem(BaseModel):
    version: str
    trained_at: str
    metrics: Dict[str, Any]
    is_active: bool

# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------
class AuditLogItem(BaseModel):
    log_id: str
    user: str
    action: str
    project_id: Optional[str] = None
    timestamp: str
    model_version: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

