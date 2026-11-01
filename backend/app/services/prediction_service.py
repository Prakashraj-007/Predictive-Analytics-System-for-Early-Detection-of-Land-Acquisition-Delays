"""
Prediction Service for LandSentinel (Task A8 Integration Point).
Orchestrates feature building, ML prediction, recommendation generation,
alert evaluation, database persistence, and audit logging.

Strictly adheres to docs/contracts.md sections 4, 5, 6, and A8 specifications.
"""
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone, date
import uuid

from app.db import get_supabase_client, fetch_project_bundle, fetch_district_past_delay_rate
from app.services.audit import log_action

# ---------------------------------------------------------------------------
# Module imports with stubs and TODOs for missing partner modules
# ---------------------------------------------------------------------------

# 1. Feature Builder (Person D - Task D2)
try:
    from core.features import build_features
except ImportError:
    # TODO: Person D will provide core/features.py (Task D2)
    def build_features(
        project: dict,
        parcels: list,
        cases: list,
        approvals: list,
        compensation: dict,
        incidents: list,
        district_past_delay_rate: float,
        as_of: Optional[Any] = None
    ) -> dict:
        land_area = float(project.get("land_area_ha") or 100.0)
        
        # Pending court cases and stay orders
        lit_cases = sum(1 for c in cases if c.get("status", "pending") == "pending") if cases else int(project.get("litigation_cases") or 0)
        stay_orders = sum(1 for c in cases if c.get("stay_order") is True and c.get("status", "pending") == "pending")
        
        # Ownership disputes
        comp_disputes = int((compensation or {}).get("disputes") or 0)
        parcel_disputes = sum(1 for p in parcels if p.get("ownership_dispute") is True)
        ownership_disputes = parcel_disputes + comp_disputes
        
        # Compensation pending pct
        award = float((compensation or {}).get("award_amount") or 0.0)
        disbursed = float((compensation or {}).get("disbursed_amount") or 0.0)
        if award > 0:
            comp_pending_pct = max(0.0, min(100.0, ((award - disbursed) / award) * 100.0))
        else:
            comp_pending_pct = 0.0
            
        # Approval days pending
        today = date.today() if as_of is None else as_of
        if isinstance(today, str):
            today = date.fromisoformat(today)
        max_approval_days = 0
        for a in approvals:
            if a.get("status") == "pending" and a.get("planned_date"):
                try:
                    p_date = date.fromisoformat(str(a["planned_date"])[:10])
                    diff = (today - p_date).days
                    if diff > max_approval_days:
                        max_approval_days = diff
                except Exception:
                    pass
                    
        # Incomplete documentation pct
        if parcels:
            incomplete_count = sum(1 for p in parcels if not p.get("doc_complete"))
            docs_inc_pct = round((incomplete_count / len(parcels)) * 100.0, 2)
        else:
            docs_inc_pct = 0.0
            
        # Encroached area pct
        encroached_ha = sum(float(i.get("encroached_area_ha") or 0.0) for i in incidents if i.get("type") == "encroachment")
        encroached_pct = max(0.0, min(100.0, round((encroached_ha / land_area) * 100.0, 2))) if land_area > 0 else 0.0
        
        # Possession pct
        if parcels:
            handed_ha = sum(float(p.get("area_ha") or 0.0) for p in parcels if p.get("possession_status") == "handed_over")
            total_ha = sum(float(p.get("area_ha") or 0.0) for p in parcels)
            possession_pct = max(0.0, min(100.0, round((handed_ha / total_ha) * 100.0, 2))) if total_ha > 0 else 0.0
        else:
            possession_pct = 0.0

        return {
            "land_area_ha": land_area,
            "families_affected": int(project.get("families_affected") or 0),
            "project_type": str(project.get("type") or "highway"),
            "litigation_cases": lit_cases,
            "stay_orders": stay_orders,
            "ownership_disputes": ownership_disputes,
            "compensation_pending_pct": round(comp_pending_pct, 2),
            "approval_days_pending": max_approval_days,
            "docs_incomplete_pct": docs_inc_pct,
            "officer_response_days": int(project.get("officer_response_days") or 14),
            "encroached_area_pct": encroached_pct,
            "possession_pct": possession_pct,
            "rr_progress_pct": float(project.get("rr_progress_pct") or 0.0),
            "current_stage": str(project.get("current_stage") or "planning"),
            "district_past_delay_rate": float(district_past_delay_rate or 0.25)
        }


