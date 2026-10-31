"""
Hard-coded realistic stub data for LandSentinel FastAPI stub mode.
Strictly adheres to docs/contracts.md response structures.
"""
from typing import Dict, List, Any
import copy

SAMPLE_PROJECTS: List[Dict[str, Any]] = [
    {
        "project_id": "PRJ-0001",
        "name": "Pune Ring Road Sector 1",
        "type": "highway",
        "agency": "MSRDC",
        "state": "Maharashtra",
        "district": "Pune",
        "lat": 18.5204,
        "lon": 73.8567,
        "land_area_ha": 340.5,
        "families_affected": 420,
        "families_resettlement": 110,
        "budget": 2400000000.0,
        "planned_start": "2024-03-01",
        "planned_end": "2027-06-30",
        "current_stage": "award",
        "status": "active",
        "rr_progress_pct": 35.0,
        "officer_response_days": 18,
        "created_by": "5ad5e3f4-99ff-445b-bd5c-2fee103c357e",
        "created_at": "2024-03-01T09:00:00Z",
        "updated_at": "2026-10-15T14:30:00Z",
        "risk_score": 78,
        "band": "High",
        "top_driver": "litigation_cases"
    },
    {
        "project_id": "PRJ-0002",
        "name": "Nagpur Metro Rail Extension Line 2",
        "type": "rail",
        "agency": "Maha-Metro",
        "state": "Maharashtra",
        "district": "Nagpur",
        "lat": 21.1458,
        "lon": 79.0882,
        "land_area_ha": 125.0,
        "families_affected": 180,
        "families_resettlement": 45,
        "budget": 1600000000.0,
        "planned_start": "2024-07-15",
        "planned_end": "2026-12-31",
        "current_stage": "notification",
        "status": "active",
        "rr_progress_pct": 55.0,
        "officer_response_days": 12,
        "created_by": "5ad5e3f4-99ff-445b-bd5c-2fee103c357e",
        "created_at": "2024-07-15T11:00:00Z",
        "updated_at": "2026-09-20T10:15:00Z",
        "risk_score": 52,
        "band": "Medium",
        "top_driver": "docs_incomplete_pct"
    },
    {
        "project_id": "PRJ-0003",
        "name": "Nashik Agricultural Irrigation Canal",
        "type": "irrigation",
        "agency": "Water Resources Dept",
        "state": "Maharashtra",
        "district": "Nashik",
        "lat": 19.9975,
        "lon": 73.7898,
        "land_area_ha": 480.2,
        "families_affected": 290,
        "families_resettlement": 30,
        "budget": 850000000.0,
        "planned_start": "2023-11-01",
        "planned_end": "2026-04-30",
        "current_stage": "possession",
        "status": "active",
        "rr_progress_pct": 82.0,
        "officer_response_days": 7,
        "created_by": "5ad5e3f4-99ff-445b-bd5c-2fee103c357e",
        "created_at": "2023-11-01T08:30:00Z",
        "updated_at": "2026-10-02T16:45:00Z",
        "risk_score": 24,
        "band": "Low",
        "top_driver": "officer_response_days"
    },
    {
        "project_id": "PRJ-0004",
        "name": "Thane Coastal Road Package 3",
        "type": "urban",
        "agency": "MMRDA",
        "state": "Maharashtra",
        "district": "Thane",
        "lat": 19.2183,
        "lon": 72.9781,
        "land_area_ha": 95.8,
        "families_affected": 560,
        "families_resettlement": 210,
        "budget": 3100000000.0,
        "planned_start": "2025-01-10",
        "planned_end": "2028-08-31",
        "current_stage": "planning",
        "status": "draft",
        "rr_progress_pct": 10.0,
        "officer_response_days": 24,
        "created_by": "5ad5e3f4-99ff-445b-bd5c-2fee103c357e",
        "created_at": "2025-01-10T10:00:00Z",
        "updated_at": "2026-10-18T11:20:00Z",
        "risk_score": 84,
        "band": "High",
        "top_driver": "compensation_pending_pct"
    },
    {
        "project_id": "PRJ-0005",
        "name": "Solapur Solar Park Grid Connectivity",
        "type": "power",
        "agency": "MAHAGENCO",
        "state": "Maharashtra",
        "district": "Solapur",
        "lat": 17.6599,
        "lon": 75.9064,
        "land_area_ha": 620.0,
        "families_affected": 75,
        "families_resettlement": 0,
        "budget": 1200000000.0,
        "planned_start": "2024-05-01",
        "planned_end": "2026-03-31",
        "current_stage": "compensation",
        "status": "active",
        "rr_progress_pct": 90.0,
        "officer_response_days": 5,
        "created_by": "5ad5e3f4-99ff-445b-bd5c-2fee103c357e",
        "created_at": "2024-05-01T09:30:00Z",
        "updated_at": "2026-08-14T12:00:00Z",
        "risk_score": 18,
        "band": "Low",
        "top_driver": "stay_orders"
    },
    {
        "project_id": "PRJ-0006",
        "name": "Mumbai-Pune Expressway Capacity Augmentation",
        "type": "highway",
        "agency": "MSRDC",
        "state": "Maharashtra",
        "district": "Pune",
        "lat": 18.7538,
        "lon": 73.4069,
        "land_area_ha": 180.4,
        "families_affected": 140,
        "families_resettlement": 25,
        "budget": 1950000000.0,
        "planned_start": "2024-09-01",
        "planned_end": "2027-01-31",
        "current_stage": "sia",
        "status": "active",
        "rr_progress_pct": 40.0,
        "officer_response_days": 14,
        "created_by": "5ad5e3f4-99ff-445b-bd5c-2fee103c357e",
        "created_at": "2024-09-01T10:00:00Z",
        "updated_at": "2026-10-10T09:15:00Z",
        "risk_score": 46,
        "band": "Medium",
        "top_driver": "approval_days_pending"
    }
]

