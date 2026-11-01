import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NotAllowed({ allowedRoles }) {
  const { user, switchDemoRole, demoUsers } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleRoleSwitch = async (role) => {
    await switchDemoRole(role);
    // Reload current page or navigate back
    navigate(location.pathname, { replace: true });
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4 selection:bg-[#C8792C] selection:text-white">
      <div className="peace-card p-8 max-w-xl w-full text-center space-y-6 border border-[rgba(244,217,160,0.2)]">
        {/* Crest */}
        <div className="w-16 h-16 rounded-full bg-[#2A1814] border border-[#7F261E] text-[#F87171] mx-auto flex items-center justify-center font-mono font-bold text-2xl shadow-inner">
          !
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-mono text-[#F4D9A0] uppercase tracking-widest block">
            Statutory Protocol 403 • Access Restricted
          </span>
          <h1 className="text-2xl font-bold font-headline text-[#F4D9A0]">
            Permission Denied for Current Officer Role
          </h1>
          <p className="text-xs text-[#C4B5A5] max-w-md mx-auto leading-relaxed">
            Your active designated role (
            <span className="font-mono text-[#F4D9A0] font-semibold">{user?.role || 'Unassigned'}</span>
            ) does not hold the statutory administrative authorization mandated for this module under RFCTLARR Act 2013 operational guidelines.
          </p>
        </div>

        {allowedRoles && allowedRoles.length > 0 && (
          <div className="p-3 bg-[#16100C] border border-[rgba(244,217,160,0.12)] rounded text-xs space-y-1">
            <span className="font-mono text-[10px] uppercase text-[#8E7E70] block">
              Statutorily Authorized Roles for this Route:
            </span>
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              {allowedRoles.map((r) => (
                <span
                  key={r}
                  className="px-2 py-0.5 rounded bg-[#2A1F18] text-[#F4D9A0] border border-[rgba(244,217,160,0.25)] font-mono text-[11px]"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Prototype Quick Switch for Authorized Roles */}
        {allowedRoles && allowedRoles.length > 0 && (
          <div className="text-left border-t border-[rgba(244,217,160,0.1)] pt-4 space-y-2">
            <span className="text-[11px] font-mono text-[#C4B5A5] block">
              Switch to an authorized role to evaluate this module:
            </span>
            <div className="flex flex-wrap gap-2">
              {demoUsers
                .filter((du) => allowedRoles.includes(du.role))
                .map((du) => (
                  <button
                    key={du.role}
                    type="button"
                    onClick={() => handleRoleSwitch(du.role)}
                    className="btn-mocha text-xs"
                  >
                    Switch to {du.name} ({du.role})
                  </button>
                ))}
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/overview')}
            className="btn-amber text-xs"
          >
            &larr; Return to Executive Overview
          </button>
        </div>
      </div>
    </div>
  );
}

