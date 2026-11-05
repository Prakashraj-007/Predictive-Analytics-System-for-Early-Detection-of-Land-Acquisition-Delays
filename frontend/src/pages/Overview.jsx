import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getDashboardSummary,
  getDashboardDistricts,
  getDashboardTrend,
} from '../api/projects';
import KpiCard from '../components/KpiCard';
import RiskBadge from '../components/RiskBadge';
import DistrictBar from '../components/charts/DistrictBar';
import TrendLine from '../components/charts/TrendLine';
import BandDonut from '../components/charts/BandDonut';
import { SkeletonCard, SkeletonChart } from '../components/Loading';
import ErrorBox from '../components/ErrorBox';
import EmptyState from '../components/EmptyState';

/**
 * C4. Overview Dashboard
 * Displays:
 * 1. Four KpiCard components (total, high-risk, avg risk, active alerts)
 * 2. Three Recharts charts:
 *    - DistrictBar: Average risk by district
 *    - TrendLine: Average risk over time (12-month trend)
 *    - BandDonut: Risk band distribution
 * 3. Table: Top 10 highest-risk projects (name, district, score as RiskBadge, main driver; row click to /projects/:id)
 * 4. Role scoping subtitle: "Showing: all districts" | "Showing: [district] district" | "Showing: your projects"
 */
