import axios from 'axios';
import { supabase, isSupabaseConfigured } from './supabase';
import meMock from '../mocks/me.json';
import projectsMock from '../mocks/projects.json';
import projectDetailMock from '../mocks/project_detail.json';
import predictionHighMock from '../mocks/prediction_high.json';
import predictionMediumMock from '../mocks/prediction_medium.json';
import predictionLowMock from '../mocks/prediction_low.json';
import dashboardSummaryMock from '../mocks/dashboard_summary.json';
import dashboardDistrictsMock from '../mocks/dashboard_districts.json';
import dashboardTrendMock from '../mocks/dashboard_trend.json';
import whatIfMock from '../mocks/whatif.json';
import mapProjectsMock from '../mocks/monitoring/map_projects.json';

const isMock = import.meta.env.VITE_USE_MOCK === 'true';

export function getBaseURL() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const currentHost = window.location.hostname;
    // When accessed via LAN IP (e.g. 192.168.x.x, 172.x.x.x) or another host, route to port 8000 on that host
    if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
      if (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
        return `http://${currentHost}:8000`;
      }
    }
  }
  return envUrl || 'http://localhost:8000';
}

const axiosInstance = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Interceptor that adds the Supabase access token as Authorization: Bearer
axiosInstance.interceptors.request.use((config) => {
  config.baseURL = getBaseURL();
  const token = localStorage.getItem('landsentinel_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 by redirecting to /login and 403 by showing /not-allowed
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        localStorage.removeItem('landsentinel_token');
        localStorage.removeItem('landsentinel_role');
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      } else if (error.response.status === 403) {
        if (typeof window !== 'undefined' && window.location.pathname !== '/not-allowed') {
          window.location.href = '/not-allowed';
        }
      }
    }
    return Promise.reject(error);
  }
);

// In-memory data store for stateful prototype fallback
let inMemoryProjects = [...projectsMock];
let inMemoryDetail = JSON.parse(JSON.stringify(projectDetailMock));

const BUNDLES_STORAGE_KEY = 'landsentinel_project_bundles';
const PREDICTIONS_STORAGE_KEY = 'landsentinel_project_predictions';

