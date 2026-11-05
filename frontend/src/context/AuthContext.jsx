import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getMe,
  loginWithCredentials,
  loginAsDemoRole,
  logoutUser,
  DEMO_USERS,
} from '../api/auth';
import { supabase, isSupabaseConfigured } from '../api/supabase';

const isMock = import.meta.env.VITE_USE_MOCK !== 'false';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Initialize session on mount
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      setLoading(true);
      try {
        const token = localStorage.getItem('landsentinel_token');
        if (token) {
          try {
            const profile = await getMe();
            if (mounted && profile) {
              setUser(profile);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.warn('Existing token validation error, re-establishing session:', e.message);
          }
        }

        // Establish session with active evaluation role
        const activeRole = localStorage.getItem('landsentinel_role') || 'project_manager';
        try {
          const profile = await loginAsDemoRole(activeRole);
          if (mounted && profile) setUser(profile);
        } catch (e) {
          console.warn('Initial session sign-in note:', e.message);
          if (mounted) setUser(null);
        }
      } catch (err) {
        console.error('Session initialization error:', err);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initSession();

    // Supabase auth state listener for real auth
    let authListener = null;
    if (!isMock && isSupabaseConfigured) {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.access_token) {
          localStorage.setItem('landsentinel_token', session.access_token);
          try {
            const profile = await getMe();
            if (mounted) setUser(profile);
          } catch (e) {
            console.error(e);
          }
        } else if (event === 'SIGNED_OUT') {
          if (mounted) setUser(null);
        }
      });
      authListener = data.subscription;
    }

    return () => {
      mounted = false;
      if (authListener) authListener.unsubscribe();
    };
  }, []);

  // Standard Login with Email and Password
  const login = async (email, password) => {
    setLoading(true);
    setAuthError(null);
    try {
      const profile = await loginWithCredentials(email, password);
      setUser(profile);
      return profile;
    } catch (err) {
      setAuthError(err.message || 'Login failed.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Evaluation Role Switch
  const switchDemoRole = async (role) => {
    setLoading(true);
    setAuthError(null);
    try {
      const profile = await loginAsDemoRole(role);
      setUser(profile);
      return profile;
    } catch (err) {
      setAuthError(err.message || 'Failed to switch evaluation role.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Sign Out
  const logout = async () => {
    setLoading(true);
    try {
      await logoutUser();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Role Checker Utility
  const hasRole = (allowedRoles) => {
    if (!user || !user.role) return false;
    if (!allowedRoles || allowedRoles.length === 0) return true;
    if (typeof allowedRoles === 'string') return user.role === allowedRoles;
    return allowedRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role,
        district: user?.district,
        fullName: user?.full_name,
        isAuthenticated: Boolean(user),
        loading,
        authError,
        setAuthError,
        login,
        switchDemoRole,
        logout,
        hasRole,
        demoUsers: DEMO_USERS,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
