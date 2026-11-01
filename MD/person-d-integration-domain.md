# PERSON D: Data Integration, Domain Logic, Monitoring Pages, QA and Pitch

Branch: `feature/integration-qa`
Your folders: `backend/adapters/`, `backend/core/features.py`, `backend/core/alerts.py`, `backend/core/recommend.py`, `tests/`, `docs/` (except `contracts.md`), `frontend/src/pages/monitoring/`, `frontend/src/components/monitoring/`, `frontend/src/api/monitoring.js`.
You do NOT touch: `backend/app/` (Person A), `backend/ml/`, `backend/data_gen/`, `backend/core/predict.py` (Person B), the rest of `frontend/` (Person C).

You are the bridge between the data and the model, and between the model and the user. Your Python modules (adapters, `features.py`, `recommend.py`, `alerts.py`) are called by Person A's prediction service, and you also build the monitoring-side screens and test everything.

You can start right away on D1 to D5 without waiting on anyone.

---

## How to use this file

1. Open the repo in Antigravity on your own branch.
2. For every new agent session, paste the **SHARED CONTEXT** block first, then the prompt you need.
3. Run and test locally after every prompt. Python modules must pass their own pytest before you push.
4. `docs/contracts.md` (from Person A) is the source of truth for function signatures and JSON shapes. If it differs from this file, follow the contract.

## SHARED CONTEXT (paste at the start of every session)

```text
PROJECT: LandSentinel, a web app that predicts delay risk for land acquisition projects (risk score 0-100, band Low <30 / Medium 30-60 / High >60, expected delay days, stage-wise probabilities, top-3 SHAP drivers in plain language, recommended actions, what-if, dashboards, risk map, alerts, tasks, role-based access, audit log, retraining). The prototype uses SYNTHETIC data; real government systems (eCourts, land records, compensation, approvals, police incidents) are simulated by CSV files read through adapter files, so replacing a CSV with a real API later changes only one adapter file.

STACK: React (Vite) + Tailwind + Recharts + react-leaflet | FastAPI | Supabase Postgres | Python 3.10+ (pandas, numpy, pytest).

MY FOLDERS ONLY: backend/adapters/, backend/core/features.py, backend/core/alerts.py, backend/core/recommend.py, tests/, docs/ (except contracts.md), frontend/src/pages/monitoring/, frontend/src/components/monitoring/, frontend/src/api/monitoring.js. Follow docs/contracts.md exactly. Do not add heavy packages.

MODEL FEATURES (exact names; build_features must return exactly these keys):
land_area_ha, families_affected, project_type, litigation_cases, stay_orders, ownership_disputes, compensation_pending_pct, approval_days_pending, docs_incomplete_pct, officer_response_days, encroached_area_pct, possession_pct, rr_progress_pct, current_stage, district_past_delay_rate

FUNCTION SIGNATURES (from the contract):
- core.features.build_features(project: dict, parcels: list[dict], cases: list[dict], approvals: list[dict], compensation: dict, incidents: list[dict], district_past_delay_rate: float) -> dict
- core.recommend.recommend(drivers: list[dict]) -> list[dict]   # input drivers: [{feature,label,impact,direction,plain_text}], output [{driver, action}]
- core.alerts.evaluate_alert(new_score: int, previous_score: int | None, threshold: int = 60) -> dict | None  # {"reason": str, "severity": "High"|"Medium"}
- adapters: court_adapter.get_cases(parcel_ids: list[str]) -> list[dict]; land_record_adapter.get_parcels(project_id: str) -> list[dict]; compensation_adapter.get_compensation(project_id: str) -> dict; approvals_adapter.get_approvals(project_id: str) -> list[dict]; incidents_adapter.get_incidents(project_id: str) -> list[dict]

TABLE COLUMNS (data/ongoing/*.csv and Supabase):
projects(project_id, name, type, agency, state, district, lat, lon, land_area_ha, families_affected, families_resettlement, budget, planned_start, planned_end, current_stage, status, rr_progress_pct, officer_response_days, created_by, created_at, updated_at)
parcels(parcel_id, project_id, survey_no, area_ha, land_type, compensation_status, possession_status, doc_complete, ownership_dispute)
cases(case_id, parcel_id, category, filing_date, status, stay_order, hearings)
approvals(approval_id, project_id, name, planned_date, actual_date, status)
compensation(project_id, award_amount, disbursed_amount, disputes)
incidents(incident_id, project_id, type, incident_date, encroached_area_ha)

PRIVACY: only land-related cases, aggregated per parcel or project, owner details anonymised (DPDP Act 2023). No individual profiling.

FRONTEND CONVENTIONS (Person C owns the shell): shared components live in frontend/src/components/ (Layout, Sidebar, RiskBadge, KpiCard, RiskGauge, StageBars); API client is frontend/src/api/client.js with a mock switch VITE_USE_MOCK. I put my API functions in frontend/src/api/monitoring.js using that client, my mock JSON in frontend/src/mocks/monitoring/, my pages in frontend/src/pages/monitoring/ and my components in frontend/src/components/monitoring/. Risk colors: Low #16a34a, Medium #d97706, High #dc2626.
```

