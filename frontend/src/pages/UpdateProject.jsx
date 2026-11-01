import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProjectDetail, updateProject } from '../api/projects';

export default function UpdateProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    budget: 0,
    land_area_ha: 0,
    landowners_count: 0,
    compensation_disbursed_pct: 0,
  });

  useEffect(() => {
    async function load() {
      try {
        const p = await getProjectDetail(id || 'PRJ-0001');
        if (p) {
          setFormData({
            budget: p.budget || 5400000000,
            land_area_ha: p.land_area_ha || 184.2,
            landowners_count: p.landowners_count || 342,
            compensation_disbursed_pct: p.compensation_disbursed_pct || 34,
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateProject(id || 'PRJ-0001', formData);
      setSuccess(true);
    } catch (e) {
      alert('Failed to update project attributes');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-6">
      <div className="border-b border-[rgba(244,217,160,0.12)] pb-4 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-mono text-[#F4D9A0] uppercase tracking-widest">
            Field Update Protocol
          </span>
          <h1 className="text-xl font-bold font-headline text-[#F4D9A0] mt-1">
            Update Acquisition Corridor: {id}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/overview')}
          className="btn-outline text-xs"
        >
          &larr; Back to Overview
        </button>
      </div>

      {success && (
        <div className="p-4 rounded bg-[#182B1E] border border-[#2F6B42] text-[#86EFAC] text-xs flex items-center justify-between">
          <span>Project telemetry updated. Recalculated risk score scheduled in pipeline.</span>
          <button
            type="button"
            onClick={() => navigate('/overview')}
            className="text-white underline font-semibold ml-4"
          >
            View in Dashboard
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="peace-card p-6 space-y-4">
        {loading ? (
          <div className="text-xs text-[#C4B5A5]">Retrieving project telemetry...</div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-[#C4B5A5] mb-1">
                Allocated Corridor Budget (INR)
              </label>
              <input
                type="number"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
                className="peace-input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#C4B5A5] mb-1">
                Total Land Extent to Acquire (Hectares)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.land_area_ha}
                onChange={(e) => setFormData({ ...formData, land_area_ha: Number(e.target.value) })}
                className="peace-input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#C4B5A5] mb-1">
                Identified Landowner Entities Count
              </label>
              <input
                type="number"
                value={formData.landowners_count}
                onChange={(e) => setFormData({ ...formData, landowners_count: Number(e.target.value) })}
                className="peace-input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#C4B5A5] mb-1">
                Disbursed Compensation Percentage (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.compensation_disbursed_pct}
                onChange={(e) => setFormData({ ...formData, compensation_disbursed_pct: Number(e.target.value) })}
                className="peace-input w-full"
              />
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/overview')}
                className="btn-outline text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-amber text-xs font-medium"
              >
                {submitting ? 'Applying Updates...' : 'Commit Telemetry Update'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