SAMPLE_PARCELS: Dict[str, List[Dict[str, Any]]] = {
    "PRJ-0001": [
        {
            "parcel_id": "PAR-0001-01",
            "project_id": "PRJ-0001",
            "survey_no": "104/2A",
            "area_ha": 12.5,
            "land_type": "private",
            "compensation_status": "pending",
            "possession_status": "pending",
            "doc_complete": True,
            "ownership_dispute": False
        },
        {
            "parcel_id": "PAR-0001-02",
            "project_id": "PRJ-0001",
            "survey_no": "105/1",
            "area_ha": 8.4,
            "land_type": "private",
            "compensation_status": "pending",
            "possession_status": "pending",
            "doc_complete": False,
            "ownership_dispute": True
        },
        {
            "parcel_id": "PAR-0001-03",
            "project_id": "PRJ-0001",
            "survey_no": "112",
            "area_ha": 45.0,
            "land_type": "government",
            "compensation_status": "disbursed",
            "possession_status": "handed_over",
            "doc_complete": True,
            "ownership_dispute": False
        }
    ]
}

SAMPLE_CASES: Dict[str, List[Dict[str, Any]]] = {
    "PRJ-0001": [
        {
            "case_id": "CAS-0001-01",
            "parcel_id": "PAR-0001-02",
            "category": "Title Dispute",
            "filing_date": "2024-06-12",
            "status": "pending",
            "stay_order": True,
            "hearings": 6
        },
        {
            "case_id": "CAS-0001-02",
            "parcel_id": "PAR-0001-01",
            "category": "Compensation Enhancement",
            "filing_date": "2024-08-20",
            "status": "pending",
            "stay_order": False,
            "hearings": 3
        }
    ]
}

SAMPLE_APPROVALS: Dict[str, List[Dict[str, Any]]] = {
    "PRJ-0001": [
        {
            "approval_id": "APP-0001-01",
            "project_id": "PRJ-0001",
            "name": "Environmental Clearance (MoEFCC)",
            "planned_date": "2024-05-15",
            "actual_date": "2024-07-22",
            "status": "cleared"
        },
        {
            "approval_id": "APP-0001-02",
            "project_id": "PRJ-0001",
            "name": "Forest Stage-1 Clearance",
            "planned_date": "2024-08-30",
            "actual_date": None,
            "status": "pending"
        }
    ]
}

SAMPLE_COMPENSATION: Dict[str, Dict[str, Any]] = {
    "PRJ-0001": {
        "project_id": "PRJ-0001",
        "award_amount": 750000000.0,
        "disbursed_amount": 280000000.0,
        "disputes": 9
    }
}

SAMPLE_PREDICTIONS: Dict[str, Dict[str, Any]] = {
    "PRJ-0001": {
        "project_id": "PRJ-0001",
        "created_at": "2026-10-30T10:15:00Z",
        "risk_score": 78,
        "band": "High",
        "delay_probability": 0.78,
        "expected_delay_days": 140,
        "stage_probabilities": {
            "approval": 0.35,
            "compensation": 0.72,
            "possession": 0.81,
            "rr": 0.45
        },
        "drivers": [
            {
                "feature": "litigation_cases",
                "label": "Court cases",
                "impact": 0.22,
                "direction": "increases_risk",
                "plain_text": "9 court cases, 2 with stay orders, are the biggest cause of delay risk."
            },
            {
                "feature": "compensation_pending_pct",
                "label": "Pending Compensation",
                "impact": 0.18,
                "direction": "increases_risk",
                "plain_text": "62.7% of awarded compensation remains un-disbursed."
            },
            {
                "feature": "approval_days_pending",
                "label": "Forest Clearance Overdue",
                "impact": 0.15,
                "direction": "increases_risk",
                "plain_text": "Forest Stage-1 Clearance is overdue by 61 days."
            }
        ],
        "recommendations": [
            {
                "driver": "litigation_cases",
                "action": "Escalate cases to the legal cell and schedule a dedicated Lok Adalat session."
            },
            {
                "driver": "compensation_pending_pct",
                "action": "Organize village-level direct bank transfer camps to expedite disbursement."
            },
            {
                "driver": "approval_days_pending",
                "action": "Submit nodal compliance responses to the Forest Department."
            }
        ],
        "model_version": "v1"
    }
}

