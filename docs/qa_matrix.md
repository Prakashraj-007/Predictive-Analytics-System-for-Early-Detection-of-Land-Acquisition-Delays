# LandSentinel Role-by-Role QA Matrix & Acceptance Verification

**Document Version:** 1.0.0  
**Based on:** `docs/contracts.md` (Sections 1, 2, 3, & 5)  
**Author / QA Lead:** Person D (Data Integration, Domain Logic & QA)  
**Target Release:** LandSentinel MVP / Hackathon Demo  

---

## 1. Role Definitions & Scoping Principles

| Role Key | Name in Contract | Scope & Operational Boundary |
|---|---|---|
| `project_manager` | Project Manager (PM) | Scoped exclusively to assigned projects (`created_by = user_id`). Can draft and update projects, execute What-If simulations, and complete assigned corrective tasks. Cannot approve projects or create tasks. |
| `collector` | District Collector | Scoped to jurisdictional district (`district = user.district`). Can review projects, approve projects for land acquisition, triage alerts, and issue corrective directive tasks to Project Managers. |
| `policymaker` | State Principal Secretary | Statewide visibility across all districts. Reviews macro KPI dashboards, cross-district variance, systemic bottlenecks, and issues high-level corrective directives. |
| `admin` | System Administrator | Unrestricted platform access. Controls data ingestion pipelines, model retraining cycles, model version activation, and statutory compliance audit trails. |
| `auditor` | Statutory Auditor | Read-only statewide access to corridor records, risk assessments, prediction histories, and complete immutable audit logs with CSV export. |

---

## 2. Role-by-Role Functional Permission Matrix

### Legend
- **Allowed (Visible)**: Element is visible and fully interactive. Action executes successfully (HTTP 200/201/202).
- **Hidden / 403**: Element is hidden in UI navigation, or if accessed directly via URL/API, returns HTTP 403 Forbidden.
- **Read-Only**: Data is visible in the UI, but edit/action buttons are hidden or disabled.
- **Scoped**: Results filtered automatically to user's ownership or jurisdictional district.

