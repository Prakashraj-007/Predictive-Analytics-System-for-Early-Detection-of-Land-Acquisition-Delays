import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuditLog() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6">
      <div className="border-b border-[rgba(244,217,160,0.12)] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#F4D9A0] uppercase tracking-widest">
              Regulatory Verification
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#2A1F18] text-[#F4D9A0] border border-[rgba(244,217,160,0.2)]">
              Admin &amp; Auditor
            </span>
          </div>
          <h1 className="text-2xl font-bold font-headline text-[#F4D9A0] mt-1">
            Statutory Audit Log Ledger
          </h1>
          <p className="text-xs text-[#C4B5A5] mt-0.5">
            Immutable log of all user actions, simulation runs, project updates, and model activations
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
        <div className="w-14 h-14 rounded-full bg-[#201812] border border-[rgba(244,217,160,0.25)] text-[#F4D9A0] mx-auto flex items-center justify-center font-mono font-bold text-xl">
          LOG
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold font-headline text-[#F4D9A0]">
            Audit Ledger Pipeline Provisioned
          </h2>
          <p className="text-xs text-[#C4B5A5] max-w-lg mx-auto leading-relaxed">
            This module is assigned to Person D. It will provide immutable audit trail query filters based on Section 3 &amp; 5 of contracts.md.
          </p>
        </div>

        <div className="p-4 bg-[#140F0B] border border-[#3D2D21] rounded text-left font-mono text-xs text-[#C4B5A5] max-w-lg mx-auto space-y-2">
          <div className="text-[11px] text-[#F4D9A0] font-semibold uppercase">
            Contract API Endpoint Specification:
          </div>
          <div>Endpoint: <span className="text-white">GET /audit?user=&amp;project=&amp;from=&amp;to=</span></div>
          <div>Payload: <span className="text-[#86EFAC]">&#123;log_id, user, action, project_id, timestamp, model_version&#125;</span></div>
          <div>Status: <span className="text-[#C8792C]">Ready for Person D Component Injection</span></div>
        </div>
      </div>
    </div>
  );
}
