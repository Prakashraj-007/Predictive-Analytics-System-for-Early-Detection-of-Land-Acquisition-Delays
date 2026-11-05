---
name: Bug Report
about: Create a bug report to help identify and fix LandSentinel defects
title: "[BUG] "
labels: ["bug"]
assignees: ""
---

### 1. Page or Endpoint
<!-- e.g. Frontend URL: /alerts or /projects/PRJ-0001; or REST Endpoint: PATCH /projects/:id -->


### 2. Role Used
<!-- Select one: project_manager | collector | policymaker | admin | auditor -->


### 3. Steps to Reproduce
1. Log in or select role: 
2. Navigate to: 
3. Perform action / click button: 
4. Observe behavior: 

### 4. Expected Behavior
<!-- A clear and concise description of what should happen according to docs/contracts.md -->


### 5. Actual Behavior
<!-- What actually happened, including HTTP status codes, console errors, or unexpected UI states -->


### 6. Screenshot / Log Output
<!-- Paste screenshot or copy relevant terminal/browser console logs -->


### 7. Owner
<!-- Person responsible according to ownership boundaries:
     Owner A: Backend Platform, FastAPI routers, Supabase schema, RBAC (backend/app/)
     Owner B: ML Models, Synthetic Data, SHAP Explainability (backend/ml/, backend/data_gen/, backend/core/predict.py)
     Owner C: Frontend UX, Dashboard, Project Detail, Layout, Client (frontend/src/pages/, components/, except monitoring)
     Owner D: Data Adapters, Feature Engineering, Alerts, Recommendations, Monitoring Pages, Tests (backend/adapters/, backend/core/features.py, alerts.py, recommend.py, frontend/src/pages/monitoring/)
-->
- [ ] Owner A (Backend Platform & API)
- [ ] Owner B (ML Models & Data Gen)
- [ ] Owner C (Frontend UI & Visualizations)
- [ ] Owner D (Integration, Domain Logic & QA)

### 8. Severity
<!-- Select appropriate severity -->
- [ ] demo-blocker (Prevents completion of official 6-step demo path)
- [ ] major (Core workflow failure or permission bypass without immediate workaround)
- [ ] minor (Cosmetic, styling alignment, or non-blocking edge case)
