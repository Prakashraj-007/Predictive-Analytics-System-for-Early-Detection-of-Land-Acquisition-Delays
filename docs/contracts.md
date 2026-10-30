# LandSentinel Contracts (source of truth)

Change this file only through the leader. Everyone codes against it.

## 1. Conventions
- IDs are text, e.g. "PRJ-0001", "PAR-0001-03".
- Dates are ISO strings "YYYY-MM-DD". Timestamps are ISO 8601 UTC.
- Percent fields are 0 to 100 (not 0 to 1). Probabilities are 0 to 1.
- risk_score is an integer 0 to 100. band: "Low" (<30), "Medium" (30 to 60), "High" (>60).
- Roles: project_manager, collector, policymaker, admin, auditor.
- project_type values: highway, rail, irrigation, power, urban.
- current_stage values: planning, sia, notification, award, compensation, possession, rr.
- Parcel owner names are never stored or returned (anonymised).

## 2. Tables (Supabase Postgres)
- profiles(user_id uuid pk, full_name, role, district)
- projects(project_id pk, name, type, agency, state, district, lat, lon, land_area_ha, families_affected, families_resettlement, budget, planned_start, planned_end, current_stage, status, rr_progress_pct, officer_response_days, created_by, created_at, updated_at)
  status: draft, approved, active, completed
- parcels(parcel_id pk, project_id fk, survey_no, area_ha, land_type, compensation_status, possession_status, doc_complete bool, ownership_dispute bool)
  land_type: private, government, forest; possession_status: pending, handed_over
- cases(case_id pk, parcel_id fk, category, filing_date, status, stay_order bool, hearings int)
  status: pending, disposed
- approvals(approval_id pk, project_id fk, name, planned_date, actual_date, status)
  status: pending, cleared
- compensation(project_id pk fk, award_amount, disbursed_amount, disputes int)
- incidents(incident_id pk, project_id fk, type, incident_date, encroached_area_ha)
  type: encroachment, obstruction
- historical_projects(project_id pk, planned_start, [15 model features], is_delayed, delay_days, delayed_approval, delayed_compensation, delayed_possession)
- predictions(prediction_id pk, project_id fk, created_at, risk_score, band, delay_probability, expected_delay_days, stage_probabilities jsonb, drivers jsonb, recommendations jsonb, model_version)
- alerts(alert_id pk, project_id fk, district, reason, risk_score, previous_score, status, created_at)
  status: open, ack
- tasks(task_id pk, project_id fk, assigned_by, assigned_to, action, deadline, status, remarks, created_at)
  status: open, done
- audit_log(log_id pk, user_id, action, project_id, timestamp, details jsonb)
- model_versions(version pk, trained_at, metrics jsonb, is_active bool)

## 3. REST endpoints (all JSON, Bearer Supabase JWT)
GET  /health
GET  /me -> {user_id, full_name, role, district}

GET  /projects?state=&district=&type=&band=&stage=&sort=risk_desc
  -> [{project_id, name, district, type, current_stage, risk_score, band, top_driver}]
GET  /projects/{id}
  -> {project{...}, parcels[...], cases[...], approvals[...], compensation{...}}
POST /projects   (project_manager)  body: {project{...}, parcels[...], approvals[...]}
  -> {project_id}
POST /projects/{id}/approve (collector)
PATCH /projects/{id} (project_manager)  body: partial project fields, and optional
  parcels[], cases[], approvals[], compensation{} updates
  -> full prediction object (section 4)

GET  /projects/{id}/prediction -> prediction object
POST /projects/{id}/predict    -> prediction object (fresh run)
POST /projects/{id}/what-if
  body: {changes: {compensation_pending_pct?, litigation_cases?, docs_incomplete_pct?, approval_days_pending?}}
  -> {current_score, new_score, change}

GET  /dashboard/summary
  -> {total_projects, high_risk_projects, avg_risk_score, projects_with_alerts,
      band_distribution{Low, Medium, High},
      top_risk[{project_id, name, risk_score, top_driver}]}
GET  /dashboard/districts -> [{district, avg_risk, project_count, high_risk_count}]
GET  /dashboard/trend     -> [{month, avg_risk}]
GET  /map/projects?district=&band=
  -> [{project_id, name, lat, lon, risk_score, band, top_driver}]