SAMPLE_ALERTS: List[Dict[str, Any]] = [
    {
        "alert_id": "ALT-0001",
        "project_id": "PRJ-0001",
        "project_name": "Pune Ring Road Sector 1",
        "district": "Pune",
        "reason": "Risk score jumped from 61 to 78 due to 2 new high court stay orders",
        "risk_score": 78,
        "previous_score": 61,
        "status": "open",
        "created_at": "2026-10-28T09:40:00Z"
    },
    {
        "alert_id": "ALT-0002",
        "project_id": "PRJ-0004",
        "project_name": "Thane Coastal Road Package 3",
        "district": "Thane",
        "reason": "High risk threshold breached (84/100): Critical CRZ clearance overdue",
        "risk_score": 84,
        "previous_score": 72,
        "status": "open",
        "created_at": "2026-10-29T14:15:00Z"
    }
]

SAMPLE_TASKS: List[Dict[str, Any]] = [
    {
        "task_id": "TSK-0001",
        "project_id": "PRJ-0001",
        "project_name": "Pune Ring Road Sector 1",
        "action": "Expedite hearing for Stay Order on Survey No. 105/1 with District Legal Cell",
        "assigned_by": "cc354e61-2574-49e8-a9ff-85e541a60084",
        "assigned_to": "5ad5e3f4-99ff-445b-bd5c-2fee103c357e",
        "deadline": "2026-11-15",
        "status": "open",
        "remarks": "Priority matter before High Court bench on 12 Nov."
    },
    {
        "task_id": "TSK-0002",
        "project_id": "PRJ-0002",
        "project_name": "Nagpur Metro Rail Extension Line 2",
        "action": "Complete missing 7/12 land title extracts for remaining 14 parcels",
        "assigned_by": "cc354e61-2574-49e8-a9ff-85e541a60084",
        "assigned_to": "5ad5e3f4-99ff-445b-bd5c-2fee103c357e",
        "deadline": "2026-11-20",
        "status": "open",
        "remarks": None
    }
]

SAMPLE_AUDIT: List[Dict[str, Any]] = [
    {
        "log_id": "LOG-0001",
        "user": "pm1@landsentinel.gov.in",
        "action": "UPDATE_PROJECT",
        "project_id": "PRJ-0001",
        "timestamp": "2026-10-30T10:14:00Z",
        "model_version": "v1",
        "details": {"updated_fields": ["officer_response_days", "rr_progress_pct"]}
    },
    {
        "log_id": "LOG-0002",
        "user": "collector1@landsentinel.gov.in",
        "action": "CREATE_TASK",
        "project_id": "PRJ-0001",
        "timestamp": "2026-10-30T11:00:00Z",
        "model_version": None,
        "details": {"task_id": "TSK-0001", "assigned_to": "pm1"}
    }
]

SAMPLE_MODELS: List[Dict[str, Any]] = [
    {
        "version": "v1",
        "trained_at": "2026-10-01T12:00:00Z",
        "metrics": {
            "auc": 0.884,
            "f1_score": 0.826,
            "mae_days": 18.2,
            "train_samples": 4500
        },
        "is_active": True
    },
    {
        "version": "v0.9-baseline",
        "trained_at": "2026-09-01T10:00:00Z",
        "metrics": {
            "auc": 0.821,
            "f1_score": 0.765,
            "mae_days": 24.5,
            "train_samples": 3000
        },
        "is_active": False
    }
]

def get_prediction_for_project(project_id: str) -> Dict[str, Any]:
    if project_id in SAMPLE_PREDICTIONS:
        return copy.deepcopy(SAMPLE_PREDICTIONS[project_id])
    
    # Generic realistic fallback prediction adhering strictly to contract section 4
    return {
        "project_id": project_id,
        "created_at": "2026-10-30T12:00:00Z",
        "risk_score": 45,
        "band": "Medium",
        "delay_probability": 0.45,
        "expected_delay_days": 75,
        "stage_probabilities": {
            "approval": 0.20,
            "compensation": 0.40,
            "possession": 0.50,
            "rr": 0.30
        },
        "drivers": [
            {
                "feature": "officer_response_days",
                "label": "Officer response latency",
                "impact": 0.16,
                "direction": "increases_risk",
                "plain_text": "Response latency across queries exceeds 14 days."
            },
            {
                "feature": "docs_incomplete_pct",
                "label": "Incomplete documentation",
                "impact": 0.14,
                "direction": "increases_risk",
                "plain_text": "28% of land record documents require verification."
            },
            {
                "feature": "compensation_pending_pct",
                "label": "Compensation progress",
                "impact": 0.10,
                "direction": "decreases_risk",
                "plain_text": "Disbursement is on track with scheduled disbursement."
            }
        ],
        "recommendations": [
            {
                "driver": "officer_response_days",
                "action": "Designate a dedicated land acquisition officer for rapid review."
            },
            {
                "driver": "docs_incomplete_pct",
                "action": "Deploy field surveyors for door-to-door documentation verification."
            },
            {
                "driver": "compensation_pending_pct",
                "action": "Maintain current disbursement schedule."
            }
        ],
        "model_version": "v1"
    }

