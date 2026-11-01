import React from 'react';
import { getRiskBand } from '../theme';

/**
 * RiskBadge Component - Inner Peace Styling
 * Displays score + colored risk band label.
 */
export default function RiskBadge({
  score = 0,
  band,
  showScore = true,
  showLabel = true,
  size = 'md',
}) {
  const config = getRiskBand(score);
  const displayBand = band || config.band;

  const isHigh = displayBand.toLowerCase() === 'high';
  const isMedium = displayBand.toLowerCase() === 'medium';

  const badgeStyle = isHigh
    ? 'bg-[#331411] text-[#F87171] border-[#7F261E]'
    : isMedium
    ? 'bg-[#301C0D] text-[#F4D9A0] border-[#8A4A17]'
    : 'bg-[#152B1E] text-[#86EFAC] border-[#255C3A]';

  const dotColor = isHigh
    ? 'bg-[#C94A3D]'
    : isMedium
    ? 'bg-[#C8792C]'
    : 'bg-[#4A855A]';

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-0.5 gap-2',
    lg: 'text-sm px-3.5 py-1.5 gap-2.5 font-medium',
  };

  return (
    <span
      className={`inline-flex items-center font-mono rounded border ${badgeStyle} ${sizeClasses[size] || sizeClasses.md}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {showScore && <span className="font-semibold">{score}</span>}
      {showScore && showLabel && <span className="text-[#8E7E70]">|</span>}
      {showLabel && (
        <span className="uppercase tracking-wider font-sans text-[10px] font-semibold">
          {displayBand}
        </span>
      )}
    </span>
  );
}
