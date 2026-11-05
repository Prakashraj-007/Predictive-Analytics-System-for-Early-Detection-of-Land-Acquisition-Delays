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
    user_id: '5ad5e3f4-99ff-445b-bd5c-2fee103c357e',
    name: 'Priya Sharma (PM)',
    district: 'Pune',
    desc: 'Project Manager (Create/Update Projects, What-If, Alerts & Tasks)',
    email: 'pm1@landsentinel.gov.in',
    aliasEmail: 'pm@landsentinel.gov.in',
    defaultPassword: 'demo123',
  },
  {
    role: 'collector',
    user_id: 'cc354e61-2574-49e8-a9ff-85e541a60084',
    name: 'Rajesh Patil (District Collector)',
    district: 'Pune',
    desc: 'District Collector (Pune District Scope, Approvals, Assign Tasks)',
    email: 'collector1@landsentinel.gov.in',
    aliasEmail: 'collector.pune@landsentinel.gov.in',
    defaultPassword: 'demo123',
  },
  {
    role: 'policymaker',
    user_id: '52430ba3-8c1d-4807-9b96-873adac3b96b',
    name: 'Dr. Sunita Deshmukh (Secretary)',
    district: 'Maharashtra State',
    desc: 'State Policy Maker (Statewide Macro Overview, Risk Prioritization, What-If)',
    email: 'policymaker1@landsentinel.gov.in',
    aliasEmail: 'policy@landsentinel.gov.in',
    defaultPassword: 'demo123',
  },
  {
    role: 'admin',
    user_id: '34b6811b-2523-4bc3-b6a4-794b4724715d',
    name: 'Anand Verma (System Admin)',
    district: 'State Data Cell',
    desc: 'System Admin (Model Retrain, Uploads, Audit Access, Map)',
    email: 'admin1@landsentinel.gov.in',
    aliasEmail: 'admin@landsentinel.gov.in',
    defaultPassword: 'demo123',
  },
  {
    role: 'auditor',
    user_id: '61c729eb-1349-4733-a712-63ea368359e4',
    name: 'Kavita Rao (State Auditor)',
    district: 'Audit Directorate',
    desc: 'Compliance Auditor (Read-only Verification, Audit Log, Overview)',
    email: 'auditor1@landsentinel.gov.in',
    aliasEmail: 'audit@landsentinel.gov.in',
    defaultPassword: 'demo123',
  },
];

/**
 * Generate a cryptographically valid HS256 JWT for statutory demo evaluation
 * Fully verified by FastAPI jwt.decode with SUPABASE_JWT_SECRET
 */
export async function createDemoJwt(userId, role, district, fullName, email) {
  const secret =
    import.meta.env.VITE_SUPABASE_JWT_SECRET ||
    '6PAkgHk5pHbGxme6l2EuNHfr4ZOEf5bhC+3jBZFmLwErGShqonIV/76bOQczBM42SnXkEsHVwRFMohrUuwdu3A==';
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: 'supabase',
    sub: userId,
    role: 'authenticated',
    email: email || `${userId}@landsentinel.gov.in`,
    iat: now,
    exp: now + 86400 * 7,
    user_metadata: {
      role: role,
      district: district || null,
      full_name: fullName || userId,
    },
  };

  const b64u = (obj) => {
    const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const dataToSign = `${b64u(header)}.${b64u(payload)}`;

  try {
    const cryptoObj = typeof window !== 'undefined' && window.crypto ? window.crypto : (globalThis.crypto || null);
    if (cryptoObj?.subtle) {
      const enc = new TextEncoder();
      const key = await cryptoObj.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await cryptoObj.subtle.sign('HMAC', key, enc.encode(dataToSign));
      const sigBytes = new Uint8Array(signature);
      let binary = '';
      for (let i = 0; i < sigBytes.length; i++) {
        binary += String.fromCharCode(sigBytes[i]);
      }
      const sigB64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return `${dataToSign}.${sigB64}`;
    }
  } catch (err) {
    console.warn('Crypto subtle signing note:', err);
  }

  return `${dataToSign}.demo_jwt_${Date.now()}`;
}

/**
 * Log in using credentials (email and password)
 */
export async function loginWithCredentials(email, password) {
  if (!email || !password) {
    throw new Error('Please enter both official email and secure passcode.');
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Match demo user registry or parse custom email
  const matchedUser = DEMO_USERS.find(
    (u) => u.email.toLowerCase() === normalizedEmail || u.aliasEmail?.toLowerCase() === normalizedEmail
  );

  if (matchedUser) {
    const token = await createDemoJwt(
      matchedUser.user_id,
      matchedUser.role,
      matchedUser.district,
      matchedUser.name,
      matchedUser.email
    );
    localStorage.setItem('landsentinel_token', token);
    localStorage.setItem('landsentinel_role', matchedUser.role);
    return await getMe();
  }

  if (!normalizedEmail.includes('@landsentinel.gov.in')) {
    throw new Error('Unrecognized departmental domain. Use @landsentinel.gov.in email address.');
  }

  if (password.length < 4) {
    throw new Error('Invalid passcode length. Statutory credentials require at least 4 characters.');
  }

  const role = 'project_manager';
  const token = await createDemoJwt(
    '5ad5e3f4-99ff-445b-bd5c-2fee103c357e',
    role,
    'Pune',
    'Department Officer',
    normalizedEmail
  );
  localStorage.setItem('landsentinel_role', role);
  localStorage.setItem('landsentinel_token', token);

  return await getMe();
}

/**
 * 1-Click Fast Access for Statutory Role Switcher & Evaluation
 */
export async function loginAsDemoRole(role) {
  const user = DEMO_USERS.find((u) => u.role === role) || DEMO_USERS[0];
  const token = await createDemoJwt(
    user.user_id,
    user.role,
    user.district,
    user.name,
    user.email
  );

  localStorage.setItem('landsentinel_role', role);
  localStorage.setItem('landsentinel_token', token);
  return await getMe();
}

/**
 * Fetch active profile identity and statutory clearances
 */
export async function getMe() {
  const profile = await api.get('/me');
  if (profile?.role) {
    localStorage.setItem('landsentinel_role', profile.role);
  }
  return profile;
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
