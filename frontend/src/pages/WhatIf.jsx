import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getProjects, getProjectDetail, getProjectPrediction, postWhatIf } from '../api/projects';
import RiskGauge from '../components/RiskGauge';
import SyntheticNote from '../components/SyntheticNote';
import ErrorBox from '../components/ErrorBox';
import EmptyState from '../components/EmptyState';
import { SkeletonCard, SkeletonChart } from '../components/Loading';
import { getRiskBand, RISK_COLORS } from '../theme';

/**
 * C9. What-If Counterfactual Sensitivity Simulator
 *
 * Route: /what-if (or /what-if?project=:id)
 * Access: project_manager, collector, policymaker, admin.
 * Hidden for auditor.
 *
 * Core Features:
 * - Project selector (defaults to the ?project= query or first project).
 * - Four sliders:
 *     1. compensation pending percent (0-100, pre-filled from project features)
 *     2. number of court cases (0-30, pre-filled)
 *     3. documents incomplete percent (0-100, pre-filled)
 *     4. approval days pending (0-365, pre-filled)
 * - Current value and changed value under each slider + a Reset button.
 * - On slider release (debounced 400 ms), calls POST /projects/:id/what-if with { changes: { ...only changed keys } }.
 * - Three cards: Current score, New score (colored by band), Change (e.g. -17 with a green down arrow).
 * - Before / After RiskGauge pair.
 * - Quick scenarios row of 3 buttons:
 *     1. "Release 50% of pending compensation"
 *     2. "Close half of court cases"
 *     3. "Complete all documents"
 * - Bottom note: "Simulation only. Nothing is saved."
 */

