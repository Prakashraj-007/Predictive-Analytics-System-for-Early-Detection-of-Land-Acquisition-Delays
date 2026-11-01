import api from './client';

export async function getProjects(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, val);
    }
  });
  const qs = query.toString();
  return await api.get(`/projects${qs ? `?${qs}` : ''}`);
}

export async function getProjectDetail(id) {
  return await api.get(`/projects/${id}`);
}

export async function getProjectPrediction(id) {
  return await api.get(`/projects/${id}/prediction`);
}

export async function postWhatIf(id, changes) {
  return await api.post(`/projects/${id}/what-if`, { changes });
}

export async function createProject(data) {
  return await api.post('/projects', data);
}

export async function updateProject(id, data) {
  return await api.patch(`/projects/${id}`, data);
}

export async function getDashboardSummary() {
  return await api.get('/dashboard/summary');
}

export async function getDashboardDistricts() {
  return await api.get('/dashboard/districts');
}

export async function getDashboardTrend() {
  return await api.get('/dashboard/trend');
}

export async function createTask(data) {
  return await api.post('/tasks', data);
}