---

## DAY 0 / DAY 1: DATA-SIDE PYTHON (no waiting needed)

### D1. Adapter base and the five CSV adapters

```text
[Paste SHARED CONTEXT]

Task: Create the adapters in backend/adapters/:
1. base.py with a CsvAdapter class: loads a CSV once into a pandas DataFrame (cached), path from an environment variable DATA_DIR (default "data/ongoing"), a method rows(filter: dict) -> list[dict] converting NaN to None and booleans properly, and a clear FileNotFoundError message that names the missing CSV.
2. court_adapter.py: get_cases(parcel_ids) reads cases.csv and returns the cases for those parcels (case_id, parcel_id, category, filing_date, status, stay_order, hearings).
3. land_record_adapter.py: get_parcels(project_id) reads parcels.csv (parcel_id, project_id, survey_no, area_ha, land_type, compensation_status, possession_status, doc_complete, ownership_dispute).
4. compensation_adapter.py: get_compensation(project_id) reads compensation.csv and returns one dict (or zeros if the project has none).
5. approvals_adapter.py: get_approvals(project_id) reads approvals.csv.
6. incidents_adapter.py: get_incidents(project_id) reads incidents.csv.
7. adapters/__init__.py exposing a function fetch_external_bundle(project_id) -> {"parcels", "cases", "compensation", "approvals", "incidents"} that calls all five (cases looked up via the parcel ids).
8. A module docstring in each adapter: "Today: reads CSV. Later: replace the body with a call to <real system>. Keep the return shape unchanged." Name the real source (eCourts/NJDG, Bhulekh-type land records, compensation/payment system, PARIVESH-type department tracking, police/district administration records).
Never return owner names. Write pytest tests in tests/test_adapters.py using data/sample_tiny/ (from Person B; if not present yet, create a tiny fixture folder tests/fixtures/ with 3 projects).
```

### D2. Feature builder

```text
[Paste SHARED CONTEXT]

Task: Create backend/core/features.py with build_features(project, parcels, cases, approvals, compensation, incidents, district_past_delay_rate) -> dict. It must be a PURE function (no database, no file access) returning exactly the 15 keys listed, computed like this:
- land_area_ha: project["land_area_ha"]; families_affected, project_type (from project["type"]), current_stage, rr_progress_pct from the project.
- litigation_cases: count of cases with status "pending".
- stay_orders: count of pending cases with stay_order true.
- ownership_disputes: count of parcels with ownership_dispute true plus compensation["disputes"].
- compensation_pending_pct: (award_amount - disbursed_amount) / award_amount * 100, clipped to 0-100; if award_amount is 0 or missing, return 0.
- approval_days_pending: maximum over approvals with status "pending" of (today - planned_date) in days, clipped at 0; if none pending return 0. "today" is a parameter defaulting to date.today() so tests are deterministic (add an optional keyword argument as_of).
- docs_incomplete_pct: parcels with doc_complete false / total parcels * 100 (0 if no parcels).
- officer_response_days: project["officer_response_days"] (None if missing).
- encroached_area_pct: sum of encroached_area_ha over incidents of type encroachment / (project land_area_ha) * 100, clipped to 0-100.
- possession_pct: area_ha of parcels with possession_status "handed_over" / total parcel area * 100.
- district_past_delay_rate: the argument as given.
Missing inputs never raise; use None only where documented, 0 elsewhere. Round percentages to 1 decimal. Add a function explain_features(features) -> dict of the same keys to human text, used by the UI later. Write pytest tests in tests/test_features.py including the worked example: 120 ha, 800 families, 9 pending cases of which 2 stayed, award 100 and disbursed 59 (41 percent pending), an approval 120 days overdue, 8 percent encroached, officer response 22 days.
```