# 2. ML Predict & What-If (Person B - Task B7)
try:
    from core.predict import predict_project, what_if, get_active_version
except ImportError:
    # TODO: Person B will provide core/predict.py (Task B7)
    def predict_project(features: dict) -> dict:
        # Heuristic delay risk model aligning strictly with the 15 contract features
        score = 20
        score += min(30, int(features.get("litigation_cases", 0) * 4))
        score += min(20, int(features.get("stay_orders", 0) * 8))
        score += min(20, int(features.get("compensation_pending_pct", 0) * 0.25))
        score += min(15, int(features.get("approval_days_pending", 0) * 0.1))
        score += min(15, int(features.get("encroached_area_pct", 0) * 0.5))
        score += min(10, int(features.get("docs_incomplete_pct", 0) * 0.15))
        score += min(15, int(features.get("district_past_delay_rate", 0.25) * 40))
        if features.get("possession_pct", 0) > 70:
            score -= 15
        if features.get("rr_progress_pct", 0) > 70:
            score -= 10
            
        risk_score = max(5, min(95, score))
        delay_prob = round(risk_score / 100.0, 2)
        
        if risk_score < 30:
            band = "Low"
            expected_days = int(delay_prob * 45)
        elif risk_score <= 60:
            band = "Medium"
            expected_days = int(delay_prob * 110)
        else:
            band = "High"
            expected_days = int(delay_prob * 190)

        # 3 SHAP drivers in plain language
        candidates = [
            {
                "feature": "litigation_cases",
                "label": "Court cases",
                "impact": round(min(0.35, max(0.08, features.get("litigation_cases", 0) * 0.04)), 2),
                "direction": "increases_risk",
                "plain_text": f"{features.get('litigation_cases', 0)} court cases ({features.get('stay_orders', 0)} with stay orders) are a major driver of delay risk."
            },
            {
                "feature": "compensation_pending_pct",
                "label": "Compensation progress",
                "impact": round(min(0.30, max(0.06, features.get("compensation_pending_pct", 0) * 0.003)), 2),
                "direction": "increases_risk",
                "plain_text": f"{round(features.get('compensation_pending_pct', 0))}% of compensation is pending disbursement."
            },
            {
                "feature": "approval_days_pending",
                "label": "Pending approvals",
                "impact": round(min(0.25, max(0.05, features.get("approval_days_pending", 0) * 0.002)), 2),
                "direction": "increases_risk",
                "plain_text": f"Statutory approvals have been pending for {features.get('approval_days_pending', 0)} days."
            },
            {
                "feature": "encroached_area_pct",
                "label": "Encroached area",
                "impact": round(min(0.20, max(0.04, features.get("encroached_area_pct", 0) * 0.004)), 2),
                "direction": "increases_risk",
                "plain_text": f"{round(features.get('encroached_area_pct', 0))}% of project land area has active encroachment."
            },
            {
                "feature": "docs_incomplete_pct",
                "label": "Documentation gaps",
                "impact": round(min(0.18, max(0.03, features.get("docs_incomplete_pct", 0) * 0.002)), 2),
                "direction": "increases_risk",
                "plain_text": f"{round(features.get('docs_incomplete_pct', 0))}% of parcels have incomplete land records."
            }
        ]
        sorted_drivers = sorted(candidates, key=lambda d: d["impact"], reverse=True)[:3]

        stage_probabilities = {
            "approval": round(min(0.95, max(0.05, delay_prob * 0.8 + (0.1 if features.get("approval_days_pending", 0) > 30 else -0.05))), 2),
            "compensation": round(min(0.95, max(0.05, delay_prob * 0.9 + (features.get("compensation_pending_pct", 0) * 0.002))), 2),
            "possession": round(min(0.95, max(0.05, delay_prob * 1.0 - (features.get("possession_pct", 0) * 0.003))), 2),
            "rr": round(min(0.95, max(0.05, delay_prob * 0.7 - (features.get("rr_progress_pct", 0) * 0.002))), 2)
        }

        return {
            "risk_score": risk_score,
            "band": band,
            "delay_probability": delay_prob,
            "expected_delay_days": expected_days,
            "stage_probabilities": stage_probabilities,
            "drivers": sorted_drivers,
            "model_version": "v1"
        }

    def what_if(features: dict, changes: dict) -> dict:
        current_res = predict_project(features)
        current_score = current_res["risk_score"]
        
        modified = dict(features)
        for k, v in changes.items():
            if k in ("compensation_pending_pct", "litigation_cases", "docs_incomplete_pct", "approval_days_pending") and v is not None:
                if "pct" in k:
                    modified[k] = max(0.0, min(100.0, float(v)))
                else:
                    modified[k] = max(0, int(v))
                    
        new_res = predict_project(modified)
        new_score = new_res["risk_score"]
        return {
            "current_score": current_score,
            "new_score": new_score,
            "change": new_score - current_score
        }

    def get_active_version() -> str:
        return "v1"


