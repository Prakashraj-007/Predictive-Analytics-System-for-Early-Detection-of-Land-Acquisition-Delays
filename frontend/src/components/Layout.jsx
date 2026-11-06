import React, { useState, useRef, useEffect } from 'react';
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

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [legalModal, setLegalModal] = useState(null); // 'tos' | 'privacy' | null

  const userMenuRef = useRef(null);

  // Close user dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
    navigate('/login');
  };

  const handleRoleSelect = async (newRole) => {
    setShowSwitchModal(false);
    setShowUserMenu(false);
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

  const getRoleTitle = (r) => {
    switch (r) {
      case 'project_manager':
        return 'Project Manager';
      case 'collector':
        return 'District Collector';
      case 'policymaker':
        return 'State Policy Maker';
      case 'admin':
        return 'System Administrator';
      case 'auditor':
        return 'Compliance Auditor';
      default:
        return 'Authorized Officer';
    }
  };

  const getInitials = (name) => {
    if (!name) return 'AO';
    const parts = name.replace(/\([^)]*\)/g, '').trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
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

        {/* Executive User Profile Trigger */}
        <div className="flex items-center gap-2 sm:gap-4">
          {user && (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#201812] border border-[rgba(244,217,160,0.18)] hover:border-[#C8792C] hover:bg-[#261E17] transition-all text-left group"
              >
                <div className="relative">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#8A4A17] to-[#C8792C] text-[#F4D9A0] font-headline font-bold text-xs flex items-center justify-center border border-[rgba(244,217,160,0.4)] shadow-inner">
                    {getInitials(fullName)}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#86EFAC] ring-2 ring-[#201812]" />
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-bold text-[#F4D9A0] leading-tight group-hover:text-white transition-colors">
                    {fullName || 'Authorized Officer'}
                  </div>
                  <div className="text-[10px] text-[#C4B5A5] font-mono tracking-wider flex items-center gap-1.5 mt-0.5">
                    <span className="capitalize">{getRoleTitle(role)}</span>
                    <span className="text-[#8E7E70]">•</span>
                    <span className="text-[#8E7E70] truncate max-w-[90px]">{district || 'Statewide'}</span>
                  </div>
                </div>
                <svg
                  className={`w-3.5 h-3.5 text-[#C4B5A5] transition-transform duration-200 ml-1 ${showUserMenu ? 'rotate-180 text-[#F4D9A0]' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Professional Executive Profile Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-80 bg-[#1A130E] border border-[rgba(244,217,160,0.25)] rounded-xl shadow-2xl overflow-hidden z-50">
                  {/* Officer Identity Card */}
                  <div className="p-4 bg-[#241B14] border-b border-[rgba(244,217,160,0.12)]">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8A4A17] to-[#C8792C] text-[#F4D9A0] font-headline font-bold text-sm flex items-center justify-center border border-[rgba(244,217,160,0.3)] shadow-inner shrink-0 mt-0.5">
                        {getInitials(fullName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-[#F4D9A0] truncate">
                          {fullName || 'Authorized Officer'}
                        </div>
                        <div className="text-xs text-[#C4B5A5] truncate mt-0.5">
                          {user?.email || 'officer@landsentinel.gov.in'}
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border ${getRoleBadgeStyle(role)}`}>
                            {getRoleTitle(role)}
                          </span>
                          <span className="text-[10px] font-mono text-[#86EFAC] bg-[#16271C] px-1.5 py-0.5 rounded border border-[#255C3A]">
                            Clearance L3
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Jurisdiction & Officer Telemetry */}
                  <div className="p-3 bg-[#1D1610] border-b border-[rgba(244,217,160,0.08)] text-[11px] space-y-1.5 font-mono">
                    <div className="flex items-center justify-between text-[#C4B5A5]">
                      <span className="text-[#8E7E70]">Jurisdiction:</span>
                      <span className="text-[#F4D9A0] font-semibold">{district ? `${district} District` : 'Statewide Commission'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[#C4B5A5]">
                      <span className="text-[#8E7E70]">Department:</span>
                      <span>Revenue &amp; Land Administration</span>
                    </div>
                    <div className="flex items-center justify-between text-[#C4B5A5]">
                      <span className="text-[#8E7E70]">Session Status:</span>
                      <span className="text-[#86EFAC] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#86EFAC] animate-pulse"></span>
                        Active &amp; Verified
                      </span>
                    </div>
                  </div>

                  {/* Menu Actions */}
                  <div className="p-2 space-y-1">
                    {/* Switch Officer Profile Modal trigger */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowSwitchModal(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs text-[#E8DFD3] hover:bg-[#2A1F18] hover:text-[#F4D9A0] transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5">
                        <svg className="w-4 h-4 text-[#C4B5A5] group-hover:text-[#F4D9A0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        <div>
                          <span className="font-medium block">Switch Officer Account</span>
                          <span className="text-[10px] text-[#8E7E70]">Change active statutory clearance profile</span>
                        </div>
                      </div>
                      <span className="text-xs text-[#8E7E70] group-hover:text-[#F4D9A0]">&rarr;</span>
                    </button>

                    {/* Sign Out */}
                    <div className="pt-1 border-t border-[rgba(244,217,160,0.08)]">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs text-[#FCA5A5] hover:bg-[#331411] hover:text-[#F87171] transition-colors flex items-center gap-2.5"
                      >
                        <svg className="w-4 h-4 text-[#F87171]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="font-semibold">Sign Out of Terminal</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Single-Column Scroll Down Content Canvas */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-12 min-w-0">
        <Outlet />
      </main>

      {/* Institutional Compliance Footer */}
      <footer className="border-t border-[rgba(244,217,160,0.12)] bg-[#100C09] px-6 py-6 text-xs text-[#8E7E70] space-y-4">
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

      {/* Switch Officer Profile Modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#1A130E] border border-[rgba(244,217,160,0.3)] max-w-xl w-full rounded-xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.12)] pb-3">
              <div>
                <h3 className="text-base font-bold font-headline text-[#F4D9A0]">
                  Switch Statutory Officer Clearance
                </h3>
                <p className="text-xs text-[#C4B5A5] mt-0.5">
                  Select an authorized officer profile to inspect role-scoped corridors, telemetry, and approvals.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSwitchModal(false)}
                className="text-[#C4B5A5] hover:text-white font-mono text-xl p-1"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {demoUsers.map((item) => {
                const isCurrent = user?.user_id === item.user_id || role === item.role;
                return (
                  <button
                    key={item.user_id || item.role}
                    type="button"
                    onClick={() => handleRoleSelect(item.user_id || item.role)}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-start justify-between gap-3 ${
                      isCurrent
                        ? 'bg-[#2C1D13] border-[#C8792C] text-[#F4D9A0] ring-1 ring-[#C8792C]'
                        : 'bg-[#201812] border-[rgba(244,217,160,0.12)] hover:border-[#C8792C] hover:bg-[#261E17] text-[#E8DFD3]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#8A4A17] to-[#C8792C] text-[#F4D9A0] font-headline font-bold text-xs flex items-center justify-center border border-[rgba(244,217,160,0.3)] shadow-inner shrink-0 mt-0.5">
                        {getInitials(item.name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[#F4D9A0]">{item.name}</span>
                          {isCurrent && (
                            <span className="text-[9px] font-mono uppercase bg-[#C8792C] text-white px-1.5 py-0.2 rounded font-bold">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#C4B5A5] mt-0.5 leading-relaxed">
                          {item.desc}
                        </div>
                        <div className="text-[10px] font-mono text-[#8E7E70] mt-1 flex items-center gap-2">
                          <span>{item.email}</span>
                          <span>&bull;</span>
                          <span className="capitalize">{item.district || 'Statewide'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 mt-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border ${getRoleBadgeStyle(item.role)}`}>
                        {item.role}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end border-t border-[rgba(244,217,160,0.1)]">
              <button
                type="button"
                onClick={() => setShowSwitchModal(false)}
                className="btn-mocha text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