### D3. Recommendation rules (10 to 15 rules)

```text
[Paste SHARED CONTEXT]

Task: Create backend/core/recommend.py with recommend(drivers: list[dict]) -> list[dict].
1. A module-level RULES list (not an AI model) of 12 to 15 rules, each a dict {feature, min_value_hint (optional), action, owner_role, priority, expected_effect}. Cover every one of the 15 features at least in a generic way and use these as the base rules:
 - compensation_pending_pct: "Release pending funds and hold payment camps for landowners."
 - litigation_cases and stay_orders: "Escalate the cases to the legal cell, consider a special Lok Adalat and seek early hearings."
 - approval_days_pending: "Escalate to the department head and set a deadline for the pending approval."
 - docs_incomplete_pct: "Run a documentation drive and verify land records."
 - encroached_area_pct: "Plan an eviction and clearance drive with the local administration."
 - rr_progress_pct: "Speed up resettlement site development and housing allotment."
 - ownership_disputes: "Hold a joint hearing with the revenue officer and speed up mutation of disputed parcels."
 - officer_response_days: "Set a file-movement time limit (for example 7 days) and track delays weekly."
 - possession_pct: "Hold a possession camp parcel by parcel with the village administration."
 - district_past_delay_rate: "Review the district's past delay causes and add a monthly review meeting."
 - land_area_ha, families_affected, project_type, current_stage: generic fallbacks ("Split the project into phases", "Appoint a dedicated resettlement officer", etc.).
2. recommend() takes the drivers, keeps those with direction "increases_risk", and for each returns {"driver": feature, "action": text} in the same order; when a rule has several variants chosen by size of the driver (e.g. more than 5 cases gets the Lok Adalat suggestion), pick by the value in the driver's plain_text is NOT allowed; use the optional "value" key if the driver dict contains one, else the default action.
3. Unknown features return a generic action: "Review this factor with the project team."
4. Return at most one action per driver.
5. A helper rules_table() -> list[dict] used for documentation, and docs/recommendation_rules.md generated from it (a markdown table: driver, action, owner, expected effect).
Write pytest tests in tests/test_recommend.py: every feature has a rule, output order equals driver order, decreases_risk drivers are skipped.
```

### D4. Alert engine

```text
[Paste SHARED CONTEXT]

Task: Create backend/core/alerts.py with evaluate_alert(new_score, previous_score, threshold=60) -> dict | None, a PURE function:
- Alert if new_score > threshold (reason "Risk score {n} is above the {threshold} High-risk threshold"; severity High).
- Alert if previous_score is not None and new_score - previous_score >= 15 (reason "Risk score rose by {delta} points, from {old} to {new}"; severity High if new_score > threshold else Medium).
- If both conditions apply, combine reasons in one alert, severity High.
- Do not alert when the score is flat or falling, even if it is still above the threshold, but do alert on first prediction (previous_score None) only when above the threshold.
- Also add dedupe_key(project_id, reason_type) for Person A to avoid creating duplicate open alerts.
Write pytest tests in tests/test_alerts.py with at least 10 cases (first prediction high/low, exactly 15 jump, 14 jump, falling, crossing threshold, etc.).
```

Push D1 to D4 to `develop` through a pull request and tell Person A the module names are ready for the prediction service (A8).

---

## DAY 1 / DAY 2: MONITORING PAGES

Wait for Person C to push C1 (layout, sidebar, `api/client.js`) to `develop`, then merge `develop` into your branch. Until then, create your pages with plain `fetch` calls and switch to the shared client when it appears.

### D5. Monitoring API file and mock data

```text
[Paste SHARED CONTEXT]

Task: Create frontend/src/api/monitoring.js with functions using the shared client from frontend/src/api/client.js: getMapProjects({district, band}), getAlerts(), ackAlert(id), createTask(body), getTasks({mine, assignedByMe}), updateTask(id, body), uploadTrainingCsv(file), startRetrain(filename), getRetrainStatus(), getModels(), activateModel(version), getAudit({user, project, from, to}). Request and response shapes must match docs/contracts.md section 3. Create mock JSON in frontend/src/mocks/monitoring/: map_projects.json (30 projects with real-looking lat/lon in 5 Maharashtra districts), alerts.json (8 alerts), tasks.json (6 tasks open and done), retrain_status_done.json (before and after metrics with pr_auc, recall, f1, brier, top10_recall), models.json (v1 active, v2), audit.json (20 rows). Register the mock routes in the client map by adding one import in a monitoring-only file frontend/src/api/monitoringMocks.js (do not edit Person C's client.js; if the client has no hook for extra mock routes, tell me exactly what two-line change Person C should make).
```

