/**
 * frontend/src/api/monitoring.js
 * ==============================
 * Monitoring API Client for Person D (Task D5).
 * Uses the shared unified client from frontend/src/api/client.js.
 * Automatically loads mock interceptors via monitoringMocks.js when in mock mode.
 *
 * Conforms strictly to docs/contracts.md section 3.
 */

import api from './client';
import './monitoringMocks';

/**
 * Fetch mapped projects with geospatial coordinates, risk score, band, and top drivers.
 * @param {Object} [params]
 * @param {string} [params.district] - District filter (e.g. "Pune")
 * @param {string} [params.band] - Risk band filter ("Low", "Medium", "High")
 * @returns {Promise<Array<{project_id: string, name: string, district?: string, lat: number, lon: number, risk_score: number, band: string, top_driver: string}>>}
 */
export async function getMapProjects({ district, band } = {}) {
  const query = new URLSearchParams();
  if (district) query.append('district', district);
  if (band) query.append('band', band);
  const qs = query.toString();
  return await api.get(`/map/projects${qs ? `?${qs}` : ''}`);
}

/**
 * Fetch all system alerts scoped to user role.
 * @returns {Promise<Array<{alert_id: string, project_id: string, project_name: string, district: string, reason: string, risk_score: number, previous_score: number|null, status: string, created_at: string}>>}
 */
export async function getAlerts() {
  return await api.get('/alerts');
}

/**
 * Acknowledge an active alert.
 * @param {string} id - Alert identifier (e.g. "ALT-0001")
 * @returns {Promise<{status: string}>}
 */
export async function ackAlert(id) {
  return await api.post(`/alerts/${id}/ack`, {});
}

/**
 * Create a new corrective task assignment.
 * @param {Object} body
 * @param {string} body.project_id - Target project ID
 * @param {string} body.assigned_to - Username/UUID of assignee (e.g. "pm1")
 * @param {string} body.action - Recommended action description
 * @param {string} body.deadline - Due date (YYYY-MM-DD)
 * @returns {Promise<{task_id: string}>}
 */
export async function createTask(body) {
  return await api.post('/tasks', body);
}

/**
 * Fetch tasks scoped by user involvement.
 * @param {Object} [params]
 * @param {boolean} [params.mine] - Fetch tasks assigned to the current user
 * @param {boolean} [params.assignedByMe] - Fetch tasks assigned by the current user
 * @returns {Promise<Array<{task_id: string, project_id: string, project_name: string, action: string, assigned_by: string, assigned_to: string, deadline: string, status: string, remarks: string|null}>>}
 */
export async function getTasks({ mine, assignedByMe } = {}) {
  const query = new URLSearchParams();
  if (mine !== undefined) query.append('mine', String(mine));
  if (assignedByMe !== undefined) query.append('assigned_by_me', String(assignedByMe));
  const qs = query.toString();
  return await api.get(`/tasks${qs ? `?${qs}` : ''}`);
}

/**
 * Update task status and resolution remarks.
 * @param {string} id - Task identifier (e.g. "TSK-0001")
 * @param {Object} body
 * @param {string} [body.status] - New status ("assigned"|"in_progress"|"done")
 * @param {string} [body.remarks] - Project manager remarks or outcome notes
 * @returns {Promise<Object>}
 */
export async function updateTask(id, body) {
  return await api.patch(`/tasks/${id}`, body);
}

/**
 * Upload retrain historical dataset CSV (Admin only).
 * @param {File} file - File object from input[type="file"]
 * @returns {Promise<{filename: string, rows: number, columns: string[]}>}
 */
export async function uploadTrainingCsv(file) {
  const formData = new FormData();
  formData.append('file', file);
  return await api.post('/admin/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/**
 * Trigger background ML model retraining on uploaded CSV (Admin only).
 * @param {string} filename - Staged filename from upload response
 * @returns {Promise<{message: string, file: string}>}
 */
export async function startRetrain(filename) {
  return await api.post('/admin/retrain', { file: filename });
}

/**
 * Poll retraining status and before/after metrics (Admin only).
 * @returns {Promise<{state: "running"|"done"|"failed", result?: {before: Object, after: Object, new_version: string, promoted: boolean}}>}
 */
export async function getRetrainStatus() {
  return await api.get('/admin/retrain/status');
}

/**
 * Fetch available model versions and registry metrics (Admin only).
 * @returns {Promise<Array<{version: string, trained_at: string, metrics: Object, is_active: boolean}>>}
 */
export async function getModels() {
  return await api.get('/admin/models');
}

/**
 * Promote / activate a specific model version (Admin only).
 * @param {string} version - Version identifier (e.g. "v1", "v2")
 * @returns {Promise<{status: string, active_version: string}>}
 */
export async function activateModel(version) {
  return await api.post(`/admin/models/${version}/activate`, {});
}

/**
 * Query immutable audit log trail (Admin and Auditor only).
 * @param {Object} [params]
 * @param {string} [params.user] - Filter by user
 * @param {string} [params.project] - Filter by project ID
 * @param {string} [params.from] - Filter from ISO date
 * @param {string} [params.to] - Filter to ISO date
 * @returns {Promise<Array<{log_id: string, user: string, action: string, project_id: string|null, timestamp: string, model_version?: string}>>}
 */
export async function getAudit({ user, project, from, to } = {}) {
  const query = new URLSearchParams();
  if (user) query.append('user', user);
  if (project) query.append('project', project);
  if (from) query.append('from', from);
  if (to) query.append('to', to);
  const qs = query.toString();
  return await api.get(`/audit${qs ? `?${qs}` : ''}`);
}