| Page / Component / Action | `project_manager` | `collector` | `policymaker` | `admin` | `auditor` | Result | Bug Link | Tester / Date |
|---|---|---|---|---|---|---|---|---|
| **Navigation: Overview (`/`)** | Visible (Scoped to own projects) | Visible (Scoped to district) | Visible (Statewide all) | Visible (Statewide all) | Visible (Statewide all) | Pass | - | Person D / 2026-11-05 |
| **Dashboard: KPI Metric Cards** | Allowed (Own projects) | Allowed (District projects) | Allowed (Statewide) | Allowed (Statewide) | Allowed (Statewide) | Pass | - | Person D / 2026-11-05 |
| **Dashboard: District Comparison** | Hidden / N/A | Visible (Own district highlighted) | Visible (All districts) | Visible (All districts) | Visible (All districts) | Pass | - | Person D / 2026-11-05 |
| **Dashboard: Top Risk Corridors** | Scoped (Own projects) | Scoped (District projects) | Allowed (Top statewide) | Allowed (Top statewide) | Allowed (Top statewide) | Pass | - | Person D / 2026-11-05 |
| **Navigation: Projects (`/projects`)** | Visible | Visible | Visible | Visible | Visible | Pass | - | Person D / 2026-11-05 |
| **Projects List: Visibility Scope** | Scoped (Own projects) | Scoped (District projects) | Allowed (All) | Allowed (All) | Allowed (All, read) | Pass | - | Person D / 2026-11-05 |
| **Button: "New Project" (`/projects/new`)** | Visible (Allowed) | Hidden (403 Forbidden) | Hidden (403 Forbidden) | Hidden (403 Forbidden) | Hidden (403 Forbidden) | Pass | - | Person D / 2026-11-05 |
| **Form: Create Project (`POST /projects`)** | Allowed (HTTP 201) | 403 Forbidden | 403 Forbidden | 403 Forbidden | 403 Forbidden | Pass | - | Person D / 2026-11-05 |
| **Project Detail (`/projects/:id`)** | Scoped (Own projects) | Scoped (District projects) | Allowed (All) | Allowed (All) | Allowed (All, read) | Pass | - | Person D / 2026-11-05 |
| **Button: "Edit / Patch Project"** | Visible (Own projects) | Hidden (403 Forbidden) | Hidden (403 Forbidden) | Hidden (403 Forbidden) | Hidden (403 Forbidden) | Pass | - | Person D / 2026-11-05 |
| **Action: Save Project Patch (`PATCH /projects/:id`)** | Allowed (HTTP 200) | 403 Forbidden | 403 Forbidden | 403 Forbidden | 403 Forbidden | Pass | - | Person D / 2026-11-05 |
| **Button: "Approve Project"** | Hidden (403 Forbidden) | Visible (Own district only) | Hidden (403 Forbidden) | Hidden (403 Forbidden) | Hidden (403 Forbidden) | Pass | - | Person D / 2026-11-05 |
| **Action: Approve Project (`POST /projects/:id/approve`)** | 403 Forbidden | Allowed (HTTP 200) | 403 Forbidden | 403 Forbidden | 403 Forbidden | Pass | - | Person D / 2026-11-05 |
| **Workbench: What-If Simulation** | Allowed (Own projects) | Allowed (District projects) | Allowed (All projects) | Allowed (All projects) | Hidden (Read-only prediction) | Pass | - | Person D / 2026-11-05 |
| **Action: What-If Recalculation (`POST /what-if`)** | Allowed (HTTP 200) | Allowed (HTTP 200) | Allowed (HTTP 200) | Allowed (HTTP 200) | 403 Forbidden | Pass | - | Person D / 2026-11-05 |
| **Navigation: Corridor Map (`/map`)** | Visible (Scoped own) | Visible (District scope) | Visible (Statewide) | Visible (Statewide) | Visible (Statewide) | Pass | - | Person D / 2026-11-05 |
| **Map: Marker Clicks & Popups** | Allowed | Allowed | Allowed | Allowed | Allowed | Pass | - | Person D / 2026-11-05 |
| **Map: District / Risk Band Filters** | Scoped | Scoped (District prefiltered) | Allowed (Full filter) | Allowed (Full filter) | Allowed (Full filter) | Pass | - | Person D / 2026-11-05 |
| **Navigation: Alerts & Tasks (`/alerts`)** | Visible | Visible | Visible | Visible | Visible (Read-only) | Pass | - | Person D / 2026-11-05 |
| **Alerts Tab: Filter & Listing** | Scoped (Own alerts) | Scoped (District alerts) | High-severity only (All) | Allowed (All) | Allowed (Read-only) | Pass | - | Person D / 2026-11-05 |
| **Button: "Acknowledge Alert"** | Visible (Own alerts) | Visible (District alerts) | Visible (State alerts) | Visible (All) | Hidden / Disabled | Pass | - | Person D / 2026-11-05 |
| **Button: "Assign Task / Directive"** | Hidden (403 Forbidden) | Visible (Allowed) | Visible (Allowed) | Hidden (403 Forbidden) | Hidden (403 Forbidden) | Pass | - | Person D / 2026-11-05 |
| **Modal: Create Directive Task (`POST /tasks`)** | 403 Forbidden | Allowed (HTTP 201) | Allowed (HTTP 201) | 403 Forbidden | 403 Forbidden | Pass | - | Person D / 2026-11-05 |
| **Tasks Tab: "Assigned by me" List** | Empty / N/A | Visible (Created tasks) | Visible (Created tasks) | Visible (All) | Read-only | Pass | - | Person D / 2026-11-05 |
| **Tasks Tab: "Assigned to me" List** | Visible (My tasks) | Visible (If assigned) | Visible (If assigned) | Visible | Read-only | Pass | - | Person D / 2026-11-05 |
| **Button: "Mark Completed" (Tasks)** | Visible (Own tasks) | Hidden (403 Forbidden) | Hidden (403 Forbidden) | Hidden (403 Forbidden) | Hidden (403 Forbidden) | Pass | - | Person D / 2026-11-05 |
| **Action: Update Task Status (`PATCH /tasks/:id`)** | Allowed (HTTP 200) | 403 Forbidden | 403 Forbidden | 403 Forbidden | 403 Forbidden | Pass | - | Person D / 2026-11-05 |
| **Navigation: Admin Retrain (`/admin/retrain`)** | Hidden (403 Forbidden) | Hidden (403 Forbidden) | Hidden (403 Forbidden) | Visible (Allowed) | Hidden (403 Forbidden) | Pass | - | Person D / 2026-11-05 |
| **Upload CSV: Retraining Batch (`POST /admin/upload`)** | 403 Forbidden | 403 Forbidden | 403 Forbidden | Allowed (HTTP 200) | 403 Forbidden | Pass | - | Person D / 2026-11-05 |
| **Button: "Trigger Retraining Pipeline"** | 403 Forbidden | 403 Forbidden | 403 Forbidden | Allowed (HTTP 202) | 403 Forbidden | Pass | - | Person D / 2026-11-05 |
| **Button: "Activate Model Version"** | 403 Forbidden | 403 Forbidden | 403 Forbidden | Allowed (HTTP 200) | 403 Forbidden | Pass | - | Person D / 2026-11-05 |
| **Navigation: Audit Log (`/audit`)** | Hidden (403 Forbidden) | Hidden (403 Forbidden) | Hidden (403 Forbidden) | Visible (Allowed) | Visible (Allowed) | Pass | - | Person D / 2026-11-05 |
| **Audit Log: Filter by Date/User/Action** | 403 Forbidden | 403 Forbidden | 403 Forbidden | Allowed | Allowed | Pass | - | Person D / 2026-11-05 |
| **Button: "Export Filtered Audit Log to CSV"** | 403 Forbidden | 403 Forbidden | 403 Forbidden | Allowed (Browser CSV) | Allowed (Browser CSV) | Pass | - | Person D / 2026-11-05 |

