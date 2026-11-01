import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getProjectDetail, getProjectPrediction, updateProject } from '../api/projects';
import ErrorBox from '../components/ErrorBox';
import EmptyState from '../components/EmptyState';
import { SkeletonCard, SkeletonChart, SkeletonTable } from '../components/Loading';
import SyntheticNote from '../components/SyntheticNote';

/**
 * C8. Update Project Telemetry
 * 
 * Accessible exclusively to project_manager at /projects/:id/update.
 * 4 Tab Panels:
 *   (1) Field updates: possession handed over per parcel (checkbox), documents verified per parcel (checkbox),
 *       encroachments (area in hectares), obstructions or protests (count), R&R progress percent slider,
 *       current stage dropdown, officer response days.
 *   (2) Compensation: award amount and amount disbursed.
 *   (3) Court cases: list of existing cases with status and stay-order toggle, and an "Add case" row
 *       (category, filing date, stay order).
 *   (4) Approvals: mark an approval cleared with its actual date.
 * 
 * On Save:
 *   Sends PATCH /projects/:id with ONLY the changed fields.
 *   Shows a result dialog with the NEW prediction returned by the API:
 *   - old score to new score with a colored arrow
 *   - new band
 *   - banner "Alert created: risk rose by N points" when the score rose by 15 or more or crossed 60
 *   - "View project" button
 */

const STAGES = [
  { value: 'planning', label: 'Planning & Feasibility' },
  { value: 'sia', label: 'Social Impact Assessment (SIA)' },
  { value: 'notification', label: 'Section 11 Preliminary Notification' },
  { value: 'award', label: 'Section 23/31 Award Declaration' },
  { value: 'compensation', label: 'Compensation Disbursement' },
  { value: 'possession', label: 'Land Possession Handover' },
  { value: 'rr', label: 'Rehabilitation & Resettlement (R&R)' },
];

const CASE_CATEGORIES = [
  'Compensation Enhancement Dispute',
  'Title & Ownership Dispute',
  'Environmental & Ecological Challenge',
  'Forest & Tribal Rights Violation',
  'Procedural / SIA Irregularity',
  'Boundary & Survey Demarcation',
];