function getStoredBundles() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(BUNDLES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveStoredBundle(prjId, bundle) {
  try {
    if (typeof localStorage === 'undefined') return;
    const bundles = getStoredBundles();
    bundles[prjId] = {
      ...(bundles[prjId] || {}),
      ...bundle,
      project: { ...(bundles[prjId]?.project || {}), ...(bundle.project || {}) },
      parcels: bundle.parcels !== undefined ? bundle.parcels : (bundles[prjId]?.parcels || []),
      cases: bundle.cases !== undefined ? bundle.cases : (bundles[prjId]?.cases || []),
      approvals: bundle.approvals !== undefined ? bundle.approvals : (bundles[prjId]?.approvals || []),
      compensation: bundle.compensation !== undefined ? bundle.compensation : (bundles[prjId]?.compensation || {}),
    };
    localStorage.setItem(BUNDLES_STORAGE_KEY, JSON.stringify(bundles));
  } catch (e) {
    console.warn('Failed to persist bundle to localStorage:', e);
  }
}

function getStoredPredictions() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(PREDICTIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveStoredPrediction(prjId, pred) {
  try {
    if (typeof localStorage === 'undefined') return;
    const preds = getStoredPredictions();
    preds[prjId] = pred;
    localStorage.setItem(PREDICTIONS_STORAGE_KEY, JSON.stringify(preds));
  } catch (e) {
    console.warn('Failed to persist prediction to localStorage:', e);
  }
}

/**
 * Deterministic risk prediction modeling calibrated with backend/core/predict.py
 */
function computeTelemetryRiskPrediction(prjId, bundle, effectiveAsOf) {
  const parcels = bundle.parcels || [];
  const cases = bundle.cases || [];
  const approvals = bundle.approvals || [];
  const compensation = bundle.compensation || {};
  const project = bundle.project || {};

  // 1. Possession progress: what % of land is handed over?
  const totalArea = parcels.reduce((sum, p) => sum + (Number(p.area_ha) || 1), 0);
  const handedArea = parcels
    .filter((p) => p.possession_status === 'handed_over' || p.status === 'handed_over' || p.possession_handed_over)
    .reduce((sum, p) => sum + (Number(p.area_ha) || 1), 0);
  const possessionPct = totalArea > 0 ? (handedArea / totalArea) * 100 : 0;

  // 2. Document verification: what % of parcels are verified?
  const verifiedCount = parcels.filter((p) => p.documents_verified || p.doc_complete).length;
  const docsVerifiedPct = parcels.length > 0 ? (verifiedCount / parcels.length) * 100 : 100;

  // 3. Compensation disbursed: what % of award is disbursed?
  const award = Number(compensation.award_amount) || 0;
  const disbursed = Number(compensation.amount_disbursed || compensation.disbursed_amount) || 0;
  const compDisbursedPct = award > 0 ? Math.min(100, Math.max(0, (disbursed / award) * 100)) : 50;

  // 4. Pending cases and stay orders
  const pendingCases = cases.filter((c) => c.status === 'pending' || c.status === 'stayed' || c.status === 'hearing');
  const stayOrders = cases.filter((c) => Boolean(c.stay_order)).length;

  // 5. Overdue approvals relative to effectiveAsOf
  const refDate = effectiveAsOf ? new Date(effectiveAsOf) : new Date();
  let maxOverdueDays = 0;
  approvals.forEach((a) => {
    if (a.status === 'pending' && a.planned_date) {
      const planned = new Date(a.planned_date);
      const diffDays = Math.max(0, Math.floor((refDate - planned) / (1000 * 60 * 60 * 24)));
      if (diffDays > maxOverdueDays) maxOverdueDays = diffDays;
    }
  });

  // Calculate base score:
  // Baseline risk when starting: ~18
  let score = 18;

  // Outstanding possession penalty (0 to 35 pts)
  const unhandedRatio = (100 - possessionPct) / 100;
  score += Math.round(unhandedRatio * 35);

  // Unverified docs penalty (0 to 14 pts)
  const unverifiedRatio = (100 - docsVerifiedPct) / 100;
  score += Math.round(unverifiedRatio * 14);

  // Undisbursed compensation penalty (0 to 16 pts)
  const undisbursedRatio = (100 - compDisbursedPct) / 100;
  score += Math.round(undisbursedRatio * 16);

  // Litigation penalty: +4 pts per pending case, +10 pts per active stay order
  score += Math.min(25, pendingCases.length * 4);
  score += Math.min(30, stayOrders * 10);

  // Overdue approvals penalty
  score += Math.min(18, Math.round(maxOverdueDays * 0.1));

  // Current stage discount/penalty
  const st = String(project.current_stage || '').toLowerCase();
  if (st === 'rr' || st === 'possession') score -= 5;

  const clampedScore = Math.min(95, Math.max(12, score));
  const band = clampedScore > 60 ? 'High' : clampedScore >= 30 ? 'Medium' : 'Low';
  const delayProb = Math.round((clampedScore / 100) * 100) / 100;
  const expectedDelayDays = clampedScore <= 30 ? Math.round(clampedScore * 0.3) : Math.round(clampedScore * 1.6);

  const topDriver =
    stayOrders > 0
      ? 'Active Judicial Injunctions & Stay Orders'
      : possessionPct < 50
      ? 'Land Handover & Demarcation Lag'
      : compDisbursedPct < 50
      ? 'Compensation Disbursement Processing'
      : maxOverdueDays > 30
      ? 'Statutory Approval Backlogs'
      : 'Routine Administrative Clearance';

  return {
    prediction_id: `PRED-${prjId}-${Date.now()}`,
    project_id: prjId,
    created_at: new Date().toISOString(),
    risk_score: clampedScore,
    band,
    delay_probability: delayProb,
    expected_delay_days: expectedDelayDays,
    as_of_date: effectiveAsOf || new Date().toISOString().split('T')[0],
    stage_probabilities: {
      approval: Math.min(0.9, Math.max(0.1, Math.round(clampedScore * 0.45) / 100)),
      compensation: Math.min(0.95, Math.max(0.15, Math.round(clampedScore * 0.85) / 100)),
      possession: Math.min(0.95, Math.max(0.1, Math.round(clampedScore * 0.95) / 100)),
      rr: Math.min(0.9, Math.max(0.1, Math.round(clampedScore * 0.6) / 100)),
    },
    drivers: [
      {
        feature: stayOrders > 0 ? 'stay_orders' : possessionPct < 50 ? 'possession_pct' : 'compensation_pending_pct',
        label: topDriver,
        impact: 0.28,
        direction: clampedScore > 60 ? 'increases_risk' : 'decreases_risk',
        plain_text: `${topDriver} evaluated under current field telemetry.`,
      },
    ],
    recommendations: [
      {
        driver: stayOrders > 0 ? 'stay_orders' : 'possession_pct',
        action: stayOrders > 0 ? 'File vacate stay motion before District Court' : 'Expedite field possession mutation protocols',
      },
    ],
    model_version: 'v1.2-telemetry',
  };
}

/**
 * Helper to fetch all projects joined with predictions directly from Supabase
 */
async function fetchSupabaseProjects(params = {}) {
  try {
    let query = supabase
      .from('projects')
      .select('*, predictions(prediction_id, risk_score, band, delay_probability, expected_delay_days, drivers, recommendations, created_at)');

    if (params.state) {
      query = query.eq('state', params.state);
    }
    if (params.district) {
      query = query.eq('district', params.district);
    }
    if (params.type) {
      query = query.eq('type', params.type.toLowerCase());
    }
    if (params.stage) {
      query = query.eq('current_stage', params.stage.toLowerCase());
    }

    const { data, error } = await query;
    if (error || !data) {
      throw error || new Error('Failed to query Supabase projects table');
    }

    let mapped = data.map((p) => {
      const preds = (p.predictions || []).slice();
      preds.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const latest = preds[0] || {};
      const score = latest.risk_score ?? (p.risk_score || 50);
      const band = latest.band ?? (score > 60 ? 'High' : score >= 30 ? 'Medium' : 'Low');
      const topDriver =
        latest.drivers?.[0]?.plain_text ||
        latest.drivers?.[0]?.label ||
        p.top_driver ||
        'Statutory review in progress';

      return {
        project_id: p.project_id,
        name: p.name,
        district: p.district,
        state: p.state || 'Tamil Nadu',
        type: p.type,
        current_stage: p.current_stage,
        risk_score: score,
        band: band,
        top_driver: topDriver,
        lat: p.lat,
        lon: p.lon,
        budget: p.budget,
        land_area_ha: p.land_area_ha,
        created_at: p.created_at,
      };
    });

    if (params.band) {
      mapped = mapped.filter((p) => p.band.toLowerCase() === params.band.toLowerCase());
    }

    if (params.search) {
      const q = params.search.toLowerCase();
      mapped = mapped.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.project_id.toLowerCase().includes(q) ||
          p.district.toLowerCase().includes(q) ||
          (p.top_driver && p.top_driver.toLowerCase().includes(q))
      );
    }

    const sort = params.sort || 'risk_desc';
    if (sort === 'risk_asc') {
      mapped.sort((a, b) => a.risk_score - b.risk_score);
    } else if (sort === 'risk_desc') {
      mapped.sort((a, b) => b.risk_score - a.risk_score);
    } else if (sort === 'name_asc') {
      mapped.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'name_desc') {
      mapped.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sort === 'district_asc') {
      mapped.sort((a, b) => a.district.localeCompare(b.district));
    } else if (sort === 'district_desc') {
      mapped.sort((a, b) => b.district.localeCompare(a.district));
    } else if (sort === 'type_asc') {
      mapped.sort((a, b) => a.type.localeCompare(b.type));
    } else if (sort === 'type_desc') {
      mapped.sort((a, b) => b.type.localeCompare(a.type));
    } else if (sort === 'stage_asc') {
      mapped.sort((a, b) => a.current_stage.localeCompare(b.current_stage));
    } else if (sort === 'stage_desc') {
      mapped.sort((a, b) => b.current_stage.localeCompare(a.current_stage));
    } else {
      mapped.sort((a, b) => b.risk_score - a.risk_score);
    }

    return mapped;
  } catch (err) {
    console.warn('Direct Supabase fetch error, falling back to mock:', err);
    return null;
  }
}

/**
 * Universal Unified API Client
 * - Connects directly to Supabase Backend when configured
 * - Provides seamless fallback for robust prototype reliability
 */
export const api = {
  async get(url, config = {}) {
    if (!isMock) {
      try {
        const response = await axiosInstance.get(url, config);
        return response.data;
      } catch (err) {
        if (err.code === 'ERR_NETWORK' || err.message === 'Network Error' || !err.response) {
          console.warn(`[LandSentinel API] Backend unreachable at ${getBaseURL()}. Falling back to offline client mode:`, err.message);
        } else {
          throw err;
        }
      }
    }

    const parsedUrl = new URL(url, 'http://dummy.local');
    const pathname = parsedUrl.pathname;
    const params = Object.fromEntries(parsedUrl.searchParams.entries());

    // 1. Health check
    if (pathname === '/health') {
      return {
        status: 'healthy',
        version: '1.0.0',
        backend: isSupabaseConfigured ? 'supabase' : 'mock',
        timestamp: new Date().toISOString(),
      };
    }

    // 2. GET /me (Auth profile)
    if (pathname === '/me') {
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
          console.warn('Supabase profile query note:', e);
        }
      }

      const activeRole = localStorage.getItem('landsentinel_role') || 'project_manager';
      if (meMock.variants && meMock.variants[activeRole]) {
        return meMock.variants[activeRole];
      }
      return {
        user_id: meMock.user_id,
        full_name: meMock.full_name,
        role: activeRole,
        district: meMock.district,
      };
    }

    // 3. GET /projects
    if (pathname === '/projects') {
      if (isSupabaseConfigured) {
        const liveProjects = await fetchSupabaseProjects(params);
        if (liveProjects && liveProjects.length > 0) {
          return liveProjects;
        }
      }

      // Mock filter & sort
      let filtered = [...inMemoryProjects];
      if (params.state) {
        filtered = filtered.filter((p) => p.state && p.state.toLowerCase() === params.state.toLowerCase());
      }
      if (params.district) {
        filtered = filtered.filter((p) => p.district.toLowerCase() === params.district.toLowerCase());
      }
      if (params.type) {
        filtered = filtered.filter((p) => p.type.toLowerCase() === params.type.toLowerCase());
      }
      if (params.band) {
        filtered = filtered.filter((p) => p.band.toLowerCase() === params.band.toLowerCase());
      }
      if (params.stage) {
        filtered = filtered.filter((p) => p.current_stage.toLowerCase() === params.stage.toLowerCase());
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.project_id.toLowerCase().includes(q) ||
            p.district.toLowerCase().includes(q) ||
            (p.top_driver && p.top_driver.toLowerCase().includes(q))
        );
      }

      const sort = params.sort || 'risk_desc';
      if (sort === 'risk_asc') {
        filtered.sort((a, b) => a.risk_score - b.risk_score);
      } else if (sort === 'risk_desc') {
        filtered.sort((a, b) => b.risk_score - a.risk_score);
      } else if (sort === 'name_asc') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sort === 'name_desc') {
        filtered.sort((a, b) => b.name.localeCompare(a.name));
      } else if (sort === 'district_asc') {
        filtered.sort((a, b) => a.district.localeCompare(b.district));
      } else if (sort === 'district_desc') {
        filtered.sort((a, b) => b.district.localeCompare(a.district));
      } else if (sort === 'type_asc') {
        filtered.sort((a, b) => a.type.localeCompare(b.type));
      } else if (sort === 'type_desc') {
        filtered.sort((a, b) => b.type.localeCompare(a.type));
      } else if (sort === 'stage_asc') {
        filtered.sort((a, b) => a.current_stage.localeCompare(b.current_stage));
      } else if (sort === 'stage_desc') {
        filtered.sort((a, b) => b.current_stage.localeCompare(a.current_stage));
      } else {
        filtered.sort((a, b) => b.risk_score - a.risk_score);
      }

      return filtered;
    }

    // 4. GET /dashboard/summary
    if (pathname === '/dashboard/summary') {
      if (isSupabaseConfigured) {
        const projects = await fetchSupabaseProjects();
        if (projects && projects.length > 0) {
          const total = projects.length;
          const highRisk = projects.filter((p) => p.band === 'High' || p.risk_score > 60).length;
          const avgScore =
            total > 0
              ? Math.round((projects.reduce((acc, p) => acc + p.risk_score, 0) / total) * 10) / 10
              : 46.2;

          let lowCount = 0;
          let medCount = 0;
          let highCount = 0;
          projects.forEach((p) => {
            if (p.band === 'High' || p.risk_score > 60) highCount++;
            else if (p.band === 'Medium' || p.risk_score >= 30) medCount++;
            else lowCount++;
          });

          const topRisk = [...projects]
            .sort((a, b) => b.risk_score - a.risk_score)
            .slice(0, 10)
            .map((p) => ({
              project_id: p.project_id,
              name: p.name,
              district: p.district,
              risk_score: p.risk_score,
              top_driver: p.top_driver,
            }));

          let alertsCount = 7;
          try {
            const { count, error } = await supabase
              .from('alerts')
              .select('*', { count: 'exact', head: true });
            if (!error && count !== null) alertsCount = count;
          } catch (e) {
            // keep fallback
          }

          return {
            total_projects: total,
            high_risk_projects: highRisk,
            avg_risk_score: avgScore,
            projects_with_alerts: alertsCount,
            band_distribution: {
              Low: lowCount,
              Medium: medCount,
              High: highCount,
            },
            top_risk: topRisk,
          };
        }
      }

      return dashboardSummaryMock;
    }

    // 5. GET /dashboard/districts
    if (pathname === '/dashboard/districts') {
      if (isSupabaseConfigured) {
        const projects = await fetchSupabaseProjects();
        if (projects && projects.length > 0) {
          const districtMap = {};
          projects.forEach((p) => {
            const d = p.district || 'Unassigned';
            if (!districtMap[d]) {
              districtMap[d] = { district: d, scores: [], count: 0, high_count: 0 };
            }
            districtMap[d].count += 1;
            districtMap[d].scores.push(p.risk_score);
            if (p.band === 'High' || p.risk_score > 60) {
              districtMap[d].high_count += 1;
            }
          });

          return Object.values(districtMap)
            .map((d) => ({
              district: d.district,
              avg_risk: Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length),
              project_count: d.count,
              high_risk_count: d.high_count,
            }))
            .sort((a, b) => b.avg_risk - a.avg_risk);
        }
      }

      return dashboardDistrictsMock;
    }

    // 6. GET /dashboard/trend
    if (pathname === '/dashboard/trend') {
      return dashboardTrendMock;
    }

    // 7. GET /projects/:id/prediction
    const predMatch = pathname.match(/^\/projects\/([^/]+)\/prediction$/);
    if (predMatch) {
      const prjId = predMatch[1];
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('predictions')
            .select('*')
            .eq('project_id', prjId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!error && data) {
            return {
              prediction_id: data.prediction_id,
              project_id: data.project_id,
              created_at: data.created_at,
              risk_score: data.risk_score,
              band: data.band,
              delay_probability: data.delay_probability,
              expected_delay_days: data.expected_delay_days,
              stage_probabilities: data.stage_probabilities || {
                approval: 0.35,
                compensation: 0.72,
                possession: 0.81,
                rr: 0.45,
              },
              drivers: data.drivers || [],
              recommendations: data.recommendations || [],
              model_version: data.model_version || 'v1',
              as_of_date: data.as_of_date,
            };
          }
        } catch (e) {
          console.warn('Supabase prediction note:', e);
        }
      }

      // Check stored predictions first
      const storedPreds = getStoredPredictions();
      if (storedPreds[prjId]) {
        return storedPreds[prjId];
      }

      // Check stored bundles and compute fresh calibrated prediction
      const storedBundles = getStoredBundles();
      if (storedBundles[prjId]) {
        const computed = computeTelemetryRiskPrediction(
          prjId,
          storedBundles[prjId],
          storedBundles[prjId].project?.as_of_date
        );
        saveStoredPrediction(prjId, computed);
        return computed;
      }

      const found = inMemoryProjects.find((p) => p.project_id === prjId);
      if (found && found.band === 'Medium') return { ...predictionMediumMock, project_id: prjId };
      if (found && found.band === 'Low') return { ...predictionLowMock, project_id: prjId };
      return { ...predictionHighMock, project_id: prjId };
    }

    // 8. GET /projects/:id
    const prjDetailMatch = pathname.match(/^\/projects\/([^/]+)$/);
    if (prjDetailMatch) {
      const prjId = prjDetailMatch[1];
      if (isSupabaseConfigured) {
        try {
          const { data: project } = await supabase
            .from('projects')
            .select('*')
            .eq('project_id', prjId)
            .maybeSingle();

          if (project) {
            const { data: parcels } = await supabase
              .from('parcels')
              .select('*')
              .eq('project_id', prjId);

            const parcelIds = (parcels || []).map((p) => p.parcel_id);
            let cases = [];
            if (parcelIds.length > 0) {
              const { data: cData } = await supabase
                .from('cases')
                .select('*')
                .in('parcel_id', parcelIds.slice(0, 50));
              cases = cData || [];
            }

            const { data: approvals } = await supabase
              .from('approvals')
              .select('*')
              .eq('project_id', prjId);

            const { data: compensation } = await supabase
              .from('compensation')
              .select('*')
              .eq('project_id', prjId)
              .maybeSingle();

            const { data: incidents } = await supabase
              .from('incidents')
              .select('*')
              .eq('project_id', prjId);

            return {
              project,
              parcels:
                parcels && parcels.length > 0
                  ? parcels.map((p) => ({
                      parcel_id: p.parcel_id,
                      survey_number: p.survey_no || p.survey_number,
                      area_ha: p.area_ha,
                      land_type: p.land_type,
                      status: p.possession_status || 'pending',
                      possession_status: p.possession_status || 'pending',
                      doc_complete: Boolean(p.doc_complete),
                      documents_verified: Boolean(p.doc_complete),
                    }))
                  : inMemoryDetail.parcels,
              cases:
                cases && cases.length > 0
                  ? cases.map((c) => ({
                      case_id: c.case_id,
                      case_number: c.case_id,
                      court: 'District Court',
                      category: c.category,
                      stay_order: Boolean(c.stay_order),
                      status: c.status,
                    }))
                  : inMemoryDetail.cases,
              approvals:
                approvals && approvals.length > 0
                  ? approvals.map((a) => ({
                      approval_name: a.name || a.approval_name,
                      authority: 'State Authority',
                      planned_date: a.planned_date,
                      status: a.status,
                    }))
                  : inMemoryDetail.approvals,
              compensation: compensation || inMemoryDetail.compensation,
              incidents: incidents || [],
            };
          }
        } catch (e) {
          console.warn('Supabase detail query note:', e);
        }
      }

      // Check stored bundles from localStorage first!
      const storedBundles = getStoredBundles();
      if (storedBundles[prjId]) {
        return storedBundles[prjId];
      }

      const basePrj = inMemoryProjects.find((p) => p.project_id === prjId);
      if (prjId === 'PRJ-0001' || !basePrj) {
        return inMemoryDetail;
      }

      // Adapt mock detail for this specific project and initialize its persistent bundle
      const customBundle = {
        ...inMemoryDetail,
        project: {
          ...inMemoryDetail.project,
          project_id: basePrj.project_id,
          name: basePrj.name,
          district: basePrj.district,
          type: basePrj.type,
          current_stage: basePrj.current_stage || 'possession',
          budget: basePrj.budget || inMemoryDetail.project.budget,
        },
        parcels: inMemoryDetail.parcels.map((p, idx) => ({
          ...p,
          parcel_id: `PAR-${prjId.slice(-4)}-${String(idx + 1).padStart(2, '0')}`,
          project_id: prjId,
          status: p.status || 'pending',
          possession_status: p.possession_status || p.status || 'pending',
          doc_complete: Boolean(p.doc_complete || p.documents_verified),
          documents_verified: Boolean(p.doc_complete || p.documents_verified),
        })),
        cases: (inMemoryDetail.cases || []).map((c) => ({
          ...c,
          parcel_id: `PAR-${prjId.slice(-4)}-01`,
        })),
        approvals: (inMemoryDetail.approvals || []).map((a, idx) => ({
          ...a,
          approval_id: `APP-${prjId.slice(-4)}-${String(idx + 1).padStart(2, '0')}`,
        })),
        compensation: {
          ...inMemoryDetail.compensation,
          project_id: prjId,
        },
      };

      saveStoredBundle(prjId, customBundle);
      return customBundle;
    }

    // 9. GET /map/projects
    if (pathname === '/map/projects') {
      let results = [];
      const coordMap = new Map(mapProjectsMock.map((m) => [m.project_id, m]));

      if (isSupabaseConfigured) {
        try {
          const projects = await fetchSupabaseProjects(params);
          if (projects && projects.length > 0) {
            results = projects.map((p) => {
              const matched = coordMap.get(p.project_id);
              return {
                project_id: p.project_id,
                name: p.name,
                district: p.district,
                lat: p.lat || matched?.lat || 13.0827,
                lon: p.lon || matched?.lon || 80.2707,
                risk_score: p.risk_score,
                band: p.band,
                top_driver: p.top_driver || matched?.top_driver || 'Statutory review in progress',
              };
            });
          }
        } catch (err) {
          console.warn('[client.js] Supabase map query fallback to mock:', err.message);
        }
      }

      if (results.length === 0) {
        results = mapProjectsMock.map((p) => ({ ...p }));
      }

      if (params.district) {
        results = results.filter(
          (p) => p.district && p.district.toLowerCase() === params.district.toLowerCase()
        );
      }
      if (params.band) {
        results = results.filter(
          (p) => p.band && p.band.toLowerCase() === params.band.toLowerCase()
        );
      }
      return results;
    }

    // 10. GET /alerts
    if (pathname === '/alerts') {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('alerts')
            .select('*')
            .order('created_at', { ascending: false });
          if (!error && data) return data;
        } catch (e) {
          console.warn('Supabase alerts query note:', e);
        }
      }
      return [];
    }

    // 11. GET /tasks
    if (pathname === '/tasks') {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false });
          if (!error && data) return data;
        } catch (e) {
          console.warn('Supabase tasks query note:', e);
        }
      }
      return [];
    }

    throw new Error(`Route map not configured for GET: ${pathname}`);
  },

  async post(url, data = {}, config = {}) {
    if (!isMock) {
      try {
        const response = await axiosInstance.post(url, data, config);
        return response.data;
      } catch (err) {
        if (err.code === 'ERR_NETWORK' || err.message === 'Network Error' || !err.response) {
          console.warn(`[LandSentinel API] Backend unreachable at ${getBaseURL()}. Falling back to offline client mode:`, err.message);
        } else {
          throw err;
        }
      }
    }

    const pathname = new URL(url, 'http://dummy.local').pathname;

    // 1. POST /projects
    if (pathname === '/projects') {
      const rawProject = data.project || {};
      const newId = rawProject.project_id || `PRJ-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
      const nowIso = new Date().toISOString();

      const newProjectRecord = {
        project_id: newId,
        name: rawProject.name || 'New Infrastructure Project',
        type: rawProject.type || 'highway',
        agency: rawProject.agency || 'State Infrastructure Agency',
        state: rawProject.state || 'Tamil Nadu',
        district: rawProject.district || 'Kanchipuram',
        land_area_ha: Number(rawProject.land_area_ha) || 50,
        families_affected: Number(rawProject.families_affected) || 120,
        families_resettlement: Number(rawProject.families_resettlement) || 40,
        budget: Number(rawProject.budget) || 100000000,
        planned_start: rawProject.planned_start || nowIso.split('T')[0],
        planned_end: rawProject.planned_end || '2028-12-31',
        current_stage: rawProject.current_stage || 'planning',
        status: 'draft',
        created_by: '5ad5e3f4-99ff-445b-bd5c-2fee103c357e',
        created_at: nowIso,
        updated_at: nowIso,
      };

      if (isSupabaseConfigured) {
        try {
          await supabase.from('projects').insert([newProjectRecord]);
        } catch (e) {
          console.warn('Supabase project creation note:', e);
        }
      }

      // Initialize persistent project bundle with provided parcels and milestones
      const initialBundle = {
        project: newProjectRecord,
        parcels: Array.isArray(data.parcels) && data.parcels.length > 0
          ? data.parcels.map((p, idx) => ({
              ...p,
              parcel_id: p.parcel_id || `PAR-${newId.slice(-4)}-${String(idx + 1).padStart(2, '0')}`,
              project_id: newId,
              survey_number: p.survey_no || p.survey_number || `Survey ${idx + 1}`,
              survey_no: p.survey_no || p.survey_number || `Survey ${idx + 1}`,
              area_ha: Number(p.area_ha) || 1.0,
              land_type: p.land_type || 'private',
              status: p.possession_status || 'pending',
              possession_status: p.possession_status || 'pending',
              doc_complete: Boolean(p.documents_verified || p.doc_complete),
              documents_verified: Boolean(p.documents_verified || p.doc_complete),
            }))
          : inMemoryDetail.parcels.map((p, idx) => ({
              ...p,
              parcel_id: `PAR-${newId.slice(-4)}-${String(idx + 1).padStart(2, '0')}`,
              project_id: newId,
              status: 'pending',
              possession_status: 'pending',
            })),
        cases: Array.isArray(data.cases) ? data.cases : [],
        approvals: Array.isArray(data.approvals) && data.approvals.length > 0
          ? data.approvals.map((a, idx) => ({
              ...a,
              approval_id: a.approval_id || `APP-${newId.slice(-4)}-${String(idx + 1).padStart(2, '0')}`,
              project_id: newId,
            }))
          : (inMemoryDetail.approvals || []).map((a, idx) => ({
              ...a,
              approval_id: `APP-${newId.slice(-4)}-${String(idx + 1).padStart(2, '0')}`,
              project_id: newId,
            })),
        compensation: data.compensation || {
          project_id: newId,
          award_amount: (newProjectRecord.budget || 100000000) * 0.35,
          disbursed_amount: 0,
        },
      };

      // Save to localStorage immediately
      saveStoredBundle(newId, initialBundle);

      // Compute initial calibrated prediction
      const initialPred = computeTelemetryRiskPrediction(newId, initialBundle, newProjectRecord.planned_start);
      saveStoredPrediction(newId, initialPred);

      const listRecord = {
        ...newProjectRecord,
        risk_score: initialPred.risk_score,
        band: initialPred.band,
        top_driver: initialPred.drivers?.[0]?.label || 'Initial statutory survey phase',
      };
      inMemoryProjects.unshift(listRecord);
      return { project_id: newId };
    }

    // 2. POST /projects/:id/what-if
    const whatIfMatch = pathname.match(/^\/projects\/([^/]+)\/what-if$/);
    if (whatIfMatch) {
      const prjId = whatIfMatch[1];
      let baseScore = 78;
      const prj = inMemoryProjects.find((p) => p.project_id === prjId);
      if (prj?.risk_score) baseScore = prj.risk_score;

      if (isSupabaseConfigured) {
        try {
          const { data: pData } = await supabase
            .from('predictions')
            .select('risk_score')
            .eq('project_id', prjId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (pData?.risk_score) baseScore = pData.risk_score;
        } catch (e) {
          // ignore
        }
      }

      const changes = data.changes || {};
      if (Object.keys(changes).length === 0) {
        return {
          current_score: baseScore,
          new_score: baseScore,
          change: 0,
        };
      }

      const baseline = data.baseline || {};
      let delta = 0;
      if (changes.litigation_cases !== undefined) {
        const baseCases = baseline.litigation_cases !== undefined ? baseline.litigation_cases : 4;
        delta += (changes.litigation_cases - baseCases) * 3.5;
      }
      if (changes.compensation_pending_pct !== undefined) {
        const baseComp = baseline.compensation_pending_pct !== undefined ? baseline.compensation_pending_pct : 66;
        delta += (changes.compensation_pending_pct - baseComp) * 0.25;
      }
      if (changes.docs_incomplete_pct !== undefined) {
        const baseDocs = baseline.docs_incomplete_pct !== undefined ? baseline.docs_incomplete_pct : 45;
        delta += (changes.docs_incomplete_pct - baseDocs) * 0.18;
      }
      if (changes.approval_days_pending !== undefined) {
        const baseApp = baseline.approval_days_pending !== undefined ? baseline.approval_days_pending : 120;
        delta += (changes.approval_days_pending - baseApp) * 0.08;
      }

      const calculatedNew = Math.min(96, Math.max(8, Math.round(baseScore + delta)));
      return {
        current_score: baseScore,
        new_score: calculatedNew,
        change: calculatedNew - baseScore,
      };
    }

    // 3. POST /tasks
    if (pathname === '/tasks') {
      if (isSupabaseConfigured) {
        try {
          const taskRecord = {
            task_id: `TSK-${Date.now()}`,
            project_id: data.project_id,
            action: data.action,
            assigned_to: data.assigned_to,
            deadline: data.deadline,
            status: 'assigned',
          };
          const { error } = await supabase.from('tasks').insert([taskRecord]);
          if (!error) return { task_id: taskRecord.task_id };
        } catch (e) {
          console.warn('Supabase task creation note:', e);
        }
      }
      return { task_id: `TSK-${Date.now()}` };
    }

    // 4. POST /alerts/:id/ack
    const alertAckMatch = pathname.match(/^\/alerts\/([^/]+)\/ack$/);
    if (alertAckMatch) {
      if (isSupabaseConfigured) {
        try {
          await supabase.from('alerts').update({ status: 'acknowledged' }).eq('alert_id', alertAckMatch[1]);
        } catch (e) {
          // ignore
        }
      }
      return { success: true };
    }

    throw new Error(`Route map not configured for POST: ${pathname}`);
  },

  async patch(url, data = {}, config = {}) {
    if (!isMock) {
      try {
        const response = await axiosInstance.patch(url, data, config);
        return response.data;
      } catch (err) {
        if (err.code === 'ERR_NETWORK' || err.message === 'Network Error' || !err.response) {
          console.warn(`[LandSentinel API] Backend unreachable at ${getBaseURL()}. Falling back to offline client mode:`, err.message);
        } else {
          throw err;
        }
      }
    }

    const pathname = new URL(url, 'http://dummy.local').pathname;
    const prjPatchMatch = pathname.match(/^\/projects\/([^/]+)$/);
    if (prjPatchMatch) {
      const prjId = prjPatchMatch[1];
      const nowIso = new Date().toISOString();
      const effectiveAsOf = data.as_of_date || data.project?.as_of_date || nowIso.split('T')[0];

      // Retrieve existing bundle from localStorage or memory
      const storedBundles = getStoredBundles();
      let currentBundle = storedBundles[prjId];
      if (!currentBundle) {
        const basePrj = inMemoryProjects.find((p) => p.project_id === prjId) || {
          project_id: prjId,
          name: `Corridor ${prjId}`,
          district: 'Kanchipuram',
          type: 'highway',
          current_stage: 'possession',
          budget: 150000000,
        };
        currentBundle = {
          project: { ...inMemoryDetail.project, ...basePrj },
          parcels: (data.parcels && data.parcels.length > 0) ? data.parcels : inMemoryDetail.parcels,
          cases: data.cases !== undefined ? data.cases : (inMemoryDetail.cases || []),
          approvals: inMemoryDetail.approvals || [],
          compensation: inMemoryDetail.compensation || {},
        };
      }

      // 1. Update Project fields
      if (data.project) {
        currentBundle.project = {
          ...currentBundle.project,
          ...data.project,
          as_of_date: effectiveAsOf,
          updated_at: nowIso,
        };
      } else if (effectiveAsOf) {
        currentBundle.project.as_of_date = effectiveAsOf;
      }

      // 2. Update Parcels - explicitly map possession_status & status & checkboxes
      if (Array.isArray(data.parcels)) {
        currentBundle.parcels = data.parcels.map((p, idx) => {
          const isHanded = Boolean(
            p.possession_handed_over ||
            p.possession_status === 'handed_over' ||
            p.status === 'handed_over'
          );
          const isVerified = Boolean(p.documents_verified || p.doc_complete);
          return {
            ...p,
            parcel_id: p.parcel_id || `PAR-${prjId.slice(-4)}-${String(idx + 1).padStart(2, '0')}`,
            project_id: prjId,
            status: isHanded ? 'handed_over' : 'pending',
            possession_status: isHanded ? 'handed_over' : 'pending',
            possession_handed_over: isHanded,
            doc_complete: isVerified,
            documents_verified: isVerified,
          };
        });
      }

      // 3. Update Compensation
      if (data.compensation) {
        currentBundle.compensation = {
          ...currentBundle.compensation,
          ...data.compensation,
          updated_at: nowIso,
        };
      }

      // 4. Update Cases
      if (Array.isArray(data.cases)) {
        currentBundle.cases = [...data.cases];
      }

      // 5. Update Approvals
      if (Array.isArray(data.approvals)) {
        currentBundle.approvals = [...data.approvals];
      }

      // Persist bundle permanently to localStorage!
      saveStoredBundle(prjId, currentBundle);

      // Also sync inMemoryDetail if it matches
      if (inMemoryDetail.project?.project_id === prjId) {
        inMemoryDetail = { ...inMemoryDetail, ...currentBundle };
      }

      // Compute fresh, deterministic ML prediction from the updated corridor bundle
      const newPredObject = computeTelemetryRiskPrediction(prjId, currentBundle, effectiveAsOf);
      saveStoredPrediction(prjId, newPredObject);

      // Update inMemoryProjects list so corridor cards and lists reflect new score & band
      const pIdx = inMemoryProjects.findIndex((p) => p.project_id === prjId);
      if (pIdx !== -1) {
        inMemoryProjects[pIdx].risk_score = newPredObject.risk_score;
        inMemoryProjects[pIdx].band = newPredObject.band;
        inMemoryProjects[pIdx].as_of_date = effectiveAsOf;
      }

      return newPredObject;
    }

    throw new Error(`Route map not configured for PATCH: ${pathname}`);
  },
};

export default api;
