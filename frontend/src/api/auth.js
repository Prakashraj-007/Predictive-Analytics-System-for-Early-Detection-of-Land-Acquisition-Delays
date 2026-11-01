import api from './client';
import { supabase, isSupabaseConfigured } from './supabase';

const isMock = import.meta.env.VITE_USE_MOCK === 'true';

/**
 * Demo user registry matching Supabase Auth seed accounts
 * Passcode for all statutory users in Supabase: demo123
 */
export const DEMO_USERS = [
  {
    role: 'project_manager',
    name: 'Priya Sharma (PM)',
    district: 'Pune',
    desc: 'Project Manager (Create/Update Projects, What-If, Alerts & Tasks)',
    email: 'pm1@landsentinel.gov.in',
    aliasEmail: 'pm@landsentinel.gov.in',
    defaultPassword: 'demo123',
  },
  {
    role: 'collector',
    name: 'Rajesh Patil (District Collector)',
    district: 'Pune',
    desc: 'District Collector (Pune District Scope, Approvals, Assign Tasks)',
    email: 'collector1@landsentinel.gov.in',
    aliasEmail: 'collector.pune@landsentinel.gov.in',
    defaultPassword: 'demo123',
  },
  {
    role: 'policymaker',
    name: 'Dr. Sunita Deshmukh (Secretary)',
    district: 'Maharashtra State',
    desc: 'State Policy Maker (Statewide Macro Overview, Risk Prioritization, What-If)',
    email: 'policymaker1@landsentinel.gov.in',
    aliasEmail: 'policy@landsentinel.gov.in',
    defaultPassword: 'demo123',
  },
  {
    role: 'admin',
    name: 'Anand Verma (System Admin)',
    district: 'State Data Cell',
    desc: 'System Admin (Model Retrain, Uploads, Audit Access, Map)',
    email: 'admin1@landsentinel.gov.in',
    aliasEmail: 'admin@landsentinel.gov.in',
    defaultPassword: 'demo123',
  },
  {
    role: 'auditor',
    name: 'Kavita Rao (State Auditor)',
    district: 'Audit Directorate',
    desc: 'Compliance Auditor (Read-only Verification, Audit Log, Overview)',
    email: 'auditor1@landsentinel.gov.in',
    aliasEmail: 'audit@landsentinel.gov.in',
    defaultPassword: 'demo123',
  },
];

/**
 * Log in using credentials (email and password)
 */
export async function loginWithCredentials(email, password) {
  if (!email || !password) {
    throw new Error('Please enter both official email and secure passcode.');
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Map alias email to canonical seeded Supabase email if needed
  const matchedUser = DEMO_USERS.find(
    (u) => u.email.toLowerCase() === normalizedEmail || u.aliasEmail?.toLowerCase() === normalizedEmail
  );
  const targetEmail = matchedUser ? matchedUser.email : normalizedEmail;
  const targetPassword = password || matchedUser?.defaultPassword || 'demo123';

  // 1. Real Supabase Authentication
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: targetPassword,
      });

      if (error) {
        throw new Error(error.message || 'Authentication failed. Please verify credentials.');
      }

      if (data?.session?.access_token) {
        localStorage.setItem('landsentinel_token', data.session.access_token);
        if (matchedUser) {
          localStorage.setItem('landsentinel_role', matchedUser.role);
        }
      }

      return await getMe();
    } catch (err) {
      console.error('Supabase authentication failed:', err);
      throw err;
    }
  }

  // 2. Fallback / Mock Mode Authentication
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
 * 1-Click Fast Access for Statutory Role Switcher & Evaluation
 */
export async function loginAsDemoRole(role) {
  const user = DEMO_USERS.find((u) => u.role === role) || DEMO_USERS[0];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: user.defaultPassword || 'demo123',
      });

      if (!error && data?.session?.access_token) {
        localStorage.setItem('landsentinel_token', data.session.access_token);
        localStorage.setItem('landsentinel_role', role);
        return await getMe();
      }
    } catch (e) {
      console.warn('Direct Supabase demo sign-in note:', e.message);
    }
  }

  localStorage.setItem('landsentinel_role', role);
  localStorage.setItem('landsentinel_token', `token-${role}-${Date.now()}`);
  return await getMe();
}

/**
 * Fetch active profile identity and statutory clearances
 */
export async function getMe() {
  if (isSupabaseConfigured) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        if (profile) {
          localStorage.setItem('landsentinel_role', profile.role);
          return {
            user_id: profile.user_id,
            full_name: profile.full_name,
            role: profile.role,
            district: profile.district,
            email: authData.user.email,
          };
        }
      }
    } catch (e) {
      console.warn('Supabase getMe lookup note:', e.message);
    }
  }

  return await api.get('/me');
}

/**
 * Sign out and clear session tokens
 */
export async function logoutUser() {
  if (isSupabaseConfigured) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Supabase signOut warning:', e);
    }
  }
  localStorage.removeItem('landsentinel_token');
  localStorage.removeItem('landsentinel_role');
}
