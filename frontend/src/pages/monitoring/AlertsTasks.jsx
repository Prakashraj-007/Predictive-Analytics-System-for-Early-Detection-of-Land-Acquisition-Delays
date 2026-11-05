import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getAlerts, ackAlert, createTask, getTasks, updateTask } from '../../api/monitoring';
import { getProjectPrediction } from '../../api/projects';
import RiskBadge from '../../components/RiskBadge';
import Loading from '../../components/Loading';
import ErrorBox from '../../components/ErrorBox';

// Fallback recommendation actions if project prediction has none loaded
const DEFAULT_RECOMMENDATIONS = [
  'Escalate the cases to the legal cell, consider a special Lok Adalat and seek early hearings.',
  'Release pending funds and hold payment camps for landowners.',
  'Escalate to the department head and set a deadline for the pending approval.',
  'Run a documentation drive and verify land records.',
  'Plan an eviction and clearance drive with the local administration.',
  'Hold a joint hearing with the revenue officer and speed up mutation of disputed parcels.',
];

// Demo user assignees
const ASSIGNEES = [
  { id: 'pm1', label: 'pm1 — Project Manager (Pune / Central)' },
  { id: 'collector1', label: 'collector1 — District Collector' },
  { id: 'policymaker1', label: 'policymaker1 — State Infrastructure Department' },
  { id: 'admin1', label: 'admin1 — System Administrator' },
];

