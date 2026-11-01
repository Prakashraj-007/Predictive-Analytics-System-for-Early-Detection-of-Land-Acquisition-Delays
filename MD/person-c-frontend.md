# PERSON C: Frontend (React) , Core Product Pages

Branch: `feature/frontend`
Your folders: `frontend/` (everything except `frontend/src/pages/monitoring/`, `frontend/src/components/monitoring/` and `frontend/src/api/monitoring.js`, which belong to Person D).
You do NOT touch: `backend/` (any file).

You can start right away with mock data. You do not need the backend to be running until Day 3.

---

## How to use this file

1. Open the repo in Antigravity on your own branch.
2. For every new agent session, paste the **SHARED CONTEXT** block first, then the prompt you need.
3. Run `npm run dev` after every prompt and click through the page. Do not commit what you have not seen in the browser.
4. Mock mode: all API calls go through `frontend/src/api/client.js`. A flag `VITE_USE_MOCK=true` makes it return JSON from `frontend/src/mocks/` instead. You switch it to `false` on Day 3.
5. `docs/contracts.md` (from Person A) is the source of truth for every JSON shape. If a shape in your mock differs from the contract, change your mock.

## SHARED CONTEXT (paste at the start of every session)

```text
PROJECT: LandSentinel, a web app that predicts delay risk for land acquisition projects (risk score 0-100, band Low <30 / Medium 30-60 / High >60, expected delay days, stage-wise probabilities, top-3 SHAP drivers in plain language, recommended actions, what-if simulator, dashboards, risk map, alerts, tasks, role-based access). The prototype uses SYNTHETIC data, and the UI must always show a small visible note saying so.

STACK: React 18 + Vite + Tailwind CSS + React Router + Recharts (charts) + react-leaflet (map, Person D) + @supabase/supabase-js (auth only) + axios or fetch. JavaScript or TypeScript: use JavaScript with JSDoc unless told otherwise. The backend is a FastAPI service at VITE_API_URL; every request carries the Supabase access token as Authorization: Bearer.

MY FOLDERS ONLY: frontend/ except frontend/src/pages/monitoring/, frontend/src/components/monitoring/, frontend/src/api/monitoring.js (those are Person D's). Never touch backend/.

ROLES: project_manager, collector, policymaker, admin, auditor. Role-based navigation and data come from GET /me and the backend; the frontend only hides what the role cannot use, the backend enforces it.

FRONTEND STRUCTURE:
frontend/src/
  api/client.js (single API client, mock switch), api/projects.js, api/auth.js
  mocks/*.json
  context/AuthContext.jsx
  components/ (shared: Layout, Sidebar, RiskBadge, KpiCard, RiskGauge, ShapBar, StageBars, Loading, ErrorBox, SyntheticNote)
  pages/ (Login, Overview, ProjectList, ProjectDetail, CreateProject, UpdateProject, WhatIf)
  pages/monitoring/ (Person D: RiskMap, AlertsTasks, AdminRetrain, AuditLog)
  routes.jsx

DESIGN RULES: clean government-dashboard look, Tailwind only, risk colors: Low green #16a34a, Medium amber #d97706, High red #dc2626. Responsive down to tablet. Every page has loading, empty and error states. Plain language everywhere.

PREDICTION OBJECT (from the contract):
{ project_id, created_at, risk_score, band, delay_probability, expected_delay_days,
  stage_probabilities: {approval, compensation, possession, rr},
  drivers: [ {feature, label, impact, direction, plain_text} x3 ],
  recommendations: [ {driver, action} ],
  model_version }
```

---

## DAY 0

### C1. Scaffold

```text
[Paste SHARED CONTEXT]

Task: Create the Vite React app in frontend/ with Tailwind, React Router, Recharts, @supabase/supabase-js and axios. Create the folder structure from FRONTEND STRUCTURE with placeholder files. Create .env.example (VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_USE_MOCK=true). Create frontend/src/api/client.js: an axios instance with baseURL VITE_API_URL, an interceptor that adds the Supabase access token, and a helper api.get/post/patch that, when VITE_USE_MOCK is "true", returns JSON from frontend/src/mocks/ by a route-to-file map instead of calling the network, with a 300 ms delay to imitate latency. Add a basic Layout (top bar with the app name "LandSentinel" and a SyntheticNote saying "Prototype: all data is synthetic", left Sidebar) and a routes.jsx with a placeholder for each page. npm run dev must show the layout.
```

### C2. Mock data in the contract format

```text
[Paste SHARED CONTEXT]

Task: Create mock JSON files in frontend/src/mocks/ that exactly match the response shapes of the endpoints in docs/contracts.md section 3 (if the file is not on develop yet, use the shapes in SHARED CONTEXT and the ones below): me.json (4 variants: project_manager, collector, policymaker, admin), projects.json (12 projects over 4 districts in all three bands, each with top_driver), project_detail.json (one project with 6 parcels, 4 cases, 4 approvals, compensation), prediction_high.json, prediction_medium.json, prediction_low.json (full prediction objects with 3 drivers and 3 recommendations), dashboard_summary.json, dashboard_districts.json, dashboard_trend.json (12 months), whatif.json ({current_score:78,new_score:61,change:-17}). Make the High example match the worked example: score 78, delay about 140 days, stage probabilities compensation 0.72, possession 0.81, rr 0.45, drivers litigation +0.22, compensation pending +0.17, encroachment +0.09. Add the route-to-file map entries in client.js.
```

