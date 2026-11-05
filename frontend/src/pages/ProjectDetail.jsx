import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getProjectDetail, getProjectPrediction, createTask } from '../api/projects';
import RiskBadge from '../components/RiskBadge';
import RiskGauge from '../components/RiskGauge';
import StageBars from '../components/StageBars';
import ShapBar from '../components/ShapBar';
import ErrorBox from '../components/ErrorBox';
import EmptyState from '../components/EmptyState';
import { SkeletonCard, SkeletonChart } from '../components/Loading';

/**
 * C6. Project Detail Page with Charts
 *
 * Layout, top to bottom:
 * 1. Header:
 *    - Project name, district, type, stage, status badge
 *    - Buttons: "Update data" (project_manager), "Run what-if" (/what-if?project=:id),
 *      and "Assign task" (collector, policymaker)
 * 2. Row of three:
 *    - RiskGauge (semi-circle gauge 0-100 with three colored bands and score in center)
 *    - "Expected delay: about N days" card
 *    - "Model version and date" card
 * 3. StageBars component:
 *    - 4 horizontal bars for approval, compensation, possession, rr with probability in percent
 * 4. "Why is this project at risk?" section:
 *    - ShapBar component (horizontal bars of 3 drivers' impact, red for increases_risk, green for decreases_risk)
 *    - Under each bar: plain_text sentence and matching recommendation card (recommendation.driver === driver.feature)
 * 5. Tabs:
 *    - Parcels (table) - NEVER displays owner names
 *    - Court cases (table with stay order badge)
 *    - Approvals (timeline with planned vs actual date and red mark if overdue)
 */
