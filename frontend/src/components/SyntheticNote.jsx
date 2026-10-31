import React from 'react';

/**
 * SyntheticNote Component - Inner Peace Styling
 */
export default function SyntheticNote({ compact = false }) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono tracking-wider bg-[#1A130E] text-[#C4B5A5] border border-[rgba(244,217,160,0.2)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#C8792C]"></span>
        SYNTHETIC DATA PROTOTYPE
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-[#1A130E] border border-[rgba(244,217,160,0.18)] rounded text-xs text-[#C4B5A5]">
      <span className="w-2 h-2 rounded-full bg-[#C8792C]"></span>
      <span className="font-semibold text-[#F4D9A0]">Statutory Notice:</span>
      <span>Simulated environment: all land records, coordinates, and predictions are synthetic models for evaluation.</span>
    </div>
  );
}
