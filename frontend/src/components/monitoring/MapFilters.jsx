import React from 'react';

/**
 * MapFilters Component - Filters for District and Risk Bands
 */
export default function MapFilters({
  districts = [],
  selectedDistrict = '',
  onDistrictChange,
  selectedBands = { Low: true, Medium: true, High: true },
  onBandToggle,
  showingCount = 0,
  totalCount = 0,
  onReset,
}) {
  const bands = [
    { key: 'Low', label: 'Low', color: '#16a34a' },
    { key: 'Medium', label: 'Medium', color: '#d97706' },
    { key: 'High', label: 'High', color: '#dc2626' },
  ];

  return (
    <div className="bg-[#1E1611] border border-[rgba(244,217,160,0.18)] rounded-lg p-4 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* District Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="district-select" className="text-xs text-[#C4B5A5] font-medium">
            District:
          </label>
          <select
            id="district-select"
            value={selectedDistrict}
            onChange={(e) => onDistrictChange(e.target.value)}
            className="bg-[#140F0B] border border-[rgba(244,217,160,0.2)] rounded px-3 py-1.5 text-xs text-[#F4D9A0] focus:outline-none focus:border-[#F4D9A0]"
          >
            <option value="">All Districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Risk Band Checkboxes */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#C4B5A5] font-medium">Bands:</span>
          {bands.map((b) => (
            <label
              key={b.key}
              className="inline-flex items-center gap-1.5 cursor-pointer text-xs select-none"
            >
              <input
                type="checkbox"
                checked={Boolean(selectedBands[b.key])}
                onChange={() => onBandToggle(b.key)}
                className="rounded border-[rgba(244,217,160,0.25)] bg-[#140F0B] text-[#F4D9A0] focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5 cursor-pointer"
              />
              <span className="flex items-center gap-1 text-[#F3EDE2]">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: b.color }}
                />
                {b.label}
              </span>
            </label>
          ))}
        </div>

        {/* Showing Count & Reset */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-[#F4D9A0]">
            Showing <strong className="text-[#F3EDE2]">{showingCount}</strong> of{' '}
            <strong className="text-[#F3EDE2]">{totalCount}</strong> projects
          </span>
          {(selectedDistrict || !selectedBands.Low || !selectedBands.Medium || !selectedBands.High) && (
            <button
              type="button"
              onClick={onReset}
              className="text-[11px] font-mono text-[#C4B5A5] hover:text-[#F4D9A0] underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
