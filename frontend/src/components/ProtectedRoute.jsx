import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotAllowed from '../pages/NotAllowed';
import { SkeletonCard } from './Loading';

/**
 * ProtectedRoute component:
 * 1. Verifies authentication session. If none, redirects to /login.
 * 2. Verifies role permission if allowedRoles is provided. If forbidden, shows friendly NotAllowed screen.
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, isAuthenticated, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="py-12 px-6 max-w-4xl mx-auto space-y-6">
        <SkeletonCard height="h-24" />
        <SkeletonCard height="h-64" />
      </div>
    );
  }

  // Not authenticated -> redirect to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role restriction check
  if (allowedRoles && !hasRole(allowedRoles)) {
    return <NotAllowed allowedRoles={allowedRoles} />;
  }

  return children ? children : null;
}

