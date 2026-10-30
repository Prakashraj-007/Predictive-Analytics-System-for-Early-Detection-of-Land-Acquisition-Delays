# LandSentinel Supabase Setup & Seed Guide

This directory contains the database migration scripts and seed utilities for the LandSentinel platform.

---

## Architecture Overview

- **Tables Defined:** 13 core tables adhering strictly to [`docs/contracts.md`](../docs/contracts.md)
  1. `profiles` (Linked to `auth.users`, trigger-free design)
  2. `projects`
  3. `parcels`
  4. `cases`
  5. `approvals`
  6. `compensation`
  7. `incidents`
  8. `historical_projects`
  9. `predictions`
  10. `alerts`
  11. `tasks`
  12. `audit_log`
  13. `model_versions`
- **Security:** Row Level Security (RLS) is enabled on all tables with granular role-based policies for `project_manager`, `collector`, `policymaker`, `admin`, and `auditor`.
- **FastAPI Integration:** The FastAPI backend uses the Supabase Service Role Key, which bypasses RLS to perform administrative and orchestrated pipeline queries.

---

## Step 1: Run Database Migration in Supabase

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to the **SQL Editor** tab (left sidebar).
3. Click **New query** (or `+`).
4. Copy the entire contents of [`supabase/migrations/0001_init.sql`](./migrations/0001_init.sql) and paste them into the SQL editor.
5. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`).
6. Confirm that the query completes with `Success. No rows returned`.
7. Verify under **Table Editor** that all 13 tables are present and Row Level Security is active.

---

## Step 2: Configure Environment Variables

1. In your Supabase Dashboard, go to **Project Settings > API**.
2. Note down:
   - **Project URL** (`https://<project-ref>.supabase.co`)
   - **anon public key** (`eyJ...`)
   - **service_role secret key** (`eyJ...`)
3. Create your `backend/.env` file from [`backend/.env.example`](../backend/.env.example):
   ```bash
   cp backend/.env.example backend/.env
   ```
4. Fill in the values:
   ```env
   SUPABASE_URL=https://<your-project-ref>.supabase.co
   SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   SUPABASE_JWT_SECRET=<your-jwt-secret>
   CORS_ORIGINS=http://localhost:5173,http://localhost:3000
   MODEL_DIR=models
   STUB_MODE=true
   ```

---

## Step 3: Run the Seed Users Script

The seed script creates the 5 demo accounts with password `demo123` via the Supabase Admin Auth API and inserts their corresponding `profiles` records.

1. Ensure Python dependencies are installed:
   ```bash
   pip install supabase python-dotenv
   ```
2. Execute the script from the repository root:
   ```bash
   python supabase/seed_users.py
   ```
3. If successful, you will see output confirming user creation and profile synchronization.

---

## Demo Accounts Reference

All accounts are created with password: **`demo123`**

| Username | Email | Role | District | Description |
|---|---|---|---|---|
| `pm1` | `pm1@landsentinel.gov.in` | `project_manager` | Pune | Creates and manages assigned projects & updates parcel details |
| `collector1` | `collector1@landsentinel.gov.in` | `collector` | Pune | Approves projects, manages tasks & monitors district alerts |
| `policymaker1` | `policymaker1@landsentinel.gov.in` | `policymaker` | *All* | State-wide dashboards, high-risk trends & assigns tasks |
| `admin1` | `admin1@landsentinel.gov.in` | `admin` | *All* | Manages models, uploads retraining datasets, system config |
| `auditor1` | `auditor1@landsentinel.gov.in` | `auditor` | *All* | Read-only inspection of predictions, projects, and audit logs |

---

## Notes & Troubleshooting

- **Supabase Free Tier Inactivity:** Supabase free-tier projects pause after one week of inactivity. If paused, restore the project in the Supabase Dashboard before running the app.
- **Rerunning Seed Script:** `seed_users.py` is idempotent. You can re-run it at any time to sync or update demo user profiles without duplicating users.
