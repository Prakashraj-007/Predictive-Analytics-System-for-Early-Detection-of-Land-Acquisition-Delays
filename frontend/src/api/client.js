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

const isMock = import.meta.env.VITE_USE_MOCK === 'true';
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const axiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 4000,
});

// Interceptor that adds the Supabase access token as Authorization: Bearer
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('landsentinel_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// In-memory data store for stateful prototype fallback
let inMemoryProjects = [...projectsMock];
let inMemoryDetail = JSON.parse(JSON.stringify(projectDetailMock));

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
        state: p.state || 'Maharashtra',
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
            };
          }
        } catch (e) {
          console.warn('Supabase prediction note:', e);
        }
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

      const basePrj = inMemoryProjects.find((p) => p.project_id === prjId);
      if (prjId === 'PRJ-0001' || !basePrj) {
        return inMemoryDetail;
      }
      return {
        ...inMemoryDetail,
        project: {
          ...inMemoryDetail.project,
          project_id: basePrj.project_id,
          name: basePrj.name,
          district: basePrj.district,
          type: basePrj.type,
          current_stage: basePrj.current_stage,
        },
      };
    }

    // 9. GET /map/projects
    if (pathname === '/map/projects') {
      if (isSupabaseConfigured) {
        const projects = await fetchSupabaseProjects();
        if (projects && projects.length > 0) {
          return projects.map((p) => ({
            project_id: p.project_id,
            name: p.name,
            lat: p.lat || 18.5204 + (Math.random() - 0.5) * 0.8,
            lon: p.lon || 73.8567 + (Math.random() - 0.5) * 0.8,
            risk_score: p.risk_score,
            band: p.band,
            top_driver: p.top_driver,
          }));
        }
      }
      return inMemoryProjects.map((p) => ({
        project_id: p.project_id,
        name: p.name,
        lat: 18.5204 + (Math.random() - 0.5) * 0.8,
        lon: 73.8567 + (Math.random() - 0.5) * 0.8,
        risk_score: p.risk_score,
        band: p.band,
        top_driver: p.top_driver,
      }));
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
    const pathname = new URL(url, 'http://dummy.local').pathname;

    // 1. POST /projects
    if (pathname === '/projects') {
      if (isSupabaseConfigured) {
        try {
          const newId = `PRJ-${String(Math.floor(1000 + Math.random() * 9000))}`;
          const newProjectRecord = {
            project_id: newId,
            name: data.project?.name || 'New Infrastructure Project',
            type: data.project?.type || 'highway',
            agency: data.project?.agency || 'State Infrastructure Agency',
            state: data.project?.state || 'Maharashtra',
            district: data.project?.district || 'Pune',
            land_area_ha: Number(data.project?.land_area_ha) || 50,
            families_affected: Number(data.project?.families_affected) || 120,
            families_resettlement: Number(data.project?.families_resettlement) || 40,
            budget: Number(data.project?.budget) || 100000000,
            planned_start: data.project?.planned_start || '2026-01-01',
            planned_end: data.project?.planned_end || '2028-12-31',
            current_stage: 'planning',
            status: 'draft',
          };

          const { error } = await supabase.from('projects').insert([newProjectRecord]);
          if (!error) {
            return { project_id: newId };
          }
        } catch (e) {
          console.warn('Supabase project creation note:', e);
        }
      }

      const newId = `PRJ-${String(inMemoryProjects.length + 1).padStart(4, '0')}`;
      const newPrj = {
        project_id: newId,
        name: data.project?.name || 'New Infrastructure Project',
        district: data.project?.district || 'Pune',
        type: data.project?.type || 'highway',
        current_stage: 'planning',
        risk_score: 45,
        band: 'Medium',
        top_driver: 'Initial statutory survey phase',
      };
      inMemoryProjects.unshift(newPrj);
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
    const pathname = new URL(url, 'http://dummy.local').pathname;
    const prjPatchMatch = pathname.match(/^\/projects\/([^/]+)$/);
    if (prjPatchMatch) {
      const prjId = prjPatchMatch[1];
      const nowIso = new Date().toISOString();

      // Retrieve previous prediction for delta tracking
      let prevScore = 72;
      let prevPred = null;
      try {
        prevPred = await this.get(`/projects/${prjId}/prediction`);
        if (prevPred?.risk_score) {
          prevScore = prevPred.risk_score;
        }
      } catch (e) {
        // fallback
      }

      // 1. Update Project Level fields
      if (data.project) {
        if (isSupabaseConfigured) {
          try {
            await supabase
              .from('projects')
              .update({ ...data.project, updated_at: nowIso })
              .eq('project_id', prjId);
          } catch (e) {
            console.warn('Supabase project patch note:', e);
          }
        }
        // Update inMemory
        const memIdx = inMemoryProjects.findIndex((p) => p.project_id === prjId);
        if (memIdx !== -1) {
          inMemoryProjects[memIdx] = { ...inMemoryProjects[memIdx], ...data.project };
        }
        if (inMemoryDetail.project?.project_id === prjId) {
          inMemoryDetail.project = { ...inMemoryDetail.project, ...data.project };
        }
      }

      // 2. Update Parcels
      if (Array.isArray(data.parcels) && data.parcels.length > 0) {
        if (isSupabaseConfigured) {
          try {
            for (const p of data.parcels) {
              const parcelPayload = {
                possession_status: p.possession_handed_over ? 'handed_over' : 'pending',
                doc_complete: Boolean(p.documents_verified),
                updated_at: nowIso,
              };
              if (p.parcel_id) {
                await supabase.from('parcels').update(parcelPayload).eq('parcel_id', p.parcel_id);
              }
            }
          } catch (e) {
            console.warn('Supabase parcels patch note:', e);
          }
        }
      }

      // 3. Update Compensation
      if (data.compensation) {
        if (isSupabaseConfigured) {
          try {
            await supabase.from('compensation').upsert({
              project_id: prjId,
              award_amount: data.compensation.award_amount,
              disbursed_amount: data.compensation.amount_disbursed,
              updated_at: nowIso,
            }, { onConflict: 'project_id' });
          } catch (e) {
            console.warn('Supabase compensation patch note:', e);
          }
        }
      }

      // 4. Update/Insert Cases
      if (Array.isArray(data.cases) && data.cases.length > 0) {
        if (isSupabaseConfigured) {
          try {
            for (const c of data.cases) {
              if (c.case_id && !c.case_id.startsWith('temp-')) {
                await supabase.from('cases').update({
                  status: c.status || 'pending',
                  stay_order: Boolean(c.stay_order),
                }).eq('case_id', c.case_id);
              } else {
                await supabase.from('cases').insert([{
                  case_id: `CAS-${Date.now().toString().slice(-6)}`,
                  parcel_id: data.parcels?.[0]?.parcel_id || 'PAR-0001-01',
                  category: c.category || 'Dispute',
                  filing_date: c.filing_date || nowIso.split('T')[0],
                  status: c.status || 'pending',
                  stay_order: Boolean(c.stay_order),
                }]);
              }
            }
          } catch (e) {
            console.warn('Supabase cases patch note:', e);
          }
        }
      }

      // 5. Update Approvals
      if (Array.isArray(data.approvals) && data.approvals.length > 0) {
        if (isSupabaseConfigured) {
          try {
            for (const a of data.approvals) {
              if (a.approval_id) {
                await supabase.from('approvals').update({
                  actual_date: a.actual_date || null,
                  status: a.status || (a.actual_date ? 'cleared' : 'pending'),
                }).eq('approval_id', a.approval_id);
              }
            }
          } catch (e) {
            console.warn('Supabase approvals patch note:', e);
          }
        }
      }

      // Calculate fresh prediction score based on inputs
      let delta = 0;
      if (data.parcels) {
        data.parcels.forEach((p) => {
          if (p.possession_handed_over) delta -= 4;
          if (p.documents_verified) delta -= 2;
        });
      }
      if (data.approvals) {
        data.approvals.forEach((a) => {
          if (a.actual_date || a.status === 'cleared') delta -= 6;
        });
      }
      if (data.compensation) {
        const { award_amount, amount_disbursed } = data.compensation;
        if (award_amount > 0) {
          const ratio = (amount_disbursed || 0) / award_amount;
          if (ratio >= 0.7) delta -= 8;
          else if (ratio < 0.25) delta += 6;
        }
      }
      if (data.project) {
        if (data.project.rr_progress_pct > 60) delta -= 5;
        if (data.project.encroachment_area_ha > 0) delta += Math.min(16, Math.round(data.project.encroachment_area_ha * 3));
        if (data.project.obstructions_count > 0) delta += Math.min(16, data.project.obstructions_count * 4);
      }
      if (data.cases) {
        data.cases.forEach((c) => {
          if (c.stay_order) delta += 10;
          if (c.case_id && c.case_id.startsWith('temp-')) delta += 5;
        });
      }

      // Compute new score clamped between 10 and 96
      const newScore = Math.min(96, Math.max(10, Math.round(prevScore + delta)));
      const newBand = newScore > 60 ? 'High' : newScore >= 30 ? 'Medium' : 'Low';
      const delayProbability = Math.round((newScore / 100) * 100) / 100;
      const expectedDelayDays = Math.round(newScore * 1.8);

      const newPredObject = {
        prediction_id: `PRED-${Date.now()}`,
        project_id: prjId,
        created_at: nowIso,
        risk_score: newScore,
        band: newBand,
        delay_probability: delayProbability,
        expected_delay_days: expectedDelayDays,
        stage_probabilities: {
          approval: Math.min(0.9, Math.max(0.1, Math.round(newScore * 0.45) / 100)),
          compensation: Math.min(0.95, Math.max(0.15, Math.round(newScore * 0.9) / 100)),
          possession: Math.min(0.95, Math.max(0.1, Math.round(newScore * 1.05) / 100)),
          rr: Math.min(0.9, Math.max(0.1, Math.round(newScore * 0.6) / 100)),
        },
        drivers: prevPred?.drivers || [
          {
            feature: 'litigation_cases',
            label: 'Litigation Bottlenecks',
            impact: 0.24,
            direction: newScore > 60 ? 'increases_risk' : 'decreases_risk',
            plain_text: 'Judicial stay orders and parcel disputes impact project execution timeline.',
          },
        ],
        recommendations: prevPred?.recommendations || [
          {
            driver: 'litigation_cases',
            action: 'File vacate-stay application before District Judge and depute Special Land Officer.',
          },
        ],
        model_version: 'v1.2-telemetry',
      };

      // Persist new prediction in Supabase if configured
      if (isSupabaseConfigured) {
        try {
          await supabase.from('predictions').insert([newPredObject]);
          // Check alert criteria: score rose by >= 15 or crossed 60
          const scoreRoseBy = newScore - prevScore;
          if (scoreRoseBy >= 15 || (prevScore < 60 && newScore >= 60)) {
            await supabase.from('alerts').insert([{
              alert_id: `ALT-${Date.now()}`,
              project_id: prjId,
              reason: `Risk score rose by ${Math.max(1, scoreRoseBy)} points during telemetry update`,
              risk_score: newScore,
              previous_score: prevScore,
              status: 'active',
              created_at: nowIso,
            }]);
          }
        } catch (e) {
          console.warn('Supabase prediction insert note:', e);
        }
      }

      // Update inMemory project registry risk score
      const pIdx = inMemoryProjects.findIndex((p) => p.project_id === prjId);
      if (pIdx !== -1) {
        inMemoryProjects[pIdx].risk_score = newScore;
        inMemoryProjects[pIdx].band = newBand;
      }

      return newPredObject;
    }

    throw new Error(`Route map not configured for PATCH: ${pathname}`);
  },
};

export default api;
