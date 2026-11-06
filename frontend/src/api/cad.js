/**
 * CAD API Client for LandSentinel.
 * Sends DXF, GeoJSON, and Zipped Shapefile data directly to the backend parser.
 * Strictly adheres to rule 10: Backend parsing only, no client-side fallback.
 */

import api, { getBaseURL } from './client';
import axios from 'axios';

/**
 * Upload and parse a CAD file server-side.
 * @param {File} file - DXF, GeoJSON, or Zipped Shapefile.
 * @param {Object} options
 * @param {string} [options.sourceCrs="EPSG:32644"] - Source Coordinate Reference System.
 * @param {string} [options.units="metres"] - Unit for DXF files ('metres' or 'feet').
 * @param {number} [options.declaredAreaHa] - Optional declared project area for reconciliation.
 * @returns {Promise<Object>} Full parsed geometry and validation report.
 */
export async function parseCadFile(file, { sourceCrs = 'EPSG:32644', units = 'metres', declaredAreaHa = null } = {}) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('source_crs', sourceCrs);
  formData.append('units', units);
  if (declaredAreaHa && !isNaN(Number(declaredAreaHa))) {
    formData.append('declared_area_ha', String(declaredAreaHa));
  }

  const token = localStorage.getItem('landsentinel_token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Upload directly to backend via multipart POST
  const response = await axios.post(`${getBaseURL()}/cad/parse`, formData, {
    headers,
    timeout: 45000,
  });

  return response.data;
}

/**
 * Persist / confirm parsed CAD parcels and link to project.
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export async function confirmCadParcels(payload) {
  return await api.post('/cad/confirm', payload);
}

