import { api } from './client';
import mapProjectsMock from '../mocks/monitoring/map_projects.json';
import alertsMock from '../mocks/monitoring/alerts.json';
import tasksMock from '../mocks/monitoring/tasks.json';
import retrainStatusDoneMock from '../mocks/monitoring/retrain_status_done.json';
import modelsMock from '../mocks/monitoring/models.json';
import auditMock from '../mocks/monitoring/audit.json';

// In-memory stateful copies for mock mode interactions
let inMemoryAlerts = JSON.parse(JSON.stringify(alertsMock));
let inMemoryTasks = JSON.parse(JSON.stringify(tasksMock));
let inMemoryModels = JSON.parse(JSON.stringify(modelsMock));
let inMemoryAudit = JSON.parse(JSON.stringify(auditMock));

const isMock = import.meta.env.VITE_USE_MOCK === 'true';

/**
 * Handle GET requests for Person D Monitoring endpoints in Mock Mode
 */
export function handleMonitoringGet(pathname, params = {}) {
  // 1. GET /map/projects
  if (pathname === '/map/projects') {
    let result = [...mapProjectsMock];
    if (params.district) {
      result = result.filter(
        (p) => p.district.toLowerCase() === params.district.toLowerCase()
      );
    }
    if (params.band) {
      result = result.filter(
        (p) => p.band.toLowerCase() === params.band.toLowerCase()
      );
    }
    return result;
  }

  // 2. GET /alerts
  if (pathname === '/alerts') {
    return [...inMemoryAlerts];
  }

  // 3. GET /tasks
  if (pathname === '/tasks') {
    let result = [...inMemoryTasks];
    const currentRole = localStorage.getItem('landsentinel_role') || 'project_manager';
    if (params.mine === 'true' || params.mine === true) {
      result = result.filter((t) => t.assigned_to === 'pm1' || t.assigned_to === currentRole);
    }
    if (params.assigned_by_me === 'true' || params.assigned_by_me === true) {
      result = result.filter((t) => t.assigned_by === 'collector1' || t.assigned_by === currentRole);
    }
    return result;
  }

  // 4. GET /admin/retrain/status
  if (pathname === '/admin/retrain/status') {
    return JSON.parse(JSON.stringify(retrainStatusDoneMock));
  }

  // 5. GET /admin/models
  if (pathname === '/admin/models') {
    return [...inMemoryModels];
  }

  // 6. GET /audit
  if (pathname === '/audit') {
    let result = [...inMemoryAudit];
    if (params.user) {
      result = result.filter((a) =>
        a.user.toLowerCase().includes(params.user.toLowerCase())
      );
    }
    if (params.project) {
      result = result.filter(
        (a) => a.project_id && a.project_id.toLowerCase().includes(params.project.toLowerCase())
      );
    }
    if (params.from) {
      result = result.filter((a) => new Date(a.timestamp) >= new Date(params.from));
    }
    if (params.to) {
      result = result.filter((a) => new Date(a.timestamp) <= new Date(params.to));
    }
    return result;
  }

  return undefined;
}

/**
 * Handle POST requests for Person D Monitoring endpoints in Mock Mode
 */
export function handleMonitoringPost(pathname, data = {}) {
  // 1. POST /alerts/:id/ack
  const ackMatch = pathname.match(/^\/alerts\/([^/]+)\/ack$/);
  if (ackMatch) {
    const alertId = ackMatch[1];
    const alert = inMemoryAlerts.find((a) => a.alert_id === alertId);
    if (alert) {
      alert.status = 'acknowledged';
    }
    return { status: 'ack', alert_id: alertId };
  }

  // 2. POST /tasks
  if (pathname === '/tasks') {
    const taskId = `TSK-${String(inMemoryTasks.length + 1).padStart(4, '0')}`;
    const newTask = {
      task_id: taskId,
      project_id: data.project_id || 'PRJ-0001',
      project_name: data.project_name || 'Project Corridor',
      action: data.action || 'Corrective Action',
      assigned_by: localStorage.getItem('landsentinel_role') || 'collector1',
      assigned_to: data.assigned_to || 'pm1',
      deadline: data.deadline || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      status: 'assigned',
      remarks: null,
    };
    inMemoryTasks.unshift(newTask);
    return { task_id: taskId };
  }

  // 3. POST /admin/upload
  if (pathname === '/admin/upload') {
    const filename = data?.name || 'historical_projects_upload.csv';
    return {
      filename,
      rows: 500,
      columns: [
        'project_id', 'planned_start', 'land_area_ha', 'families_affected',
        'project_type', 'litigation_cases', 'stay_orders', 'ownership_disputes',
        'compensation_pending_pct', 'approval_days_pending', 'docs_incomplete_pct',
        'officer_response_days', 'encroached_area_pct', 'possession_pct',
        'rr_progress_pct', 'current_stage', 'district_past_delay_rate',
        'is_delayed', 'delay_days', 'delayed_approval', 'delayed_compensation',
        'delayed_possession',
      ],
    };
  }

  // 4. POST /admin/retrain
  if (pathname === '/admin/retrain') {
    return {
      message: 'Retraining job queued successfully',
      file: data.file || 'retrain_dataset.csv',
      state: 'running',
    };
  }

  // 5. POST /admin/models/:version/activate
  const activateMatch = pathname.match(/^\/admin\/models\/([^/]+)\/activate$/);
  if (activateMatch) {
    const ver = activateMatch[1];
    inMemoryModels.forEach((m) => {
      m.is_active = m.version === ver;
    });
    return { status: 'activated', active_version: ver };
  }

  return undefined;
}

/**
 * Handle PATCH requests for Person D Monitoring endpoints in Mock Mode
 */
export function handleMonitoringPatch(pathname, data = {}) {
  // 1. PATCH /tasks/:id
  const taskMatch = pathname.match(/^\/tasks\/([^/]+)$/);
  if (taskMatch) {
    const taskId = taskMatch[1];
    const task = inMemoryTasks.find((t) => t.task_id === taskId);
    if (task) {
      if (data.status) task.status = data.status;
      if (data.remarks !== undefined) task.remarks = data.remarks;
      return { ...task };
    }
    return { task_id: taskId, status: data.status || 'done', remarks: data.remarks };
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Seamless mock interceptor registered on the shared api client
// ---------------------------------------------------------------------------
if (isMock) {
  const originalGet = api.get.bind(api);
  api.get = async function (url, config = {}) {
    const parsedUrl = new URL(url, 'http://dummy.local');
    const pathname = parsedUrl.pathname;
    const params = Object.fromEntries(parsedUrl.searchParams.entries());

    const handled = handleMonitoringGet(pathname, params);
    if (handled !== undefined) {
      return handled;
    }
    return originalGet(url, config);
  };

  const originalPost = api.post.bind(api);
  api.post = async function (url, data = {}, config = {}) {
    const parsedUrl = new URL(url, 'http://dummy.local');
    const pathname = parsedUrl.pathname;

    const handled = handleMonitoringPost(pathname, data);
    if (handled !== undefined) {
      return handled;
    }
    return originalPost(url, data, config);
  };

  const originalPatch = api.patch.bind(api);
  api.patch = async function (url, data = {}, config = {}) {
    const parsedUrl = new URL(url, 'http://dummy.local');
    const pathname = parsedUrl.pathname;

    const handled = handleMonitoringPatch(pathname, data);
    if (handled !== undefined) {
      return handled;
    }
    return originalPatch(url, data, config);
  };
}