# 3. Action Recommendations (Person D - Task D3)
try:
    from core.recommend import recommend
except ImportError:
    # TODO: Person D will provide core/recommend.py (Task D3)
    RECOMMENDATION_ACTIONS = {
        "litigation_cases": "Escalate the cases to the legal cell, consider a special Lok Adalat and seek early hearings.",
        "stay_orders": "Prioritize vacation of stay orders through Advocate General's office.",
        "compensation_pending_pct": "Release pending funds and hold payment camps for landowners.",
        "approval_days_pending": "Escalate to the department head and set a deadline for the pending approval.",
        "docs_incomplete_pct": "Run a documentation drive and verify land records.",
        "encroached_area_pct": "Plan an eviction and clearance drive with the local administration.",
        "rr_progress_pct": "Speed up resettlement site development and housing allotment.",
        "ownership_disputes": "Hold a joint hearing with the revenue officer and speed up mutation of disputed parcels.",
        "officer_response_days": "Set a file-movement time limit (e.g. 7 days) and track delays weekly.",
        "possession_pct": "Hold a possession camp parcel by parcel with the village administration."
    }

    def recommend(drivers: list) -> list:
        recs = []
        seen = set()
        for d in drivers:
            feat = d.get("feature")
            if feat and feat not in seen:
                seen.add(feat)
                action = RECOMMENDATION_ACTIONS.get(
                    feat,
                    f"Address critical bottleneck in {d.get('label', feat)} to mitigate project delay."
                )
                recs.append({"driver": feat, "action": action})
        return recs


# 4. Alert Engine (Person D - Task D4)
try:
    from core.alerts import evaluate_alert
except ImportError:
    # TODO: Person D will provide core/alerts.py (Task D4)
    def evaluate_alert(new_score: int, previous_score: Optional[int], threshold: int = 60) -> Optional[dict]:
        above_threshold = new_score > threshold
        jump = (previous_score is not None and (new_score - previous_score) >= 15)
        
        if above_threshold and jump:
            reason = f"Risk score {new_score} crossed High-risk threshold (> {threshold}) and rose by {new_score - previous_score} points."
            severity = "High"
        elif above_threshold:
            reason = f"Risk score {new_score} is above the {threshold} High-risk threshold."
            severity = "High"
        elif jump:
            reason = f"Risk score rose sharply by {new_score - previous_score} points, from {previous_score} to {new_score}."
            severity = "High" if new_score > threshold else "Medium"
        else:
            return None
            
        return {"reason": reason, "severity": severity}


# ---------------------------------------------------------------------------
# Core Pipeline: run_prediction (Task A8)
# ---------------------------------------------------------------------------

