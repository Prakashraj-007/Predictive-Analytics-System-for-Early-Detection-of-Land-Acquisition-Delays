# PERSON A (Team Leader): Platform, Supabase, FastAPI and Integration

Branch: `feature/backend-core`
Your folders: `backend/app/`, `supabase/`, `docs/contracts.md`, `.github/`, deployment files.
You do NOT touch: `backend/ml/`, `backend/data_gen/` (Person B), `backend/core/features.py`, `alerts.py`, `recommend.py`, `backend/adapters/` (Person D), `frontend/` (Person C, and D's monitoring pages).

You are the first person to start. Everybody else is waiting on A1 to A4. Finish those within the first 3 to 4 hours and push to `develop`.

---

## How to use this file

1. Open the repo in Antigravity on your own branch.
2. For every new agent session, paste the **SHARED CONTEXT** block first, then the prompt you need.
3. Run and test locally after every prompt. Review the code before committing.
4. Prompts are in build order. Do not skip ahead.

## SHARED CONTEXT (paste at the start of every session)

```text
PROJECT: LandSentinel, a web app that predicts delay risk for land acquisition projects. Output per project: risk score 0-100, band (Low <30, Medium 30-60, High >60), delay probability, expected delay days, stage-wise probabilities (approval, compensation, possession, rr), top-3 SHAP drivers in plain language, recommended corrective actions. Also what-if simulator, dashboards, risk map, alerts, tasks, role-based access, audit log, model retraining. The prototype uses SYNTHETIC data; real systems (eCourts, land records, compensation) are simulated by CSV files read through adapter files.

STACK: React (Vite) + Tailwind + Recharts + react-leaflet | FastAPI + Uvicorn | Supabase (Postgres + Auth) | Python 3.10+, pandas, scikit-learn, XGBoost, SHAP, joblib.

REPO LAYOUT:
landsentinel/
  frontend/                 (Person C owns; Person D owns frontend/src/pages/monitoring/ and frontend/src/components/monitoring/)
  backend/
    app/                    (Person A) main.py, auth.py, db.py, schemas.py, routers/, services/
    core/                   features.py, alerts.py, recommend.py (Person D); predict.py (Person B)
    adapters/               (Person D)
    ml/                     (Person B) train.py, evaluate.py, explain.py, retrain.py
    data_gen/               (Person B)
  data/  models/            (Person B)
  supabase/migrations/      (Person A)
  docs/contracts.md         (Person A) THE SOURCE OF TRUTH for names, inputs, outputs, columns
  tests/                    (Person D)

RULES: Only edit files in my own folders. Follow docs/contracts.md exactly (function names, argument names, JSON keys, column names). Do not add heavy packages that are not in the stack. Keep requirements.txt updated. The Supabase service-role key is only used in the FastAPI backend, never in the frontend. All secrets come from .env files that are git-ignored.

ROLES (profiles.role values): project_manager, collector, policymaker, admin, auditor.

MODEL FEATURES (exact names and order):
land_area_ha, families_affected, project_type, litigation_cases, stay_orders, ownership_disputes, compensation_pending_pct, approval_days_pending, docs_incomplete_pct, officer_response_days, encroached_area_pct, possession_pct, rr_progress_pct, current_stage, district_past_delay_rate
```

---

## DAY 0

### A0. Manual git setup (no agent needed)

```bash
git init -b main
git add . && git commit -m "chore: initial structure"
git remote add origin <repo-url>
git push -u origin main
git checkout -b develop && git push -u origin develop
git checkout -b feature/backend-core && git push -u origin feature/backend-core
```

On GitHub: invite the 3 teammates, protect `main` and `develop` (pull request required), make `develop` the default branch, create the Projects board (To Do, In Progress, Review, Done) and one issue per prompt in the four person files.

### A1. Scaffold the repo

```text
[Paste SHARED CONTEXT]

Task: Create the empty repository structure exactly as in REPO LAYOUT, including empty __init__.py files in every Python package, a root README.md placeholder, a .gitignore (node_modules, __pycache__, .env, .venv, *.joblib is NOT ignored, dist), and a backend/requirements.txt with: fastapi, uvicorn[standard], pydantic, python-dotenv, supabase, PyJWT, pandas, numpy, scikit-learn, xgboost, shap, joblib, faker, httpx, pytest. Also create backend/.env.example with SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, CORS_ORIGINS, MODEL_DIR=models, and frontend/.env.example with VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY. Do not create any application code yet.
```

### A2. Write docs/contracts.md

Give this prompt to the agent, then paste the **CONTRACT TEXT** below it.

```text
[Paste SHARED CONTEXT]

Task: Create docs/contracts.md with EXACTLY the content I paste below the line CONTRACT TEXT. Do not rephrase, reorder or add fields. After creating it, list any inconsistency you notice between the tables, the endpoints and the function signatures, but do not fix it silently.

CONTRACT TEXT:
[paste everything under "CONTRACT TEXT (copy into docs/contracts.md)" at the bottom of this file]
```

### A3. Supabase schema, RLS and seed users

```text
[Paste SHARED CONTEXT]

Task: Create supabase/migrations/0001_init.sql implementing every table in docs/contracts.md section 2 (Postgres types, primary keys, foreign keys, indexes on project_id, district, created_at, check constraints for enum-like text columns). Add:
1. A profiles table linked to auth.users with a trigger-free design (rows inserted by the seed script).
2. Row Level Security enabled on profiles, projects, tasks, alerts. Policies: a user can read their own profile; project_manager reads projects where created_by = auth.uid(); collector reads projects where district = their profile district; policymaker, admin, auditor read all. Service role bypasses RLS (FastAPI uses it).
3. A file supabase/seed_users.py that uses the Supabase admin API to create 5 demo users (password demo123): pm1 (project_manager, district Pune), collector1 (collector, Pune), policymaker1 (policymaker), admin1 (admin), auditor1 (auditor), and inserts their profiles rows.
Add a short supabase/README.md explaining how to run the migration in the Supabase SQL editor and how to run the seed script.
```

### A4. FastAPI skeleton with STUB endpoints (unblocks C and D)

```text
[Paste SHARED CONTEXT]

Task: Create the FastAPI app in backend/app/. Requirements:
1. main.py with CORS from env, a /health endpoint, and routers included under no prefix.
2. One router file per group in backend/app/routers/: projects.py, predictions.py, dashboard.py, map.py, alerts.py, tasks.py, admin.py, audit.py, me.py.
3. EVERY endpoint listed in docs/contracts.md section 3 must exist and return a FIXED, hard-coded JSON example that matches the response shape in the contract exactly (use 5 to 8 sample projects in different districts and bands). No database or ML yet.
4. Pydantic response models in schemas.py matching the contract; use them as response_model.
5. A flag STUB_MODE=true in .env that keeps the stubs on. Real implementations will replace the stubs later.
6. Run it with uvicorn and verify http://localhost:8000/docs lists every endpoint.
Do not implement auth yet.
```

Push A1 to A4 to `develop` through a pull request and message the team: "contracts.md and stub API are on develop, pull now."

---

## DAY 1

### A5. Auth, role guard and audit helper

```text
[Paste SHARED CONTEXT]

Task: In backend/app/auth.py implement authentication that verifies the Supabase JWT (Authorization: Bearer) using PyJWT and SUPABASE_JWT_SECRET, loads the user's row from profiles (role, district) using the service-role client, and returns a CurrentUser object (user_id, role, district, full_name). Provide:
1. get_current_user dependency.
2. require_roles(*roles) dependency factory that returns 403 with a clear message.
3. scope_projects_query helper: given CurrentUser, returns the filter to apply (project_manager: created_by = user_id; collector: district = user district; policymaker/admin/auditor: all).
4. backend/app/services/audit.py with log_action(user_id, action, project_id=None, details=None) that inserts into audit_log.
5. GET /me returns the profile.
Apply get_current_user to all routers except /health. Keep STUB_MODE working: stubs still return fixed JSON, but now require a valid token and the right role per the permission table in docs/contracts.md section 5. Write pytest tests for 401, 403 and a valid call using a mocked token.
```

### A6. Database layer and seed loader

```text
[Paste SHARED CONTEXT]

Task: Create backend/app/db.py with a Supabase client (service role) and small helper functions: fetch_project_bundle(project_id) returning a dict with keys project, parcels, cases, approvals, compensation, incidents (all lists/dicts shaped as in docs/contracts.md section 2), and fetch_district_past_delay_rate(district) computed from the historical_projects table or, if that table is empty, a default of 0.3. Then create backend/app/seed_loader.py, a CLI script: python -m app.seed_loader --dir data/ongoing that reads these CSVs produced by Person B: projects.csv, parcels.csv, cases.csv, approvals.csv, compensation.csv, incidents.csv, and upserts them into Supabase in the right order (projects, parcels, cases, approvals, compensation, incidents) with batch inserts of 500 rows. It must be idempotent, print row counts, and fail with a readable message if a column is missing. If the CSVs are not available yet, generate 5 hand-written rows per table into data/sample_tiny/ and load those so the loader can be tested today.
```

### A7. Real projects and parcels endpoints

```text
[Paste SHARED CONTEXT]

Task: Replace the stub implementations in routers/projects.py with real Supabase-backed code, still returning the contract shapes:
1. GET /projects with filters state, district, type, band, stage, sort=risk_desc and scope by role using scope_projects_query. The latest prediction per project is joined in (risk_score, band, top_driver); projects with no prediction yet return null score.
2. GET /projects/{id} returns the project, parcels, cases, approvals and compensation, with owner names NOT exposed (anonymised).
3. POST /projects (project_manager only) creates a project with status "draft", inserts parcels and approvals sent in the same body.
4. POST /projects/{id}/approve (collector only, same district) sets status "approved" then "active".
5. PATCH /projects/{id} (project_manager, own projects) updates the editable fields from contracts.md section 3 and then calls services.prediction_service.run_prediction(project_id, user_id). For now run_prediction can be a stub that returns the previous prediction; it is built in A8.
Log every create, update and approve with audit.log_action. Keep a pytest for each endpoint.
```

---

## DAY 2 (critical path day: A and B join the model into the API)

### A8. Prediction service (the integration point)

Do this after Person B has pushed `core/predict.py` and Person D has pushed `core/features.py`, `core/recommend.py` and `core/alerts.py`. If one is missing, stub that single call and leave a TODO.

```text
[Paste SHARED CONTEXT]

Task: Create backend/app/services/prediction_service.py with run_prediction(project_id, user_id) that performs the pipeline in this order:
1. bundle = db.fetch_project_bundle(project_id); rate = db.fetch_district_past_delay_rate(bundle["project"]["district"])
2. features = core.features.build_features(bundle["project"], bundle["parcels"], bundle["cases"], bundle["approvals"], bundle["compensation"], bundle["incidents"], rate)
3. result = core.predict.predict_project(features)
4. recs = core.recommend.recommend(result["drivers"])
5. previous = latest saved prediction for the project (may be None)
6. alert = core.alerts.evaluate_alert(result["risk_score"], previous["risk_score"] if previous else None)
7. Insert a row in predictions (with drivers, stage_probabilities, recommendations as jsonb, model_version)
8. If alert is not None, insert into alerts with district, reason, risk_score, previous_score
9. audit.log_action(user_id, "predict", project_id, {"model_version": ...})
10. Return the full prediction object exactly as in docs/contracts.md section 4.
Wire it into: GET /projects/{id}/prediction (returns latest saved, or runs one if none), POST /projects/{id}/predict (runs a fresh one), POST /projects/{id}/what-if (calls core.predict.what_if(features, changes) and returns {current_score, new_score, change}; does NOT save anything), and the PATCH /projects/{id} flow from A7. Also add backend/app/scripts/predict_all.py that runs run_prediction for every active project so the demo database has predictions. Add an integration test that creates a project from the tiny sample data and checks the response shape. Set STUB_MODE=false for these routes.
```

### A9. Dashboard, map, alerts, tasks, audit routers

```text
[Paste SHARED CONTEXT]

Task: Replace the stubs with real implementations, all scoped by role as in docs/contracts.md section 5:
1. dashboard.py: GET /dashboard/summary (KPI counts, band distribution, top 10 risk projects with top driver), GET /dashboard/districts (avg risk, project count, high-risk count per district), GET /dashboard/trend (monthly average risk from the predictions table).
2. map.py: GET /map/projects returning id, name, lat, lon, risk_score, band, top_driver, filterable by district and band.
3. alerts.py: GET /alerts (scoped: pm own projects, collector own district, policymaker only High band), POST /alerts/{id}/ack.
4. tasks.py: POST /tasks (collector or policymaker; takes project_id, assigned_to, action, deadline), GET /tasks (assigned to me, or assigned by me), PATCH /tasks/{id} (assignee marks done with remarks). Log everything.
5. audit.py: GET /audit with filters user, project, date range; roles admin and auditor only; also returns the model_version from predictions when the action is "predict".
Write at least one pytest per router.
```

### Tag v0.1

When A8 works with real data: merge `develop` to `main` through your own PR and `git tag v0.1`.

---

## DAY 3

### A10. Admin upload and retrain endpoints

```text
[Paste SHARED CONTEXT]

Task: Implement backend/app/routers/admin.py (admin role only):
1. POST /admin/upload accepts a CSV file (multipart), validates it has the columns listed in docs/contracts.md section 6 (historical training CSV), saves it to data/uploads/<timestamp>.csv and returns row count and detected columns, or a readable 422 listing missing columns.
2. POST /admin/retrain takes {"file": "<saved filename>"}, calls ml.retrain.retrain(csv_path) from Person B, and returns {"before": {...metrics}, "after": {...metrics}, "new_version": "...", "promoted": true/false}. Run it as a FastAPI BackgroundTask and store status in a model_versions row; GET /admin/retrain/status returns running, done or failed with the result.
3. GET /admin/models lists model_versions with metrics, and POST /admin/models/{version}/activate switches the active version.
4. Audit-log every action.
```

### A11. Deployment and clean-machine test

```text
[Paste SHARED CONTEXT]

Task: Prepare deployment:
1. backend/Dockerfile (python:3.11-slim, installs requirements, copies backend/, models/ and data/, runs uvicorn on $PORT).
2. A render.yaml or fly.toml for the backend (pick whichever is simpler) and notes for deploying the frontend build to Vercel or Netlify with VITE_API_URL pointing at the backend.
3. docs/SETUP.md with exact steps for a clean machine: clone, create .venv, pip install, copy .env.example to .env and fill it, run the Supabase migration, run seed_users.py, run seed_loader, run predict_all, start uvicorn, then npm install and npm run dev in frontend/.
4. A scripts/demo_reset.py that wipes tasks, alerts and predictions and reloads the demo dataset so the demo can be repeated.
Include a reminder in docs/SETUP.md that the Supabase free tier pauses when idle and must be opened the day before the demo.
```

---

## DAY 4

### A12. Final checks

```text
[Paste SHARED CONTEXT]

Task: Review the backend for demo readiness. Check and fix, inside backend/app/ only: every endpoint in docs/contracts.md exists and matches the shape; no endpoint leaks parcel owner names; every endpoint rejects the wrong roles; response times for /dashboard/summary and /projects/{id}/prediction are under 2 seconds with 50 projects; errors return JSON {"detail": "..."}; logs do not print secrets. Output a short checklist of what passed and what still needs a human decision.
```

### Merge routine for the leader

Use this prompt on any teammate's pull request diff:

```text
Review this pull request diff for LandSentinel. Check: (1) files changed are only inside the author's folders per the ownership rules; (2) names and JSON keys match docs/contracts.md; (3) no secrets or large files committed; (4) new packages are justified; (5) any obvious bug or missing error handling. Reply with: approve or request changes, and a numbered list of required fixes.
```

Merge to `develop` at least once a day. Tag `v1.0` on `main` on Day 4 after testing on a clean machine.

---

## CONTRACT TEXT (copy into docs/contracts.md)

```markdown
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
```

---

## Dependencies for you (Person A)

| You need | From | If late |
|---|---|---|
| Sample CSVs (A6) | Person B, within 3 hours of Day 1 | Use your 5-row hand-written files |
| `core/predict.py` (A8) | Person B | Stub `predict_project` with fixed output |
| `core/features.py`, `recommend.py`, `alerts.py` (A8) | Person D | Stub each call |
| `ml/retrain.py` (A10) | Person B | Return a fake result |

People waiting on you: A2 (contracts) unblocks everyone. A3 and A4 (schema and stub API) unblock C and D. A5 (auth) unblocks C's login. A8 unblocks real data for C and D.
