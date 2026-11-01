# LandSentinel Setup & Clean-Machine Runbook

This guide contains end-to-end instructions for deploying and running **LandSentinel** on a fresh machine or server from scratch.

---

> [!IMPORTANT]
> **Supabase Free Tier Inactivity Notice:**
> Supabase automatically pauses projects on the free tier after 7 days of inactivity. If the project has been paused, restore/unpause it from the [Supabase Dashboard](https://supabase.com/dashboard) at least **24 hours before** any live presentation, demo, or evaluation.

---

## 1. System Prerequisites

Before beginning, ensure the following software is installed on your workstation:
- **Git** (v2.30+)
- **Python** (v3.10, v3.11, or v3.12)
- **Node.js** (v18.x or v20.x LTS) with `npm`
- **Supabase Account** (with an active project)

---

## 2. Step-by-Step Clean Machine Installation

### Step 2.1: Clone the Repository
```bash
git clone https://github.com/Prakashraj-007/Predictive-Analytics-System-for-Early-Detection-of-Land-Acquisition-Delays.git landsentinel
cd landsentinel
```

---

### Step 2.2: Backend Environment Setup
1. Create and activate a Python virtual environment:
   - **Linux / macOS:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```
   - **Windows (PowerShell):**
     ```powershell
     python -m venv .venv
     .venv\Scripts\Activate.ps1
     ```

2. Install backend Python dependencies:
   ```bash
   pip install --upgrade pip
   pip install -r backend/requirements.txt
   ```

---

### Step 2.3: Configure Environment Variables

1. **Backend Environment (`backend/.env`):**
   Copy the example environment template:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Fill in your Supabase project credentials in `backend/.env`:
   ```ini
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOi...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
   SUPABASE_JWT_SECRET=your-supabase-jwt-secret
   CORS_ORIGINS=http://localhost:5173,http://localhost:3000
   STUB_MODE=false
   MODEL_DIR=models
   ```

2. **Frontend Environment (`frontend/.env`):**
   ```bash
   cp frontend/.env.example frontend/.env
   ```
   Configure the API and Supabase endpoints:
   ```ini
   VITE_API_URL=http://localhost:8000
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

---

### Step 2.4: Supabase Database Migration

1. Open your project on the [Supabase Dashboard](https://supabase.com/dashboard).
2. Open the **SQL Editor** tab from the left sidebar.
3. Click **New Query**, paste the full contents of `supabase/migrations/0001_init.sql`, and click **Run**.
4. Confirm that all 13 tables are created with Row Level Security (RLS) enabled.

---

### Step 2.5: Seed Demo Users
Run the user seeding script to create the 5 role accounts in Supabase Auth and the `profiles` table:
```bash
python supabase/seed_users.py
```

#### Demo User Credentials Table
| Role | User ID / Email | Default Password | District Scope |
| :--- | :--- | :--- | :--- |
| **Project Manager** | `pm1@landsentinel.gov.in` | `demo123` | Pune (Own projects) |
| **District Collector** | `collector1@landsentinel.gov.in` | `demo123` | Pune District |
| **Policymaker / Secretary** | `policymaker1@landsentinel.gov.in` | `demo123` | Statewide (High band alerts) |
| **System Admin** | `admin1@landsentinel.gov.in` | `demo123` | Full administrative control |
| **Auditor / Oversight** | `auditor1@landsentinel.gov.in` | `demo123` | Read-only & Audit Logs |

---

### Step 2.6: Seed Ongoing Projects Dataset
Load the ongoing projects, parcels, court cases, approvals, compensation, and incidents CSV files into Supabase:
```bash
python -m app.seed_loader --dir data/ongoing
```
*(If running on a restricted test environment without full datasets, use `--dir data/sample_tiny`)*.

---

### Step 2.7: Pre-compute Batch Predictions
Run the batch prediction pipeline across all loaded projects:
```bash
python -m app.scripts.predict_all
```
This runs the full ML feature construction, XGBoost inference, plain-language driver mapping, and alert evaluation for all projects in Supabase.

---

### Step 2.8: Start the FastAPI Backend
Start the backend server on port 8000:
```bash
uvicorn app.main:app --reload --app-dir backend --port 8000
```
- Interactive API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)

---

### Step 2.9: Start the React Frontend
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open your browser at [http://localhost:5173](http://localhost:5173) to access the LandSentinel portal.

---

## 3. Demo Reset Procedure

To reset the database between demo presentations (wipes tasks, alerts, predictions, reloads ongoing projects, and re-computes initial risk predictions):
```bash
python scripts/demo_reset.py
```
This leaves user accounts and schemas intact while restoring a known baseline state.

---

## 4. Production Deployment

### Option A: Docker Deployment
Build and run the backend container locally or on any cloud container service:
```bash
docker build -t landsentinel-api -f backend/Dockerfile .
docker run -p 8000:8000 --env-file backend/.env landsentinel-api
```

### Option B: Render Deployment
A blueprint configuration is provided in `render.yaml`:
1. Push your repository to GitHub.
2. Link your repository in [Render Dashboard](https://dashboard.render.com).
3. Render automatically detects `render.yaml` and deploys:
   - `landsentinel-api` (Docker web service)
   - `landsentinel-frontend` (Static site with SPA routing)
4. Add your secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`) in the Render environment settings.

### Option C: Frontend Deployment (Vercel / Netlify)
To deploy the frontend to Vercel or Netlify:
1. Set the **Root Directory** to `frontend`.
2. Build Command: `npm run build`
3. Output Directory: `dist`
4. Set Environment Variable:
   - `VITE_API_URL`: URL of the deployed FastAPI backend (e.g. `https://landsentinel-api.onrender.com`).
   - `VITE_SUPABASE_URL`: Your Supabase URL.
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon public key.
5. Configure SPA redirect rule (for Netlify, add a `_redirects` file with `/*  /index.html  200`; for Vercel, `vercel.json` rewrite to `/index.html`).