---

## 3. Demo Path Checks (Strict End-to-End Validation)

The following 6 sequential steps represent the official live demonstration script. Every step must execute without regression.

### Step 1: Policymaker Overview & District Hotspot Identification
- **User Role:** `policymaker` (`Dr. Sunita Deshmukh, Secretary`)
- **Action:** Sign in and load the Executive Dashboard (`/`).
- **Expected Outcome:** Statewide KPI summary displays total ongoing projects, average risk score, projects with active warnings, and risk band distribution. District comparison charts highlight Pune and Thane as high-risk delay hotspots.
- **Verification:**
  - [x] Statewide total projects and average risk score render correctly.
  - [x] District risk cards render with Pune highlighted (>60 High Risk).
  - [x] Top high-risk corridors list displays `Pune Ring Road Sector 1` at risk score 78.
- **Status:** **PASS**

---

### Step 2: Collector Login, Alert Review & Project Deep Dive
- **User Role:** `collector` (`Rajesh Patil, District Collector - Pune`)
- **Action:** Switch to Collector profile, navigate to `/alerts`, review Pune district alerts, click through to `Pune Ring Road Sector 1` (`/projects/PRJ-0001`).
- **Expected Outcome:** Collector sees alerts scoped to Pune district. Opening project displays full breakdown: risk score 78 (High), expected delay of 140 days, stage probabilities (possession 81%, compensation 72%), top 3 SHAP drivers (`litigation_cases`, `compensation_pending_pct`, `approval_days_pending`), and actionable prescriptive recommendations.
- **Verification:**
  - [x] Alerts page displays alert: *"Risk score jumped from 61 to 78 due to 2 new high court stay orders"*.
  - [x] Clicking "Pune Ring Road Sector 1" opens project detail view.
  - [x] Risk gauge shows 78/100 (Red / High Risk) with 140 days expected delay.
  - [x] Top drivers section lists Court cases (+0.22 impact) and Pending compensation (+0.18 impact).
  - [x] Prescriptive recommendations provide specific mitigation directives (e.g. Lok Adalat, disbursement camps).
- **Status:** **PASS**

---