def run_prediction(project_id: str, user_id: str = "system") -> Dict[str, Any]:
    """
    Executes the 10-step prediction pipeline for a project:
    1. Fetch bundle and district past delay rate.
    2. Build 15 model features.
    3. Predict project delay risk score, probabilities, and top-3 drivers.
    4. Generate recommended corrective actions for drivers.
    5. Query previous saved prediction (if any).
    6. Evaluate alert conditions.
    7. Insert prediction record into 'predictions' table.
    8. Insert alert record into 'alerts' table if alert triggered.
    9. Log action in audit log.
    10. Return full prediction object matching contracts.md section 4.
    """
    supabase = get_supabase_client()
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Step 1: Bundle & district past delay rate
    bundle = fetch_project_bundle(project_id)
    project = bundle.get("project") or {}
    district = project.get("district", "Thane")
    rate = fetch_district_past_delay_rate(district)
    
    # Step 2: Build features
    features = build_features(
        project=project,
        parcels=bundle.get("parcels", []),
        cases=bundle.get("cases", []),
        approvals=bundle.get("approvals", []),
        compensation=bundle.get("compensation", {}),
        incidents=bundle.get("incidents", []),
        district_past_delay_rate=rate
    )
    
    # Step 3: ML Prediction
    result = predict_project(features)
    
    # Step 4: Recommendations
    recs = recommend(result.get("drivers", []))
    
    # Step 5: Query previous saved prediction
    previous = None
    if supabase:
        try:
            prev_res = (
                supabase.table("predictions")
                .select("risk_score, created_at, band")
                .eq("project_id", project_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if prev_res.data and len(prev_res.data) > 0:
                previous = prev_res.data[0]
        except Exception as pe:
            print(f"[WARN] Failed to query previous prediction for {project_id}: {pe}")
            
    # Step 6: Evaluate alert
    prev_score = previous.get("risk_score") if previous else None
    alert = evaluate_alert(result["risk_score"], prev_score)
    
    # Step 7: Insert into predictions table
    pred_id = f"PRED-{project_id}-{int(datetime.now(timezone.utc).timestamp())}"
    pred_row = {
        "prediction_id": pred_id,
        "project_id": project_id,
        "created_at": now_iso,
        "risk_score": result["risk_score"],
        "band": result["band"],
        "delay_probability": result["delay_probability"],
        "expected_delay_days": result["expected_delay_days"],
        "stage_probabilities": result["stage_probabilities"],
        "drivers": result["drivers"],
        "recommendations": recs,
        "model_version": result.get("model_version", "v1")
    }
    if supabase:
        try:
            supabase.table("predictions").insert(pred_row).execute()
        except Exception as pie:
            print(f"[WARN] Failed to persist prediction row for {project_id}: {pie}")
            
    # Step 8: Insert alert into alerts table if triggered
    if alert and supabase:
        try:
            alert_id = f"ALT-{project_id}-{int(datetime.now(timezone.utc).timestamp())}"
            # Avoid inserting duplicate active open alert with identical reason
            existing = (
                supabase.table("alerts")
                .select("alert_id")
                .eq("project_id", project_id)
                .eq("status", "open")
                .eq("reason", alert["reason"])
                .limit(1)
                .execute()
            )
            if not (existing.data and len(existing.data) > 0):
                alert_row = {
                    "alert_id": alert_id,
                    "project_id": project_id,
                    "district": district,
                    "reason": alert["reason"],
                    "risk_score": result["risk_score"],
                    "previous_score": prev_score,
                    "status": "open",
                    "created_at": now_iso
                }
                supabase.table("alerts").insert(alert_row).execute()
        except Exception as aie:
            print(f"[WARN] Failed to persist alert row for {project_id}: {aie}")
            
    # Step 9: Audit log
    log_action(
        user_id=user_id,
        action="predict",
        project_id=project_id,
        details={"model_version": result.get("model_version", "v1")}
    )
    
    # Step 10: Return full prediction object matching contracts.md section 4
    return {
        "project_id": project_id,
        "created_at": now_iso,
        "risk_score": result["risk_score"],
        "band": result["band"],
        "delay_probability": result["delay_probability"],
        "expected_delay_days": result["expected_delay_days"],
        "stage_probabilities": result["stage_probabilities"],
        "drivers": result["drivers"],
        "recommendations": recs,
        "model_version": result.get("model_version", "v1")
    }


def simulate_what_if_service(project_id: str, changes: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes what-if simulation for a project given parameter changes.
    Does NOT save anything to the database.
    Returns {current_score, new_score, change}.
    """
    bundle = fetch_project_bundle(project_id)
    project = bundle.get("project") or {}
    district = project.get("district", "Thane")
    rate = fetch_district_past_delay_rate(district)
    
    features = build_features(
        project=project,
        parcels=bundle.get("parcels", []),
        cases=bundle.get("cases", []),
        approvals=bundle.get("approvals", []),
        compensation=bundle.get("compensation", {}),
        incidents=bundle.get("incidents", []),
        district_past_delay_rate=rate
    )
    
    return what_if(features, changes)