function formatTimeAgo(isoDate) {
  if (!isoDate) return 'Recently';
  try {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 1) return `${diffDay} days ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffHour > 1) return `${diffHour} hours ago`;
    if (diffHour === 1) return '1 hour ago';
    if (diffMin > 1) return `${diffMin} min ago`;
    return 'Just now';
  } catch {
    return 'Recently';
  }
}

export default function AlertsTasks() {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const currentRole = role || localStorage.getItem('landsentinel_role') || 'project_manager';

  const [activeTab, setActiveTab] = useState('alerts'); // 'alerts' | 'tasks'
  const [alerts, setAlerts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters for alerts
  const [alertSeverity, setAlertSeverity] = useState('all'); // 'all' | 'High' | 'Medium'
  const [alertStatus, setAlertStatus] = useState('all'); // 'all' | 'active' | 'acknowledged'
  const [alertSearch, setAlertSearch] = useState('');

  // Filters for tasks
  const [taskFilterStatus, setTaskFilterStatus] = useState('all'); // 'all' | 'open' | 'done'
  const [taskScope, setTaskScope] = useState(
    currentRole === 'project_manager' ? 'mine' : 'assignedByMe'
  );

  // Assign Task Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [recommendedActions, setRecommendedActions] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [selectedAction, setSelectedAction] = useState('');
  const [customAction, setCustomAction] = useState('');
  const [assignedTo, setAssignedTo] = useState('pm1');
  const [deadline, setDeadline] = useState('');
  const [submittingTask, setSubmittingTask] = useState(false);

  // Complete Task Modal State
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState(null);
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [submittingComplete, setSubmittingComplete] = useState(false);

  // Initial Data Fetch
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [alertsData, tasksData] = await Promise.all([
        getAlerts().catch((err) => {
          console.warn('Failed to fetch alerts:', err);
          return [];
        }),
        getTasks().catch((err) => {
          console.warn('Failed to fetch tasks:', err);
          return [];
        }),
      ]);

      setAlerts(Array.isArray(alertsData) ? alertsData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (err) {
      console.error('Failed to load alerts & tasks:', err);
      setError(err.message || 'Unable to retrieve monitoring telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Alerts List
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      // Role scoping: PM only sees own projects
      if (currentRole === 'project_manager' && a.created_by && a.created_by !== user?.user_id) {
        // In prototype, allow PM to view alerts relevant to their projects
      }

      // Severity filter
      if (alertSeverity !== 'all') {
        const isHigh = a.risk_score > 60 || a.severity === 'High';
        if (alertSeverity === 'High' && !isHigh) return false;
        if (alertSeverity === 'Medium' && isHigh) return false;
      }

      // Status filter
      if (alertStatus !== 'all') {
        const normStatus = (a.status || 'active').toLowerCase();
        if (alertStatus.toLowerCase() !== normStatus) return false;
      }

      // Search filter
      if (alertSearch.trim()) {
        const q = alertSearch.toLowerCase();
        const nameMatch = (a.project_name || '').toLowerCase().includes(q);
        const reasonMatch = (a.reason || '').toLowerCase().includes(q);
        const prjIdMatch = (a.project_id || '').toLowerCase().includes(q);
        const distMatch = (a.district || '').toLowerCase().includes(q);
        if (!nameMatch && !reasonMatch && !prjIdMatch && !distMatch) return false;
      }

      return true;
    });
  }, [alerts, alertSeverity, alertStatus, alertSearch, currentRole, user]);

  // Filtered Tasks List
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Status filter
      if (taskFilterStatus === 'open' && t.status === 'done') return false;
      if (taskFilterStatus === 'done' && t.status !== 'done') return false;

      // Scope filter
      if (currentRole === 'project_manager') {
        return t.assigned_to === 'pm1' || t.assigned_to === user?.user_id;
      }

      if (taskScope === 'mine') {
        return t.assigned_to === 'collector1' || t.assigned_to === user?.user_id;
      }
      if (taskScope === 'assignedByMe') {
        return t.assigned_by === 'collector1' || t.assigned_by === 'policymaker1' || t.assigned_by === currentRole;
      }

      return true;
    });
  }, [tasks, taskFilterStatus, taskScope, currentRole, user]);

  // Handle Acknowledge Alert
  const handleAcknowledge = async (alertId) => {
    try {
      await ackAlert(alertId);
      setAlerts((prev) =>
        prev.map((a) =>
          a.alert_id === alertId ? { ...a, status: 'acknowledged' } : a
        )
      );
      toast.success(`Alert ${alertId} acknowledged.`);
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
      toast.error('Failed to acknowledge alert.');
    }
  };

  // Open Assign Task Modal
  const handleOpenAssignModal = async (alertItem) => {
    setSelectedAlert(alertItem);
    setSelectedAction('');
    setCustomAction('');
    setAssignedTo('pm1');

    // Default deadline to 14 days from now
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setDeadline(d.toISOString().split('T')[0]);

    setAssignModalOpen(true);
    setLoadingRecommendations(true);

    try {
      const pred = await getProjectPrediction(alertItem.project_id);
      if (pred && Array.isArray(pred.recommendations) && pred.recommendations.length > 0) {
        const recList = pred.recommendations.map((r) => r.action);
        setRecommendedActions(recList);
        setSelectedAction(recList[0] || '');
      } else {
        setRecommendedActions(DEFAULT_RECOMMENDATIONS.slice(0, 3));
        setSelectedAction(DEFAULT_RECOMMENDATIONS[0]);
      }
    } catch (err) {
      console.warn('Could not fetch project prediction recommendations:', err);
      setRecommendedActions(DEFAULT_RECOMMENDATIONS.slice(0, 3));
      setSelectedAction(DEFAULT_RECOMMENDATIONS[0]);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Submit Assign Task
  const handleAssignTaskSubmit = async (e) => {
    e.preventDefault();
    const finalAction = selectedAction === '__custom__' ? customAction.trim() : selectedAction;
    if (!finalAction) {
      toast.error('Please specify an action for the task directive.');
      return;
    }
    if (!deadline) {
      toast.error('Please select a deadline date.');
      return;
    }

    try {
      setSubmittingTask(true);
      const res = await createTask({
        project_id: selectedAlert.project_id,
        project_name: selectedAlert.project_name,
        assigned_to: assignedTo,
        action: finalAction,
        deadline: deadline,
      });

      const newTaskId = res?.task_id || `TSK-${Date.now()}`;
      const createdTask = {
        task_id: newTaskId,
        project_id: selectedAlert.project_id,
        project_name: selectedAlert.project_name,
        action: finalAction,
        assigned_by: currentRole,
        assigned_to: assignedTo,
        deadline: deadline,
        status: 'assigned',
        remarks: null,
      };

      setTasks((prev) => [createdTask, ...prev]);
      toast.success(`Task ${newTaskId} assigned to ${assignedTo}.`);
      setAssignModalOpen(false);
    } catch (err) {
      console.error('Failed to create task directive:', err);
      toast.error('Failed to create task directive.');
    } finally {
      setSubmittingTask(false);
    }
  };

  // Open Complete Task Modal
  const handleOpenCompleteModal = (taskItem) => {
    setTaskToComplete(taskItem);
    setCompletionRemarks('');
    setCompleteModalOpen(true);
  };

  // Submit Complete Task
  const handleCompleteTaskSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmittingComplete(true);
      await updateTask(taskToComplete.task_id, {
        status: 'done',
        remarks: completionRemarks.trim() || 'Directive successfully addressed by field team.',
      });

      setTasks((prev) =>
        prev.map((t) =>
          t.task_id === taskToComplete.task_id
            ? {
                ...t,
                status: 'done',
                remarks: completionRemarks.trim() || 'Directive successfully addressed by field team.',
              }
            : t
        )
      );

      toast.success(`Task ${taskToComplete.task_id} marked as completed.`);
      setCompleteModalOpen(false);
    } catch (err) {
      console.error('Failed to mark task completed:', err);
      toast.error('Failed to update task.');
    } finally {
      setSubmittingComplete(false);
    }
  };

  const activeAlertsCount = alerts.filter((a) => (a.status || 'active').toLowerCase() === 'active').length;
  const openTasksCount = tasks.filter((t) => t.status !== 'done').length;

  // Role permissions
  const canAssignTask = currentRole === 'collector' || currentRole === 'policymaker' || currentRole === 'admin';
  const isAuditor = currentRole === 'auditor';

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-4 px-2 sm:px-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(244,217,160,0.12)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#F4D9A0] uppercase tracking-widest">
              Administrative Mitigation
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#201812] text-[#F4D9A0] border border-[rgba(244,217,160,0.25)]">
              Role: {currentRole}
            </span>
          </div>
          <h1 className="text-2xl font-bold font-headline text-[#F4D9A0] mt-1">
            Active Alerts &amp; Delegated Directives
          </h1>
          <p className="text-xs text-[#C4B5A5] mt-0.5">
            Operational alert triage for delay risk surges (&ge;15 pts / &gt;60) and accountability directives
          </p>
        </div>

        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="btn-outline text-xs self-start sm:self-auto"
        >
          {loading ? 'Refreshing...' : 'Refresh Telemetry'}
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-[rgba(244,217,160,0.18)] gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('alerts')}
          className={`pb-3 px-4 font-headline text-sm font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === 'alerts'
              ? 'text-[#F4D9A0] border-b-2 border-[#C8792C]'
              : 'text-[#C4B5A5] hover:text-[#F3EDE2]'
          }`}
        >
          <span>System Alerts</span>
          <span
            className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
              activeAlertsCount > 0
                ? 'bg-[#331411] text-[#F87171] border border-[#7F261E]'
                : 'bg-[#1E1611] text-[#86EFAC]'
            }`}
          >
            {activeAlertsCount} active
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className={`pb-3 px-4 font-headline text-sm font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === 'tasks'
              ? 'text-[#F4D9A0] border-b-2 border-[#C8792C]'
              : 'text-[#C4B5A5] hover:text-[#F3EDE2]'
          }`}
        >
          <span>Corrective Tasks</span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#301C0D] text-[#F4D9A0] border border-[#8A4A17]">
            {openTasksCount} open
          </span>
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && <Loading message="Loading operational alerts and task directives..." />}
      {error && !loading && <ErrorBox message={error} onRetry={fetchData} />}

      {/* TAB 1: ALERTS */}
      {!loading && !error && activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="peace-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter by project or reason..."
                  value={alertSearch}
                  onChange={(e) => setAlertSearch(e.target.value)}
                  className="bg-[#140F0B] border border-[rgba(244,217,160,0.2)] rounded px-3 py-1.5 text-xs text-[#F4D9A0] placeholder-[#8E7E70] w-64 focus:outline-none focus:border-[#F4D9A0]"
                />
                {alertSearch && (
                  <button
                    type="button"
                    onClick={() => setAlertSearch('')}
                    className="absolute right-2 top-1.5 text-xs text-[#8E7E70] hover:text-[#F4D9A0]"
                  >
                    &times;
                  </button>
                )}
              </div>

              {/* Severity Filter */}
              <div className="flex items-center gap-1.5 text-xs text-[#C4B5A5]">
                <span>Severity:</span>
                <select
                  value={alertSeverity}
                  onChange={(e) => setAlertSeverity(e.target.value)}
                  className="bg-[#140F0B] border border-[rgba(244,217,160,0.2)] rounded px-2.5 py-1.5 text-xs text-[#F4D9A0] focus:outline-none"
                >
                  <option value="all">All Severities</option>
                  <option value="High">High (&gt;60)</option>
                  <option value="Medium">Medium (30-60)</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 text-xs text-[#C4B5A5]">
                <span>Status:</span>
                <select
                  value={alertStatus}
                  onChange={(e) => setAlertStatus(e.target.value)}
                  className="bg-[#140F0B] border border-[rgba(244,217,160,0.2)] rounded px-2.5 py-1.5 text-xs text-[#F4D9A0] focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="acknowledged">Acknowledged Only</option>
                </select>
              </div>
            </div>

            <span className="text-xs font-mono text-[#F4D9A0] self-end md:self-auto">
              Showing <strong className="text-[#F3EDE2]">{filteredAlerts.length}</strong> of{' '}
              <strong className="text-[#F3EDE2]">{alerts.length}</strong> alerts
            </span>
          </div>

          {/* Alerts List Table / Cards */}
          {filteredAlerts.length === 0 ? (
            <div className="peace-card p-10 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-[#140F0B] border border-[rgba(244,217,160,0.2)] text-[#86EFAC] mx-auto flex items-center justify-center font-mono">
                &check;
              </div>
              <h3 className="text-sm font-bold text-[#F4D9A0]">No Alerts Match Active Criteria</h3>
              <p className="text-xs text-[#C4B5A5]">
                All corridor telemetry indicators are currently within acceptable risk margins.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map((alert) => {
                const isHigh = alert.risk_score > 60 || alert.severity === 'High';
                const isAck = (alert.status || 'active').toLowerCase() === 'acknowledged';
                const hasScoreDelta = alert.previous_score !== undefined && alert.previous_score !== null;
                const delta = hasScoreDelta ? alert.risk_score - alert.previous_score : 0;

                return (
                  <div
                    key={alert.alert_id}
                    className={`peace-card p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isAck ? 'opacity-70 bg-[#16100C]' : 'border-l-4 ' + (isHigh ? 'border-l-[#C94A3D]' : 'border-l-[#C8792C]')
                    }`}
                  >
                    {/* Left: Project & Reason */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-[#C4B5A5]">
                          {alert.alert_id}
                        </span>
                        {alert.district && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#140F0B] text-[#F4D9A0] border border-[rgba(244,217,160,0.15)]">
                            {alert.district}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                            isHigh
                              ? 'bg-[#331411] text-[#F87171] border border-[#7F261E]'
                              : 'bg-[#301C0D] text-[#F4D9A0] border border-[#8A4A17]'
                          }`}
                        >
                          {isHigh ? 'HIGH SEVERITY' : 'MEDIUM SEVERITY'}
                        </span>
                        <span className="text-[11px] text-[#8E7E70]">
                          &bull; {formatTimeAgo(alert.created_at)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/projects/${alert.project_id}`}
                          className="font-headline font-bold text-sm text-[#F3EDE2] hover:text-[#F4D9A0] transition-colors underline decoration-[rgba(244,217,160,0.3)]"
                        >
                          {alert.project_name || alert.project_id}
                        </Link>
                      </div>

                      <p className="text-xs text-[#C4B5A5] leading-relaxed">
                        {alert.reason}
                      </p>
                    </div>

                    {/* Middle: Score & Surge Delta */}
                    <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-[rgba(244,217,160,0.12)] pt-3 md:pt-0 md:pl-4">
                      <div className="text-right">
                        <div className="text-[10px] font-mono text-[#8E7E70] uppercase">
                          Risk Score
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <RiskBadge score={alert.risk_score} size="sm" />
                          {hasScoreDelta && (
                            <span
                              className={`text-[11px] font-mono font-semibold ${
                                delta > 0 ? 'text-[#F87171]' : 'text-[#86EFAC]'
                              }`}
                            >
                              {delta > 0 ? `+${delta}` : delta}
                            </span>
                          )}
                        </div>
                        {hasScoreDelta && (
                          <div className="text-[10px] font-mono text-[#8E7E70]">
                            from {alert.previous_score}
                          </div>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        {/* Acknowledge Button */}
                        {!isAuditor && (
                          <button
                            type="button"
                            onClick={() => handleAcknowledge(alert.alert_id)}
                            disabled={isAck}
                            className={`text-xs px-3 py-1.5 rounded transition-all font-mono font-medium ${
                              isAck
                                ? 'bg-[#140F0B] text-[#8E7E70] border border-[rgba(244,217,160,0.1)] cursor-default'
                                : 'bg-[#1E1611] text-[#F4D9A0] border border-[rgba(244,217,160,0.25)] hover:border-[#F4D9A0]'
                            }`}
                          >
                            {isAck ? 'Acknowledged' : 'Acknowledge'}
                          </button>
                        )}

                        {/* Assign Directive Button (Collector, Policymaker, Admin only) */}
                        {canAssignTask && (
                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal(alert)}
                            className="bg-[#C8792C] text-[#140F0B] font-semibold text-xs px-3 py-1.5 rounded hover:bg-[#F4D9A0] transition-colors whitespace-nowrap"
                          >
                            Assign Task &rarr;
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TASKS */}
      {!loading && !error && activeTab === 'tasks' && (
        <div className="space-y-4">
          {/* Tasks Filters & Scope */}
          <div className="peace-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Task Scope toggle for Collector/Policymaker */}
              {currentRole !== 'project_manager' && !isAuditor && (
                <div className="flex items-center gap-1.5 bg-[#140F0B] border border-[rgba(244,217,160,0.18)] rounded p-0.5">
                  <button
                    type="button"
                    onClick={() => setTaskScope('assignedByMe')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      taskScope === 'assignedByMe'
                        ? 'bg-[#C8792C] text-[#140F0B] font-semibold'
                        : 'text-[#C4B5A5] hover:text-[#F3EDE2]'
                    }`}
                  >
                    Assigned by Me
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskScope('all')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      taskScope === 'all'
                        ? 'bg-[#C8792C] text-[#140F0B] font-semibold'
                        : 'text-[#C4B5A5] hover:text-[#F3EDE2]'
                    }`}
                  >
                    All Directives
                  </button>
                </div>
              )}

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 text-xs text-[#C4B5A5]">
                <span>Status:</span>
                <select
                  value={taskFilterStatus}
                  onChange={(e) => setTaskFilterStatus(e.target.value)}
                  className="bg-[#140F0B] border border-[rgba(244,217,160,0.2)] rounded px-2.5 py-1.5 text-xs text-[#F4D9A0] focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open / Pending</option>
                  <option value="done">Completed Only</option>
                </select>
              </div>
            </div>

            <span className="text-xs font-mono text-[#F4D9A0]">
              Showing <strong className="text-[#F3EDE2]">{filteredTasks.length}</strong> of{' '}
              <strong className="text-[#F3EDE2]">{tasks.length}</strong> directives
            </span>
          </div>

          {/* Tasks List */}
          {filteredTasks.length === 0 ? (
            <div className="peace-card p-10 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-[#140F0B] border border-[rgba(244,217,160,0.2)] text-[#F4D9A0] mx-auto flex items-center justify-center font-mono">
                &times;
              </div>
              <h3 className="text-sm font-bold text-[#F4D9A0]">No Corrective Directives Found</h3>
              <p className="text-xs text-[#C4B5A5]">
                {currentRole === 'project_manager'
                  ? 'No open directives are currently assigned to your portfolio.'
                  : 'No directives match the selected filter criteria.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => {
                const isDone = task.status === 'done';
                const todayStr = new Date().toISOString().split('T')[0];
                const isOverdue = !isDone && task.deadline && task.deadline < todayStr;

                return (
                  <div
                    key={task.task_id}
                    className={`peace-card p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isDone ? 'opacity-70 bg-[#16100C]' : 'border-l-4 border-l-[#C8792C]'
                    }`}
                  >
                    {/* Left: Action & Details */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-[#C4B5A5]">
                          {task.task_id}
                        </span>
                        <Link
                          to={`/projects/${task.project_id}`}
                          className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#140F0B] text-[#F4D9A0] border border-[rgba(244,217,160,0.15)] hover:border-[#F4D9A0]"
                        >
                          {task.project_name || task.project_id}
                        </Link>
                        {isOverdue && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#331411] text-[#F87171] border border-[#7F261E] font-semibold animate-pulse">
                            OVERDUE
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                            isDone
                              ? 'bg-[#152B1E] text-[#86EFAC] border border-[#255C3A]'
                              : 'bg-[#301C0D] text-[#F4D9A0] border border-[#8A4A17]'
                          }`}
                        >
                          {isDone ? 'COMPLETED' : task.status ? task.status.toUpperCase() : 'ASSIGNED'}
                        </span>
                      </div>

                      <h4 className="font-headline font-bold text-sm text-[#F3EDE2] leading-snug">
                        {task.action}
                      </h4>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#C4B5A5] pt-0.5">
                        <span>
                          Assigned to: <strong className="text-[#F3EDE2]">{task.assigned_to}</strong>
                        </span>
                        <span>&bull;</span>
                        <span>
                          By: <strong className="text-[#F3EDE2]">{task.assigned_by || 'Authority'}</strong>
                        </span>
                      </div>

                      {task.remarks && (
                        <div className="mt-2 p-2 bg-[#140F0B] border border-[rgba(244,217,160,0.1)] rounded text-xs text-[#C4B5A5] font-mono">
                          <span className="text-[#F4D9A0] font-semibold">Remarks:</span> {task.remarks}
                        </div>
                      )}
                    </div>

                    {/* Right: Deadline & Action Button */}
                    <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-[rgba(244,217,160,0.12)] pt-3 md:pt-0 md:pl-4">
                      <div className="text-right">
                        <div className="text-[10px] font-mono text-[#8E7E70] uppercase">
                          Target Deadline
                        </div>
                        <div
                          className={`font-mono text-xs font-semibold mt-0.5 ${
                            isOverdue ? 'text-[#F87171]' : 'text-[#F3EDE2]'
                          }`}
                        >
                          {task.deadline || 'No deadline'}
                        </div>
                      </div>

                      {/* Project Manager Mark Completed Button */}
                      {!isDone && (currentRole === 'project_manager' || currentRole === 'admin') && (
                        <button
                          type="button"
                          onClick={() => handleOpenCompleteModal(task)}
                          className="bg-[#152B1E] text-[#86EFAC] border border-[#255C3A] hover:bg-[#1E3B29] text-xs font-medium px-3 py-1.5 rounded transition-all whitespace-nowrap"
                        >
                          Mark Completed &check;
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ASSIGN TASK MODAL */}
      {assignModalOpen && selectedAlert && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="peace-card max-w-lg w-full p-6 space-y-4 bg-[#1E1611] border border-[rgba(244,217,160,0.28)] shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-[rgba(244,217,160,0.15)] pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#C8792C] uppercase tracking-wider">
                  Delegated Directive
                </span>
                <h3 className="text-base font-headline font-bold text-[#F4D9A0]">
                  Assign Corrective Task
                </h3>
                <p className="text-xs text-[#C4B5A5] mt-0.5">
                  {selectedAlert.project_name} ({selectedAlert.project_id})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="text-[#C4B5A5] hover:text-[#F4D9A0] text-lg font-mono"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAssignTaskSubmit} className="space-y-4">
              {/* Recommended Action Selection */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#F3EDE2] flex items-center justify-between">
                  <span>Directive Action (ML Recommended):</span>
                  {loadingRecommendations && (
                    <span className="text-[10px] font-mono text-[#F4D9A0]">Loading...</span>
                  )}
                </label>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {recommendedActions.map((actionText, idx) => (
                    <label
                      key={idx}
                      className={`block p-2.5 rounded border text-xs cursor-pointer transition-all ${
                        selectedAction === actionText
                          ? 'bg-[#2E231A] border-[#C8792C] text-[#F3EDE2]'
                          : 'bg-[#140F0B] border-[rgba(244,217,160,0.12)] text-[#C4B5A5] hover:border-[rgba(244,217,160,0.25)]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="directive-action"
                          value={actionText}
                          checked={selectedAction === actionText}
                          onChange={() => setSelectedAction(actionText)}
                          className="mt-0.5 text-[#C8792C] focus:ring-0"
                        />
                        <span className="leading-snug">{actionText}</span>
                      </div>
                    </label>
                  ))}

                  {/* Custom Action Radio */}
                  <label
                    className={`block p-2.5 rounded border text-xs cursor-pointer transition-all ${
                      selectedAction === '__custom__'
                        ? 'bg-[#2E231A] border-[#C8792C] text-[#F3EDE2]'
                        : 'bg-[#140F0B] border-[rgba(244,217,160,0.12)] text-[#C4B5A5]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="directive-action"
                        value="__custom__"
                        checked={selectedAction === '__custom__'}
                        onChange={() => setSelectedAction('__custom__')}
                        className="mt-0.5 text-[#C8792C] focus:ring-0"
                      />
                      <span>Custom action instructions...</span>
                    </div>
                  </label>
                </div>

                {selectedAction === '__custom__' && (
                  <textarea
                    rows={3}
                    placeholder="Describe specific field directive or administrative order..."
                    value={customAction}
                    onChange={(e) => setCustomAction(e.target.value)}
                    className="w-full bg-[#140F0B] border border-[rgba(244,217,160,0.25)] rounded p-2.5 text-xs text-[#F4D9A0] placeholder-[#8E7E70] focus:outline-none focus:border-[#F4D9A0]"
                    required
                  />
                )}
              </div>

              {/* Assignee & Deadline Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-[#C4B5A5]">Assignee:</label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full bg-[#140F0B] border border-[rgba(244,217,160,0.2)] rounded px-3 py-1.5 text-xs text-[#F4D9A0] focus:outline-none"
                  >
                    {ASSIGNEES.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#C4B5A5]">Deadline:</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-[#140F0B] border border-[rgba(244,217,160,0.2)] rounded px-3 py-1.5 text-xs text-[#F4D9A0] focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgba(244,217,160,0.12)]">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="btn-outline text-xs px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTask}
                  className="bg-[#C8792C] text-[#140F0B] font-semibold text-xs px-4 py-1.5 rounded hover:bg-[#F4D9A0] transition-colors"
                >
                  {submittingTask ? 'Assigning...' : 'Confirm Directive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLETE TASK MODAL */}
      {completeModalOpen && taskToComplete && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="peace-card max-w-md w-full p-6 space-y-4 bg-[#1E1611] border border-[rgba(244,217,160,0.28)] shadow-2xl">
            <div className="flex items-start justify-between border-b border-[rgba(244,217,160,0.15)] pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#86EFAC] uppercase tracking-wider">
                  Task Completion
                </span>
                <h3 className="text-base font-headline font-bold text-[#F4D9A0]">
                  Mark Directive Completed
                </h3>
                <p className="text-xs text-[#C4B5A5] mt-0.5">
                  {taskToComplete.task_id} &bull; {taskToComplete.project_name || taskToComplete.project_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCompleteModalOpen(false)}
                className="text-[#C4B5A5] hover:text-[#F4D9A0] text-lg font-mono"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCompleteTaskSubmit} className="space-y-4">
              <div className="p-3 bg-[#140F0B] border border-[rgba(244,217,160,0.1)] rounded text-xs text-[#F3EDE2] font-mono leading-relaxed">
                {taskToComplete.action}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#C4B5A5]">
                  Resolution Remarks &amp; Evidence:
                </label>
                <textarea
                  rows={3}
                  placeholder="Record hearings conducted, Lok Adalat orders, disbursements cleared or camp dates..."
                  value={completionRemarks}
                  onChange={(e) => setCompletionRemarks(e.target.value)}
                  className="w-full bg-[#140F0B] border border-[rgba(244,217,160,0.2)] rounded p-2.5 text-xs text-[#F4D9A0] placeholder-[#8E7E70] focus:outline-none focus:border-[#F4D9A0]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgba(244,217,160,0.12)]">
                <button
                  type="button"
                  onClick={() => setCompleteModalOpen(false)}
                  className="btn-outline text-xs px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingComplete}
                  className="bg-[#152B1E] text-[#86EFAC] border border-[#255C3A] font-semibold text-xs px-4 py-1.5 rounded hover:bg-[#1E3B29] transition-colors"
                >
                  {submittingComplete ? 'Saving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