### Step 3: What-If Simulation: "Release 50% Pending Compensation"
- **User Role:** `collector` or `policymaker`
- **Action:** Open What-If Simulation workbench on project `PRJ-0001`. Slide/enter `compensation_pending_pct` reduction from 62.7% to 12.7% (releasing 50% of pending compensation). Click "Simulate Impact".
- **Expected Outcome:** Live simulation triggers `POST /projects/PRJ-0001/what-if`. The risk score immediately drops from 78 down to 64 (delta: -14 points), moving the corridor closer to the Medium risk boundary.
- **Verification:**
  - [x] What-If workbench loads existing project baseline features.
  - [x] Changing compensation pending percentage to 12.7% computes new score.
  - [x] New risk score shows 64 with a -14 point risk reduction delta.
  - [x] Visual before/after gauge illustrates the direct impact of intervention.
- **Status:** **PASS**

---

### Step 4: Project Manager Field Update & Instant Alert Surge
- **User Role:** `project_manager` (`Priya Sharma, PM - Pune`)
- **Action:** Sign in as PM, open `Pune Ring Road Sector 1`, edit court cases count from 2 to 9 (simulating new litigation filed during field survey), and save updates (`PATCH /projects/PRJ-0001`).
- **Expected Outcome:** Backend recalculates features, runs inference, registers a risk surge &ge;15 points. System issues a High-severity Early Warning Alert (`ALT-0001`). The alert immediately appears in the Collector and PM alert feeds.
- **Verification:**
  - [x] PM can edit and save operational project fields.
  - [x] Project patch returns updated prediction object conforming to Section 4.
  - [x] Alert engine evaluates `new_score - previous_score >= 15` and generates high-severity alert.
  - [x] Collector and Policymaker immediately see the newly triggered alert on `/alerts`.
- **Status:** **PASS**

---

### Step 5: Admin Retrain Pipeline & Model Governance
- **User Role:** `admin` (`Anand Verma, System Admin`)
- **Action:** Sign in as Admin, navigate to `/admin/retrain`. Drag and drop monthly training CSV (`data/ongoing/projects.csv`), verify detected schema, click "Start Retraining Pipeline", monitor status polling, review Champion vs. Challenger metrics table and comparison chart, and activate the newly promoted model version.
- **Expected Outcome:** Pipeline returns HTTP 202 Accepted. Status poller transitions to `done`. Metrics table compares Baseline vs. Retrained model (PR-AUC: 0.884 &rarr; 0.912, Recall: 0.810 &rarr; 0.845, Brier: 0.124 &rarr; 0.098). Admin activates model version `v1.1`.
- **Verification:**
  - [x] CSV file upload succeeds and displays row count and column headers.
  - [x] Retraining trigger returns HTTP 202 and polls `/admin/retrain/status`.
  - [x] Metrics delta table highlights positive improvements (green for higher PR-AUC, green for lower Brier score).
  - [x] Recharts bar chart renders Champion vs. Challenger comparison visually.
  - [x] Clicking "Activate" promotes model version with immediate audit logging.
- **Status:** **PASS**

---

### Step 6: Statutory Auditor Compliance & Evidence Export
- **User Role:** `auditor` (`Kavita Rao, State Auditor`)
- **Action:** Sign in as Auditor, navigate to `/audit`. Filter audit records by action type (`UPDATE_PROJECT`, `RETRAIN_MODEL`, `ACTIVATE_MODEL`), verify user identity and timestamp immutability, and click "Export Filtered Audit Log to CSV".
- **Expected Outcome:** Filtered ledger shows immutable timeline of all administrative interventions, project updates, and model recalculations with recorded model version. Browser initiates instantaneous CSV download containing clean audit records.
- **Verification:**
  - [x] Audit ledger displays complete chronological history with timestamps.
  - [x] Records include user email, project ID, action name, and model version.
  - [x] Filter controls (user, project, date range, action) dynamically update the visible records.
  - [x] "Export Filtered Audit Log to CSV" generates and downloads RFC 4180 compliant CSV file in browser.
- **Status:** **PASS**

---

## 4. Test Sign-Off & Summary

| Verification Area | Total Items | Passed | Failed | Blocked |
|---|---|---|---|---|
| **Role-Based Permissions** | 34 | 34 | 0 | 0 |
| **Demo Path Steps** | 6 | 6 | 0 | 0 |
| **Automated Contract Tests** | 26 | 26 | 0 | 0 |
| **Unit & Pipeline Tests** | 118 | 118 | 0 | 0 |
| **Overall Readiness** | **100% Passed** | **Sign-off granted for demo** | - | - |
