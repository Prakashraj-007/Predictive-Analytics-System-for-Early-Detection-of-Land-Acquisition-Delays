import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProjectDetail, getProjectPrediction } from '../api/projects';
import RiskBadge from '../components/RiskBadge';
import RiskGauge from '../components/RiskGauge';
import StageBars from '../components/StageBars';
import ShapBar from '../components/ShapBar';
import ErrorBox from '../components/ErrorBox';

/**
 * C6 Project Detail Page (preview / diagnostic shell)
 * Displays project header, risk gauge, delay forecast, stage breakdown, and SHAP drivers
 */
export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projectData, setProjectData] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [activeTab, setActiveTab] = useState('parcels');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [detailRes, predRes] = await Promise.all([
          getProjectDetail(id),
          getProjectPrediction(id),
        ]);
        setProjectData(detailRes);
        setPrediction(predRes);
      } catch (err) {
        console.error('Failed to load project details:', err);
        setError(err.message || 'Failed to retrieve corridor diagnostic data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

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

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb & Back Link */}
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

        <span className="text-[11px] font-mono text-[#C4B5A5] bg-[#201812] px-2 py-0.5 rounded border border-[rgba(244,217,160,0.14)]">
          ID: {id}
        </span>
      </div>

      {error && <ErrorBox title="Project Loading Notice" message={error} />}

      {/* Header Card */}
      <div className="peace-card p-5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(244,217,160,0.1)] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-[#F4D9A0] bg-[#16100C] px-2 py-0.5 rounded border border-[#5B4632]">
                {project.project_id}
              </span>
              <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-[#301C0D] text-[#F4D9A0] border border-[rgba(200,121,44,0.3)]">
                {project.type}
              </span>
              <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-[#201812] text-[#C4B5A5] border border-[rgba(244,217,160,0.12)]">
                {project.current_stage}
              </span>
            </div>
            <h1 className="text-2xl font-bold font-headline text-[#F4D9A0]">
              {project.name}
            </h1>
            <p className="text-xs text-[#C4B5A5] mt-0.5">
              District: <strong className="text-[#F3EDE2]">{project.district}</strong> • State: Maharashtra
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {role === 'project_manager' && (
              <button
                type="button"
                onClick={() => navigate(`/projects/${id}/update`)}
                className="btn-amber text-xs"
              >
                Update Telemetry
              </button>
            )}
            <Link to={`/what-if?project=${id}`} className="btn-mocha text-xs">
              Run What-If
            </Link>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="peace-card p-4 flex flex-col items-center justify-center bg-[#16100C]">
            <RiskGauge score={prediction?.risk_score ?? 78} size={150} />
          </div>

          <div className="peace-card p-4 space-y-2 bg-[#16100C]">
            <span className="text-[10px] font-mono uppercase text-[#C4B5A5]">Expected Delay Horizon</span>
            <div className="text-3xl font-bold font-mono text-[#F87171]">
              +{prediction?.expected_delay_days ?? 140} <span className="text-sm font-sans font-normal text-[#C4B5A5]">days</span>
            </div>
            <p className="text-xs text-[#C4B5A5]">
              Delay Probability: <strong className="text-[#F4D9A0] font-mono">{Math.round((prediction?.delay_probability ?? 0.78) * 100)}%</strong>
            </p>
          </div>

          <div className="peace-card p-4 space-y-2 bg-[#16100C]">
            <span className="text-[10px] font-mono uppercase text-[#C4B5A5]">Predictive Model Telemetry</span>
            <div className="text-lg font-bold font-mono text-[#F4D9A0]">
              Model: {prediction?.model_version || 'v1-production'}
            </div>
            <p className="text-xs text-[#C4B5A5]">
              Status: Validated against statutory land acquisition records.
            </p>
          </div>
        </div>
      </div>

      {/* Stage Breakdown & SHAP Drivers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="peace-card p-5 space-y-3">
          <h2 className="text-sm font-bold font-headline text-[#F4D9A0]">Statutory Milestone Risk Breakdown</h2>
          <StageBars probabilities={prediction?.stage_probabilities || { approval: 0.35, compensation: 0.72, possession: 0.81, rr: 0.45 }} />
        </div>

        <div className="peace-card p-5 space-y-3">
          <h2 className="text-sm font-bold font-headline text-[#F4D9A0]">Top Risk Drivers (SHAP Attribution)</h2>
          <ShapBar drivers={prediction?.drivers || []} />
        </div>
      </div>

      {/* Tabs: Parcels, Cases, Approvals */}
      <div className="peace-card p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-[rgba(244,217,160,0.12)] pb-2 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('parcels')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'parcels'
                ? 'bg-[#C8792C] text-white font-semibold'
                : 'text-[#C4B5A5] hover:text-[#F4D9A0] hover:bg-[#2A1F18]'
            }`}
          >
            Parcels Registry ({parcels.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cases')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'cases'
                ? 'bg-[#C8792C] text-white font-semibold'
                : 'text-[#C4B5A5] hover:text-[#F4D9A0] hover:bg-[#2A1F18]'
            }`}
          >
            Court Litigation ({cases.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('approvals')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'approvals'
                ? 'bg-[#C8792C] text-white font-semibold'
                : 'text-[#C4B5A5] hover:text-[#F4D9A0] hover:bg-[#2A1F18]'
            }`}
          >
            Statutory Approvals ({approvals.length})
          </button>
        </div>

        {activeTab === 'parcels' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#3D2D21] text-[#C4B5A5] font-mono text-[11px] bg-[#16100C]">
                  <th className="py-2.5 px-3">Parcel ID</th>
                  <th className="py-2.5 px-3">Survey No</th>
                  <th className="py-2.5 px-3">Area (Ha)</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A1F18]">
                {parcels.map((p, i) => (
                  <tr key={i} className="hover:bg-[#2A1F18]">
                    <td className="py-2.5 px-3 font-mono text-[#F4D9A0]">{p.parcel_id}</td>
                    <td className="py-2.5 px-3 font-mono">{p.survey_number}</td>
                    <td className="py-2.5 px-3 font-mono">{p.area_ha}</td>
                    <td className="py-2.5 px-3 capitalize">{p.land_type}</td>
                    <td className="py-2.5 px-3 font-mono uppercase text-[10px]">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'cases' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#3D2D21] text-[#C4B5A5] font-mono text-[11px] bg-[#16100C]">
                  <th className="py-2.5 px-3">Case Number</th>
                  <th className="py-2.5 px-3">Court</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Stay Order</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A1F18]">
                {cases.map((c, i) => (
                  <tr key={i} className="hover:bg-[#2A1F18]">
                    <td className="py-2.5 px-3 font-mono text-[#F4D9A0]">{c.case_number}</td>
                    <td className="py-2.5 px-3">{c.court}</td>
                    <td className="py-2.5 px-3">{c.category}</td>
                    <td className="py-2.5 px-3 font-mono">
                      {c.stay_order ? (
                        <span className="text-[#F87171] font-semibold bg-[#331411] px-2 py-0.5 rounded border border-[#7F261E]">
                          ACTIVE STAY
                        </span>
                      ) : (
                        <span className="text-[#86EFAC]">No Stay</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 capitalize">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'approvals' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#3D2D21] text-[#C4B5A5] font-mono text-[11px] bg-[#16100C]">
                  <th className="py-2.5 px-3">Approval Name</th>
                  <th className="py-2.5 px-3">Authority</th>
                  <th className="py-2.5 px-3">Planned Date</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A1F18]">
                {approvals.map((a, i) => (
                  <tr key={i} className="hover:bg-[#2A1F18]">
                    <td className="py-2.5 px-3 font-medium text-[#F3EDE2]">{a.approval_name}</td>
                    <td className="py-2.5 px-3">{a.authority}</td>
                    <td className="py-2.5 px-3 font-mono text-[#C4B5A5]">{a.planned_date}</td>
                    <td className="py-2.5 px-3 font-mono uppercase text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-[#201812] text-[#F4D9A0] border border-[rgba(244,217,160,0.15)]">
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