---

## DAY 1

### C3. Login and role-based routing

```text
[Paste SHARED CONTEXT]

Task: Build authentication.
1. context/AuthContext.jsx using Supabase signInWithPassword, session persistence and signOut, then calling GET /me to load {role, district, full_name}. In mock mode, provide a login form shortcut: buttons to log in as a demo project_manager, collector, policymaker or admin without a password.
2. pages/Login.jsx: username (email) and password fields, error message for wrong credentials, a clean centered card with the LandSentinel name and a one-line description, the SyntheticNote, and (mock mode only) the demo role buttons.
3. A ProtectedRoute component that redirects to /login when there is no session and to a friendly "Not allowed" page when the role is not permitted for that route.
4. Role-based Sidebar items: project_manager (Overview, Projects, Create Project, Alerts and Tasks, What-If); collector (Overview, Projects, Map, Alerts and Tasks, What-If); policymaker (Overview, Projects, Map, Alerts, What-If); admin (Overview, Projects, Map, Data and Retrain, Audit Log); auditor (Overview, Projects, Audit Log). Add the Map, Alerts and Tasks, Data and Retrain and Audit Log entries as links to Person D's route paths: /map, /alerts, /admin/retrain, /audit (the pages come from Person D; show a "coming soon" element until they exist).
5. Show the user name, role badge, district and a Logout button in the top bar.
```

### C4. Overview dashboard

```text
[Paste SHARED CONTEXT]

Task: Build pages/Overview.jsx using GET /dashboard/summary, /dashboard/districts and /dashboard/trend (mock first):
1. Four KpiCard components: total projects, high-risk projects, average risk score, projects with active alerts.
2. A Recharts bar chart "Average risk by district" (bars colored by band of the average), a line chart "Average risk over time", and a donut/pie chart "Risk band distribution" with the three risk colors.
3. A table "Top 10 highest-risk projects" with name, district, score as RiskBadge, main driver; row click goes to /projects/:id.
4. Role scoping is done by the backend, but show the scope in a subtitle: "Showing: all districts" or "Showing: Pune district" or "Showing: your projects".
5. Reusable chart components go in frontend/src/components/charts/ (DistrictBar, TrendLine, BandDonut) so they can be reused.
```

### C5. Project list

```text
[Paste SHARED CONTEXT]

Task: Build pages/ProjectList.jsx using GET /projects with query params: a filter bar (state, district, type, band, stage dropdowns, and a text search by name), sortable columns (default: risk score descending), and a table with name, district, type, stage, risk score with RiskBadge, top driver. Pagination of 15 rows. Filters update the query and keep their state in the URL (useSearchParams). Row click goes to /projects/:id. A "Create project" button shown only to project_manager. Build the RiskBadge component (score + colored band label) in components/.
```

---

## DAY 2

### C6. Project detail page with charts

```text
[Paste SHARED CONTEXT]

Task: Build pages/ProjectDetail.jsx using GET /projects/:id and GET /projects/:id/prediction.
Layout, top to bottom:
1. Header: project name, district, type, stage, status badge, buttons "Update data" (project_manager), "Run what-if" (opens /what-if?project=:id), and "Assign task" (collector, policymaker; opens a modal that posts to POST /tasks with a pre-filled action from a clicked recommendation).
2. Row of three: RiskGauge (semi-circle gauge 0-100 with three colored bands and the score in the center; build with Recharts RadialBar or an SVG), "Expected delay: about N days" card, and "Model version and date" card.
3. StageBars component: four horizontal bars for approval, compensation, possession, rr with probability in percent, colored by level.
4. "Why is this project at risk?" section: ShapBar component (horizontal bars of the 3 drivers' impact, red for increases_risk, green for decreases_risk, with the driver label) and under each bar the plain_text sentence and the matching recommendation as a card with an action icon. Match recommendations to drivers by recommendation.driver === driver.feature.
5. Tabs: Parcels (table), Court cases (table with stay order badge), Approvals (timeline with planned vs actual date and a red mark if overdue).
Never display owner names. Put RiskGauge, ShapBar and StageBars in frontend/src/components/ with props documented in JSDoc so Person D can reuse them.
```

### C7. Create project (multi-step form)

