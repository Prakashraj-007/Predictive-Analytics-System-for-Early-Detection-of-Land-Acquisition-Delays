import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Reusable Role-Filtered Sidebar Component
 * Theme: "INNER PEACE" Palette
 * Used when modular multi-pane navigation is mounted (e.g. Person D pages)
 */
export default function Sidebar() {
  const { role } = useAuth();
  const currentRole = role || 'project_manager';

  const getNavItems = () => {
    const baseItems = [
      { to: '/overview', label: 'Overview' },
      { to: '/projects', label: 'Projects Registry' },
    ];

    if (currentRole === 'project_manager') {
      return [
        ...baseItems,
        { to: '/projects/new', label: 'Create Project' },
        { to: '/alerts', label: 'Alerts and Tasks', comingSoon: true },
        { to: '/what-if', label: 'What-If Simulator' },
      ];
    }

    if (currentRole === 'collector') {
      return [
        ...baseItems,
        { to: '/map', label: 'Geospatial Map', comingSoon: true },
        { to: '/alerts', label: 'Alerts and Tasks', comingSoon: true },
        { to: '/what-if', label: 'What-If Simulator' },
      ];
    }

    if (currentRole === 'policymaker') {
      return [
        ...baseItems,
        { to: '/map', label: 'Geospatial Map', comingSoon: true },
        { to: '/alerts', label: 'Alerts', comingSoon: true },
        { to: '/what-if', label: 'What-If Simulator' },
      ];
    }

    if (currentRole === 'admin') {
      return [
        ...baseItems,
        { to: '/map', label: 'Geospatial Map', comingSoon: true },
        { to: '/admin/retrain', label: 'Data and Retrain', comingSoon: true },
        { to: '/audit', label: 'Audit Log', comingSoon: true },
      ];
    }

    if (currentRole === 'auditor') {
      return [
        ...baseItems,
        { to: '/audit', label: 'Audit Log', comingSoon: true },
      ];
    }

    return baseItems;
  };

  const navItems = getNavItems();

  return (
    <aside className="w-64 bg-[#18120D] border-r border-[rgba(244,217,160,0.12)] flex flex-col min-h-[calc(100vh-64px)] shrink-0">
      <div className="p-4 border-b border-[rgba(244,217,160,0.1)]">
        <div className="text-[10px] font-mono uppercase tracking-wider text-[#C4B5A5] flex items-center justify-between">
          <span>Navigation Menu</span>
          <span className="text-[#F4D9A0] font-semibold">{currentRole}</span>
        </div>
      </div>
      <nav className="p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-[#C8792C] text-white font-semibold'
                  : 'text-[#C4B5A5] hover:text-[#F4D9A0] hover:bg-[#2A1F18]'
              }`
            }
          >
            <span>{item.label}</span>
            {item.comingSoon && (
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#201812] text-[#8E7E70] border border-[rgba(244,217,160,0.1)]">
                Person D
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
