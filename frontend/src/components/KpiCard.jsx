import React from 'react';

/**
 * KpiCard Component - Inner Peace Styling
 */
export default function KpiCard({
  title,
  value,
  subtitle,
  tag,
  icon,
  variant = 'default',
}) {
  const variantStyles = {
    default: 'border-[rgba(244,217,160,0.12)] bg-[#1E1611]',
    gold: 'border-[rgba(244,217,160,0.3)] bg-[#241B14]',
    warning: 'border-[rgba(200,121,44,0.35)] bg-[#24170E]',
    danger: 'border-[rgba(201,74,61,0.35)] bg-[#261210]',
  };

  return (
    <div className={`p-5 rounded-lg border transition-all duration-150 ${variantStyles[variant] || variantStyles.default}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[#C4B5A5]">
          {title}
        </span>
        {icon && <div className="text-[#C8792C]">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-extrabold font-mono tracking-tight text-[#F4D9A0]">
          {value}
        </span>
        {tag && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#2D2118] text-[#F3EDE2] border border-[#5B4632]">
            {tag}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-2 text-xs text-[#8E7E70] leading-snug">
          {subtitle}
        </p>
      )}
    </div>
  );
}
