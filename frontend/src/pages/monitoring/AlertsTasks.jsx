import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function AlertsTasks() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6">
      <div className="border-b border-[rgba(244,217,160,0.12)] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#2D1E14] uppercase tracking-widest">
              Administrative Mitigation
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#2A1F18] text-[#F4D9A0] border border-[rgba(244,217,160,0.2)]">
              Person D Integration
            </span>
          </div>
          <h1 className="text-2xl font-bold font-headline text-[#2D1E14] mt-1">
            Active Alerts &amp; Delegated Directives
          </h1>
          <p className="text-xs text-[#C4B5A5] mt-0.5">
            Operational alert telemetry for score surges (&gt;15 pts) and assigned legal mitigation tasks
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/overview')}
          className="btn-outline text-xs self-start sm:self-auto"
        >
          &larr; Return to Overview
        </button>
      </div>

      <div className="peace-card p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-[#201812] border border-[rgba(244,217,160,0.25)] text-[#C8792C] mx-auto flex items-center justify-center font-mono font-bold text-xl">
          ALT
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold font-headline text-[#F4D9A0]">
            Alerts &amp; Tasks Pipeline Provisioned
          </h2>
          <p className="text-xs text-[#C4B5A5] max-w-lg mx-auto leading-relaxed">
            This module is assigned to Person D. It will render real-time alert triage tables and task resolution actions based on Section 3 &amp; 5 of contracts.md.
          </p>
        </div>

        <div className="p-4 bg-[#140F0B] border border-[#3D2D21] rounded text-left font-mono text-xs text-[#C4B5A5] max-w-lg mx-auto space-y-2">
          <div className="text-[11px] text-[#F4D9A0] font-semibold uppercase">
            Contract API Endpoint Specification:
          </div>
          <div>Alerts: <span className="text-white">GET /alerts</span> &bull; <span className="text-white">POST /alerts/&#123;id&#125;/ack</span></div>
          <div>Tasks: <span className="text-white">GET /tasks?mine=true</span> &bull; <span className="text-white">PATCH /tasks/&#123;id&#125;</span></div>
          <div>Status: <span className="text-[#C8792C]">Ready for Person D Component Injection</span></div>
        </div>
      </div>
    </div>
  );
}
