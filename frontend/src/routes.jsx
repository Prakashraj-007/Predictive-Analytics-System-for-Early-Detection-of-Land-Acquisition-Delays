import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import NotAllowed from './pages/NotAllowed';
import NotFound from './pages/NotFound';
import Overview from './pages/Overview';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import CreateProject from './pages/CreateProject';
import UpdateProject from './pages/UpdateProject';
import WhatIf from './pages/WhatIf';
import RiskMap from './pages/monitoring/RiskMap';
import AlertsTasks from './pages/monitoring/AlertsTasks';
import AdminRetrain from './pages/monitoring/AdminRetrain';
import AuditLog from './pages/monitoring/AuditLog';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={<Login />} />
      <Route path="/not-allowed" element={<NotAllowed />} />

      {/* Authenticated Application Shell */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Core Overview & Scroll-Down Diagnostic Canvas (All Roles) */}
        <Route index element={<Overview />} />
        <Route path="overview" element={<Overview />} />
        <Route path="projects" element={<ProjectList />} />
        <Route path="projects/:id" element={<ProjectDetail />} />

        {/* Create Project Wizard: project_manager only */}
        <Route
          path="projects/new"
          element={
            <ProtectedRoute allowedRoles={['project_manager']}>
              <CreateProject />
            </ProtectedRoute>
          }
        />

        {/* Update Project Telemetry: project_manager only */}
        <Route
          path="projects/:id/update"
          element={
            <ProtectedRoute allowedRoles={['project_manager']}>
              <UpdateProject />
            </ProtectedRoute>
          }
        />

        {/* What-If Simulator: all roles except auditor */}
        <Route
          path="what-if"
          element={
            <ProtectedRoute allowedRoles={['project_manager', 'collector', 'policymaker', 'admin']}>
              <WhatIf />
            </ProtectedRoute>
          }
        />

        {/* Geospatial Map: collector, policymaker, admin */}
        <Route
          path="map"
          element={
            <ProtectedRoute allowedRoles={['collector', 'policymaker', 'admin']}>
              <RiskMap />
            </ProtectedRoute>
          }
        />

        {/* Alerts & Tasks: project_manager, collector, policymaker, admin */}
        <Route
          path="alerts"
          element={
            <ProtectedRoute allowedRoles={['project_manager', 'collector', 'policymaker', 'admin']}>
              <AlertsTasks />
            </ProtectedRoute>
          }
        />

        {/* Data & Model Retraining: admin only */}
        <Route
          path="admin/retrain"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminRetrain />
            </ProtectedRoute>
          }
        />

        {/* Audit Log: admin, auditor */}
        <Route
          path="audit"
          element={
            <ProtectedRoute allowedRoles={['admin', 'auditor']}>
              <AuditLog />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 404 Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
