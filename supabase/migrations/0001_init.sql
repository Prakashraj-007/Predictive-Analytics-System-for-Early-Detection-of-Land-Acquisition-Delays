-- =============================================================================
-- Migration: 0001_init.sql
-- Description: LandSentinel Core Schema, RLS, and Constraints
-- Source of Truth: docs/contracts.md (Section 2)
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. PROFILES (Linked to auth.users, trigger-free design)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('project_manager', 'collector', 'policymaker', 'admin', 'auditor')),
    district TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 2. PROJECTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
    project_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('highway', 'rail', 'irrigation', 'power', 'urban')),
    agency TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'Maharashtra',
    district TEXT NOT NULL,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    land_area_ha NUMERIC NOT NULL DEFAULT 0,
    families_affected INTEGER NOT NULL DEFAULT 0,
    families_resettlement INTEGER NOT NULL DEFAULT 0,
    budget NUMERIC NOT NULL DEFAULT 0,
    planned_start DATE NOT NULL,
    planned_end DATE NOT NULL,
    current_stage TEXT NOT NULL CHECK (current_stage IN ('planning', 'sia', 'notification', 'award', 'compensation', 'possession', 'rr')),
    status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'active', 'completed')) DEFAULT 'draft',
    rr_progress_pct NUMERIC NOT NULL DEFAULT 0 CHECK (rr_progress_pct >= 0 AND rr_progress_pct <= 100),
    officer_response_days NUMERIC NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 3. PARCELS (No owner names stored/returned - anonymised)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.parcels (
    parcel_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    survey_no TEXT NOT NULL,
    area_ha NUMERIC NOT NULL DEFAULT 0,
    land_type TEXT NOT NULL CHECK (land_type IN ('private', 'government', 'forest')),
    compensation_status TEXT NOT NULL DEFAULT 'pending',
    possession_status TEXT NOT NULL CHECK (possession_status IN ('pending', 'handed_over')) DEFAULT 'pending',
    doc_complete BOOLEAN NOT NULL DEFAULT false,
    ownership_dispute BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 4. CASES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cases (
    case_id TEXT PRIMARY KEY,
    parcel_id TEXT NOT NULL REFERENCES public.parcels(parcel_id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    filing_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'disposed')) DEFAULT 'pending',
    stay_order BOOLEAN NOT NULL DEFAULT false,
    hearings INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 5. APPROVALS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.approvals (
    approval_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    planned_date DATE NOT NULL,
    actual_date DATE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'cleared')) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 6. COMPENSATION
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.compensation (
    project_id TEXT PRIMARY KEY REFERENCES public.projects(project_id) ON DELETE CASCADE,
    award_amount NUMERIC NOT NULL DEFAULT 0,
    disbursed_amount NUMERIC NOT NULL DEFAULT 0,
    disputes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 7. INCIDENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.incidents (
    incident_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('encroachment', 'obstruction')),
    incident_date DATE NOT NULL,
    encroached_area_ha NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 8. HISTORICAL PROJECTS (Training dataset storage)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.historical_projects (
    project_id TEXT PRIMARY KEY,
    planned_start DATE NOT NULL,
    land_area_ha NUMERIC NOT NULL DEFAULT 0,
    families_affected INTEGER NOT NULL DEFAULT 0,
    project_type TEXT NOT NULL CHECK (project_type IN ('highway', 'rail', 'irrigation', 'power', 'urban')),
    litigation_cases INTEGER NOT NULL DEFAULT 0,
    stay_orders INTEGER NOT NULL DEFAULT 0,
    ownership_disputes INTEGER NOT NULL DEFAULT 0,
    compensation_pending_pct NUMERIC NOT NULL DEFAULT 0 CHECK (compensation_pending_pct >= 0 AND compensation_pending_pct <= 100),
    approval_days_pending NUMERIC NOT NULL DEFAULT 0,
    docs_incomplete_pct NUMERIC NOT NULL DEFAULT 0 CHECK (docs_incomplete_pct >= 0 AND docs_incomplete_pct <= 100),
    officer_response_days NUMERIC NOT NULL DEFAULT 0,
    encroached_area_pct NUMERIC NOT NULL DEFAULT 0 CHECK (encroached_area_pct >= 0 AND encroached_area_pct <= 100),
    possession_pct NUMERIC NOT NULL DEFAULT 0 CHECK (possession_pct >= 0 AND possession_pct <= 100),
    rr_progress_pct NUMERIC NOT NULL DEFAULT 0 CHECK (rr_progress_pct >= 0 AND rr_progress_pct <= 100),
    current_stage TEXT NOT NULL CHECK (current_stage IN ('planning', 'sia', 'notification', 'award', 'compensation', 'possession', 'rr')),
    district_past_delay_rate NUMERIC NOT NULL DEFAULT 0 CHECK (district_past_delay_rate >= 0 AND district_past_delay_rate <= 1),
    is_delayed INTEGER NOT NULL DEFAULT 0 CHECK (is_delayed IN (0, 1)),
    delay_days INTEGER NOT NULL DEFAULT 0,
    delayed_approval INTEGER NOT NULL DEFAULT 0 CHECK (delayed_approval IN (0, 1)),
    delayed_compensation INTEGER NOT NULL DEFAULT 0 CHECK (delayed_compensation IN (0, 1)),
    delayed_possession INTEGER NOT NULL DEFAULT 0 CHECK (delayed_possession IN (0, 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 9. PREDICTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.predictions (
    prediction_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    band TEXT NOT NULL CHECK (band IN ('Low', 'Medium', 'High')),
    delay_probability NUMERIC NOT NULL CHECK (delay_probability >= 0 AND delay_probability <= 1),
    expected_delay_days INTEGER NOT NULL DEFAULT 0,
    stage_probabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
    drivers JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    model_version TEXT NOT NULL DEFAULT 'v1'
);

-- =============================================================================
-- 10. ALERTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.alerts (
    alert_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    district TEXT NOT NULL,
    reason TEXT NOT NULL,
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    previous_score INTEGER CHECK (previous_score IS NULL OR (previous_score >= 0 AND previous_score <= 100)),
    status TEXT NOT NULL CHECK (status IN ('open', 'ack')) DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 11. TASKS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
    task_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    deadline DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'done')) DEFAULT 'open',
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 12. AUDIT LOG
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
    log_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    project_id TEXT REFERENCES public.projects(project_id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    details JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- =============================================================================
-- 13. MODEL VERSIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.model_versions (
    version TEXT PRIMARY KEY,
    trained_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT false
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_projects_district ON public.projects(district);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_stage ON public.projects(current_stage);

CREATE INDEX IF NOT EXISTS idx_parcels_project_id ON public.parcels(project_id);
CREATE INDEX IF NOT EXISTS idx_cases_parcel_id ON public.cases(parcel_id);
CREATE INDEX IF NOT EXISTS idx_approvals_project_id ON public.approvals(project_id);
CREATE INDEX IF NOT EXISTS idx_incidents_project_id ON public.incidents(project_id);

CREATE INDEX IF NOT EXISTS idx_predictions_project_id ON public.predictions(project_id);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON public.predictions(created_at);

CREATE INDEX IF NOT EXISTS idx_alerts_project_id ON public.alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_alerts_district ON public.alerts(district);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON public.alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.alerts(status);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

CREATE INDEX IF NOT EXISTS idx_audit_log_project_id ON public.audit_log(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON public.audit_log(timestamp);

-- =============================================================================
-- HELPER FUNCTIONS FOR ROW LEVEL SECURITY (RLS)
-- SECURITY DEFINER functions avoid recursion when querying profiles
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_auth_user_district()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT district FROM public.profiles WHERE user_id = auth.uid();
$$;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Service role key bypasses RLS automatically.
-- =============================================================================

-- Enable RLS on core tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compensation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- PROFILES POLICIES
-- Rule: A user can read their own profile; admins/auditors/policymakers read all
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        OR public.get_auth_user_role() IN ('admin', 'auditor', 'policymaker')
    );

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- PROJECTS POLICIES
-- Rule:
-- - project_manager reads projects where created_by = auth.uid()
-- - collector reads projects where district = their profile district
-- - policymaker, admin, auditor read all
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "projects_select_policy" ON public.projects;
CREATE POLICY "projects_select_policy"
    ON public.projects FOR SELECT
    TO authenticated
    USING (
        CASE
            WHEN public.get_auth_user_role() = 'project_manager' THEN created_by = auth.uid()
            WHEN public.get_auth_user_role() = 'collector' THEN district = public.get_auth_user_district()
            WHEN public.get_auth_user_role() IN ('policymaker', 'admin', 'auditor') THEN true
            ELSE false
        END
    );

DROP POLICY IF EXISTS "projects_insert_policy" ON public.projects;
CREATE POLICY "projects_insert_policy"
    ON public.projects FOR INSERT
    TO authenticated
    WITH CHECK (
        public.get_auth_user_role() = 'project_manager' AND created_by = auth.uid()
    );

DROP POLICY IF EXISTS "projects_update_policy" ON public.projects;
CREATE POLICY "projects_update_policy"
    ON public.projects FOR UPDATE
    TO authenticated
    USING (
        (public.get_auth_user_role() = 'project_manager' AND created_by = auth.uid())
        OR (public.get_auth_user_role() = 'collector' AND district = public.get_auth_user_district())
        OR public.get_auth_user_role() = 'admin'
    );

-- -----------------------------------------------------------------------------
-- TASKS POLICIES
-- Rule:
-- - project_manager sees assigned/created tasks
-- - collector sees tasks for district projects
-- - policymaker, admin, auditor see all
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
CREATE POLICY "tasks_select_policy"
    ON public.tasks FOR SELECT
    TO authenticated
    USING (
        CASE
            WHEN public.get_auth_user_role() = 'project_manager' THEN (assigned_to = auth.uid() OR assigned_by = auth.uid())
            WHEN public.get_auth_user_role() = 'collector' THEN EXISTS (
                SELECT 1 FROM public.projects p WHERE p.project_id = tasks.project_id AND p.district = public.get_auth_user_district()
            )
            WHEN public.get_auth_user_role() IN ('policymaker', 'admin', 'auditor') THEN true
            ELSE false
        END
    );

DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
CREATE POLICY "tasks_insert_policy"
    ON public.tasks FOR INSERT
    TO authenticated
    WITH CHECK (
        public.get_auth_user_role() IN ('collector', 'policymaker', 'admin')
    );

DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
CREATE POLICY "tasks_update_policy"
    ON public.tasks FOR UPDATE
    TO authenticated
    USING (
        assigned_to = auth.uid() OR public.get_auth_user_role() IN ('collector', 'policymaker', 'admin')
    );

-- -----------------------------------------------------------------------------
-- ALERTS POLICIES
-- Rule:
-- - project_manager sees alerts for own projects
-- - collector sees alerts for own district
-- - policymaker sees all alerts (or High alerts)
-- - admin, auditor see all
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "alerts_select_policy" ON public.alerts;
CREATE POLICY "alerts_select_policy"
    ON public.alerts FOR SELECT
    TO authenticated
    USING (
        CASE
            WHEN public.get_auth_user_role() = 'project_manager' THEN EXISTS (
                SELECT 1 FROM public.projects p WHERE p.project_id = alerts.project_id AND p.created_by = auth.uid()
            )
            WHEN public.get_auth_user_role() = 'collector' THEN district = public.get_auth_user_district()
            WHEN public.get_auth_user_role() IN ('policymaker', 'admin', 'auditor') THEN true
            ELSE false
        END
    );

DROP POLICY IF EXISTS "alerts_update_policy" ON public.alerts;
CREATE POLICY "alerts_update_policy"
    ON public.alerts FOR UPDATE
    TO authenticated
    USING (
        CASE
            WHEN public.get_auth_user_role() = 'project_manager' THEN EXISTS (
                SELECT 1 FROM public.projects p WHERE p.project_id = alerts.project_id AND p.created_by = auth.uid()
            )
            WHEN public.get_auth_user_role() = 'collector' THEN district = public.get_auth_user_district()
            WHEN public.get_auth_user_role() IN ('policymaker', 'admin') THEN true
            ELSE false
        END
    );

-- -----------------------------------------------------------------------------
-- CHILD ENTITIES READ POLICIES (Parcels, Cases, Approvals, Compensation, Incidents, Predictions)
-- Authenticated users who can access the parent project can read these records
-- -----------------------------------------------------------------------------
CREATE POLICY "parcels_read_policy" ON public.parcels FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.project_id = parcels.project_id));

CREATE POLICY "cases_read_policy" ON public.cases FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.parcels pa 
        JOIN public.projects p ON p.project_id = pa.project_id 
        WHERE pa.parcel_id = cases.parcel_id
    ));

CREATE POLICY "approvals_read_policy" ON public.approvals FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.project_id = approvals.project_id));

CREATE POLICY "compensation_read_policy" ON public.compensation FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.project_id = compensation.project_id));

CREATE POLICY "incidents_read_policy" ON public.incidents FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.project_id = incidents.project_id));

CREATE POLICY "predictions_read_policy" ON public.predictions FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.project_id = predictions.project_id));

CREATE POLICY "audit_read_policy" ON public.audit_log FOR SELECT TO authenticated
    USING (public.get_auth_user_role() IN ('admin', 'auditor'));

CREATE POLICY "models_read_policy" ON public.model_versions FOR SELECT TO authenticated
    USING (true);
