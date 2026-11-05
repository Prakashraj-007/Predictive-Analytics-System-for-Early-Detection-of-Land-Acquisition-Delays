import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProjects } from '../api/projects';
import RiskBadge from '../components/RiskBadge';
import ErrorBox from '../components/ErrorBox';
import EmptyState from '../components/EmptyState';
import { SkeletonTable } from '../components/Loading';
import SyntheticNote from '../components/SyntheticNote';
import { getRiskBand, RISK_COLORS } from '../theme';

const PAGE_SIZE = 15;
const DEFAULT_SORT = 'risk_desc';

const STATE_OPTIONS = [
  'All States',
  'Maharashtra',
  'Karnataka',
  'Gujarat',
  'Tamil Nadu',
  'Telangana',
];

const DISTRICT_OPTIONS = [
  'All Districts',
  'Pune',
  'Thane',
  'Nagpur',
  'Nashik',
];

const TYPE_OPTIONS = [
  'All Sectors',
  'highway',
  'rail',
  'irrigation',
  'power',
  'urban',
];

const BAND_OPTIONS = [
  'All Risk Bands',
  'High',
  'Medium',
  'Low',
];

const STAGE_OPTIONS = [
  'All Stages',
  'planning',
  'sia',
  'notification',
  'award',
  'compensation',
  'possession',
  'rr',
];

/**
 * Sector type display formatting & styling
 */
function getSectorBadge(type = '') {
  const norm = type.toLowerCase();
  switch (norm) {
    case 'highway':
      return {
        label: 'Highway',
        color: 'bg-[#291E13] text-[#F4D9A0] border-[#8A4A17]',
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A2 2 0 013 15.488V5.512a2 2 0 011.553-1.954L9 2m0 18l6 3m-6-3V2m6 21l5.447-2.724A2 2 0 0021 18.488V8.512a2 2 0 00-1.553-1.954L15 5m0 16V5m0 0L9 2" />
          </svg>
        ),
      };
    case 'rail':
      return {
        label: 'Rail Corridor',
        color: 'bg-[#18261E] text-[#86EFAC] border-[#255C3A]',
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ),
      };
    case 'irrigation':
      return {
        label: 'Irrigation',
        color: 'bg-[#13232C] text-[#93C5FD] border-[#1E40AF]',
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        ),
      };
    case 'power':
      return {
        label: 'Power Grid',
        color: 'bg-[#2E1E12] text-[#FDE047] border-[#854D0E]',
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ),
      };
    case 'urban':
    default:
      return {
        label: 'Urban Infra',
        color: 'bg-[#2A1F18] text-[#E8DFD3] border-[#5B4632]',
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
      };
  }
}

/**
 * Stage formatting & badge styling
 */
function getStageBadge(stage = '') {
  const norm = stage.toLowerCase();
  const stages = {
    planning: { label: 'Planning', color: 'bg-[#201812] text-[#C4B5A5] border-[#3D2D21]' },
    sia: { label: 'SIA Survey', color: 'bg-[#261E16] text-[#F4D9A0] border-[#5B4632]' },
    notification: { label: 'Notification', color: 'bg-[#271E15] text-[#FDE68A] border-[#8A4A17]' },
    award: { label: 'Award Declared', color: 'bg-[#1C241B] text-[#86EFAC] border-[#255C3A]' },
    compensation: { label: 'Compensation', color: 'bg-[#301C0D] text-[#F4D9A0] border-[#C8792C]' },
    possession: { label: 'Possession', color: 'bg-[#331411] text-[#FCA5A5] border-[#7F261E]' },
    rr: { label: 'R&R Resettlement', color: 'bg-[#281A22] text-[#F472B6] border-[#831843]' },
  };

  return stages[norm] || { label: stage || 'Active', color: 'bg-[#201812] text-[#C4B5A5] border-[#3D2D21]' };
}

/**
 * C5. Project List - Master Land Acquisition Projects Registry
 * - Comprehensive Filter Bar (state, district, type, band, stage, text search)
 * - URL Query State Persistence (useSearchParams)
 * - Sortable Columns (default: risk score descending)
 * - 15 rows pagination with page controls
 * - Row click navigation to /projects/:id
 * - Role-conditional "Create project" action for project_manager
 * - RiskBadge component integration (score + colored band label)
 */