export default function Overview() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [trend, setTrend] = useState([]);

  // Load Dashboard Telemetry
  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, distRes, trendRes] = await Promise.all([
        getDashboardSummary(),
        getDashboardDistricts(),
        getDashboardTrend(),
      ]);
      setSummary(sumRes);
      setDistricts(distRes || []);
      setTrend(trendRes || []);
    } catch (err) {
      setError(err.message || 'Failed to retrieve dashboard telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Executive Overview | LandSentinel';
    loadDashboard();
  }, []);

  // Role scoping subtitle per C4 specification
  const getScopeSubtitle = () => {
    if (role === 'project_manager') return 'Showing: your projects';
    if (role === 'collector') return `Showing: ${user?.district || 'Pune'} district`;
    return 'Showing: all districts';
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <SkeletonCard height="h-28" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonChart />
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorBox title="Data Synchronization Notice" message={error} onRetry={loadDashboard} />;
  }

  return (
    <div className="space-y-8">
      {/* ========================================================
          EXECUTIVE OVERVIEW HEADER & KPI TELEMETRY
          ======================================================== */}
      <section id="overview" className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(244,217,160,0.12)] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-mono text-[#2D1E14] uppercase tracking-widest">
                Executive Portfolio Telemetry
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-headline text-[#2D1E14] tracking-wide">
              Land Acquisition Delay Risk Intelligence
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs text-[#C4B5A5] font-sans">
                Autonomous Early Detection, Delay Probability Forecasting &amp; SHAP Mitigation Protocols
              </span>
              <span className="text-[#8E7E70]">•</span>
              <span className="text-xs font-mono text-[#F4D9A0] font-semibold bg-[#201812] px-2 py-0.5 rounded border border-[rgba(244,217,160,0.2)]">
                {getScopeSubtitle()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[#C4B5A5]">
              Active Scope: <strong className="text-[#F4D9A0]">{user?.district || 'Statewide Jurisdictions'}</strong>
            </span>
            <button
              type="button"
              onClick={loadDashboard}
              className="btn-mocha text-xs px-3 py-1.5"
            >
              Refresh Feeds
            </button>
          </div>
        </div>

        {/* 1. Four KpiCard Components */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Projects Monitored"
            value={summary?.total_projects ?? 48}
            subtitle="Active infrastructure acquisition corridors"
            variant="default"
            icon={
              <svg className="w-5 h-5 text-[#F4D9A0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />

          <KpiCard
            title="High-Risk Critical Corridors"
            value={summary?.high_risk_projects ?? 11}
            tag={`${Math.round(((summary?.high_risk_projects || 11) / (summary?.total_projects || 48)) * 100)}% portfolio`}
            subtitle="Score > 60 requiring legal/revenue intervention"
            variant="danger"
            icon={
              <svg className="w-5 h-5 text-[#F87171]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          />

          <KpiCard
            title="Portfolio Average Delay Index"
            value={summary?.avg_risk_score ?? 46.2}
            subtitle="100-point composite vulnerability index"
            variant="warning"
            icon={
              <svg className="w-5 h-5 text-[#C8792C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />

          <KpiCard
            title="Active Judicial/Dispute Alerts"
            value={summary?.projects_with_alerts ?? 7}
            subtitle="Stay orders and valuation disputes flagged"
            variant="gold"
            icon={
              <svg className="w-5 h-5 text-[#F4D9A0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            }
          />
        </div>

        {/* 2. Three Recharts Charts (DistrictBar, TrendLine, BandDonut) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Average Risk by District */}
          <div className="peace-card p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.08)] pb-2">
              <div>
                <h2 className="text-sm font-semibold text-[#F4D9A0] font-headline">Average Risk by District</h2>
                <p className="text-[11px] text-[#C4B5A5]">Color-coded by jurisdiction average band</p>
              </div>
              <span className="text-[10px] font-mono text-[#F4D9A0] bg-[#16100C] px-1.5 py-0.5 rounded border border-[#5B4632]">
                DISTRICTS
              </span>
            </div>
            <DistrictBar data={districts} />
          </div>

          {/* 12-Month Delay Risk Trend */}
          <div className="peace-card p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.08)] pb-2">
              <div>
                <h2 className="text-sm font-semibold text-[#F4D9A0] font-headline">12-Month Delay Risk Trend</h2>
                <p className="text-[11px] text-[#C4B5A5]">Rolling average vulnerability trajectory</p>
              </div>
              <span className="text-[10px] font-mono text-[#F4D9A0] bg-[#16100C] px-1.5 py-0.5 rounded border border-[#5B4632]">
                12M TREND
              </span>
            </div>
            <TrendLine data={trend} />
          </div>

          {/* Risk Band Triage Distribution */}
          <div className="peace-card p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.08)] pb-2">
              <div>
                <h2 className="text-sm font-semibold text-[#F4D9A0] font-headline">Risk Band Triage Distribution</h2>
                <p className="text-[11px] text-[#C4B5A5]">Portfolio categorization breakdown</p>
              </div>
              <span className="text-[10px] font-mono text-[#F4D9A0] bg-[#16100C] px-1.5 py-0.5 rounded border border-[#5B4632]">
                TRIAGE
              </span>
            </div>
            <BandDonut distribution={summary?.band_distribution || { Low: 19, Medium: 18, High: 11 }} />
          </div>
        </div>

        {/* 3. Top 10 Highest-Risk Projects Table */}
        <div className="peace-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.08)] pb-3">
            <div>
              <h2 className="text-sm font-semibold text-[#F4D9A0] font-headline tracking-wide">
                Top 10 highest-risk projects
              </h2>
              <p className="text-xs text-[#C4B5A5] mt-0.5">
                Priority corridors ranked by delay vulnerability. Click any corridor row to inspect /projects/:id
              </p>
            </div>
            <Link
              to="/projects"
              className="text-xs font-mono text-[#F4D9A0] hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#201812] border border-[rgba(244,217,160,0.15)] hover:border-[#C8792C]"
            >
              <span>View All in Projects Registry</span>
              <span>&rarr;</span>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#3D2D21] text-[#C4B5A5] font-mono uppercase text-[11px] bg-[#16100C]">
                  <th className="py-2.5 px-3">Project Name</th>
                  <th className="py-2.5 px-3">District</th>
                  <th className="py-2.5 px-3">Risk Score</th>
                  <th className="py-2.5 px-3">Main Driver</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A1F18]">
                {(summary?.top_risk || []).length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center">
                      <EmptyState
                        title="No Critical Delay Corridors"
                        description="All active infrastructure projects are currently operating within nominal baseline parameters."
                      />
                    </td>
                  </tr>
                ) : (
                  (summary?.top_risk || []).map((prj) => (
                    <tr
                      key={prj.project_id}
                      onClick={() => navigate(`/projects/${prj.project_id}`)}
                      className="hover:bg-[#2A1F18] cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-3">
                        <div className="font-medium text-[#F3EDE2] group-hover:text-[#F4D9A0] transition-colors">
                          {prj.name}
                        </div>
                        <div className="text-[10px] font-mono text-[#F4D9A0]">{prj.project_id}</div>
                      </td>
                      <td className="py-3 px-3 text-[#C4B5A5] font-mono">
                        {prj.district || 'Pune'}
                      </td>
                      <td className="py-3 px-3">
                        <RiskBadge score={prj.risk_score} />
                      </td>
                      <td className="py-3 px-3 text-[#E8DFD3] max-w-xs">
                        {prj.top_driver}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-[#C8792C] group-hover:text-[#F4D9A0] font-mono text-xs hover:underline flex items-center justify-end gap-1">
                          <span>Open</span>
                          <span>&rarr;</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
