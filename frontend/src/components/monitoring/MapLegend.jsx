import React from 'react';

/**
 * MapLegend Component - Geospatial Risk Map Legend
 * Displays risk band color indicators and radius explanation.
 */
export default function MapLegend() {
  const bands = [
    { label: 'Low Risk', range: '< 30', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.2)', border: '#16a34a' },
    { label: 'Medium Risk', range: '30 - 60', color: '#d97706', bg: 'rgba(217, 119, 6, 0.2)', border: '#d97706' },
    { label: 'High Risk', range: '> 60', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.2)', border: '#dc2626' },
  ];

  return (
    <div className="bg-[#1E1611] border border-[rgba(244,217,160,0.18)] rounded-lg p-3 text-xs shadow-lg space-y-2">
      <div className="text-[11px] font-mono text-[#F4D9A0] font-semibold uppercase tracking-wider">
        Risk Band Legend
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {bands.map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <span
              className="w-3.5 h-3.5 rounded-full inline-block shadow-sm"
              style={{
                backgroundColor: b.color,
                border: `1.5px solid ${b.border}`,
              }}
            />
            <span className="text-[#F3EDE2] font-medium">{b.label}</span>
            <span className="font-mono text-[10px] text-[#C4B5A5]">({b.range})</span>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-[#C4B5A5] pt-1 border-t border-[rgba(244,217,160,0.08)]">
        Marker radius scales proportionally with composite delay risk score (0-100).
      </div>
    </div>
  );
}