export default function WhatIf() {
  const { role, switchDemoRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Project selection & registry feeds
  const [projectsList, setProjectsList] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Baseline values loaded from project features
  const [baseline, setBaseline] = useState({
    compensation_pending_pct: 66,
    litigation_cases: 4,
    docs_incomplete_pct: 45,
    approval_days_pending: 120,
    current_score: 78,
    current_band: 'High',
  });

  // Slider working state
  const [sliders, setSliders] = useState({
    compensation_pending_pct: 66,
    litigation_cases: 4,
    docs_incomplete_pct: 45,
    approval_days_pending: 120,
  });

  // Simulation output
  const [simulationResult, setSimulationResult] = useState({
    current_score: 78,
    new_score: 78,
    change: 0,
    loading: false,
  });

  // Debounce timer ref
  const debounceTimerRef = useRef(null);

  // 1. Role Gate: Hidden for auditor
  if (role === 'auditor') {
    return (
      <div className="peace-card p-8 max-w-lg mx-auto text-center space-y-4 my-12">
        <div className="w-12 h-12 rounded-full bg-[#331411] border border-[#7F261E] text-[#F87171] mx-auto flex items-center justify-center font-mono text-xl">
          !
        </div>
        <h2 className="text-lg font-bold font-headline text-[#F4D9A0]">
          Simulation Protocol Restricted
        </h2>
        <p className="text-xs text-[#C4B5A5] leading-relaxed">
          The <strong>What-If Counterfactual Simulator</strong> is reserved for planning and administrative roles (<code className="font-mono text-[#F4D9A0]">project_manager</code>, <code className="font-mono text-[#F4D9A0]">collector</code>, <code className="font-mono text-[#F4D9A0]">policymaker</code>, <code className="font-mono text-[#F4D9A0]">admin</code>). It is restricted for statutory Auditor profiles.
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
            onClick={() => navigate('/projects')}
            className="btn-mocha text-xs"
          >
            View Projects Registry
          </button>
        </div>
      </div>
    );
  }

  // 2. Fetch Projects Registry for selector
  useEffect(() => {
    document.title = 'What-If Sensitivity Simulator | LandSentinel';
    let isMounted = true;
    async function loadProjects() {
      setLoadingProjects(true);
      try {
        const list = await getProjects();
        if (!isMounted) return;
        setProjectsList(list || []);

        // Resolve default project ID from ?project= query or first item in list
        const queryPrj = searchParams.get('project');
        const matched = list.find((p) => p.project_id === queryPrj);
        const resolvedId = matched ? matched.project_id : (list[0]?.project_id || 'PRJ-0001');

        setSelectedProjectId(resolvedId);
        if (queryPrj !== resolvedId) {
          setSearchParams({ project: resolvedId }, { replace: true });
        }
      } catch (err) {
        console.error('Failed to load projects list for What-If:', err);
      } finally {
        if (isMounted) setLoadingProjects(false);
      }
    }

    loadProjects();
    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Load baseline project features & prediction when selected project changes
  useEffect(() => {
    if (!selectedProjectId) return;

    let isMounted = true;
    async function fetchProjectFeatures() {
      setLoadingDetails(true);
      try {
        const [detailRes, predRes] = await Promise.all([
          getProjectDetail(selectedProjectId).catch(() => ({})),
          getProjectPrediction(selectedProjectId).catch(() => null),
        ]);

        if (!isMounted) return;

        const prj = detailRes.project || {};
        const compensation = detailRes.compensation || {};
        const cases = detailRes.cases || [];
        const parcels = detailRes.parcels || [];
        const approvals = detailRes.approvals || [];

        // Compute baseline compensation_pending_pct
        let compPending = 66;
        const awardAmt = Number(compensation.award_amount || compensation.total_award || prj.budget || 0);
        const disbAmt = Number(compensation.disbursed_amount || compensation.amount_disbursed || 0);
        if (awardAmt > 0) {
          compPending = Math.round(Math.max(0, 1 - disbAmt / awardAmt) * 100);
        }

        // Compute baseline litigation_cases
        const litigationCount = Math.min(30, Math.max(0, Array.isArray(cases) ? cases.length : 0));

        // Compute baseline docs_incomplete_pct
        let docsIncomplete = 0;
        if (parcels.length > 0) {
          const unverified = parcels.filter((p) => !p.documents_verified && !p.doc_complete).length;
          docsIncomplete = Math.round((unverified / parcels.length) * 100);
        }

        // Compute baseline approval_days_pending
        let appDaysPending = 0;
        const pendingApps = approvals.filter((a) => a.status !== 'cleared' && !a.actual_date);
        if (pendingApps.length > 0) {
          appDaysPending = Math.min(365, pendingApps.length * 30);
        }

        const currentScore = predRes?.risk_score || prj.risk_score || 78;
        const currentBand = predRes?.band || prj.band || (currentScore > 60 ? 'High' : currentScore >= 30 ? 'Medium' : 'Low');

        const initialFeatures = {
          compensation_pending_pct: compPending,
          litigation_cases: litigationCount,
          docs_incomplete_pct: docsIncomplete,
          approval_days_pending: appDaysPending,
          current_score: currentScore,
          current_band: currentBand,
        };

        setBaseline(initialFeatures);
        setSliders({
          compensation_pending_pct: compPending,
          litigation_cases: litigationCount,
          docs_incomplete_pct: docsIncomplete,
          approval_days_pending: appDaysPending,
        });

        setSimulationResult({
          current_score: currentScore,
          new_score: currentScore,
          change: 0,
          loading: false,
        });
      } catch (err) {
        console.error('Failed to load project details for What-If:', err);
      } finally {
        if (isMounted) setLoadingDetails(false);
      }
    }

    fetchProjectFeatures();
    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  // Handle Project Selector change
  const handleProjectSelect = (e) => {
    const newId = e.target.value;
    setSelectedProjectId(newId);
    setSearchParams({ project: newId }, { replace: true });
  };

  // Identify changed slider keys
  const changedKeys = useMemo(() => {
    const changes = {};
    if (sliders.compensation_pending_pct !== baseline.compensation_pending_pct) {
      changes.compensation_pending_pct = Number(sliders.compensation_pending_pct);
    }
    if (sliders.litigation_cases !== baseline.litigation_cases) {
      changes.litigation_cases = Number(sliders.litigation_cases);
    }
    if (sliders.docs_incomplete_pct !== baseline.docs_incomplete_pct) {
      changes.docs_incomplete_pct = Number(sliders.docs_incomplete_pct);
    }
    if (sliders.approval_days_pending !== baseline.approval_days_pending) {
      changes.approval_days_pending = Number(sliders.approval_days_pending);
    }
    return changes;
  }, [sliders, baseline]);

  // Debounced API call: 400 ms on slider release
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // If no sliders changed, reset simulation back to baseline
    if (Object.keys(changedKeys).length === 0) {
      setSimulationResult({
        current_score: baseline.current_score,
        new_score: baseline.current_score,
        change: 0,
        loading: false,
      });
      return;
    }

    setSimulationResult((prev) => ({ ...prev, loading: true }));

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const baselinePayload = {
          compensation_pending_pct: baseline.compensation_pending_pct,
          litigation_cases: baseline.litigation_cases,
          docs_incomplete_pct: baseline.docs_incomplete_pct,
          approval_days_pending: baseline.approval_days_pending,
        };

        const res = await postWhatIf(selectedProjectId, changedKeys, baselinePayload);

        setSimulationResult({
          current_score: res.current_score || baseline.current_score,
          new_score: res.new_score,
          change: res.change,
          loading: false,
        });
      } catch (err) {
        console.error('What-If simulation request failed:', err);
        setSimulationResult((prev) => ({ ...prev, loading: false }));
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [changedKeys, selectedProjectId, baseline]);

  // Quick Scenarios Buttons
  const handleQuickScenario = (scenario) => {
    if (scenario === 'compensation') {
      // Release 50% of pending compensation
      setSliders((prev) => ({
        ...prev,
        compensation_pending_pct: Math.round(baseline.compensation_pending_pct * 0.5),
      }));
      toast.success('Applied scenario: Release 50% of pending compensation');
    } else if (scenario === 'litigation') {
      // Close half of court cases
      setSliders((prev) => ({
        ...prev,
        litigation_cases: Math.floor(baseline.litigation_cases * 0.5),
      }));
      toast.success('Applied scenario: Close half of court cases');
    } else if (scenario === 'documents') {
      // Complete all documents
      setSliders((prev) => ({
        ...prev,
        docs_incomplete_pct: 0,
      }));
      toast.success('Applied scenario: Complete all documents');
    }
  };

  // Reset all sliders back to baseline
  const handleResetSliders = () => {
    setSliders({
      compensation_pending_pct: baseline.compensation_pending_pct,
      litigation_cases: baseline.litigation_cases,
      docs_incomplete_pct: baseline.docs_incomplete_pct,
      approval_days_pending: baseline.approval_days_pending,
    });
    toast.success('Sliders reset to project baseline features');
  };

  const hasModifications = Object.keys(changedKeys).length > 0;

  // New band determination
  const newBand = simulationResult.new_score > 60
    ? 'High'
    : simulationResult.new_score >= 30
    ? 'Medium'
    : 'Low';

  const selectedProjectObj = projectsList.find((p) => p.project_id === selectedProjectId);

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      {/* ========================================================
          HEADER & PROJECT SELECTOR
          ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(244,217,160,0.12)] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-[#F4D9A0] uppercase tracking-widest bg-[#2A1F18] px-2 py-0.5 rounded border border-[rgba(244,217,160,0.18)]">
              Decision Support &bull; C9
            </span>
            <span className="text-xs font-mono text-[#86EFAC] bg-[#152B1E] px-2 py-0.5 rounded border border-[#255C3A]">
              Counterfactual Simulator
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-headline text-[#F4D9A0] tracking-wide">
            What-If Sensitivity Simulator
          </h1>
          <p className="text-xs text-[#C4B5A5] mt-0.5">
            Test policy interventions, legal dispute resolutions, and expedited documentation drives against the AI delay risk model.
          </p>
        </div>

        {/* Project Selector (defaults to ?project= query) */}
        <div className="w-full md:w-72">
          <label className="block text-[#C4B5A5] text-[10px] font-mono uppercase mb-1">
            Target Project Corridor
          </label>
          <select
            value={selectedProjectId}
            onChange={handleProjectSelect}
            disabled={loadingProjects}
            className="peace-input w-full text-xs font-sans font-medium"
          >
            {projectsList.map((p) => (
              <option key={p.project_id} value={p.project_id}>
                {p.project_id} &bull; {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Corridor Overview Strip */}
      {selectedProjectObj && (
        <div className="p-3.5 bg-[#16100C] border border-[rgba(244,217,160,0.12)] rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="text-[#F4D9A0] font-bold font-sans">
              {selectedProjectObj.name}
            </span>
            <span className="text-[#8E7E70]">&bull;</span>
            <span className="text-[#C4B5A5]">{selectedProjectObj.district}</span>
            <span className="text-[#8E7E70]">&bull;</span>
            <span className="text-[#C4B5A5] uppercase text-[11px]">{selectedProjectObj.type}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#8E7E70] text-[11px]">Baseline Risk:</span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                baseline.current_score > 60
                  ? 'bg-[#331411] text-[#FCA5A5] border border-[#7F261E]'
                  : baseline.current_score >= 30
                  ? 'bg-[#2E1E12] text-[#FDE047] border border-[#854D0E]'
                  : 'bg-[#152B1E] text-[#86EFAC] border border-[#255C3A]'
              }`}
            >
              {baseline.current_score} ({baseline.current_band})
            </span>
          </div>
        </div>
      )}

      {/* ========================================================
          SIMULATION METRICS: THREE CARDS + GAUGES
          ======================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Current Score */}
        <div className="peace-card p-5 space-y-2 bg-[#16100C] flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.08)] pb-2">
            <span className="text-[10px] font-mono text-[#8E7E70] uppercase tracking-wider">
              Current Baseline
            </span>
            <span className="text-[11px] font-mono text-[#C4B5A5] bg-[#241B14] px-2 py-0.5 rounded border border-[rgba(244,217,160,0.1)]">
              {baseline.current_band} Band
            </span>
          </div>
          <div className="text-center py-2">
            <span className="text-4xl font-bold font-mono text-[#F4D9A0]">
              {simulationResult.current_score}
            </span>
            <span className="block text-[11px] font-mono text-[#8E7E70] mt-1">
              Active Project Risk Score
            </span>
          </div>
        </div>

        {/* Card 2: New Score (Colored by Band) */}
        <div className="peace-card p-5 space-y-2 bg-[#16100C] flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.08)] pb-2">
            <span className="text-[10px] font-mono text-[#8E7E70] uppercase tracking-wider">
              Simulated Score
            </span>
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                newBand === 'High'
                  ? 'bg-[#331411] text-[#FCA5A5] border border-[#7F261E]'
                  : newBand === 'Medium'
                  ? 'bg-[#2E1E12] text-[#FDE047] border border-[#854D0E]'
                  : 'bg-[#152B1E] text-[#86EFAC] border border-[#255C3A]'
              }`}
            >
              {newBand} Band
            </span>
          </div>
          <div className="text-center py-2">
            <span
              className={`text-4xl font-bold font-mono transition-colors ${
                simulationResult.new_score > 60
                  ? 'text-[#F87171]'
                  : simulationResult.new_score >= 30
                  ? 'text-[#FDE047]'
                  : 'text-[#86EFAC]'
              }`}
            >
              {simulationResult.new_score}
            </span>
            <span className="block text-[11px] font-mono text-[#8E7E70] mt-1">
              Counterfactual Risk Outcome
            </span>
          </div>
        </div>

        {/* Card 3: Change (e.g. -17 with a green down arrow) */}
        <div className="peace-card p-5 space-y-2 bg-[#16100C] flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.08)] pb-2">
            <span className="text-[10px] font-mono text-[#8E7E70] uppercase tracking-wider">
              Net Score Impact
            </span>
            <span className="text-[11px] font-mono text-[#C4B5A5]">
              {simulationResult.loading ? 'Calculating...' : 'Live Inference'}
            </span>
          </div>
          <div className="text-center py-2">
            {simulationResult.change < 0 ? (
              <div className="flex items-center justify-center gap-1.5 text-[#86EFAC] font-mono">
                <span className="text-3xl font-bold">&darr;</span>
                <span className="text-4xl font-bold">{simulationResult.change}</span>
                <span className="text-xs uppercase font-sans font-semibold ml-1">pts</span>
              </div>
            ) : simulationResult.change > 0 ? (
              <div className="flex items-center justify-center gap-1.5 text-[#F87171] font-mono">
                <span className="text-3xl font-bold">&uarr;</span>
                <span className="text-4xl font-bold">+{simulationResult.change}</span>
                <span className="text-xs uppercase font-sans font-semibold ml-1">pts</span>
              </div>
            ) : (
              <div className="text-[#F4D9A0] font-mono text-3xl font-bold py-1">
                &mdash; 0 <span className="text-xs font-normal">pts</span>
              </div>
            )}
            <span className="block text-[11px] font-mono text-[#8E7E70] mt-1">
              {simulationResult.change < 0
                ? 'Risk Mitigation Achieved'
                : simulationResult.change > 0
                ? 'Elevated Risk Trajectory'
                : 'No Delta vs Baseline'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================
          BEFORE / AFTER RISK GAUGE PAIR
          ======================================================== */}
      <div className="peace-card p-6 space-y-4">
        <div className="border-b border-[rgba(244,217,160,0.08)] pb-2">
          <h3 className="text-sm font-semibold text-[#F4D9A0] font-headline">
            Speedometer Risk Assessment: Before vs. After
          </h3>
          <p className="text-xs text-[#C4B5A5] mt-0.5">
            Direct visual comparison of current project corridor risk velocity against the counterfactual simulation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          <div className="space-y-2 text-center">
            <span className="text-xs font-mono uppercase tracking-wider text-[#C4B5A5] font-semibold">
              Before &bull; Current Baseline
            </span>
            <RiskGauge
              score={simulationResult.current_score}
              label="Baseline Risk"
              size={180}
            />
          </div>

          <div className="space-y-2 text-center">
            <span className="text-xs font-mono uppercase tracking-wider text-[#F4D9A0] font-semibold">
              After &bull; Simulated Outcome
            </span>
            <RiskGauge
              score={simulationResult.new_score}
              label="Simulated Risk"
              size={180}
            />
          </div>
        </div>
      </div>

      {/* ========================================================
          QUICK SCENARIOS ROW
          ======================================================== */}
      <div className="peace-card p-4 space-y-2.5 bg-[#16100C]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase text-[#F4D9A0] font-semibold">
            Quick Policy Scenarios
          </span>
          <span className="text-[11px] text-[#8E7E70]">
            One-click counterfactual parameter presets
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => handleQuickScenario('compensation')}
            className="btn-mocha text-xs py-2 px-3 flex items-center justify-center gap-1.5 hover:border-[#C8792C]"
          >
            <span>💰</span>
            <span>Release 50% of pending compensation</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickScenario('litigation')}
            className="btn-mocha text-xs py-2 px-3 flex items-center justify-center gap-1.5 hover:border-[#C8792C]"
          >
            <span>⚖️</span>
            <span>Close half of court cases</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickScenario('documents')}
            className="btn-mocha text-xs py-2 px-3 flex items-center justify-center gap-1.5 hover:border-[#C8792C]"
          >
            <span>📁</span>
            <span>Complete all documents</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          FOUR SENSITIVITY SLIDERS
          ======================================================== */}
      <div className="peace-card p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.08)] pb-2">
          <div>
            <h3 className="text-sm font-semibold text-[#F4D9A0] font-headline">
              Sensitivity Parameter Sliders
            </h3>
            <p className="text-xs text-[#C4B5A5] mt-0.5">
              Adjust project features to observe dynamic recalculation of delay risk score (debounced 400 ms).
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetSliders}
            disabled={!hasModifications}
            className="btn-mocha text-xs font-mono disabled:opacity-40"
          >
            ↺ Reset Sliders
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Slider 1: Compensation Pending Percent (0-100) */}
          <div className="p-4 bg-[#16100C] border border-[rgba(244,217,160,0.1)] rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[#F3EDE2] font-medium font-sans">
                1. Compensation Pending Percent
              </label>
              <span className="font-mono text-sm font-bold text-[#F4D9A0]">
                {sliders.compensation_pending_pct}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={sliders.compensation_pending_pct}
              onChange={(e) =>
                setSliders((prev) => ({
                  ...prev,
                  compensation_pending_pct: Number(e.target.value),
                }))
              }
              className="w-full accent-[#C8792C] cursor-pointer"
            />

            <div className="flex items-center justify-between font-mono text-[11px] pt-1 border-t border-[rgba(244,217,160,0.06)]">
              <span className="text-[#8E7E70]">
                Current baseline: <strong className="text-[#C4B5A5]">{baseline.compensation_pending_pct}%</strong>
              </span>
              <span
                className={
                  sliders.compensation_pending_pct !== baseline.compensation_pending_pct
                    ? 'text-[#F4D9A0] font-bold'
                    : 'text-[#8E7E70]'
                }
              >
                Simulated: {sliders.compensation_pending_pct}%
              </span>
            </div>
          </div>

          {/* Slider 2: Number of Court Cases (0-30) */}
          <div className="p-4 bg-[#16100C] border border-[rgba(244,217,160,0.1)] rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[#F3EDE2] font-medium font-sans">
                2. Number of Court Cases
              </label>
              <span className="font-mono text-sm font-bold text-[#F4D9A0]">
                {sliders.litigation_cases} cases
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={sliders.litigation_cases}
              onChange={(e) =>
                setSliders((prev) => ({
                  ...prev,
                  litigation_cases: Number(e.target.value),
                }))
              }
              className="w-full accent-[#C8792C] cursor-pointer"
            />

            <div className="flex items-center justify-between font-mono text-[11px] pt-1 border-t border-[rgba(244,217,160,0.06)]">
              <span className="text-[#8E7E70]">
                Current baseline: <strong className="text-[#C4B5A5]">{baseline.litigation_cases}</strong>
              </span>
              <span
                className={
                  sliders.litigation_cases !== baseline.litigation_cases
                    ? 'text-[#F4D9A0] font-bold'
                    : 'text-[#8E7E70]'
                }
              >
                Simulated: {sliders.litigation_cases}
              </span>
            </div>
          </div>

          {/* Slider 3: Documents Incomplete Percent (0-100) */}
          <div className="p-4 bg-[#16100C] border border-[rgba(244,217,160,0.1)] rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[#F3EDE2] font-medium font-sans">
                3. Documents Incomplete Percent
              </label>
              <span className="font-mono text-sm font-bold text-[#F4D9A0]">
                {sliders.docs_incomplete_pct}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={sliders.docs_incomplete_pct}
              onChange={(e) =>
                setSliders((prev) => ({
                  ...prev,
                  docs_incomplete_pct: Number(e.target.value),
                }))
              }
              className="w-full accent-[#C8792C] cursor-pointer"
            />

            <div className="flex items-center justify-between font-mono text-[11px] pt-1 border-t border-[rgba(244,217,160,0.06)]">
              <span className="text-[#8E7E70]">
                Current baseline: <strong className="text-[#C4B5A5]">{baseline.docs_incomplete_pct}%</strong>
              </span>
              <span
                className={
                  sliders.docs_incomplete_pct !== baseline.docs_incomplete_pct
                    ? 'text-[#F4D9A0] font-bold'
                    : 'text-[#8E7E70]'
                }
              >
                Simulated: {sliders.docs_incomplete_pct}%
              </span>
            </div>
          </div>

          {/* Slider 4: Approval Days Pending (0-365) */}
          <div className="p-4 bg-[#16100C] border border-[rgba(244,217,160,0.1)] rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[#F3EDE2] font-medium font-sans">
                4. Approval Days Pending
              </label>
              <span className="font-mono text-sm font-bold text-[#F4D9A0]">
                {sliders.approval_days_pending} days
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="365"
              step="1"
              value={sliders.approval_days_pending}
              onChange={(e) =>
                setSliders((prev) => ({
                  ...prev,
                  approval_days_pending: Number(e.target.value),
                }))
              }
              className="w-full accent-[#C8792C] cursor-pointer"
            />

            <div className="flex items-center justify-between font-mono text-[11px] pt-1 border-t border-[rgba(244,217,160,0.06)]">
              <span className="text-[#8E7E70]">
                Current baseline: <strong className="text-[#C4B5A5]">{baseline.approval_days_pending} days</strong>
              </span>
              <span
                className={
                  sliders.approval_days_pending !== baseline.approval_days_pending
                    ? 'text-[#F4D9A0] font-bold'
                    : 'text-[#8E7E70]'
                }
              >
                Simulated: {sliders.approval_days_pending} days
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          STATUTORY MANDATORY DISCLAIMER NOTE
          ======================================================== */}
      <div className="p-4 bg-[#16100C] border border-[#5B4632] rounded-lg text-xs text-[#C4B5A5] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-base">ℹ️</span>
          <span className="font-mono text-[11px] text-[#F4D9A0]">
            Simulation only. Nothing is saved.
          </span>
        </div>
        <span className="text-[11px] text-[#8E7E70] italic hidden sm:inline">
          Counterfactual sandbox parameters do not modify production cadastral survey records or active statutory project state.
        </span>
      </div>
    </div>
  );
}
