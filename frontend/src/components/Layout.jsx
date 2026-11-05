import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import SyntheticNote from './SyntheticNote';
import { useAuth } from '../context/AuthContext';

/**
 * Executive Institutional Layout Shell
 * Theme: "INNER PEACE" Palette
 * - Canvas: Deep Espresso (#140F0B)
 * - Borders: Mocha Brown (#5B4632)
 * - Accent: Champagne Gold (#F4D9A0) & Burnt Amber (#C8792C)
 * - Single-Column Scroll-Down Accessible Architecture (No Left Sidebar)
 * - Dynamic Role-Based Route Filtering (C3 Specification)
 */
export default function Layout() {
  const { user, role, district, fullName, logout, switchDemoRole, demoUsers } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [legalModal, setLegalModal] = useState(null); // 'tos' | 'privacy' | null

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleRoleSelect = async (newRole) => {
    setShowRoleMenu(false);
    await switchDemoRole(newRole);
  };

  const isMainDashboard = location.pathname === '/' || location.pathname === '/overview';

  // Navigate to route directly
  const handleNavClick = (path) => {
    navigate(path);
  };

  // Determine role-based navigation links per C3 specification
  const getNavLinks = () => {
    const currentRole = role || 'project_manager';

    const baseLinks = [
      { id: 'overview', label: 'Overview', path: '/overview' },
      { id: 'projects', label: 'Projects', path: '/projects' },
    ];

    if (currentRole === 'project_manager') {
      return [
        ...baseLinks,
        { id: 'create', label: 'Create Project', path: '/projects/new' },
        { id: 'alerts', label: 'Alerts & Tasks', path: '/alerts', badge: 'Person D' },
        { id: 'what-if', label: 'What-If', path: '/what-if', badge: 'Day 3' },
      ];
    }

    if (currentRole === 'collector') {
      return [
        ...baseLinks,
        { id: 'map', label: 'Map', path: '/map', badge: 'Person D' },
        { id: 'alerts', label: 'Alerts & Tasks', path: '/alerts', badge: 'Person D' },
        { id: 'what-if', label: 'What-If', path: '/what-if', badge: 'Day 3' },
      ];
    }

    if (currentRole === 'policymaker') {
      return [
        ...baseLinks,
        { id: 'map', label: 'Map', path: '/map', badge: 'Person D' },
        { id: 'alerts', label: 'Alerts', path: '/alerts', badge: 'Person D' },
        { id: 'what-if', label: 'What-If', path: '/what-if', badge: 'Day 3' },
      ];
    }

    if (currentRole === 'admin') {
      return [
        ...baseLinks,
        { id: 'map', label: 'Map', path: '/map', badge: 'Person D' },
        { id: 'retrain', label: 'Data & Retrain', path: '/admin/retrain', badge: 'Person D' },
        { id: 'audit', label: 'Audit Log', path: '/audit', badge: 'Person D' },
      ];
    }

    if (currentRole === 'auditor') {
      return [
        ...baseLinks,
        { id: 'audit', label: 'Audit Log', path: '/audit', badge: 'Person D' },
      ];
    }

    return baseLinks;
  };

  const navLinks = getNavLinks();

  // Role display badge styling helper
  const getRoleBadgeStyle = (r) => {
    switch (r) {
      case 'project_manager':
        return 'bg-[#301C0D] text-[#F4D9A0] border-[#C8792C]';
      case 'collector':
        return 'bg-[#292211] text-[#FDE68A] border-[#D97706]';
      case 'policymaker':
        return 'bg-[#182B1E] text-[#86EFAC] border-[#255C3A]';
      case 'admin':
        return 'bg-[#2A1F18] text-[#E8DFD3] border-[#5B4632]';
      case 'auditor':
        return 'bg-[#241B14] text-[#C4B5A5] border-[#3D2D21]';
      default:
        return 'bg-[#201812] text-[#F3EDE2] border-[#3D2D21]';
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-[#F3EDE2] flex flex-col font-sans selection:bg-[#C8792C] selection:text-white">
      {/* Top Sticky Institutional Header */}
      <header className="h-16 bg-[#18120D] border-b border-[rgba(244,217,160,0.14)] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md bg-opacity-95">
        {/* Brand Crest */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded bg-[#2A1F18] flex items-center justify-center font-headline font-bold text-[#F4D9A0] text-base border border-[rgba(244,217,160,0.3)] shadow-inner group-hover:border-[#C8792C] transition-colors">
              LS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-headline font-bold text-lg tracking-wide text-[#F4D9A0]">
                  LandSentinel
                </span>
              </div>
              <div className="text-[10px] text-[#C4B5A5] font-mono tracking-wider uppercase -mt-0.5">
                Predictive Land Acquisition Intelligence
              </div>
            </div>
          </Link>
        </div>

        {/* Top Role-Based Navigation */}
        <nav className="hidden lg:flex items-center gap-1.5 font-medium text-xs text-[#C4B5A5]">
          {navLinks.map((link) => {
            const isActive =
              location.pathname === link.path ||
              (link.path === '/projects' && location.pathname.startsWith('/projects'));

            return (
              <button
                key={link.id}
                type="button"
                onClick={() => handleNavClick(link.path)}
                className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#C8792C] text-white font-semibold'
                    : 'text-[#C4B5A5] hover:text-[#F4D9A0] hover:bg-[#2A1F18]'
                }`}
              >
                <span>{link.label}</span>
                {link.badge && (
                  <span
                    className={`text-[9px] font-mono px-1 py-0.2 rounded border ${
                      isActive
                        ? 'bg-black/30 text-white/90 border-white/20'
                        : 'bg-[#201812] text-[#8E7E70] border-[rgba(244,217,160,0.1)]'
                    }`}
                  >
                    {link.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Identity, Role Switcher & Disclaimer */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex">
            <SyntheticNote compact />
          </div>

          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="flex items-center gap-2.5 px-2.5 sm:px-3 py-1.5 rounded bg-[#201812] border border-[rgba(244,217,160,0.18)] hover:border-[#C8792C] transition-colors text-left"
              >
                <div className="w-6 h-6 rounded bg-[#35271E] text-[#F4D9A0] font-mono text-xs flex items-center justify-center font-bold">
                  {fullName ? fullName.charAt(0) : 'U'}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-[#F3EDE2] leading-tight">
                    {fullName || 'Authorized Officer'}
                  </div>
                  <div className="text-[10px] text-[#C4B5A5] font-mono uppercase tracking-wider flex items-center gap-1">
                    <span className={`px-1 py-0.2 rounded border text-[9px] ${getRoleBadgeStyle(role)}`}>
                      {role}
                    </span>
                    <span>•</span>
                    <span>{district || 'All Districts'}</span>
                  </div>
                </div>
                <svg className="w-3.5 h-3.5 text-[#C4B5A5] ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Role switch dropdown */}
              {showRoleMenu && (
                <div className="absolute right-0 mt-2 w-80 bg-[#1E1611] border border-[rgba(244,217,160,0.25)] rounded-lg shadow-2xl p-2 z-50">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#C4B5A5] px-2 py-1 border-b border-[rgba(244,217,160,0.1)] mb-1 flex items-center justify-between">
                    <span>Statutory Roles</span>
                    <span className="text-[#F4D9A0] text-[10px]">C3 Role Simulator</span>
                  </div>
                  {demoUsers.map((item) => (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => handleRoleSelect(item.role)}
                      className={`w-full text-left p-2 rounded text-xs transition-colors flex flex-col ${
                        role === item.role
                          ? 'bg-[#C8792C] text-white font-medium'
                          : 'text-[#E8DFD3] hover:bg-[#2A1F18]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{item.name}</span>
                        <span className="font-mono text-[9px] uppercase opacity-85 px-1 py-0.2 rounded bg-black/30">
                          {item.role}
                        </span>
                      </div>
                      <span className="text-[11px] opacity-75 mt-0.5">{item.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="text-xs font-mono px-3 py-1.5 rounded bg-[#201812] hover:bg-[#331411] text-[#C4B5A5] hover:text-[#F87171] border border-[rgba(244,217,160,0.14)] hover:border-[#7F261E] transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Single-Column Scroll Down Content Canvas */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-12 min-w-0">
        <Outlet />
      </main>

      {/* Institutional Compliance Footer */}
      <footer className="border-t border-[rgba(244,217,160,0.12)] bg-[#100C09] px-6 py-6 text-xs text-[#8E7E70] space-y-4">
        <div className="max-w-7xl mx-auto flex justify-center">
          <SyntheticNote />
        </div>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-[rgba(244,217,160,0.06)]">
          <div className="flex items-center gap-3">
            <span className="text-[#C4B5A5]">LandSentinel Predictive Intelligence Console</span>
            <span>•</span>
            <span className="font-mono text-[#F4D9A0]">v1.4.2-RF</span>
            <span>•</span>
            <span className="text-[11px] font-mono text-[#8E7E70]">Role: {role}</span>
          </div>

          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setLegalModal('tos')}
              className="hover:text-[#F4D9A0] transition-colors underline font-medium"
            >
              Terms of Statutory Service
            </button>
            <button
              type="button"
              onClick={() => setLegalModal('privacy')}
              className="hover:text-[#F4D9A0] transition-colors underline font-medium"
            >
              Privacy &amp; DPDP Act 2023 Compliance
            </button>
          </div>
        </div>
      </footer>

      {/* Legal Modals */}
      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1E1611] border border-[rgba(244,217,160,0.3)] max-w-lg w-full rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.1)] pb-3">
              <h3 className="text-base font-semibold font-headline text-[#F4D9A0]">
                {legalModal === 'tos' ? 'Terms of Statutory Service' : 'Privacy & DPDP Act 2023 Compliance'}
              </h3>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="text-[#C4B5A5] hover:text-white font-mono text-lg"
              >
                &times;
              </button>
            </div>

            <div className="text-xs text-[#C4B5A5] space-y-3 max-h-80 overflow-y-auto pr-1">
              {legalModal === 'tos' ? (
                <>
                  <p>
                    <strong>1. Authorized Institutional Use Only:</strong> This predictive infrastructure analytics suite is restricted to designated public works authorities, district collectors, and authorized state infrastructure officers.
                  </p>
                  <p>
                    <strong>2. Advisory Decision Support:</strong> AI risk scores, predicted delay timelines, and SHAP attribution metrics constitute predictive risk forecasts. Final administrative actions remain under the statutory jurisdiction of the competent land authority under RFCTLARR Act 2013.
                  </p>
                  <p>
                    <strong>3. Model Inferences & Auditability:</strong> All simulation inputs, model version invocations, and mitigation tasks are immutable and recorded in the cryptographic audit ledger.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <strong>1. Digital Personal Data Protection (DPDP) Act 2023:</strong> In accordance with statutory PII protections, all individual landholder identities are strictly redacted and cryptographically anonymized at source.
                  </p>
                  <p>
                    <strong>2. Zero Landowner PII Retention:</strong> No parcel records contain private citizen names, contact numbers, Aadhaar tokens, or bank account identities. Only survey boundaries and disbursement percentages are processed.
                  </p>
                  <p>
                    <strong>3. Role-Based Access Scoping:</strong> Access to micro-corridors is strictly filtered by administrative district and statutory officer jurisdiction.
                  </p>
                </>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="btn-amber text-xs"
              >
                Acknowledge &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