### D6. Risk map page

```text
[Paste SHARED CONTEXT]

Task: Build frontend/src/pages/monitoring/RiskMap.jsx at /map using react-leaflet and OpenStreetMap tiles (add react-leaflet and leaflet to package.json and import the leaflet CSS). Requirements:
1. Fetch getMapProjects; draw each project as a CircleMarker colored by band (green, amber, red) with radius scaled slightly by risk score.
2. Popup on click: project name, score with band, top driver, and a link "Open project" to /projects/:id.
3. A filter panel above the map: district dropdown and band checkboxes (Low, Medium, High); a legend; a count "Showing N of M projects".
4. Fit the map bounds to the visible markers when filters change.
5. Fix the default leaflet marker icon issue with Vite; handle empty results with a friendly message.
Components in frontend/src/components/monitoring/ (MapLegend, MapFilters).
```

### D7. Alerts and tasks page

```text
[Paste SHARED CONTEXT]

Task: Build frontend/src/pages/monitoring/AlertsTasks.jsx at /alerts with two tabs.
Tab 1 "Alerts": list of alerts (project name link, district, reason, current and previous score with arrow, severity badge, time ago) with an Acknowledge button, filter by severity and status. For collector and policymaker, each alert row has an "Assign task" button that opens a modal: the recommended actions for the project are loaded via GET /projects/:id/prediction (recommendations list) and shown as radio options (or free text), assignee dropdown (use a text field with the project manager's user id if no users endpoint exists), deadline date picker; submit calls createTask.
Tab 2 "Tasks": two sections for collectors/policymakers ("Assigned by me") and project managers ("Assigned to me"). Each task shows action, project, deadline (red if overdue), status. The project manager sees a "Mark completed" button which opens a remarks textarea and calls updateTask with status done and the remarks.
Role handling: project_manager sees only their alerts and tasks assigned to them and cannot create tasks; auditor sees read-only. Empty and loading states required.
```

### D8. Admin: data upload and retrain page

```text
[Paste SHARED CONTEXT]

Task: Build frontend/src/pages/monitoring/AdminRetrain.jsx at /admin/retrain (admin only).
1. Step 1 Upload: drag and drop CSV; on upload call uploadTrainingCsv and show rows and detected columns, or the list of missing columns on error.
2. Step 2 Retrain: a button that calls startRetrain(filename), then polls getRetrainStatus every 3 seconds (stop on done or failed) showing a progress message.
3. Step 3 Result: a before and after table for pr_auc, recall, f1, brier, top10_recall with the difference colored (green better, red worse; remember lower is better for brier), a new model version and a "promoted: yes/no" badge, plus a small bar chart (Recharts) comparing before and after.
4. A "Model versions" table from getModels with an Activate button for non-active versions.
5. A visible honesty note: "Metrics are on simulated data. Validate on real data in a pilot."
```

### D9. Audit log page (nice to have, cut first)

```text
[Paste SHARED CONTEXT]

Task: Build frontend/src/pages/monitoring/AuditLog.jsx at /audit (admin and auditor, read-only). A filterable table (user, project, date range, action type), columns: time, user, action, project (link), model version for "predict" actions. Pagination of 25 rows, CSV export button of the filtered rows (generate in the browser). Empty and error states.
```

---

## DAY 3: QA

### D10. Automated tests and fixtures

```text
[Paste SHARED CONTEXT]

Task: In tests/ create (1) tests/test_pipeline.py that runs the full backend-side pipeline without HTTP: fetch_external_bundle for 5 sample projects, build_features, core.predict.predict_project, core.recommend.recommend, core.alerts.evaluate_alert, and asserts that every output matches the shape in docs/contracts.md section 4 (use jsonschema or manual assertions); (2) tests/test_contract_shapes.py that loads the FastAPI app with TestClient in STUB_MODE and checks that every endpoint listed in docs/contracts.md section 3 exists (parse the contract file) and returns the documented top-level keys; (3) a pytest.ini and a short tests/README.md. If predict.py or the API is not on develop yet, mark those tests with pytest.mark.skip(reason=...) and tell me which ones.
```