export default function UpdateProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, switchDemoRole } = useAuth();

  const [activeTab, setActiveTab] = useState('field'); // 'field' | 'compensation' | 'cases' | 'approvals'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Initial fetched snapshot for dirty checking (only changed fields are sent on PATCH)
  const [initialData, setInitialData] = useState(null);

  // Editable working form state
  const [formData, setFormData] = useState({
    // (1) Field updates
    current_stage: 'planning',
    rr_progress_pct: 0,
    officer_response_days: 14,
    encroachment_area_ha: 0,
    obstructions_count: 0,
    parcels: [],

    // (2) Compensation
    award_amount: 0,
    amount_disbursed: 0,

    // (3) Court cases
    cases: [],

    // (4) Approvals
    approvals: [],
  });

  // "Add case" row buffer
  const [newCase, setNewCase] = useState({
    category: CASE_CATEGORIES[0],
    filing_date: new Date().toISOString().split('T')[0],
    stay_order: false,
  });

  // Baseline prediction snapshot prior to update
  const [baselinePrediction, setBaselinePrediction] = useState(null);

  // Result dialog modal state
  const [resultDialog, setResultDialog] = useState({
    isOpen: false,
    oldScore: 0,
    newScore: 0,
    newBand: 'Low',
    newPrediction: null,
    scoreRoseBy: 0,
    alertTriggered: false,
  });

  // Load project bundle & prediction
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      document.title = `Update Telemetry: ${id} | LandSentinel`;
      setLoading(true);
      setError(null);
      try {
        const [detailRes, predRes] = await Promise.all([
          getProjectDetail(id),
          getProjectPrediction(id).catch(() => null),
        ]);

        if (!isMounted) return;

        const prj = detailRes.project || {};
        const parcels = detailRes.parcels || [];
        const cases = detailRes.cases || [];
        const approvals = detailRes.approvals || [];
        const compensation = detailRes.compensation || {};

        const loadedForm = {
          current_stage: prj.current_stage || 'planning',
          rr_progress_pct: Number(prj.rr_progress_pct || 0),
          officer_response_days: Number(prj.officer_response_days || 14),
          encroachment_area_ha: Number(prj.encroachment_area_ha || 0),
          obstructions_count: Number(prj.obstructions_count || 0),
          parcels: parcels.map((p) => ({
            parcel_id: p.parcel_id,
            survey_no: p.survey_number || p.survey_no || '101/A',
            area_ha: Number(p.area_ha || 0),
            land_type: p.land_type || 'private',
            possession_handed_over: Boolean(
              p.status === 'handed_over' || p.possession_status === 'handed_over' || p.possession_given
            ),
            documents_verified: Boolean(p.documents_verified || p.doc_complete),
          })),
          award_amount: Number(compensation.award_amount || compensation.total_award || prj.budget || 0),
          amount_disbursed: Number(compensation.disbursed_amount || compensation.amount_disbursed || 0),
          cases: cases.map((c) => ({
            case_id: c.case_id,
            category: c.category || 'Dispute',
            filing_date: c.filing_date || '2024-01-01',
            status: c.status || 'pending',
            stay_order: Boolean(c.stay_order),
          })),
          approvals: approvals.map((a, idx) => ({
            approval_id: a.approval_id || `APP-${idx + 1}`,
            name: a.approval_name || a.name || 'Statutory Approval',
            planned_date: a.planned_date || '',
            actual_date: a.actual_date || a.cleared_date || '',
            status: a.status || (a.actual_date ? 'cleared' : 'pending'),
          })),
        };

        setInitialData(JSON.parse(JSON.stringify(loadedForm)));
        setFormData(loadedForm);
        setBaselinePrediction(predRes || { risk_score: 72, band: 'High' });
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to load project details for update:', err);
        setError('Failed to retrieve project telemetry records.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Compute changed fields diff between formData and initialData
  const diffPayload = useMemo(() => {
    if (!initialData) return { changedCount: 0, patchBody: {} };

    const patchBody = {};
    let changedCount = 0;

    // 1. Project level fields
    const changedPrj = {};
    if (formData.current_stage !== initialData.current_stage) {
      changedPrj.current_stage = formData.current_stage;
      changedCount++;
    }
    if (formData.rr_progress_pct !== initialData.rr_progress_pct) {
      changedPrj.rr_progress_pct = formData.rr_progress_pct;
      changedCount++;
    }
    if (formData.officer_response_days !== initialData.officer_response_days) {
      changedPrj.officer_response_days = formData.officer_response_days;
      changedCount++;
    }
    if (formData.encroachment_area_ha !== initialData.encroachment_area_ha) {
      changedPrj.encroachment_area_ha = formData.encroachment_area_ha;
      changedCount++;
    }
    if (formData.obstructions_count !== initialData.obstructions_count) {
      changedPrj.obstructions_count = formData.obstructions_count;
      changedCount++;
    }
    if (Object.keys(changedPrj).length > 0) {
      patchBody.project = changedPrj;
    }

    // 2. Parcels diff
    const changedParcels = [];
    formData.parcels.forEach((p) => {
      const initP = initialData.parcels.find((ip) => ip.parcel_id === p.parcel_id);
      if (
        !initP ||
        p.possession_handed_over !== initP.possession_handed_over ||
        p.documents_verified !== initP.documents_verified
      ) {
        changedParcels.push(p);
        changedCount++;
      }
    });
    if (changedParcels.length > 0) {
      patchBody.parcels = changedParcels;
    }

    // 3. Compensation diff
    const changedComp = {};
    if (formData.award_amount !== initialData.award_amount) {
      changedComp.award_amount = formData.award_amount;
      changedCount++;
    }
    if (formData.amount_disbursed !== initialData.amount_disbursed) {
      changedComp.amount_disbursed = formData.amount_disbursed;
      changedCount++;
    }
    if (Object.keys(changedComp).length > 0) {
      patchBody.compensation = changedComp;
    }

    // 4. Cases diff
    const changedCases = [];
    formData.cases.forEach((c) => {
      const initC = initialData.cases.find((ic) => ic.case_id === c.case_id);
      if (!initC || c.status !== initC.status || c.stay_order !== initC.stay_order) {
        changedCases.push(c);
        changedCount++;
      }
    });
    if (changedCases.length > 0) {
      patchBody.cases = changedCases;
    }

    // 5. Approvals diff
    const changedApprovals = [];
    formData.approvals.forEach((a) => {
      const initA = initialData.approvals.find((ia) => ia.approval_id === a.approval_id);
      if (!initA || a.actual_date !== initA.actual_date || a.status !== initA.status) {
        changedApprovals.push(a);
        changedCount++;
      }
    });
    if (changedApprovals.length > 0) {
      patchBody.approvals = changedApprovals;
    }

    return { changedCount, patchBody };
  }, [formData, initialData]);

  // Parcel field update helper
  const handleParcelChange = (parcelId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      parcels: prev.parcels.map((p) =>
        p.parcel_id === parcelId ? { ...p, [field]: value } : p
      ),
    }));
  };

  // Case stay-order toggle helper
  const handleCaseToggleStay = (caseId) => {
    setFormData((prev) => ({
      ...prev,
      cases: prev.cases.map((c) =>
        c.case_id === caseId ? { ...c, stay_order: !c.stay_order } : c
      ),
    }));
  };

  // Case status update helper
  const handleCaseStatusChange = (caseId, status) => {
    setFormData((prev) => ({
      ...prev,
      cases: prev.cases.map((c) =>
        c.case_id === caseId ? { ...c, status } : c
      ),
    }));
  };

  // Add new case handler
  const handleAddCase = (e) => {
    e.preventDefault();
    if (!newCase.category) return;

    const createdCase = {
      case_id: `temp-${Date.now()}`,
      category: newCase.category,
      filing_date: newCase.filing_date,
      status: 'pending',
      stay_order: Boolean(newCase.stay_order),
    };

    setFormData((prev) => ({
      ...prev,
      cases: [createdCase, ...prev.cases],
    }));

    // Reset add case inputs
    setNewCase({
      category: CASE_CATEGORIES[0],
      filing_date: new Date().toISOString().split('T')[0],
      stay_order: false,
    });
  };

  // Approval clearance update helper
  const handleApprovalClearance = (approvalId, actualDate) => {
    setFormData((prev) => ({
      ...prev,
      approvals: prev.approvals.map((a) =>
        a.approval_id === approvalId
          ? {
              ...a,
              actual_date: actualDate,
              status: actualDate ? 'cleared' : 'pending',
            }
          : a
      ),
    }));
  };

  // Form submit handler sending PATCH /projects/:id with only changed fields
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (diffPayload.changedCount === 0) {
      alert('No field modifications detected to save.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const oldScore = baselinePrediction?.risk_score || 72;

      // Dispatch PATCH /projects/:id with only the changed fields
      const newPrediction = await updateProject(id, diffPayload.patchBody);

      const newScore = newPrediction.risk_score || oldScore;
      const newBand = newPrediction.band || (newScore > 60 ? 'High' : newScore >= 30 ? 'Medium' : 'Low');
      const scoreRoseBy = newScore - oldScore;

      // Condition: "when the score rose by 15 or more or crossed 60"
      const alertTriggered = scoreRoseBy >= 15 || (oldScore < 60 && newScore >= 60);

      // Open result dialog
      setResultDialog({
        isOpen: true,
        oldScore,
        newScore,
        newBand,
        newPrediction,
        scoreRoseBy,
        alertTriggered,
      });

      // Synchronize initial baseline data to newly saved values
      setInitialData(JSON.parse(JSON.stringify(formData)));
      setBaselinePrediction(newPrediction);
      toast.success('Project telemetry committed and risk recalculated!');
    } catch (err) {
      console.error('Failed to commit project updates:', err);
      const msg = err.message || 'Failed to persist field updates to project registry.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Discard changes
  const handleDiscard = () => {
    if (initialData) {
      setFormData(JSON.parse(JSON.stringify(initialData)));
    }
  };

  // 1. Role Authorization Check: project_manager only
  if (role !== 'project_manager') {
    return (
      <div className="peace-card p-8 max-w-lg mx-auto text-center space-y-4 my-12">
        <div className="w-12 h-12 rounded-full bg-[#331411] border border-[#7F261E] text-[#F87171] mx-auto flex items-center justify-center font-mono text-xl">
          !
        </div>
        <h2 className="text-lg font-bold font-headline text-[#F4D9A0]">
          Project Manager Authorization Required
        </h2>
        <p className="text-xs text-[#C4B5A5] leading-relaxed">
          The Project Telemetry Update protocol at <code className="font-mono text-[#F4D9A0]">/projects/:id/update</code> is restricted exclusively to authorized <strong>Project Managers</strong> under RFCTLARR Act guidelines.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row justify-center gap-2">
          <button
            type="button"
            onClick={() => switchDemoRole('project_manager')}
            className="btn-amber text-xs"
          >
            Switch to Project Manager Demo Role
          </button>
          <button
            type="button"
            onClick={() => navigate(`/projects/${id}`)}
            className="btn-mocha text-xs"
          >
            Return to Project Detail
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 py-4">
        <div className="h-10 w-64 bg-[#201812] rounded animate-pulse" />
        <SkeletonCard height="h-28" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard height="h-44" />
          <SkeletonCard height="h-44" />
        </div>
        <SkeletonTable rows={4} cols={5} />
      </div>
    );
  }

  if (error && !initialData) {
    return (
      <div className="max-w-3xl mx-auto my-12 space-y-4">
        <Link
          to={`/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-[#F4D9A0] hover:text-white"
        >
          &larr; Return to Project Detail
        </Link>
        <ErrorBox
          title="Telemetry Synchronization Failed"
          message={error}
          onRetry={loadData}
        />
      </div>
    );
  }

  const compensationRatio = formData.award_amount > 0
    ? Math.round((formData.amount_disbursed / formData.award_amount) * 100)
    : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      {/* ========================================================
          HEADER & CONTEXT BANNER
          ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(244,217,160,0.12)] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-[#F4D9A0] uppercase tracking-widest bg-[#2A1F18] px-2 py-0.5 rounded border border-[rgba(244,217,160,0.18)]">
              Field Update Protocol &bull; C8
            </span>
            <span className="text-xs font-mono text-[#C4B5A5] bg-[#201812] px-2 py-0.5 rounded border border-[rgba(244,217,160,0.1)]">
              Corridor ID: {id}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-headline text-[#F4D9A0] tracking-wide">
            Update Acquisition Project
          </h1>
          <p className="text-xs text-[#C4B5A5] mt-0.5">
            Record physical possession handovers, verification records, compensation disbursements, litigation, and statutory milestones.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {diffPayload.changedCount > 0 && (
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#301C0D] text-[#FDE68A] border border-[#8A4A17]">
              {diffPayload.changedCount} field{diffPayload.changedCount > 1 ? 's' : ''} modified
            </span>
          )}
          <Link
            to={`/projects/${id}`}
            className="btn-mocha text-xs"
          >
            &larr; Back to Detail
          </Link>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3.5 rounded bg-[#331411] border border-[#7F261E] text-xs text-[#F87171] font-mono">
          {error}
        </div>
      )}

      {/* ========================================================
          TAB NAVIGATION (4 TABS)
          ======================================================== */}
      <div className="border-b border-[#3D2D21]">
        <div className="flex flex-wrap gap-2 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('field')}
            className={`py-2.5 px-4 rounded-t-lg font-medium transition-colors border-t border-x ${
              activeTab === 'field'
                ? 'bg-[#241B14] border-[rgba(244,217,160,0.25)] text-[#F4D9A0] font-semibold border-b-2 border-b-[#C8792C]'
                : 'bg-[#16100C] border-transparent text-[#8E7E70] hover:text-[#C4B5A5] hover:bg-[#1E1611]'
            }`}
          >
            (1) Field Updates
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('compensation')}
            className={`py-2.5 px-4 rounded-t-lg font-medium transition-colors border-t border-x ${
              activeTab === 'compensation'
                ? 'bg-[#241B14] border-[rgba(244,217,160,0.25)] text-[#F4D9A0] font-semibold border-b-2 border-b-[#C8792C]'
                : 'bg-[#16100C] border-transparent text-[#8E7E70] hover:text-[#C4B5A5] hover:bg-[#1E1611]'
            }`}
          >
            (2) Compensation
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cases')}
            className={`py-2.5 px-4 rounded-t-lg font-medium transition-colors border-t border-x ${
              activeTab === 'cases'
                ? 'bg-[#241B14] border-[rgba(244,217,160,0.25)] text-[#F4D9A0] font-semibold border-b-2 border-b-[#C8792C]'
                : 'bg-[#16100C] border-transparent text-[#8E7E70] hover:text-[#C4B5A5] hover:bg-[#1E1611]'
            }`}
          >
            (3) Court Cases ({formData.cases.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('approvals')}
            className={`py-2.5 px-4 rounded-t-lg font-medium transition-colors border-t border-x ${
              activeTab === 'approvals'
                ? 'bg-[#241B14] border-[rgba(244,217,160,0.25)] text-[#F4D9A0] font-semibold border-b-2 border-b-[#C8792C]'
                : 'bg-[#16100C] border-transparent text-[#8E7E70] hover:text-[#C4B5A5] hover:bg-[#1E1611]'
            }`}
          >
            (4) Approvals ({formData.approvals.length})
          </button>
        </div>
      </div>

      {/* ========================================================
          TAB 1: FIELD UPDATES
          ======================================================== */}
      {activeTab === 'field' && (
        <div className="space-y-6">
          {/* General Stage & Progress Attributes */}
          <div className="peace-card p-6 space-y-5">
            <h3 className="text-sm font-semibold text-[#F4D9A0] font-headline border-b border-[rgba(244,217,160,0.08)] pb-2">
              Execution Stage &amp; Site Progress Parameters
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Current stage dropdown */}
              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Current Execution Stage
                </label>
                <select
                  value={formData.current_stage}
                  onChange={(e) => setFormData({ ...formData, current_stage: e.target.value })}
                  className="peace-input w-full"
                >
                  {STAGES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Officer response days */}
              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Officer Response Time (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={formData.officer_response_days}
                  onChange={(e) =>
                    setFormData({ ...formData, officer_response_days: Number(e.target.value) })
                  }
                  className="peace-input w-full font-mono"
                />
                <span className="text-[10px] text-[#8E7E70] mt-0.5 block">
                  Avg SLA turnaround for queries &amp; clearances
                </span>
              </div>

              {/* R&R progress percent slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#C4B5A5] font-medium">R&amp;R Progress</label>
                  <span className="font-mono text-[#F4D9A0] font-bold">
                    {formData.rr_progress_pct}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.rr_progress_pct}
                  onChange={(e) =>
                    setFormData({ ...formData, rr_progress_pct: Number(e.target.value) })
                  }
                  className="w-full accent-[#C8792C] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#8E7E70] font-mono mt-0.5">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Encroachments (area in hectares) */}
              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Encroachments (Area in Hectares)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.encroachment_area_ha}
                  onChange={(e) =>
                    setFormData({ ...formData, encroachment_area_ha: Number(e.target.value) })
                  }
                  placeholder="0.00"
                  className="peace-input w-full font-mono"
                />
                <span className="text-[10px] text-[#8E7E70] mt-0.5 block">
                  Unauthorized occupation detected along corridor
                </span>
              </div>

              {/* Obstructions or protests (count) */}
              <div>
                <label className="block text-[#C4B5A5] mb-1 font-medium">
                  Obstructions or Protests (Count)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.obstructions_count}
                  onChange={(e) =>
                    setFormData({ ...formData, obstructions_count: Number(e.target.value) })
                  }
                  placeholder="0"
                  className="peace-input w-full font-mono"
                />
                <span className="text-[10px] text-[#8E7E70] mt-0.5 block">
                  Reported local agitation or physical site blockages
                </span>
              </div>
            </div>
          </div>

          {/* Repeatable Parcels: Possession Handed Over & Documents Verified */}
          <div className="peace-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[rgba(244,217,160,0.08)] pb-2">
              <div>
                <h3 className="text-sm font-semibold text-[#F4D9A0] font-headline">
                  Parcel-Level Handover &amp; Verification Schedule
                </h3>
                <p className="text-xs text-[#C4B5A5] mt-0.5">
                  Update field possession status and cadastral title document verification per parcel.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      parcels: prev.parcels.map((p) => ({ ...p, possession_handed_over: true })),
                    }))
                  }
                  className="btn-mocha text-[11px] py-1 px-2.5 font-mono"
                >
                  ✓ All Handed Over
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      parcels: prev.parcels.map((p) => ({ ...p, documents_verified: true })),
                    }))
                  }
                  className="btn-mocha text-[11px] py-1 px-2.5 font-mono"
                >
                  ✓ All Verified
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-[rgba(244,217,160,0.1)] rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#3D2D21] text-[#C4B5A5] font-mono uppercase text-[11px] bg-[#16100C]">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Parcel ID / Survey No</th>
                    <th className="py-2.5 px-3">Area (Ha)</th>
                    <th className="py-2.5 px-3">Land Type</th>
                    <th className="py-2.5 px-3 text-center">Possession Handed Over</th>
                    <th className="py-2.5 px-3 text-center">Documents Verified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A1F18]">
                  {formData.parcels.map((p, idx) => (
                    <tr key={p.parcel_id || idx} className="hover:bg-[#201812]">
                      <td className="py-2.5 px-3 font-mono text-[#8E7E70]">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono">
                        <span className="font-semibold text-[#F4D9A0]">{p.survey_no}</span>
                        <span className="block text-[10px] text-[#8E7E70]">{p.parcel_id}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#F3EDE2]">{p.area_ha} Ha</td>
                      <td className="py-2.5 px-3 capitalize text-[#C4B5A5]">{p.land_type}</td>
                      <td className="py-2.5 px-3 text-center">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(p.possession_handed_over)}
                            onChange={(e) =>
                              handleParcelChange(p.parcel_id, 'possession_handed_over', e.target.checked)
                            }
                            className="w-4 h-4 accent-[#4A855A] rounded cursor-pointer"
                          />
                          <span
                            className={`text-[11px] font-mono ${
                              p.possession_handed_over ? 'text-[#86EFAC]' : 'text-[#8E7E70]'
                            }`}
                          >
                            {p.possession_handed_over ? 'Handed Over' : 'Pending'}
                          </span>
                        </label>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(p.documents_verified)}
                            onChange={(e) =>
                              handleParcelChange(p.parcel_id, 'documents_verified', e.target.checked)
                            }
                            className="w-4 h-4 accent-[#C8792C] rounded cursor-pointer"
                          />
                          <span
                            className={`text-[11px] font-mono ${
                              p.documents_verified ? 'text-[#F4D9A0]' : 'text-[#8E7E70]'
                            }`}
                          >
                            {p.documents_verified ? 'Verified' : 'Unverified'}
                          </span>
                        </label>
                      </td>
                    </tr>
                  ))}
                  {formData.parcels.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-6 text-center text-[#8E7E70] italic">
                        No parcel records found for this corridor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: COMPENSATION
          ======================================================== */}
      {activeTab === 'compensation' && (
        <div className="peace-card p-6 space-y-6">
          <div className="border-b border-[rgba(244,217,160,0.08)] pb-2">
            <h3 className="text-sm font-semibold text-[#F4D9A0] font-headline">
              Section 31 Financial Compensation Disbursed
            </h3>
            <p className="text-xs text-[#C4B5A5] mt-0.5">
              Record determination of total statutory award and physical escrow disbursement to project affected persons.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="block text-[#C4B5A5] mb-1 font-medium">
                Determined Award Amount (INR) <span className="text-[#F87171]">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.award_amount}
                onChange={(e) => setFormData({ ...formData, award_amount: Number(e.target.value) })}
                className="peace-input w-full font-mono text-sm"
              />
              <span className="text-[10px] text-[#8E7E70] mt-1 block">
                Total sanctioned award under Section 23/31 valuation
              </span>
            </div>

            <div>
              <label className="block text-[#C4B5A5] mb-1 font-medium">
                Amount Disbursed to Date (INR) <span className="text-[#F87171]">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.amount_disbursed}
                onChange={(e) =>
                  setFormData({ ...formData, amount_disbursed: Number(e.target.value) })
                }
                className="peace-input w-full font-mono text-sm"
              />
              <span className="text-[10px] text-[#8E7E70] mt-1 block">
                Funds released to validated landowner bank accounts
              </span>
            </div>
          </div>

          {/* Analytical Disbursement Ratio Visualization */}
          <div className="p-4 bg-[#16100C] border border-[rgba(244,217,160,0.12)] rounded-lg space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#C4B5A5]">Disbursement Liquidity Ratio:</span>
              <span
                className={`font-bold ${
                  compensationRatio >= 70
                    ? 'text-[#86EFAC]'
                    : compensationRatio >= 40
                    ? 'text-[#FDE68A]'
                    : 'text-[#F87171]'
                }`}
              >
                {compensationRatio}% Disbursed
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-[#201812] border border-[rgba(244,217,160,0.1)] overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  compensationRatio >= 70
                    ? 'bg-[#4A855A]'
                    : compensationRatio >= 40
                    ? 'bg-[#C8792C]'
                    : 'bg-[#7F261E]'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, compensationRatio))}%` }}
              />
            </div>

            <div className="grid grid-cols-2 text-[11px] font-mono text-[#8E7E70] pt-1">
              <div>
                Disbursed:{' '}
                <strong className="text-[#F3EDE2]">
                  ₹{Number(formData.amount_disbursed).toLocaleString('en-IN')}
                </strong>
              </div>
              <div className="text-right">
                Outstanding Balance:{' '}
                <strong className="text-[#F4D9A0]">
                  ₹{Math.max(0, formData.award_amount - formData.amount_disbursed).toLocaleString('en-IN')}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: COURT CASES
          ======================================================== */}
      {activeTab === 'cases' && (
        <div className="space-y-6">
          {/* Add Case Row */}
          <div className="peace-card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-[#F4D9A0] font-headline uppercase tracking-wider">
              + Register New Litigation / Judicial Filing
            </h3>

            <form onSubmit={handleAddCase} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end text-xs">
              <div className="sm:col-span-5">
                <label className="block text-[#C4B5A5] mb-1 font-medium">Dispute Category</label>
                <select
                  value={newCase.category}
                  onChange={(e) => setNewCase({ ...newCase, category: e.target.value })}
                  className="peace-input w-full"
                >
                  {CASE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[#C4B5A5] mb-1 font-medium">Filing Date</label>
                <input
                  type="date"
                  required
                  value={newCase.filing_date}
                  onChange={(e) => setNewCase({ ...newCase, filing_date: e.target.value })}
                  className="peace-input w-full font-mono text-xs"
                />
              </div>

              <div className="sm:col-span-2 flex items-center justify-center pb-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCase.stay_order}
                    onChange={(e) => setNewCase({ ...newCase, stay_order: e.target.checked })}
                    className="w-4 h-4 accent-[#F87171] rounded cursor-pointer"
                  />
                  <span
                    className={`font-mono text-xs font-semibold ${
                      newCase.stay_order ? 'text-[#F87171]' : 'text-[#C4B5A5]'
                    }`}
                  >
                    Stay Order
                  </span>
                </label>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="btn-amber w-full text-xs py-2 font-semibold"
                >
                  Add Case
                </button>
              </div>
            </form>
          </div>

          {/* List of Existing Cases */}
          <div className="peace-card p-6 space-y-4">
            <div className="border-b border-[rgba(244,217,160,0.08)] pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#F4D9A0] font-headline">
                  Active Litigation Registry ({formData.cases.length})
                </h3>
                <p className="text-xs text-[#C4B5A5] mt-0.5">
                  Manage judicial disputes, status tracking, and stay order toggles affecting physical access.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-[rgba(244,217,160,0.1)] rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#3D2D21] text-[#C4B5A5] font-mono uppercase text-[11px] bg-[#16100C]">
                    <th className="py-2.5 px-3">Case ID</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Filing Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">Stay Order Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A1F18]">
                  {formData.cases.map((c) => (
                    <tr key={c.case_id} className="hover:bg-[#201812]">
                      <td className="py-2.5 px-3 font-mono font-semibold text-[#F4D9A0]">
                        {c.case_id}
                      </td>
                      <td className="py-2.5 px-3 text-[#F3EDE2] font-medium">{c.category}</td>
                      <td className="py-2.5 px-3 font-mono text-[#C4B5A5]">{c.filing_date}</td>
                      <td className="py-2.5 px-3">
                        <select
                          value={c.status}
                          onChange={(e) => handleCaseStatusChange(c.case_id, e.target.value)}
                          className="peace-input py-1 text-xs capitalize"
                        >
                          <option value="pending">Pending</option>
                          <option value="hearing">Hearing Scheduled</option>
                          <option value="stayed">Injunction / Stayed</option>
                          <option value="dismissed">Dismissed</option>
                          <option value="disposed">Disposed / Settled</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleCaseToggleStay(c.case_id)}
                          className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-colors border ${
                            c.stay_order
                              ? 'bg-[#331411] text-[#FCA5A5] border-[#7F261E] hover:bg-[#451A16]'
                              : 'bg-[#182B1E] text-[#86EFAC] border-[#2F6B42] hover:bg-[#1E3B27]'
                          }`}
                        >
                          {c.stay_order ? '⚠ STAY ORDER ACTIVE' : 'NO STAY'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {formData.cases.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-6 text-center text-[#8E7E70] italic">
                        No pending court cases recorded for this project corridor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 4: APPROVALS
          ======================================================== */}
      {activeTab === 'approvals' && (
        <div className="peace-card p-6 space-y-4">
          <div className="border-b border-[rgba(244,217,160,0.08)] pb-2">
            <h3 className="text-sm font-semibold text-[#F4D9A0] font-headline">
              Statutory Milestones &amp; Clearances
            </h3>
            <p className="text-xs text-[#C4B5A5] mt-0.5">
              Mark statutory sanctions and environmental clearances as cleared with their actual completion date.
            </p>
          </div>

          <div className="space-y-3">
            {formData.approvals.map((app) => {
              const isCleared = app.status === 'cleared' || Boolean(app.actual_date);

              return (
                <div
                  key={app.approval_id}
                  className={`p-4 rounded-lg border transition-colors grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-xs ${
                    isCleared
                      ? 'bg-[#152B1E] border-[#255C3A]'
                      : 'bg-[#16100C] border-[rgba(244,217,160,0.1)]'
                  }`}
                >
                  <div className="md:col-span-5 space-y-0.5">
                    <div className="font-semibold text-sm text-[#F3EDE2]">{app.name}</div>
                    <div className="text-[11px] font-mono text-[#8E7E70]">
                      Target Planned Date: {app.planned_date || 'Pending Schedule'}
                    </div>
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-[#C4B5A5] text-[10px] uppercase font-mono mb-1">
                      Actual Clearance Date
                    </label>
                    <input
                      type="date"
                      value={app.actual_date || ''}
                      onChange={(e) => handleApprovalClearance(app.approval_id, e.target.value)}
                      className="peace-input w-full font-mono text-xs"
                    />
                  </div>

                  <div className="md:col-span-3 text-right md:text-center">
                    {isCleared ? (
                      <div className="inline-flex items-center gap-1.5 font-mono text-xs text-[#86EFAC] bg-[#1C3322] px-3 py-1.5 rounded border border-[#255C3A]">
                        <span>✓</span>
                        <span>CLEARED</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          handleApprovalClearance(
                            app.approval_id,
                            new Date().toISOString().split('T')[0]
                          )
                        }
                        className="btn-amber text-xs py-1 px-3"
                      >
                        Mark Cleared Today
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {formData.approvals.length === 0 && (
              <div className="py-6 text-center text-[#8E7E70] italic">
                No statutory approvals scheduled for this project.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          PERSISTENT ACTION BAR
          ======================================================== */}
      <div className="peace-card p-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t-2 border-t-[#C8792C]">
        <div className="text-xs text-[#C4B5A5] flex items-center gap-2">
          <span className="font-mono text-[#F4D9A0] font-bold">
            {diffPayload.changedCount} field{diffPayload.changedCount === 1 ? '' : 's'} modified
          </span>
          {diffPayload.changedCount > 0 && (
            <span className="text-[11px] text-[#8E7E70]">
              (Only changed fields will be transmitted in statutory PATCH body)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={diffPayload.changedCount === 0 || saving}
            className="btn-mocha text-xs disabled:opacity-40"
          >
            Discard Changes
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={diffPayload.changedCount === 0 || saving}
            className="btn-amber text-xs font-semibold px-5 disabled:opacity-40"
          >
            {saving ? 'Committing Telemetry...' : 'Save & Recalculate Risk →'}
          </button>
        </div>
      </div>

      {/* ========================================================
          RESULT DIALOG (MODAL)
          ======================================================== */}
      {resultDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="peace-card p-6 w-full max-w-lg bg-[#1E1611] border border-[rgba(244,217,160,0.3)] shadow-2xl rounded-xl space-y-5 animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="text-center border-b border-[rgba(244,217,160,0.12)] pb-3">
              <span className="text-[10px] font-mono text-[#86EFAC] uppercase tracking-wider bg-[#152B1E] px-2 py-0.5 rounded border border-[#255C3A]">
                TELEMETRY UPDATE COMMITTED
              </span>
              <h2 className="text-xl font-bold font-headline text-[#F4D9A0] mt-2">
                Risk Recalculation Results
              </h2>
              <p className="text-xs text-[#C4B5A5] mt-0.5">
                Machine learning inference completed with newly submitted field telemetry.
              </p>
            </div>

            {/* Score Comparison with Colored Arrow */}
            <div className="p-4 bg-[#140F0B] border border-[rgba(244,217,160,0.15)] rounded-lg flex items-center justify-around">
              <div className="text-center">
                <span className="text-[10px] font-mono text-[#8E7E70] uppercase block">
                  Previous Score
                </span>
                <span className="text-2xl font-bold font-mono text-[#C4B5A5]">
                  {resultDialog.oldScore}
                </span>
              </div>

              {/* Colored Arrow */}
              <div className="flex flex-col items-center">
                {resultDialog.newScore < resultDialog.oldScore ? (
                  <div className="flex items-center gap-1 text-[#86EFAC] font-mono text-sm font-bold">
                    <span className="text-2xl">&darr;</span>
                    <span>{resultDialog.oldScore - resultDialog.newScore} pts</span>
                  </div>
                ) : resultDialog.newScore > resultDialog.oldScore ? (
                  <div className="flex items-center gap-1 text-[#F87171] font-mono text-sm font-bold">
                    <span className="text-2xl">&uarr;</span>
                    <span>+{resultDialog.newScore - resultDialog.oldScore} pts</span>
                  </div>
                ) : (
                  <div className="text-[#F4D9A0] font-mono text-xs">
                    <span>&mdash; Unchanged</span>
                  </div>
                )}
                <span className="text-[10px] text-[#8E7E70] font-mono mt-0.5">
                  {resultDialog.newScore < resultDialog.oldScore
                    ? 'Risk Reduced'
                    : resultDialog.newScore > resultDialog.oldScore
                    ? 'Risk Increased'
                    : 'Net Neutral'}
                </span>
              </div>

              <div className="text-center">
                <span className="text-[10px] font-mono text-[#8E7E70] uppercase block">
                  New Score
                </span>
                <span
                  className={`text-2xl font-bold font-mono ${
                    resultDialog.newScore > 60
                      ? 'text-[#F87171]'
                      : resultDialog.newScore >= 30
                      ? 'text-[#FDE047]'
                      : 'text-[#86EFAC]'
                  }`}
                >
                  {resultDialog.newScore}
                </span>
              </div>
            </div>

            {/* New Risk Band Badge */}
            <div className="flex items-center justify-between p-3 bg-[#16100C] border border-[rgba(244,217,160,0.1)] rounded-lg text-xs font-mono">
              <span className="text-[#C4B5A5]">Updated Vulnerability Band:</span>
              <span
                className={`px-3 py-0.5 rounded font-bold uppercase ${
                  resultDialog.newBand === 'High'
                    ? 'bg-[#331411] text-[#FCA5A5] border border-[#7F261E]'
                    : resultDialog.newBand === 'Medium'
                    ? 'bg-[#2E1E12] text-[#FDE047] border border-[#854D0E]'
                    : 'bg-[#152B1E] text-[#86EFAC] border border-[#255C3A]'
                }`}
              >
                {resultDialog.newBand} Risk
              </span>
            </div>

            {/* Banner: "Alert created: risk rose by N points" when score rose by 15+ or crossed 60 */}
            {resultDialog.alertTriggered && (
              <div className="p-3.5 bg-[#331411] border-l-4 border-l-[#F87171] border border-[#7F261E] rounded-r-lg space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-[#F87171] font-mono">
                  <span>⚠️</span>
                  <span>
                    Alert created: risk rose by {Math.max(1, resultDialog.scoreRoseBy)} points
                  </span>
                </div>
                <p className="text-[11px] text-[#FCA5A5] leading-relaxed">
                  Corridor vulnerability crossed critical statutory threshold or exhibited a spike &ge; 15 points. High-priority notification dispatched to District Collector and Monitoring Cell.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2 border-t border-[rgba(244,217,160,0.1)]">
              <button
                type="button"
                onClick={() => setResultDialog((prev) => ({ ...prev, isOpen: false }))}
                className="btn-mocha text-xs"
              >
                Keep Editing
              </button>
              <Link
                to={`/projects/${id}`}
                className="btn-amber text-xs font-semibold text-center"
              >
                View project &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
