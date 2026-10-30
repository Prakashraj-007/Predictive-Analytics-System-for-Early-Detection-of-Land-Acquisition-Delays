# LandSentinel

> **Predictive Analytics System for Early Detection of Land Acquisition Delays**

LandSentinel is a web application that predicts delay risk for land acquisition infrastructure projects.

## Key Features & Output per Project
- **Risk Score:** 0–100 with categorical risk bands:
  - **Low:** < 30
  - **Medium:** 30–60
  - **High:** > 60
- **Delay Metrics:** Delay probability and expected delay days
- **Stage-Wise Probabilities:** Approval, compensation, possession, R&R (Resettlement & Rehabilitation)
- **Explainability:** Top-3 SHAP drivers in plain language
- **Actionable Insights:** Recommended corrective actions and what-if simulation
- **Operational Tools:** Risk map, interactive dashboards, real-time alerts, task workflows, role-based access control, audit logging, and model retraining pipelines

---

## Tech Stack
- **Frontend:** React (Vite) + Tailwind CSS + Recharts + react-leaflet
- **Backend:** FastAPI + Uvicorn + Pydantic
- **Database & Auth:** Supabase (PostgreSQL + RLS + Auth JWT)
- **Machine Learning:** Python 3.10+, pandas, scikit-learn, XGBoost, SHAP, joblib

---

## Repository Layout
```text
landsentinel/
  frontend/                 # React Vite frontend application
  backend/
    app/                    # FastAPI application, auth, db, schemas, routers, services
    core/                   # Feature engineering, alert evaluation, recommendations, prediction
    adapters/               # Domain system adapters (eCourts, land records, compensation, approvals)
    ml/                     # Model training, evaluation, explainability, retraining
    data_gen/               # Synthetic data generators
  data/                     # Historical and ongoing datasets
  models/                   # Trained ML models and artifacts
  supabase/migrations/      # SQL migrations, RLS policies, seed scripts
  docs/contracts.md         # Source of truth for contracts, schemas, and API endpoints
  tests/                    # Test suite (pytest)
```

---

## Team Ownership & Branches
- **Person A (Platform / API):** `feature/backend-core` — owns `backend/app/`, `supabase/`, `docs/contracts.md`, deployment
- **Person B (ML / Data):** `feature/ml-data` — owns `backend/ml/`, `backend/data_gen/`, `backend/core/predict.py`, `data/`, `models/`
- **Person C (Frontend):** `feature/frontend` — owns core `frontend/` pages and components
- **Person D (Integration / QA):** `feature/integration-qa` — owns `backend/adapters/`, `backend/core/` (features, alerts, recommend), `tests/`, monitoring pages

---

## Source of Truth
Refer to [`docs/contracts.md`](docs/contracts.md) for data schemas, API routes, model features, and function signatures.
