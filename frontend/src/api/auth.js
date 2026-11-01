import api from './client';
import { supabase, isSupabaseConfigured } from './supabase';

const isMock = import.meta.env.VITE_USE_MOCK !== 'false';

export const DEMO_USERS = [
  {
    role: 'project_manager',
    name: 'Rajesh Sharma',
    district: 'Pune',
    desc: 'Project Manager (Create/Update Projects, What-If, Alerts & Tasks)',
    email: 'pm@landsentinel.gov.in',
    defaultPassword: 'demo-password-pm',
  },
  {
    role: 'collector',
    name: 'Dr. Sunita Kulkarni, IAS',
    district: 'Pune',
    desc: 'District Collector (Pune District Scope, Approvals, Assign Tasks)',
    email: 'collector.pune@landsentinel.gov.in',
    defaultPassword: 'demo-password-collector',
  },
  {
    role: 'policymaker',
    name: 'Vikramaditya Deshmukh',
    district: 'Maharashtra State',
    desc: 'State Policy Maker (Statewide Macro Overview, Risk Prioritization, What-If)',
    email: 'policy@landsentinel.gov.in',
    defaultPassword: 'demo-password-policy',
  },
  {
    role: 'admin',
    name: 'Ananya Sen',
    district: 'State Data Cell',
    desc: 'System Admin (Model Retrain, Uploads, Audit Access, Map)',
    email: 'admin@landsentinel.gov.in',
    defaultPassword: 'demo-password-admin',
  },
  {
    role: 'auditor',
    name: 'Gopalakrishnan Nair',
    district: 'Audit Directorate',
    desc: 'Compliance Auditor (Read-only Verification, Audit Log, Overview)',
    email: 'audit@landsentinel.gov.in',
    defaultPassword: 'demo-password-auditor',
  },
];

/**
 * Log in using credentials (email and password)
 */
export async function loginWithCredentials(email, password) {
  if (!email || !password) {
    throw new Error('Please enter both official email and secure passcode.');
  }

  // 1. Real Supabase Authentication (Day 3 / Production)
  if (!isMock && isSupabaseConfigured) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw new Error(error.message || 'Authentication failed. Check credentials.');
    }
    if (data?.session?.access_token) {
      localStorage.setItem('landsentinel_token', data.session.access_token);
    }
    return await getMe();
  }

  // 2. Mock Mode Authentication Validation
  const normalizedEmail = email.trim().toLowerCase();
  const matchedUser = DEMO_USERS.find(
    (u) => u.email.toLowerCase() === normalizedEmail
  );

  // In mock mode, allow any demo user or standard test password, but reject completely bogus credentials
  if (!matchedUser && !normalizedEmail.includes('@landsentinel.gov.in')) {
    throw new Error('Unrecognized departmental domain. Use @landsentinel.gov.in email address.');
  }

  if (password.length < 4) {
    throw new Error('Invalid passcode length. Statutory credentials require at least 4 characters.');
  }

  const role = matchedUser ? matchedUser.role : 'project_manager';
  localStorage.setItem('landsentinel_role', role);
  localStorage.setItem('landsentinel_token', `mock-token-${role}-${Date.now()}`);

  return await getMe();
}

/**
 * 1-Click Fast Access for Prototype Evaluation
 */
export async function loginAsDemoRole(role) {
  localStorage.setItem('landsentinel_role', role);
  localStorage.setItem('landsentinel_token', `mock-token-${role}-${Date.now()}`);
  return await getMe();
}

/**
 * Fetch active profile identity and statutory clearances
 */
export async function getMe() {
  return await api.get('/me');
}

/**
 * Sign out and clear session tokens
 */
export async function logoutUser() {
  if (!isMock && isSupabaseConfigured) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Supabase signOut warning:', e);
    }
  }
  localStorage.removeItem('landsentinel_token');
  localStorage.removeItem('landsentinel_role');
}
