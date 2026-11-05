import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getAudit } from '../../api/monitoring';
import Loading from '../../components/Loading';
import ErrorBox from '../../components/ErrorBox';

// Known system users for filter dropdown
const KNOWN_USERS = [
  'pm1',
  'collector1',
  'policymaker1',
  'admin1',
  'auditor1',
];

// Action color mappings
function getActionBadgeStyle(action = '') {
  const norm = action.toUpperCase();
  if (norm.includes('PREDICT')) {
    return 'bg-[#152B1E] text-[#86EFAC] border-[#255C3A]';
  }
  if (norm.includes('CREATE') || norm.includes('UPLOAD')) {
    return 'bg-[#2A2016] text-[#F4D9A0] border-[#8A4A17]';
  }
  if (norm.includes('UPDATE') || norm.includes('ACK')) {
    return 'bg-[#201812] text-[#C4B5A5] border-[rgba(244,217,160,0.2)]';
  }
  if (norm.includes('ACTIVATE') || norm.includes('RETRAIN')) {
    return 'bg-[#2C192E] text-[#F472B6] border-[#831843]';
  }
  return 'bg-[#1E1611] text-[#C4B5A5] border-[rgba(244,217,160,0.15)]';
}

export default function AuditLog() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const currentRole = role || localStorage.getItem('landsentinel_role') || 'auditor';

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [filterUser, setFilterUser] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Pagination state (25 rows per page)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  // Fetch audit records
  const fetchAuditData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAudit({
        user: filterUser,
        project: filterProject,
        from: filterFrom,
        to: filterTo,
      });
      setLogs(Array.isArray(data) ? data : []);
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to query audit trail:', err);
      setError(err.message || 'Unable to retrieve cryptographic audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [filterUser, filterProject, filterFrom, filterTo]);

  // Extract distinct actions for dropdown
  const availableActions = useMemo(() => {
    const set = new Set();
    logs.forEach((l) => {
      if (l.action) set.add(l.action);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Client-side filtering (handles action type and local text filters)
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterAction && log.action !== filterAction) {
        return false;
      }
      return true;
    });
  }, [logs, filterAction]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, currentPage]);

  const handleResetFilters = () => {
    setFilterUser('');
    setFilterProject('');
    setFilterAction('');
    setFilterFrom('');
    setFilterTo('');
    setCurrentPage(1);
  };

  // Browser-side CSV Export
  const handleExportCsv = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      toast.error('No audit records matching current filters to export.');
      return;
    }

    try {
      const headers = ['Log ID', 'Timestamp', 'User', 'Action', 'Project ID', 'Model Version'];
      const rows = filteredLogs.map((log) => [
        `"${log.log_id || ''}"`,
        `"${log.timestamp || ''}"`,
        `"${log.user || ''}"`,
        `"${log.action || ''}"`,
        `"${log.project_id || ''}"`,
        `"${log.model_version || ''}"`,
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `landsentinel_audit_ledger_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${filteredLogs.length} audit records to CSV.`);
    } catch (err) {
      console.error('CSV Export Error:', err);
      toast.error('Failed to export audit CSV.');
    }
  };

  const startIndex = (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage * PAGE_SIZE, filteredLogs.length);

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-4 px-2 sm:px-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(244,217,160,0.12)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#F4D9A0] uppercase tracking-widest">
              Regulatory Accountability
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#201812] text-[#86EFAC] border border-[#255C3A]">
              Immutable Trail
            </span>
          </div>
          <h1 className="text-2xl font-bold font-headline text-[#F4D9A0] mt-1">
            Statutory Audit Log Ledger
          </h1>
          <p className="text-xs text-[#C4B5A5] mt-0.5">
            Cryptographic ledger tracking all model inferences, telemetry updates, directives, and parameter promotions
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* CSV Export Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || filteredLogs.length === 0}
            className="bg-[#C8792C] text-[#140F0B] font-semibold text-xs px-3.5 py-1.5 rounded hover:bg-[#F4D9A0] transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>&darr;</span>
            <span>Export Filtered CSV</span>
          </button>

          <button
            type="button"
            onClick={fetchAuditData}
            disabled={loading}
            className="btn-outline text-xs px-3 py-1.5"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filterable Bar */}
      <div className="peace-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          {/* User Filter */}
          <div className="space-y-1">
            <label className="text-[#C4B5A5] font-medium">User / Role:</label>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full bg-[#140F0B] border border-[rgba(244,217,160,0.2)] rounded px-2.5 py-1.5 text-xs text-[#F4D9A0] focus:outline-none"
            >
              <option value="">All Users</option>
              {KNOWN_USERS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Project ID Filter */}
          <div className="space-y-1">
            <label className="text-[#C4B5A5] font-medium">Project ID:</label>
            <input
              type="text"
              placeholder="e.g. PRJ-0001"
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="w-full bg-[#140F0B] border border-[rgba(244,217,160,0.2)] rounded px-2.5 py-1.5 text-xs text-[#F4D9A0] placeholder-[#8E7E70] focus:outline-none"
            />
          </div>

          {/* Action Type Filter */}
          <div className="space-y-1">
            <label className="text-[#C4B5A5] font-medium">Action Type:</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full bg-[#140F0B] border border-[rgba(244,217,160,0.2)] rounded px-2.5 py-1.5 text-xs text-[#F4D9A0] focus:outline-none"
            >
              <option value="">All Actions</option>
              {availableActions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div className="space-y-1">
            <label className="text-[#C4B5A5] font-medium">From Date:</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="w-full bg-[#140F0B] border border-[rgba(244,217,160,0.2)] rounded px-2.5 py-1.5 text-xs text-[#F4D9A0] focus:outline-none"
            />
          </div>

          {/* To Date */}
          <div className="space-y-1">
            <label className="text-[#C4B5A5] font-medium">To Date:</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="w-full bg-[#140F0B] border border-[rgba(244,217,160,0.2)] rounded px-2.5 py-1.5 text-xs text-[#F4D9A0] focus:outline-none"
            />
          </div>
        </div>

        {/* Filter Summary & Reset */}
        <div className="flex items-center justify-between pt-2 border-t border-[rgba(244,217,160,0.08)]">
          <span className="text-xs font-mono text-[#F4D9A0]">
            Filtered Ledger: <strong className="text-[#F3EDE2]">{filteredLogs.length}</strong> entries
          </span>
          {(filterUser || filterProject || filterAction || filterFrom || filterTo) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-mono text-[#C4B5A5] hover:text-[#F4D9A0] underline"
            >
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && <Loading message="Querying immutable audit log entries..." />}
      {error && !loading && <ErrorBox message={error} onRetry={fetchAuditData} />}

      {/* Audit Log Table */}
      {!loading && !error && (
        <div className="peace-card overflow-hidden space-y-0">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-[#140F0B] border border-[rgba(244,217,160,0.2)] text-[#F4D9A0] mx-auto flex items-center justify-center font-mono">
                &times;
              </div>
              <h3 className="text-sm font-bold text-[#F4D9A0]">No Audit Trail Records Match Criteria</h3>
              <p className="text-xs text-[#C4B5A5]">
                Adjust or clear your search parameters to view historical system log records.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[rgba(244,217,160,0.18)] bg-[#140F0B] text-[#8E7E70] font-mono">
                      <th className="py-3 px-4">Timestamp (UTC)</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Project ID</th>
                      <th className="py-3 px-4">Model Ver.</th>
                      <th className="py-3 px-4 text-right">Log ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(244,217,160,0.08)]">
                    {paginatedLogs.map((log) => {
                      const isPredict = (log.action || '').toUpperCase().includes('PREDICT');
                      const badgeClass = getActionBadgeStyle(log.action);

                      return (
                        <tr
                          key={log.log_id}
                          className="hover:bg-[#140F0B]/40 transition-colors font-sans"
                        >
                          {/* Timestamp */}
                          <td className="py-3 px-4 font-mono text-[#C4B5A5] whitespace-nowrap">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                          </td>

                          {/* User */}
                          <td className="py-3 px-4 font-mono font-medium text-[#F3EDE2]">
                            <span className="px-2 py-0.5 rounded bg-[#140F0B] border border-[rgba(244,217,160,0.15)]">
                              {log.user}
                            </span>
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4">
                            <span
                              className={`font-mono text-[10px] px-2 py-0.5 rounded font-semibold border ${badgeClass}`}
                            >
                              {log.action}
                            </span>
                          </td>

                          {/* Project */}
                          <td className="py-3 px-4 font-mono">
                            {log.project_id ? (
                              <Link
                                to={`/projects/${log.project_id}`}
                                className="text-[#F4D9A0] hover:underline"
                              >
                                {log.project_id}
                              </Link>
                            ) : (
                              <span className="text-[#8E7E70]">—</span>
                            )}
                          </td>

                          {/* Model Version */}
                          <td className="py-3 px-4 font-mono">
                            {log.model_version || (isPredict ? 'v1' : null) ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-[#152B1E] text-[#86EFAC] border border-[#255C3A]">
                                {log.model_version || 'v1'}
                              </span>
                            ) : (
                              <span className="text-[#8E7E70]">—</span>
                            )}
                          </td>

                          {/* Log ID */}
                          <td className="py-3 px-4 text-right font-mono text-[#8E7E70]">
                            {log.log_id}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controller */}
              <div className="p-4 bg-[#140F0B] border-t border-[rgba(244,217,160,0.12)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-mono text-[#C4B5A5]">
                  Showing <strong className="text-[#F3EDE2]">{startIndex}</strong> -{' '}
                  <strong className="text-[#F3EDE2]">{endIndex}</strong> of{' '}
                  <strong className="text-[#F3EDE2]">{filteredLogs.length}</strong> records
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn-outline text-xs px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    &larr; Previous
                  </button>

                  <span className="text-xs font-mono text-[#F4D9A0] px-2">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-outline text-xs px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
