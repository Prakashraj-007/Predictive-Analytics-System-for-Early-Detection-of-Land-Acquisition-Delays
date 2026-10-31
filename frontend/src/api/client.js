import axios from 'axios';
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

const isMock = import.meta.env.VITE_USE_MOCK !== 'false';
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const axiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor that adds the Supabase access token as Authorization: Bearer
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('landsentinel_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Helper delay to imitate latency (300 ms per C1/C2 specification)
const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

// In-memory data store for stateful prototype actions
let inMemoryProjects = [...projectsMock];
let inMemoryDetail = JSON.parse(JSON.stringify(projectDetailMock));

/**
 * Route-to-file map client exactly matching docs/contracts.md Section 3 & 4
 */
export const api = {
  async get(url, config = {}) {
    if (!isMock) {
      return (await axiosInstance.get(url, config)).data;
    }

    await delay(300);
    const parsedUrl = new URL(url, 'http://dummy.local');
    const pathname = parsedUrl.pathname;
    const params = Object.fromEntries(parsedUrl.searchParams.entries());

    // 1. Health check
    if (pathname === '/health') {
      return { status: 'healthy', version: '1.0.0', timestamp: new Date().toISOString() };
    }

    // 2. GET /me (supports role variants)
    if (pathname === '/me') {
      const activeRole = localStorage.getItem('landsentinel_role') || 'project_manager';
      if (meMock.variants && meMock.variants[activeRole]) {
        return meMock.variants[activeRole];
      }
      return {
        user_id: meMock.user_id,
        full_name: meMock.full_name,
        role: meMock.role,
        district: meMock.district,
      };
    }

    // 3. GET /projects/:id/prediction
    const predMatch = pathname.match(/^\/projects\/([^/]+)\/prediction$/);
    if (predMatch) {
      const prjId = predMatch[1];
      const found = inMemoryProjects.find((p) => p.project_id === prjId);
      if (found && found.band === 'Medium') return { ...predictionMediumMock, project_id: prjId };
      if (found && found.band === 'Low') return { ...predictionLowMock, project_id: prjId };
      return { ...predictionHighMock, project_id: prjId };
    }

    // 4. GET /projects/:id
    const prjDetailMatch = pathname.match(/^\/projects\/([^/]+)$/);
    if (prjDetailMatch) {
      const prjId = prjDetailMatch[1];
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

    // 5. GET /projects (with filter, search, and sorting)
    if (pathname === '/projects') {
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

    // 6. GET /dashboard/summary
    if (pathname === '/dashboard/summary') {
      return dashboardSummaryMock;
    }

    // 7. GET /dashboard/districts
    if (pathname === '/dashboard/districts') {
      return dashboardDistrictsMock;
    }

    // 8. GET /dashboard/trend
    if (pathname === '/dashboard/trend') {
      return dashboardTrendMock;
    }

    // 9. GET /map/projects (Person D)
    if (pathname === '/map/projects') {
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

    throw new Error(`Route map not configured for GET: ${pathname}`);
  },

  async post(url, data = {}, config = {}) {
    if (!isMock) {
      return (await axiosInstance.post(url, data, config)).data;
    }

    await delay(300);
    const pathname = new URL(url, 'http://dummy.local').pathname;

    // 1. POST /projects
    if (pathname === '/projects') {
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
      const prj = inMemoryProjects.find((p) => p.project_id === prjId) || { risk_score: 78 };
      const changes = data.changes || {};

      let delta = 0;
      if (changes.litigation_cases !== undefined) {
        delta += (changes.litigation_cases - 4) * 2.8;
      }
      if (changes.compensation_pending_pct !== undefined) {
        delta += (changes.compensation_pending_pct - 66) * 0.25;
      }
      if (changes.docs_incomplete_pct !== undefined) {
        delta += (changes.docs_incomplete_pct - 45) * 0.18;
      }
      if (changes.approval_days_pending !== undefined) {
        delta += (changes.approval_days_pending - 120) * 0.08;
      }

      if (Object.keys(changes).length === 0) {
        return whatIfMock;
      }

      const calculatedNew = Math.min(99, Math.max(5, Math.round(prj.risk_score + delta)));
      return {
        current_score: prj.risk_score,
        new_score: calculatedNew,
        change: calculatedNew - prj.risk_score,
      };
    }

    // 3. POST /tasks
    if (pathname === '/tasks') {
      return {
        task_id: `TSK-${Math.floor(1000 + Math.random() * 9000)}`,
      };
    }

    // 4. POST /projects/:id/predict
    const predictMatch = pathname.match(/^\/projects\/([^/]+)\/predict$/);
    if (predictMatch) {
      return { ...predictionHighMock, project_id: predictMatch[1], created_at: new Date().toISOString() };
    }

    throw new Error(`Route map not configured for POST: ${pathname}`);
  },

  async patch(url, data = {}, config = {}) {
    if (!isMock) {
      return (await axiosInstance.patch(url, data, config)).data;
    }

    await delay(300);
    const pathname = new URL(url, 'http://dummy.local').pathname;

    // PATCH /projects/:id
    const prjPatchMatch = pathname.match(/^\/projects\/([^/]+)$/);
    if (prjPatchMatch) {
      const prjId = prjPatchMatch[1];
      const prj = inMemoryProjects.find((p) => p.project_id === prjId) || { risk_score: 78 };
      const newScore = Math.max(10, prj.risk_score - 5);
      const newBand = newScore > 60 ? 'High' : newScore >= 30 ? 'Medium' : 'Low';

      return {
        project_id: prjId,
        created_at: new Date().toISOString(),
        risk_score: newScore,
        band: newBand,
        delay_probability: Number((newScore / 100).toFixed(2)),
        expected_delay_days: Math.round(newScore * 1.8),
        stage_probabilities: predictionHighMock.stage_probabilities,
        drivers: predictionHighMock.drivers,
        recommendations: predictionHighMock.recommendations,
        model_version: 'v1',
      };
    }

    // PATCH /tasks/:id
    if (pathname.startsWith('/tasks/')) {
      return { status: 'done', remarks: data.remarks || 'Updated' };
    }

    throw new Error(`Route map not configured for PATCH: ${pathname}`);
  },
};

export default api;