GET  /alerts -> [{alert_id, project_id, project_name, district, reason, risk_score, previous_score, status, created_at}]
POST /alerts/{id}/ack
POST /tasks  body: {project_id, assigned_to, action, deadline} -> {task_id}
GET  /tasks?mine=true|assigned_by_me=true -> [{task_id, project_id, project_name, action, assigned_by, assigned_to, deadline, status, remarks}]
PATCH /tasks/{id} body: {status, remarks}

POST /admin/upload  (multipart csv) -> {filename, rows, columns}
POST /admin/retrain body: {file} -> 202 accepted
GET  /admin/retrain/status -> {state: running|done|failed, result?: {before{...}, after{...}, new_version, promoted}}
GET  /admin/models -> [{version, trained_at, metrics, is_active}]
POST /admin/models/{version}/activate
GET  /audit?user=&project=&from=&to= -> [{log_id, user, action, project_id, timestamp, model_version?}]

## 4. Prediction object
{
  "project_id": "PRJ-0001",
  "created_at": "2026-11-02T10:15:00Z",
  "risk_score": 78,
  "band": "High",
  "delay_probability": 0.78,
  "expected_delay_days": 140,
  "stage_probabilities": {"approval": 0.35, "compensation": 0.72, "possession": 0.81, "rr": 0.45},
  "drivers": [
    {"feature": "litigation_cases", "label": "Court cases", "impact": 0.22,
     "direction": "increases_risk", "plain_text": "9 court cases, 2 with stay orders, are the biggest cause of delay risk."}
  ],
  "recommendations": [
    {"driver": "litigation_cases", "action": "Escalate cases to the legal cell and consider a special Lok Adalat."}
  ],
  "model_version": "v1"
}
drivers has exactly 3 items, sorted by absolute impact. impact is the SHAP value in probability points (0 to 1 scale).

## 5. Permissions
| Endpoint group | project_manager | collector | policymaker | admin | auditor |
|---|---|---|---|---|---|
| projects list/detail | own | own district | all | all | all (read) |
| create/update project | own | no | no | no | no |
| approve project | no | own district | no | no | no |
| prediction, what-if | own | own district | all | all | prediction only |
| dashboard, map | own | own district | all | all | all |
| alerts | own | own district | High only, all | all | read |
| create task | no | yes | yes | no | no |
| complete task | yes (assigned) | no | no | no | no |
| upload/retrain/models | no | no | no | yes | no |
| audit | no | no | no | yes | yes |

## 6. Python function signatures (backend/core and backend/ml)
- core.features.build_features(project: dict, parcels: list[dict], cases: list[dict], approvals: list[dict], compensation: dict, incidents: list[dict], district_past_delay_rate: float) -> dict
  Returns exactly these keys: land_area_ha, families_affected, project_type, litigation_cases, stay_orders, ownership_disputes, compensation_pending_pct, approval_days_pending, docs_incomplete_pct, officer_response_days, encroached_area_pct, possession_pct, rr_progress_pct, current_stage, district_past_delay_rate
- core.predict.predict_project(features: dict) -> dict
  Returns: risk_score, band, delay_probability, expected_delay_days, stage_probabilities, drivers, model_version (no recommendations)
- core.predict.what_if(features: dict, changes: dict) -> dict
  Returns: current_score, new_score, change
- core.recommend.recommend(drivers: list[dict]) -> list[dict]   # [{driver, action}]
- core.alerts.evaluate_alert(new_score: int, previous_score: int | None, threshold: int = 60) -> dict | None
  Returns {"reason": str, "severity": "High"|"Medium"} or None. Alert when new_score > threshold or new_score - previous_score >= 15.
- ml.retrain.retrain(csv_path: str) -> dict   # {before, after, new_version, promoted}
- adapters: court_adapter.get_cases(parcel_ids: list[str]) -> list[dict]; land_record_adapter.get_parcels(project_id: str) -> list[dict]; compensation_adapter.get_compensation(project_id: str) -> dict; approvals_adapter.get_approvals(project_id: str) -> list[dict]; incidents_adapter.get_incidents(project_id: str) -> list[dict]

Historical training CSV (data/historical_projects.csv) columns:
project_id, planned_start, land_area_ha, families_affected, project_type, litigation_cases, stay_orders, ownership_disputes, compensation_pending_pct, approval_days_pending, docs_incomplete_pct, officer_response_days, encroached_area_pct, possession_pct, rr_progress_pct, current_stage, district_past_delay_rate, is_delayed, delay_days, delayed_approval, delayed_compensation, delayed_possession

Ongoing data CSVs (data/ongoing/): projects.csv, parcels.csv, cases.csv, approvals.csv, compensation.csv, incidents.csv with the columns of the tables in section 2.