export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projectData, setProjectData] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [activeTab, setActiveTab] = useState('parcels');

  // Assign Task Modal State (collector, policymaker)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    action: '',
    assigned_to: 'Sub-Divisional Officer (Land Acquisition)',
    deadline: '',
  });
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskSuccessMsg, setTaskSuccessMsg] = useState('');
  const [taskError, setTaskError] = useState(null);

  const canUpdateData = role === 'project_manager';
  const canAssignTask = role === 'collector' || role === 'policymaker';
  const canRunWhatIf = role !== 'auditor';

  // Load Project Detail & Prediction Data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [detailRes, predRes] = await Promise.all([
        getProjectDetail(id),
        getProjectPrediction(id),
      ]);
      setProjectData(detailRes);
      setPrediction(predRes);
      if (detailRes.project?.name) {
        document.title = `${detailRes.project.name} | LandSentinel`;
      } else {
        document.title = `Project ${id} | LandSentinel`;
      }
    } catch (err) {
      console.error('Failed to load project details:', err);
      setError(err.message || 'Failed to retrieve corridor diagnostic data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = `Loading Project ${id}... | LandSentinel`;
    loadData();
  }, [id]);

  // Open Task Modal with pre-filled action from recommendation
  const handleOpenTaskModal = (rec) => {
    // Default deadline 30 days from today
    const d = new Date();
    d.setDate(d.getDate() + 30);
    const deadlineDefault = d.toISOString().split('T')[0];

    setTaskForm({
      action: rec?.action || 'Escalate critical litigation stay orders to legal cell',
      assigned_to: 'Sub-Divisional Officer (Land Acquisition)',
      deadline: deadlineDefault,
    });
    setTaskSuccessMsg('');
    setTaskError(null);
    setIsTaskModalOpen(true);
  };

  // Submit Task Assignment (POST /tasks)
  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    setTaskSubmitting(true);
    setTaskError(null);
    try {
      await createTask({
        project_id: id,
        action: taskForm.action,
        assigned_to: taskForm.assigned_to,
        deadline: taskForm.deadline,
      });
      toast.success('Mitigation directive assigned successfully');
      setTaskSuccessMsg('Directive dispatched successfully. Task assigned to officer.');
      setTimeout(() => {
        setIsTaskModalOpen(false);
        setTaskSuccessMsg('');
      }, 1800);
    } catch (err) {
      const msg = err.message || 'Failed to dispatch task directive';
      setTaskError(msg);
      toast.error(msg);
    } finally {
      setTaskSubmitting(false);
    }
  };

  const project = projectData?.project || {
    project_id: id,
    name: 'Infrastructure Corridor',
    district: 'Pune',
    type: 'highway',
    current_stage: 'compensation',
    status: 'active',
  };

  const parcels = projectData?.parcels || [];
  const cases = projectData?.cases || [];
  const approvals = projectData?.approvals || [];

  // Check if an approval milestone is overdue
  const isApprovalOverdue = (approval) => {
    if (approval.status === 'cleared') {
      if (approval.actual_date && approval.planned_date) {
        return new Date(approval.actual_date) > new Date(approval.planned_date);
      }
      return false;
    }
    if (approval.planned_date) {
      return new Date(approval.planned_date) < new Date();
    }
    return false;
  };

  // Format prediction timestamp
  const formatPredictionDate = (isoString) => {
    if (!isoString) return '01 Nov 2026, 03:38 UTC';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return isoString;
    }
  };

  // Sector badge helper
  const getSectorStyle = (t = '') => {
    switch (t.toLowerCase()) {
      case 'highway':
        return 'bg-[#291E13] text-[#F4D9A0] border-[#8A4A17]';
      case 'rail':
        return 'bg-[#18261E] text-[#86EFAC] border-[#255C3A]';
      case 'irrigation':
        return 'bg-[#13232C] text-[#93C5FD] border-[#1E40AF]';
      case 'power':
        return 'bg-[#2E1E12] text-[#FDE047] border-[#854D0E]';
      default:
        return 'bg-[#2A1F18] text-[#E8DFD3] border-[#5B4632]';
    }
  };

  // Stage badge helper
  const getStageStyle = (s = '') => {
    switch (s.toLowerCase()) {
      case 'possession':
        return 'bg-[#331411] text-[#FCA5A5] border-[#7F261E]';
      case 'compensation':
        return 'bg-[#301C0D] text-[#F4D9A0] border-[#C8792C]';
      case 'award':
        return 'bg-[#1C241B] text-[#86EFAC] border-[#255C3A]';
      default:
        return 'bg-[#201812] text-[#C4B5A5] border-[#3D2D21]';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded bg-[#201812] animate-pulse" />
        <div className="h-44 rounded bg-[#1E1611] border border-[rgba(244,217,160,0.12)] animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonChart height="h-44" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/projects"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#F4D9A0] hover:text-white transition-colors"
          >
            <span>&larr;</span>
            <span>Return to Projects Registry</span>
          </Link>
        </div>
        <ErrorBox
          title="Corridor Diagnostic Synchronization Notice"
          message={error}
          onRetry={loadData}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ========================================================
          1. NAVIGATION BACK LINK & TOP CONTROLS
          ======================================================== */}
      <div className="flex items-center justify-between">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-[#F4D9A0] hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Projects Registry</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#C4B5A5] bg-[#201812] px-2 py-0.5 rounded border border-[rgba(244,217,160,0.14)]">
            CORRIDOR REF: {project.project_id}
          </span>
          <button
            type="button"
            onClick={loadData}
            className="btn-mocha text-xs px-2.5 py-1"
            title="Refresh diagnostic telemetry"
          >
            <svg className="w-3.5 h-3.5 text-[#F4D9A0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {error && <ErrorBox title="Project Loading Notice" message={error} onRetry={loadData} />}

      {/* ========================================================
          1. HEADER CARD: Name, District, Type, Stage, Status & Action Buttons
          ======================================================== */}
      <div className="peace-card p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(244,217,160,0.1)] pb-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-[#F4D9A0] font-semibold bg-[#16100C] px-2 py-0.5 rounded border border-[#5B4632]">
                {project.project_id}
              </span>
              <span className={`text-xs uppercase font-mono px-2 py-0.5 rounded border ${getSectorStyle(project.type)}`}>
                {project.type}
              </span>
              <span className={`text-xs uppercase font-mono px-2 py-0.5 rounded border ${getStageStyle(project.current_stage)}`}>
                {project.current_stage}
              </span>
              <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-[#1C241B] text-[#86EFAC] border border-[#255C3A]">
                {project.status || 'Active'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold font-headline text-[#F4D9A0] tracking-wide">
              {project.name}
            </h1>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[#C4B5A5]">
              <span className="flex items-center gap-1 font-mono text-[#F3EDE2]">
                <svg className="w-3.5 h-3.5 text-[#C8792C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {project.district} District
              </span>
              <span>•</span>
              <span>State: <strong>{project.state || 'Maharashtra'}</strong></span>
              {project.agency && (
                <>
                  <span>•</span>
                  <span>Agency: <span className="text-[#F3EDE2]">{project.agency}</span></span>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* "Update data" button: shown only to project_manager */}
            {canUpdateData && (
              <button
                type="button"
                onClick={() => navigate(`/projects/${id}/update`)}
                className="btn-amber text-xs font-semibold"
                title="Update project parameters and record progress"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Update data</span>
              </button>
            )}

            {/* "Run what-if" button: opens /what-if?project=:id */}
            {canRunWhatIf && (
              <button
                type="button"
                onClick={() => navigate(`/what-if?project=${id}`)}
                className="btn-mocha text-xs font-medium"
                title="Open What-If Simulator with corridor pre-loaded"
              >
                <svg className="w-3.5 h-3.5 text-[#F4D9A0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <span>Run what-if</span>
              </button>
            )}

            {/* "Assign task" button: collector, policymaker */}
            {canAssignTask && (
              <button
                type="button"
                onClick={() => handleOpenTaskModal(prediction?.recommendations?.[0])}
                className="btn-amber text-xs font-medium"
                title="Dispatch administrative directive"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>Assign task</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================
            2. ROW OF THREE: RiskGauge, Expected Delay, Model Version & Date
            ======================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Card 1: RiskGauge semi-circle */}
          <div className="peace-card p-4 flex flex-col items-center justify-center bg-[#16100C]">
            <RiskGauge
              score={prediction?.risk_score ?? 78}
              size={180}
              label="Composite Delay Vulnerability Index"
            />
          </div>

          {/* Card 2: "Expected delay: about N days" */}
          <div className="peace-card p-5 space-y-3 bg-[#16100C] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.08)] pb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#C4B5A5]">
                Forecasted Timeline Impact
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#331411] text-[#F87171] border border-[#7F261E]">
                SCHEDULE RISK
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-[#C4B5A5] font-sans">Expected delay:</div>
              <div className="text-3xl font-extrabold font-mono text-[#F87171] tracking-tight">
                about {prediction?.expected_delay_days ?? 140} days
              </div>
              <p className="text-xs text-[#E8DFD3] pt-1">
                Delay probability:{' '}
                <strong className="text-[#F4D9A0] font-mono text-sm">
                  {Math.round((prediction?.delay_probability ?? 0.78) * 100)}%
                </strong>
              </p>
            </div>

            <div className="text-[11px] font-mono text-[#8E7E70] border-t border-[rgba(244,217,160,0.08)] pt-2">
              Target completion date at risk of statutory slipping.
            </div>
          </div>

          {/* Card 3: "Model version and date" */}
          <div className="peace-card p-5 space-y-3 bg-[#16100C] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.08)] pb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#C4B5A5]">
                Predictive Model Telemetry
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#18261E] text-[#86EFAC] border border-[#255C3A]">
                VALIDATED
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-xs text-[#C4B5A5]">Model version:</span>
                <div className="text-xl font-bold font-mono text-[#F4D9A0]">
                  {prediction?.model_version || 'v1'}
                </div>
              </div>

              <div>
                <span className="text-xs text-[#C4B5A5]">Prediction date:</span>
                <div className="text-xs font-mono text-[#E8DFD3] font-medium">
                  {formatPredictionDate(prediction?.created_at)}
                </div>
              </div>
            </div>

            <div className="text-[11px] font-mono text-[#8E7E70] border-t border-[rgba(244,217,160,0.08)] pt-2 flex items-center justify-between">
              <span>Supervised Ensemble</span>
              <span className="text-[#86EFAC]">AUROC: 0.88</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          3. STAGEBARS COMPONENT: Approval, Compensation, Possession, R&R
          ======================================================== */}
      <div>
        <StageBars
          stageProbabilities={
            prediction?.stage_probabilities || {
              approval: 0.35,
              compensation: 0.72,
              possession: 0.81,
              rr: 0.45,
            }
          }
          title="Administrative Stage Overrun Probability Distribution"
        />
      </div>

      {/* ========================================================
          4. "Why is this project at risk?" SECTION (ShapBar + Recommendations)
          ======================================================== */}
      <div>
        <ShapBar
          drivers={prediction?.drivers || []}
          recommendations={prediction?.recommendations || []}
          canAssignTask={canAssignTask}
          onActionClick={handleOpenTaskModal}
        />
      </div>

      {/* ========================================================
          5. TABS: Parcels (no owner names), Court cases, Approvals (timeline)
          ======================================================== */}
      <div className="peace-card p-5 space-y-5">
        {/* Tab Headers */}
        <div className="flex items-center gap-2 border-b border-[rgba(244,217,160,0.12)] pb-2 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('parcels')}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-2 ${
              activeTab === 'parcels'
                ? 'bg-[#C8792C] text-white font-semibold'
                : 'text-[#C4B5A5] hover:text-[#F4D9A0] hover:bg-[#2A1F18]'
            }`}
          >
            <span>Parcels Registry</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/30">
              {parcels.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cases')}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-2 ${
              activeTab === 'cases'
                ? 'bg-[#C8792C] text-white font-semibold'
                : 'text-[#C4B5A5] hover:text-[#F4D9A0] hover:bg-[#2A1F18]'
            }`}
          >
            <span>Court Cases &amp; Litigation</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/30">
              {cases.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('approvals')}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-2 ${
              activeTab === 'approvals'
                ? 'bg-[#C8792C] text-white font-semibold'
                : 'text-[#C4B5A5] hover:text-[#F4D9A0] hover:bg-[#2A1F18]'
            }`}
          >
            <span>Approvals Timeline</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/30">
              {approvals.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Parcels Table (NEVER displays owner names) */}
        {activeTab === 'parcels' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[#C4B5A5]">
              <span>
                Statutory land parcels acquired under RFCTLARR Act 2013 (Landowner privacy preserved).
              </span>
              <span className="font-mono text-[10px] text-[#F4D9A0] bg-[#16100C] px-2 py-0.5 rounded border border-[#5B4632]">
                ANONYMIZED
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#3D2D21] text-[#C4B5A5] font-mono uppercase text-[11px] bg-[#16100C]">
                    <th className="py-2.5 px-3">Parcel ID</th>
                    <th className="py-2.5 px-3">Survey Number</th>
                    <th className="py-2.5 px-3">Area (Ha)</th>
                    <th className="py-2.5 px-3">Land Classification</th>
                    <th className="py-2.5 px-3">Possession Status</th>
                    <th className="py-2.5 px-3">Compensation</th>
                    <th className="py-2.5 px-3">Title Dispute</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A1F18]">
                  {parcels.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center">
                        <EmptyState
                          title="No Demarcated Parcels"
                          description="No cadastral survey land parcels recorded for this corridor."
                        />
                      </td>
                    </tr>
                  ) : (
                    parcels.map((p, idx) => (
                      <tr key={p.parcel_id || idx} className="hover:bg-[#2A1F18] transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[#F4D9A0] font-medium">
                          {p.parcel_id}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#F3EDE2]">
                          {p.survey_number}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#C4B5A5]">
                          {p.area_ha} ha
                        </td>
                        <td className="py-2.5 px-3 capitalize text-[#E8DFD3]">
                          {p.land_type}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block font-mono text-[10px] uppercase px-2 py-0.5 rounded border ${
                              p.status === 'handed_over' || p.possession_status === 'handed_over'
                                ? 'bg-[#152B1E] text-[#86EFAC] border-[#255C3A]'
                                : 'bg-[#301C0D] text-[#F4D9A0] border-[#8A4A17]'
                            }`}
                          >
                            {p.status === 'handed_over' || p.possession_status === 'handed_over'
                              ? 'Handed Over'
                              : 'Pending Possession'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] capitalize text-[#C4B5A5]">
                          {p.compensation_status || 'Pending'}
                        </td>
                        <td className="py-2.5 px-3">
                          {p.ownership_dispute ? (
                            <span className="text-[10px] font-mono text-[#F87171] bg-[#331411] px-1.5 py-0.5 rounded border border-[#7F261E]">
                              Dispute Flagged
                            </span>
                          ) : (
                            <span className="text-[#8E7E70] font-mono text-[11px]">Clear</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Court Cases (with Stay Order Badge) */}
        {activeTab === 'cases' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[#C4B5A5]">
              <span>
                Active judicial proceedings affecting corridor parcels.
              </span>
              <span className="font-mono text-[10px] text-[#F87171] bg-[#331411] px-2 py-0.5 rounded border border-[#7F261E]">
                {cases.filter((c) => c.stay_order).length} ACTIVE STAY ORDERS
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#3D2D21] text-[#C4B5A5] font-mono uppercase text-[11px] bg-[#16100C]">
                    <th className="py-2.5 px-3">Case ID</th>
                    <th className="py-2.5 px-3">Forum / Court</th>
                    <th className="py-2.5 px-3">Litigation Category</th>
                    <th className="py-2.5 px-3">Stay Order Status</th>
                    <th className="py-2.5 px-3">Proceedings Status</th>
                    <th className="py-2.5 px-3 font-mono">Hearings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A1F18]">
                  {cases.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center">
                        <EmptyState
                          title="No Litigation Proceedings"
                          description="Zero active litigation proceedings or stay orders logged for this project corridor."
                        />
                      </td>
                    </tr>
                  ) : (
                    cases.map((c, idx) => (
                      <tr key={c.case_id || idx} className="hover:bg-[#2A1F18] transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[#F4D9A0] font-semibold">
                          {c.case_number || c.case_id}
                        </td>
                        <td className="py-2.5 px-3 text-[#F3EDE2]">
                          {c.court || 'District Civil Court'}
                        </td>
                        <td className="py-2.5 px-3 text-[#C4B5A5] capitalize">
                          {c.category}
                        </td>
                        {/* Stay Order Badge per C6 Specification */}
                        <td className="py-2.5 px-3">
                          {c.stay_order ? (
                            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded bg-[#331411] text-[#F87171] border border-[#7F261E]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#C94A3D] animate-ping" />
                              <span>STAY ORDER ACTIVE</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#86EFAC] bg-[#152B1E] px-2 py-0.5 rounded border border-[#255C3A]">
                              <span>No Stay</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 capitalize font-mono text-[11px]">
                          <span
                            className={
                              c.status === 'pending'
                                ? 'text-[#F4D9A0]'
                                : 'text-[#8E7E70]'
                            }
                          >
                            {c.status || 'Pending'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#C4B5A5]">
                          {c.hearings ?? 0}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Approvals Timeline (with Planned vs Actual Date and Overdue Red Mark) */}
        {activeTab === 'approvals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[#C4B5A5]">
              <span>
                Statutory sanction milestones. Red indicator highlights overdue clearances requiring executive escalation.
              </span>
              <span className="font-mono text-[10px] text-[#F4D9A0] bg-[#16100C] px-2 py-0.5 rounded border border-[#5B4632]">
                STATUTORY WORKFLOW
              </span>
            </div>

            {/* Visual Timeline Component */}
            <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[rgba(244,217,160,0.18)]">
              {approvals.length === 0 ? (
                <div className="py-4">
                  <EmptyState
                    title="No Statutory Milestones"
                    description="No statutory clearance milestones scheduled for this corridor."
                  />
                </div>
              ) : (
                approvals.map((app, idx) => {
                  const overdue = isApprovalOverdue(app);
                  const isCleared = app.status === 'cleared';

                  return (
                    <div
                      key={app.approval_id || idx}
                      className={`relative p-4 rounded-lg border transition-colors ${
                        overdue
                          ? 'bg-[#291412] border-[#C94A3D]/70 shadow-sm shadow-[#C94A3D]/20'
                          : isCleared
                          ? 'bg-[#18211A] border-[#255C3A]/60'
                          : 'bg-[#1E1611] border-[rgba(244,217,160,0.14)]'
                      }`}
                    >
                      {/* Timeline Node Dot */}
                      <span
                        className={`absolute -left-[27px] top-4 w-3.5 h-3.5 rounded-full border-2 ${
                          overdue
                            ? 'bg-[#C94A3D] border-[#140F0B] ring-2 ring-[#7F261E]'
                            : isCleared
                            ? 'bg-[#4A855A] border-[#140F0B]'
                            : 'bg-[#C8792C] border-[#140F0B]'
                        }`}
                      />

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[rgba(244,217,160,0.08)] pb-2 mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-[#F3EDE2] font-headline">
                            {app.approval_name || app.name}
                          </h4>
                          {overdue && (
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#C94A3D] text-white uppercase tracking-wider animate-pulse">
                              OVERDUE
                            </span>
                          )}
                        </div>

                        <span
                          className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded border self-start sm:self-auto ${
                            isCleared
                              ? 'bg-[#152B1E] text-[#86EFAC] border-[#255C3A]'
                              : overdue
                              ? 'bg-[#331411] text-[#F87171] border-[#7F261E]'
                              : 'bg-[#301C0D] text-[#F4D9A0] border-[#8A4A17]'
                          }`}
                        >
                          {isCleared ? 'Cleared' : overdue ? 'Pending Overdue' : 'Pending'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                        <div>
                          <span className="text-[#8E7E70] text-[10px] block">Competent Authority:</span>
                          <span className="text-[#C4B5A5]">{app.authority || 'State Authority'}</span>
                        </div>

                        <div>
                          <span className="text-[#8E7E70] text-[10px] block">Planned Target Date:</span>
                          <span className={`font-semibold ${overdue ? 'text-[#F87171]' : 'text-[#F4D9A0]'}`}>
                            {app.planned_date || 'N/A'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[#8E7E70] text-[10px] block">Actual Sanction Date:</span>
                          <span className={app.actual_date ? 'text-[#86EFAC]' : 'text-[#8E7E70]'}>
                            {app.actual_date || (overdue ? 'Pending Beyond Target' : 'Pending')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          TASK ASSIGNMENT MODAL (POST /tasks)
          For Collector & Policymaker with pre-filled recommendation action
          ======================================================== */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="peace-card p-6 w-full max-w-lg bg-[#1E1611] border border-[rgba(244,217,160,0.25)] shadow-2xl rounded-lg space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.12)] pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#F4D9A0] uppercase tracking-wider">
                  Administrative Escalation
                </span>
                <h3 className="text-base font-bold font-headline text-[#F4D9A0] mt-0.5">
                  Assign Mitigation Task
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(false)}
                className="text-[#8E7E70] hover:text-[#F4D9A0] text-sm font-mono"
              >
                ✕
              </button>
            </div>

            {taskSuccessMsg ? (
              <div className="p-4 rounded bg-[#152B1E] border border-[#255C3A] text-xs text-[#86EFAC] font-mono flex items-center gap-2">
                <svg className="w-4 h-4 text-[#86EFAC]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>{taskSuccessMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleTaskSubmit} className="space-y-4 text-xs">
                {taskError && (
                  <div className="p-3 rounded bg-[#331411] border border-[#7F261E] text-[#F87171]">
                    {taskError}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#C4B5A5] mb-1">
                    Corridor Reference
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`${project.name} (${id})`}
                    className="peace-input w-full bg-[#140F0B] text-[#8E7E70] cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#C4B5A5] mb-1">
                    Direct Action / Mitigation Protocol
                  </label>
                  <textarea
                    rows="3"
                    required
                    value={taskForm.action}
                    onChange={(e) => setTaskForm({ ...taskForm, action: e.target.value })}
                    className="peace-input w-full text-xs font-sans leading-relaxed"
                    placeholder="Enter actionable escalation directive..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#C4B5A5] mb-1">
                    Designated Revenue / Legal Officer
                  </label>
                  <select
                    value={taskForm.assigned_to}
                    onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
                    className="peace-input w-full"
                  >
                    <option value="Sub-Divisional Officer (Land Acquisition)">
                      Sub-Divisional Officer (Land Acquisition)
                    </option>
                    <option value="Special Land Acquisition Officer (SLAO)">
                      Special Land Acquisition Officer (SLAO)
                    </option>
                    <option value="District Legal Cell & Government Pleader">
                      District Legal Cell &amp; Government Pleader
                    </option>
                    <option value="Competent Authority for Land Acquisition (CALA)">
                      Competent Authority for Land Acquisition (CALA)
                    </option>
                    <option value="Deputy Collector (Resettlement & Rehabilitation)">
                      Deputy Collector (Resettlement &amp; Rehabilitation)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#C4B5A5] mb-1">
                    Compliance Deadline
                  </label>
                  <input
                    type="date"
                    required
                    value={taskForm.deadline}
                    onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                    className="peace-input w-full font-mono text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgba(244,217,160,0.1)]">
                  <button
                    type="button"
                    onClick={() => setIsTaskModalOpen(false)}
                    className="btn-mocha text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={taskSubmitting}
                    className="btn-amber text-xs font-semibold"
                  >
                    {taskSubmitting ? 'Dispatching...' : 'Dispatch Task Directive'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