### D11. Role-by-role QA matrix

```text
[Paste SHARED CONTEXT]

Task: Create docs/qa_matrix.md: a table with rows = every page and button, columns = project_manager, collector, policymaker, admin, auditor, built from the permission table in docs/contracts.md section 5 (expected: visible or hidden, allowed or 403), plus a Result column, a Bug link column and a Tester/date column for me to fill in while I test. Add a section "Demo path checks" with these steps: Policymaker login, overview and district comparison; Collector login, alert, open High-risk project, score, reasons, recommendations; What-if "release 50% of pending compensation" lowers the score; Project Manager updates court cases from 2 to 9, risk jumps and an alert appears; Admin uploads CSV and retrains with before and after metrics; Auditor sees the trail. Each step has a pass/fail box.
```

Log every failure as a GitHub issue assigned to the owner of that folder (see ownership list above).

### D12. Bug-report template

```text
Create .github/ISSUE_TEMPLATE/bug_report.md (this one file, in .github only) with sections: Page or endpoint, Role used, Steps to reproduce, Expected, Actual, Screenshot, Owner (A, B, C or D), Severity (demo-blocker, major, minor).
```

---

## DAY 3 / DAY 4: DOCS AND PITCH

### D13. README, architecture, demo script, Q&A

```text
[Paste SHARED CONTEXT]

Task: Write in docs/: (1) README content in docs/README_draft.md (the leader copies it to the root): what LandSentinel is, screenshot placeholders, the architecture diagram as a mermaid block (simulated sources, adapters, Supabase, features, XGBoost, SHAP, recommendation rules, FastAPI, React), the tech stack table, setup steps linking to docs/SETUP.md, demo users, and an honest section "What is real and what is simulated". (2) docs/architecture.md with the data flow and how an adapter swap works. (3) docs/demo_script.md: a 5-minute script with exact clicks, what to say at each step, and a timing column, following: problem (30 s), policymaker overview, collector alert and project detail, what-if, project manager update causing an alert, admin retrain, architecture and roadmap slide. (4) docs/qa_sheet.md: answers to likely judge questions (where is your real data, how accurate is it, what about sensitive data, why not just rules, will it work in another state, what if the data is wrong, how would real integration work, who is accountable for a wrong prediction) in 2 to 4 sentences each. Be open that the data is synthetic.
```

### D14. Pitch deck outline (8 to 10 slides) and backup video plan

```text
[Paste SHARED CONTEXT]

Task: Write docs/slides_outline.md for a 9-slide deck: title and one-line value, the problem (delays are found late), our solution, how it works (pipeline), demo screenshots list, the model and metrics (use docs/metrics_slide.md from Person B), explainability and recommendations, architecture and integration with real government systems (adapters), roadmap (live eCourts and land record APIs, PostGIS, Keycloak SSO, survival analysis, NLP on court orders, multilingual interface) and impact. For each slide: title, 3 bullet points, speaker notes of 3 sentences, and what visual to place. Also docs/video_plan.md: a shot list for the 3-minute backup video (what to screen-record, in what order, what to say).
```

Each teammate gives you their slide content: Person A the architecture slide, Person B the metrics and model slides, Person C the UI screenshots.

---

## Dependencies for you (Person D)

| You need | From | If late |
|---|---|---|
| `data/ongoing/*.csv` and `data/sample_tiny/` | Person B, within 3 hours of Day 1 | Build a 3-project fixture in `tests/fixtures/` |
| Final driver `feature` names | Person B (they equal the 15 feature names) | Use the feature list above |
| `Layout`, `Sidebar`, `api/client.js` | Person C (C1 on Day 0/1) | Use plain fetch and a stand-alone test route |
| Real endpoints | Person A (A8 to A10) | Mock JSON |
| `core/predict.py` for pipeline tests | Person B (Day 2) | Skip those tests |
| Two-line hook for extra mock routes in `client.js` | Person C | Ask them; the prompt D5 tells you the exact change |

People waiting on you:

| Person | Needs | When |
|---|---|---|
| A | `features.py`, `recommend.py`, `alerts.py` and the adapters (for A6 seed, A8 prediction service) | Start of Day 2 at the latest; D1 to D4 can be done on Day 0 and Day 1 |
| B | The recommendation rule names match feature names | Already agreed through the 15 feature list |
| Everyone | Role QA matrix, bug issues, demo script | Day 3 onwards |