```text
[Paste SHARED CONTEXT]

Task: Build pages/CreateProject.jsx as a 5-step wizard with a progress bar, "Back/Next" and per-step validation (react-hook-form + zod are allowed; add them to package.json):
A. Basic details: name, type (highway, rail, irrigation, power, urban), requiring agency, state, district, planned start, planned completion (must be after start), budget.
B. Land requirement: total area in hectares, villages covered (tag input), a repeatable list of parcels (survey number, area in hectares, land type private/government/forest), with a CSV paste option for survey numbers.
C. Location: alignment start village, end village (lat/lon are looked up by the backend; show a small note).
D. Affected people: number of landowners, families affected, families needing resettlement.
E. Planned approvals: repeatable rows (name from a dropdown: Social Impact Assessment, Notification, Environmental Clearance, Forest Clearance, Award Declaration; planned date).
Final step: a review screen listing everything, then submit to POST /projects with the body shape in docs/contracts.md, then show success and a link to the new project. Only project_manager can open this page. Keep the draft in localStorage between steps (wrap access in try/catch).
```

### C8. Update project

```text
[Paste SHARED CONTEXT]

Task: Build pages/UpdateProject.jsx at /projects/:id/update, for project_manager. A form with three tabs: (1) Field updates: possession handed over per parcel (checkbox), documents verified per parcel (checkbox), encroachments (area in hectares), obstructions or protests (count), R&R progress percent slider, current stage dropdown, officer response days. (2) Compensation: award amount and amount disbursed. (3) Court cases: list of existing cases with status and stay-order toggle, and an "Add case" row (category, filing date, stay order). (4) Approvals: mark an approval cleared with its actual date. On save, send PATCH /projects/:id with only the changed fields, then show a result dialog with the NEW prediction returned by the API: old score to new score with a colored arrow, new band, and a banner "Alert created: risk rose by N points" when the score rose by 15 or more or crossed 60. Then a "View project" button.
```

---

## DAY 3

### C9. What-if simulator

```text
[Paste SHARED CONTEXT]

Task: Build pages/WhatIf.jsx at /what-if. A project selector (defaults to the ?project= query), then four sliders: compensation pending percent (0-100, current value pre-filled from the project's latest features), number of court cases (0-30), documents incomplete percent (0-100), approval days pending (0-365). Show the current value and the changed value under each slider and a Reset button. On slider release (debounce 400 ms) call POST /projects/:id/what-if with {changes: {...only changed keys}} and show three cards: Current score, New score (colored by band), Change (e.g. -17 with a green down arrow), plus a before/after RiskGauge pair. Include a "Quick scenarios" row of 3 buttons: "Release 50% of pending compensation", "Close half of court cases", "Complete all documents", each setting the sliders accordingly. Under the result, show a note: "Simulation only. Nothing is saved." Hidden for auditor.
```

### C10. Polish and consistency

```text
[Paste SHARED CONTEXT]

Task: Polish the whole frontend (files in my ownership only): consistent spacing and typography, every page has loading skeleton, empty state and error box with a retry button; toasts for success and failure (react-hot-toast); accessible labels and keyboard focus; responsive down to 768 px; the SyntheticNote visible on every page; a 404 page; page titles. Replace any hard-coded colors with the shared risk color constants in frontend/src/theme.js. Remove console logs. List what you changed.
```

### C11. Switch from mock to real API

Do this when Person A tells you the real endpoints are on `develop` (A8 and A9).

```text
[Paste SHARED CONTEXT]

Task: Set VITE_USE_MOCK=false and test every page of mine against the real backend at http://localhost:8000 using the demo users (pm1, collector1, policymaker1, admin1, auditor1). For each page, compare the real response with the mock shape; fix the frontend code (never the backend) where the real response differs, and list every difference as a note I can send to Person A. Handle 401 by redirecting to login and 403 by showing the Not allowed page. Keep the mock mode working behind the flag.
```

---

## DAY 4

### C12. Final pass

```text
[Paste SHARED CONTEXT]

Task: Final pass: run npm run build and fix warnings; check each page for each role by listing which sidebar items and buttons appear for project_manager, collector, policymaker, admin and auditor and compare with the permission table in docs/contracts.md section 5; fix mismatches; check that no page shows parcel owner names; check that the browser console has no errors on any page. Output the role-by-page checklist with pass or fail.
```

---

## Dependencies for you (Person C)

| You need | From | If late |
|---|---|---|
| JSON shapes | `docs/contracts.md` (Person A, Day 0) | Use the shapes in SHARED CONTEXT |
| A real login | Person A's seeded Supabase users (A3, A5) | Mock mode demo buttons |
| Real data | Person A's endpoints (A7 to A9), Person B's model | Mock JSON |
| A real prediction example | Person B's `docs/sample_prediction.json` | Your own `prediction_high.json` |

People waiting on you:

| Person | Needs | When |
|---|---|---|
| D | `components/Layout`, `Sidebar`, `RiskBadge`, `api/client.js` (to build monitoring pages inside the same shell) | End of Day 0 / morning of Day 1; push C1 first |
| D | `RiskGauge`, `StageBars` (for the map popup) are optional | Day 2 |
| QA (D) | All pages finished for the full role-by-role test | Day 3 |

Push C1 and C2 to `develop` as early as possible. Person D builds on your layout and API client.