export default function ProjectList() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Extract query params from URL
  const searchFilter = searchParams.get('search') || '';
  const stateFilter = searchParams.get('state') || '';
  const districtFilter = searchParams.get('district') || '';
  const typeFilter = searchParams.get('type') || '';
  const bandFilter = searchParams.get('band') || '';
  const stageFilter = searchParams.get('stage') || '';
  const sortParam = searchParams.get('sort') || DEFAULT_SORT;
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  // Component Data State
  const [allProjects, setAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Local search input buffer for smooth typing
  const [searchInput, setSearchInput] = useState(searchFilter);

  // Keep local search input synchronized if searchParam changes externally
  useEffect(() => {
    setSearchInput(searchFilter);
  }, [searchFilter]);

  // Determine user jurisdiction scope subtitle
  const getScopeSubtitle = () => {
    if (role === 'project_manager') return 'Showing: your projects';
    if (role === 'collector') return `Showing: ${user?.district || 'Pune'} district`;
    return 'Showing: all districts';
  };

  // Helper to update URL search params cleanly
  const updateUrlParams = useCallback((updates) => {
    setSearchParams((prevParams) => {
      const next = new URLSearchParams(prevParams);

      Object.entries(updates).forEach(([key, val]) => {
        if (val === undefined || val === null || val === '' || (key === 'page' && val === 1) || (key === 'sort' && val === DEFAULT_SORT)) {
          next.delete(key);
        } else {
          next.set(key, String(val));
        }
      });

      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Update a single filter field and reset pagination to page 1
  const handleFilterChange = (key, value) => {
    updateUrlParams({
      [key]: value === 'All States' || value === 'All Districts' || value === 'All Sectors' || value === 'All Risk Bands' || value === 'All Stages' ? '' : value,
      page: 1,
    });
  };

  // Submit search query
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    updateUrlParams({ search: searchInput.trim(), page: 1 });
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchInput('');
    setSearchParams({}, { replace: true });
  };

  // Toggle or change sorting column
  const handleSortToggle = (columnKey) => {
    let nextSort = `${columnKey}_asc`;

    if (columnKey === 'risk') {
      nextSort = sortParam === 'risk_desc' ? 'risk_asc' : 'risk_desc';
    } else {
      const currentPrefix = sortParam.replace(/_(asc|desc)$/, '');
      const currentDir = sortParam.endsWith('_desc') ? 'desc' : 'asc';

      if (currentPrefix === columnKey) {
        nextSort = currentDir === 'asc' ? `${columnKey}_desc` : `${columnKey}_asc`;
      } else {
        nextSort = `${columnKey}_asc`;
      }
    }

    updateUrlParams({ sort: nextSort, page: 1 });
  };

  // Fetch projects from backend/mock
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (stateFilter) params.state = stateFilter;
      if (districtFilter) params.district = districtFilter;
      if (typeFilter) params.type = typeFilter;
      if (bandFilter) params.band = bandFilter;
      if (stageFilter) params.stage = stageFilter;
      if (searchFilter) params.search = searchFilter;
      if (sortParam) params.sort = sortParam;

      const data = await getProjects(params);
      let list = Array.isArray(data) ? [...data] : [];

      // If backend doesn't filter text search, guarantee client-side search filtering
      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        list = list.filter((p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.project_id && p.project_id.toLowerCase().includes(q)) ||
          (p.district && p.district.toLowerCase().includes(q)) ||
          (p.top_driver && p.top_driver.toLowerCase().includes(q))
        );
      }

      // If sortParam is non-risk (e.g. name_asc, district_desc, etc.), guarantee client-side sort
      if (sortParam && !sortParam.startsWith('risk_')) {
        const [field, dir] = sortParam.split('_');
        list.sort((a, b) => {
          let valA = a[field] || '';
          let valB = b[field] || '';
          if (field === 'stage') {
            valA = a.current_stage || '';
            valB = b.current_stage || '';
          }
          const cmp = String(valA).localeCompare(String(valB));
          return dir === 'desc' ? -cmp : cmp;
        });
      }

      setAllProjects(list);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError(err.message || 'Failed to retrieve projects from registry');
    } finally {
      setLoading(false);
    }
  }, [stateFilter, districtFilter, typeFilter, bandFilter, stageFilter, searchFilter, sortParam]);

  useEffect(() => {
    document.title = 'Projects Registry | LandSentinel';
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Compute portfolio statistics for quick chips
  const stats = useMemo(() => {
    const total = allProjects.length;
    let high = 0;
    let medium = 0;
    let low = 0;

    allProjects.forEach((p) => {
      const score = p.risk_score || 0;
      if (score > 60 || p.band?.toLowerCase() === 'high') high += 1;
      else if (score >= 30 || p.band?.toLowerCase() === 'medium') medium += 1;
      else low += 1;
    });

    return { total, high, medium, low };
  }, [allProjects]);

  // Count active filters for badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchFilter) count += 1;
    if (stateFilter) count += 1;
    if (districtFilter) count += 1;
    if (typeFilter) count += 1;
    if (bandFilter) count += 1;
    if (stageFilter) count += 1;
    if (sortParam !== DEFAULT_SORT) count += 1;
    return count;
  }, [searchFilter, stateFilter, districtFilter, typeFilter, bandFilter, stageFilter, sortParam]);

  // Pagination calculations (15 rows per page)
  const totalItems = allProjects.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, pageParam), totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const paginatedProjects = useMemo(() => {
    return allProjects.slice(startIndex, endIndex);
  }, [allProjects, startIndex, endIndex]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    updateUrlParams({ page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Helper for column sort indicators
  const renderSortIndicator = (columnKey) => {
    const currentPrefix = sortParam.replace(/_(asc|desc)$/, '');
    const isDesc = sortParam.endsWith('_desc');
    const isActive = currentPrefix === columnKey;

    return (
      <span className={`inline-flex ml-1.5 transition-colors ${isActive ? 'text-[#F4D9A0]' : 'text-[#8E7E70] group-hover:text-[#C4B5A5]'}`}>
        {isActive ? (
          isDesc ? (
            <svg className="w-3.5 h-3.5 text-[#C8792C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-[#C8792C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
            </svg>
          )
        ) : (
          <svg className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        )}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ========================================================
          PAGE HEADER & SCOPE SUBTITLE
          ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(244,217,160,0.12)] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-[#F4D9A0] uppercase tracking-widest bg-[#2A1F18] px-2 py-0.5 rounded border border-[rgba(244,217,160,0.18)]">
              State Land Acquisition Index
            </span>
            <span className="text-xs font-mono text-[#F4D9A0] font-semibold bg-[#201812] px-2 py-0.5 rounded border border-[rgba(244,217,160,0.2)]">
              {getScopeSubtitle()}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-headline text-[#2D1E14] tracking-wide">
            Master Projects Registry
          </h1>
          <p className="text-xs text-[#C4B5A5] mt-1">
            Live telemetry, statutory milestone tracking, composite vulnerability indices, and delay bottleneck diagnostics.
          </p>
        </div>

        {/* Action Controls & Role Gated "Create Project" */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={fetchProjects}
            className="btn-mocha text-xs font-medium"
            title="Reload registry feeds"
          >
            <svg className="w-3.5 h-3.5 text-[#F4D9A0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>

          {/* Create Project Button: Restricted ONLY to project_manager per C5 specification */}
          {role === 'project_manager' && (
            <Link
              to="/projects/new"
              className="btn-amber text-xs font-medium"
              title="Initiate statutory intake for new corridor"
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span>Create Project</span>
            </Link>
          )}
        </div>
      </div>

      {/* ========================================================
          TELEMETRY KPI SUMMARY CHIPS
          ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="peace-card p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-[#C4B5A5]">Filtered Count</span>
            <div className="text-lg font-bold font-mono text-[#F4D9A0]">{totalItems}</div>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#2A1F18] text-[#C4B5A5] border border-[#3D2D21]">
            PAGE {currentPage}/{totalPages}
          </span>
        </div>

        <div className="peace-card p-3 flex items-center justify-between border-l-2 border-l-[#C94A3D]">
          <div>
            <span className="text-[10px] font-mono uppercase text-[#F87171]">High Risk (&gt;60)</span>
            <div className="text-lg font-bold font-mono text-[#F87171]">{stats.high}</div>
          </div>
          <span className="w-2 h-2 rounded-full bg-[#C94A3D] animate-pulse" />
        </div>

        <div className="peace-card p-3 flex items-center justify-between border-l-2 border-l-[#C8792C]">
          <div>
            <span className="text-[10px] font-mono uppercase text-[#F4D9A0]">Medium (30-60)</span>
            <div className="text-lg font-bold font-mono text-[#F4D9A0]">{stats.medium}</div>
          </div>
          <span className="w-2 h-2 rounded-full bg-[#C8792C]" />
        </div>

        <div className="peace-card p-3 flex items-center justify-between border-l-2 border-l-[#4A855A]">
          <div>
            <span className="text-[10px] font-mono uppercase text-[#86EFAC]">Low Risk (&lt;30)</span>
            <div className="text-lg font-bold font-mono text-[#86EFAC]">{stats.low}</div>
          </div>
          <span className="w-2 h-2 rounded-full bg-[#4A855A]" />
        </div>
      </div>

      {/* ========================================================
          FILTER BAR (STATE, DISTRICT, TYPE, BAND, STAGE, SEARCH)
          ======================================================== */}
      <div className="peace-card p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Text Search Input by Name or Project ID */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onBlur={handleSearchSubmit}
              placeholder="Search corridor by name, project ID (e.g. PRJ-0001), district or driver..."
              className="peace-input w-full pl-9 pr-8"
            />
            <svg
              className="w-4 h-4 text-[#8E7E70] absolute left-3 top-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  updateUrlParams({ search: '', page: 1 });
                }}
                className="absolute right-2.5 top-2.5 text-[#8E7E70] hover:text-[#F4D9A0] text-xs font-mono"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </form>

          {/* Quick Active Filters & Reset Button */}
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <span className="text-[11px] font-mono px-2 py-1 rounded bg-[#301C0D] text-[#F4D9A0] border border-[rgba(200,121,44,0.3)]">
                {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} applied
              </span>
            )}
            <button
              type="button"
              onClick={handleResetFilters}
              disabled={activeFiltersCount === 0}
              className="btn-mocha text-xs"
            >
              <svg className="w-3.5 h-3.5 text-[#C4B5A5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Reset Filters</span>
            </button>
          </div>
        </div>

        {/* 5 Dropdown Filters: State, District, Sector, Band, Stage */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
          {/* 1. State Dropdown */}
          <div>
            <label className="block text-[10px] font-mono text-[#C4B5A5] uppercase mb-1">State</label>
            <select
              value={stateFilter || 'All States'}
              onChange={(e) => handleFilterChange('state', e.target.value)}
              className="peace-input w-full"
            >
              {STATE_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* 2. District Dropdown */}
          <div>
            <label className="block text-[10px] font-mono text-[#C4B5A5] uppercase mb-1">District</label>
            <select
              value={districtFilter || 'All Districts'}
              onChange={(e) => handleFilterChange('district', e.target.value)}
              className="peace-input w-full"
            >
              {DISTRICT_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Type / Sector Dropdown */}
          <div>
            <label className="block text-[10px] font-mono text-[#C4B5A5] uppercase mb-1">Sector / Type</label>
            <select
              value={typeFilter || 'All Sectors'}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="peace-input w-full capitalize"
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t === 'All Sectors' ? t : t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Risk Band Dropdown */}
          <div>
            <label className="block text-[10px] font-mono text-[#C4B5A5] uppercase mb-1">Risk Band</label>
            <select
              value={bandFilter || 'All Risk Bands'}
              onChange={(e) => handleFilterChange('band', e.target.value)}
              className="peace-input w-full"
            >
              {BAND_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b === 'All Risk Bands' ? b : `${b} Risk ${b === 'High' ? '(>60)' : b === 'Medium' ? '(30-60)' : '(<30)'}`}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Current Stage Dropdown */}
          <div>
            <label className="block text-[10px] font-mono text-[#C4B5A5] uppercase mb-1">Acquisition Stage</label>
            <select
              value={stageFilter || 'All Stages'}
              onChange={(e) => handleFilterChange('stage', e.target.value)}
              className="peace-input w-full capitalize"
            >
              {STAGE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === 'All Stages' ? s : s.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================
          ERROR STATE NOTIFICATION
          ======================================================== */}
      {error && (
        <ErrorBox
          title="Registry Telemetry Notice"
          message={error}
          onRetry={fetchProjects}
        />
      )}

      {/* ========================================================
          PROJECTS REGISTRY DATA TABLE
          ======================================================== */}
      <div className="peace-card overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-[#C4B5A5] pb-2 border-b border-[rgba(244,217,160,0.1)]">
              <span>Synchronizing statutory project registers...</span>
              <span className="text-[#F4D9A0] animate-pulse">Loading telemetry</span>
            </div>
            <SkeletonTable rows={PAGE_SIZE} cols={6} />
          </div>
        ) : paginatedProjects.length === 0 ? (
          /* Empty Search / Filter State */
          <div className="py-8 px-4">
            <EmptyState
              title="No Matching Projects Found"
              description="No land acquisition corridors match the currently applied combination of filters or search criteria."
              actionLabel="Reset All Filters"
              onAction={handleResetFilters}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#3D2D21] text-[#C4B5A5] font-mono uppercase text-[11px] bg-[#16100C]">
                  {/* Column 1: Project Name & ID (Sortable) */}
                  <th
                    scope="col"
                    onClick={() => handleSortToggle('name')}
                    className="py-3 px-3.5 cursor-pointer select-none group hover:text-[#F4D9A0] transition-colors"
                  >
                    <div className="flex items-center">
                      <span>Project Name</span>
                      {renderSortIndicator('name')}
                    </div>
                  </th>

                  {/* Column 2: District (Sortable) */}
                  <th
                    scope="col"
                    onClick={() => handleSortToggle('district')}
                    className="py-3 px-3.5 cursor-pointer select-none group hover:text-[#F4D9A0] transition-colors"
                  >
                    <div className="flex items-center">
                      <span>District</span>
                      {renderSortIndicator('district')}
                    </div>
                  </th>

                  {/* Column 3: Type / Sector (Sortable) */}
                  <th
                    scope="col"
                    onClick={() => handleSortToggle('type')}
                    className="py-3 px-3.5 cursor-pointer select-none group hover:text-[#F4D9A0] transition-colors"
                  >
                    <div className="flex items-center">
                      <span>Sector</span>
                      {renderSortIndicator('type')}
                    </div>
                  </th>

                  {/* Column 4: Current Stage (Sortable) */}
                  <th
                    scope="col"
                    onClick={() => handleSortToggle('stage')}
                    className="py-3 px-3.5 cursor-pointer select-none group hover:text-[#F4D9A0] transition-colors"
                  >
                    <div className="flex items-center">
                      <span>Current Stage</span>
                      {renderSortIndicator('stage')}
                    </div>
                  </th>

                  {/* Column 5: Risk Score with RiskBadge (Sortable, Default: risk_desc) */}
                  <th
                    scope="col"
                    onClick={() => handleSortToggle('risk')}
                    className="py-3 px-3.5 cursor-pointer select-none group hover:text-[#F4D9A0] transition-colors"
                  >
                    <div className="flex items-center">
                      <span>Risk Score</span>
                      {renderSortIndicator('risk')}
                    </div>
                  </th>

                  {/* Column 6: Top Delay Driver */}
                  <th scope="col" className="py-3 px-3.5">
                    <span>Top Delay Driver</span>
                  </th>

                  {/* Column 7: Action */}
                  <th scope="col" className="py-3 px-3.5 text-right font-mono">
                    <span>Inspect</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#2A1F18]">
                {paginatedProjects.map((prj) => {
                  const sector = getSectorBadge(prj.type);
                  const stage = getStageBadge(prj.current_stage);

                  return (
                    <tr
                      key={prj.project_id}
                      onClick={() => navigate(`/projects/${prj.project_id}`)}
                      className="hover:bg-[#2A1F18] cursor-pointer transition-colors group"
                    >
                      {/* Name & ID */}
                      <td className="py-3.5 px-3.5">
                        <div className="font-semibold text-[#F3EDE2] group-hover:text-[#F4D9A0] transition-colors">
                          {prj.name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-[#F4D9A0] font-medium bg-[#16100C] px-1.5 py-0.2 rounded border border-[rgba(244,217,160,0.15)]">
                            {prj.project_id}
                          </span>
                          {prj.state && (
                            <span className="text-[10px] text-[#8E7E70] font-sans">
                              {prj.state}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* District */}
                      <td className="py-3.5 px-3.5 font-mono text-xs text-[#C4B5A5]">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-[#C8792C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>{prj.district}</span>
                        </div>
                      </td>

                      {/* Type / Sector */}
                      <td className="py-3.5 px-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium capitalize ${sector.color}`}>
                          {sector.icon}
                          <span>{sector.label}</span>
                        </span>
                      </td>

                      {/* Stage */}
                      <td className="py-3.5 px-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider ${stage.color}`}>
                          {stage.label}
                        </span>
                      </td>

                      {/* Risk Score with RiskBadge */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <RiskBadge score={prj.risk_score} band={prj.band} size="md" />
                      </td>

                      {/* Top Driver */}
                      <td className="py-3.5 px-3.5 text-[#E8DFD3] max-w-xs">
                        <div className="flex items-start gap-1.5">
                          <svg className="w-3.5 h-3.5 text-[#C8792C] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className="truncate" title={prj.top_driver}>
                            {prj.top_driver || 'Baseline statutory milestones underway'}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-3.5 text-right font-mono">
                        <span className="inline-flex items-center gap-1 text-[#C8792C] group-hover:text-[#F4D9A0] group-hover:translate-x-0.5 transition-all text-xs font-semibold">
                          <span>Details</span>
                          <span>&rarr;</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================================
            PAGINATION CONTROLS (15 ROWS PER PAGE)
            ======================================================== */}
        {!loading && totalItems > 0 && (
          <div className="p-4 border-t border-[rgba(244,217,160,0.1)] bg-[#16100C] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-[#C4B5A5] font-mono">
              Showing <span className="text-[#F4D9A0] font-semibold">{startIndex + 1}</span> to{' '}
              <span className="text-[#F4D9A0] font-semibold">{endIndex}</span> of{' '}
              <span className="text-[#F4D9A0] font-semibold">{totalItems}</span> corridor projects
            </div>

            <div className="flex items-center gap-1.5 font-mono">
              {/* Previous Button */}
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="px-2.5 py-1.5 rounded bg-[#201812] border border-[rgba(244,217,160,0.14)] text-[#C4B5A5] hover:text-[#F4D9A0] hover:border-[#C8792C] disabled:opacity-40 disabled:hover:text-[#C4B5A5] disabled:hover:border-[rgba(244,217,160,0.14)] disabled:cursor-not-allowed transition-colors"
              >
                &larr; Prev
              </button>

              {/* Page Number Buttons */}
              {[...Array(totalPages)].map((_, idx) => {
                const pageNum = idx + 1;
                const isActive = pageNum === currentPage;

                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => handlePageChange(pageNum)}
                    className={`min-w-[32px] h-8 px-2 rounded font-semibold transition-colors ${
                      isActive
                        ? 'bg-[#C8792C] text-white border border-[#D88636]'
                        : 'bg-[#201812] text-[#C4B5A5] hover:text-[#F4D9A0] border border-[rgba(244,217,160,0.14)] hover:border-[#C8792C]'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Next Button */}
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="px-2.5 py-1.5 rounded bg-[#201812] border border-[rgba(244,217,160,0.14)] text-[#C4B5A5] hover:text-[#F4D9A0] hover:border-[#C8792C] disabled:opacity-40 disabled:hover:text-[#C4B5A5] disabled:hover:border-[rgba(244,217,160,0.14)] disabled:cursor-not-allowed transition-colors"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
