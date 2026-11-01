import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createProject } from '../api/projects';

export default function CreateProject() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState(null);

  const [formData, setFormData] = useState({
    name: 'Nashik-Pune Semi-High Speed Rail Corridor (Phase 1)',
    type: 'rail',
    agency: 'MRIDC (Maharashtra Rail Infrastructure Development Corp)',
    state: 'Maharashtra',
    district: 'Pune',
    planned_start: '2025-01-15',
    planned_end: '2028-06-30',
    budget: 6800000000,
    land_area_ha: 215.4,
    villages_input: 'Rajgurunagar, Chakan, Khed, Manchar',
    parcels: [
      { survey_no: '88/1A', area_ha: 12.5, land_type: 'private' },
      { survey_no: '94/2', area_ha: 34.0, land_type: 'government' },
      { survey_no: '102/3B', area_ha: 18.2, land_type: 'private' },
      { survey_no: '115/1', area_ha: 45.0, land_type: 'forest' },
    ],
    start_village: 'Rajgurunagar North',
    end_village: 'Manchar Industrial Bypass',
    landowners_count: 420,
    families_affected: 310,
    families_resettlement: 85,
    approvals: [
      { name: 'Social Impact Assessment', planned_date: '2025-03-31' },
      { name: 'Notification', planned_date: '2025-06-30' },
      { name: 'Environmental Clearance', planned_date: '2025-10-15' },
    ],
  });

  const updateField = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await createProject({ project: formData });
      setCreatedProjectId(res.project_id || 'PRJ-0013');
    } catch (e) {
      alert('Error saving project');
    } finally {
      setSubmitting(false);
    }
  };

  if (createdProjectId) {
    return (
      <div className="peace-card p-8 text-center space-y-4 max-w-lg mx-auto mt-8">
        <div className="w-12 h-12 rounded-full bg-[#152B1E] border border-[#255C3A] text-[#86EFAC] mx-auto flex items-center justify-center font-mono font-bold text-xl">
          ✓
        </div>
        <h2 className="text-lg font-bold font-headline text-[#F4D9A0]">
          Land Acquisition Project Initialized
        </h2>
        <p className="text-xs text-[#C4B5A5]">
          Project records have been logged in the master registry. Initial AI delay baseline inference has been scheduled.
        </p>
        <div className="p-3 bg-[#140F0B] border border-[#3D2D21] rounded font-mono text-sm text-[#F4D9A0]">
          Identifier: <strong>{createdProjectId}</strong>
        </div>
        <div className="flex justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/overview')}
            className="btn-amber text-xs"
          >
            Return to Executive Overview &rarr;
          </button>
        </div>
      </div>
    );
  }

  const STEPS = [
    { num: 1, label: 'Basic Details' },
    { num: 2, label: 'Land & Parcels' },
    { num: 3, label: 'Socio-Demographics' },
    { num: 4, label: 'Review & Submit' },
  ];

  return (
    <div id="intake" className="space-y-6 max-w-4xl mx-auto py-4">
      <div className="border-b border-[rgba(244,217,160,0.12)] pb-4">
        <span className="text-[11px] font-mono text-[#F4D9A0] uppercase tracking-widest">
          RFCTLARR Act 2013 Statutory Intake
        </span>
        <h1 className="text-2xl font-bold font-headline text-[#F4D9A0] mt-1">
          Initiate New Infrastructure Acquisition Project
        </h1>
        <p className="text-xs text-[#C4B5A5] mt-0.5">
          Intake wizard with automated feature extraction and baseline risk classification
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {STEPS.map((s) => (
          <div
            key={s.num}
            className={`p-2.5 rounded border text-center transition-all ${
              currentStep === s.num
                ? 'bg-[#C8792C] border-[#D88636] text-white font-semibold'
                : currentStep > s.num
                ? 'bg-[#2A1F18] border-[rgba(244,217,160,0.3)] text-[#F4D9A0]'
                : 'bg-[#16100C] border-[#3D2D21] text-[#8E7E70]'
            }`}
          >
            <div className="font-mono text-[10px] uppercase">Step 0{s.num}</div>
            <div className="text-[11px] truncate mt-0.5 hidden sm:block">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="peace-card p-6 space-y-5">
        {currentStep === 1 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-xs font-semibold text-[#F4D9A0] uppercase font-mono tracking-wider border-b border-[rgba(244,217,160,0.08)] pb-2">
              Step 1: Administrative Identification
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[#C4B5A5] mb-1 font-medium">Project Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="peace-input w-full"
                />
              </div>

              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">Sector Category</label>
                <select
                  value={formData.type}
                  onChange={(e) => updateField('type', e.target.value)}
                  className="peace-input w-full"
                >
                  <option value="highway">Highway</option>
                  <option value="rail">Rail</option>
                  <option value="irrigation">Irrigation</option>
                  <option value="power">Power</option>
                  <option value="urban">Urban</option>
                </select>
              </div>

              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">Requiring Agency</label>
                <input
                  type="text"
                  value={formData.agency}
                  onChange={(e) => updateField('agency', e.target.value)}
                  className="peace-input w-full"
                />
              </div>

              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">District</label>
                <select
                  value={formData.district}
                  onChange={(e) => updateField('district', e.target.value)}
                  className="peace-input w-full"
                >
                  <option value="Pune">Pune</option>
                  <option value="Thane">Thane</option>
                  <option value="Nagpur">Nagpur</option>
                  <option value="Nashik">Nashik</option>
                </select>
              </div>

              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">Sanctioned Budget (INR ₹)</label>
                <input
                  type="number"
                  value={formData.budget}
                  onChange={(e) => updateField('budget', e.target.value)}
                  className="peace-input w-full font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-xs font-semibold text-[#F4D9A0] uppercase font-mono tracking-wider border-b border-[rgba(244,217,160,0.08)] pb-2">
              Step 2: Land Requirement &amp; Anonymized Survey Parcels
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">Total Land Area (Hectares)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.land_area_ha}
                  onChange={(e) => updateField('land_area_ha', parseFloat(e.target.value) || 0)}
                  className="peace-input w-full font-mono"
                />
              </div>

              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">Villages Covered</label>
                <input
                  type="text"
                  value={formData.villages_input}
                  onChange={(e) => updateField('villages_input', e.target.value)}
                  className="peace-input w-full"
                />
              </div>
            </div>

            <div className="p-3 bg-[#16100C] border border-[rgba(244,217,160,0.1)] rounded text-xs text-[#C4B5A5]">
              Total declared parcels: <strong className="text-[#F4D9A0] font-mono">{formData.parcels.length}</strong> (Anonymized title records)
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-xs font-semibold text-[#F4D9A0] uppercase font-mono tracking-wider border-b border-[rgba(244,217,160,0.08)] pb-2">
              Step 3: Affected Community &amp; R&amp;R Assessment
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">Landowners Count</label>
                <input
                  type="number"
                  value={formData.landowners_count}
                  onChange={(e) => updateField('landowners_count', parseInt(e.target.value, 10) || 0)}
                  className="peace-input w-full font-mono"
                />
              </div>

              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">Project Affected Families</label>
                <input
                  type="number"
                  value={formData.families_affected}
                  onChange={(e) => updateField('families_affected', parseInt(e.target.value, 10) || 0)}
                  className="peace-input w-full font-mono"
                />
              </div>

              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">Families Needing Resettlement</label>
                <input
                  type="number"
                  value={formData.families_resettlement}
                  onChange={(e) => updateField('families_resettlement', parseInt(e.target.value, 10) || 0)}
                  className="peace-input w-full font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-xs font-semibold text-[#F4D9A0] uppercase font-mono tracking-wider border-b border-[rgba(244,217,160,0.08)] pb-2">
              Step 4: Statutory Proposal Audit
            </h3>
            <div className="p-4 bg-[#16100C] border border-[rgba(244,217,160,0.12)] rounded space-y-2">
              <div>Project: <strong className="text-white">{formData.name}</strong></div>
              <div>Sector: <strong className="text-[#F4D9A0] capitalize">{formData.type}</strong></div>
              <div>District: <strong className="text-white">{formData.district}, {formData.state}</strong></div>
              <div>Total Area: <strong className="text-[#F4D9A0] font-mono">{formData.land_area_ha} Ha</strong></div>
              <div>Affected Families: <strong className="text-white font-mono">{formData.families_affected}</strong></div>
            </div>
          </div>
        )}

        <div className="border-t border-[rgba(244,217,160,0.1)] pt-4 flex items-center justify-between">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((p) => Math.max(1, p - 1))}
            className="btn-mocha text-xs disabled:opacity-40"
          >
            &larr; Back
          </button>

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((p) => Math.min(4, p + 1))}
              className="btn-amber text-xs"
            >
              Continue to Step 0{currentStep + 1} &rarr;
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="btn-amber text-xs font-medium"
            >
              {submitting ? 'Ingesting Project...' : 'Confirm & Ingest Corridor'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
