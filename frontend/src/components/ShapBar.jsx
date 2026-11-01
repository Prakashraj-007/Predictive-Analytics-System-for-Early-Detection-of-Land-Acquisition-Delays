import React from 'react';

/**
 * ShapBar Component - Inner Peace Styling
 */
export default function ShapBar({
  drivers = [],
  recommendations = [],
  onActionClick,
  canAssignTask = false,
}) {
  return (
    <div className="p-5 bg-[#1E1611] border border-[rgba(244,217,160,0.14)] rounded-lg space-y-5">
      <div className="flex items-center justify-between border-b border-[rgba(244,217,160,0.08)] pb-3">
        <div>
          <h3 className="text-sm font-semibold text-[#F4D9A0] font-headline tracking-wide">
            Key Risk Drivers & AI Explainability (SHAP Marginal Analysis)
          </h3>
          <p className="text-xs text-[#C4B5A5] mt-0.5">
            Top factors contributing to project delay probability, ranked by mathematical marginal contribution
          </p>
        </div>
        <span className="text-[10px] font-mono text-[#F4D9A0] px-2 py-0.5 rounded bg-[#2D2118] border border-[#5B4632]">
          SHAP EXPLAINABILITY
        </span>
      </div>

      <div className="space-y-6">
        {drivers.map((driver, idx) => {
          const isIncrease = driver.direction === 'increases_risk';
          const absImpact = Math.abs(driver.impact);
          const impactPercent = (absImpact * 100).toFixed(1);
          const rec = recommendations.find((r) => r.driver === driver.feature);

          return (
            <div key={driver.feature || idx} className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#2A1F18] border border-[#5B4632] text-[#F4D9A0]">
                    #{idx + 1}
                  </span>
                  <span className="font-medium text-[#F3EDE2]">{driver.label}</span>
                  <span className="font-mono text-[11px] text-[#8E7E70]">({driver.feature})</span>
                </div>

                <div className="flex items-center gap-2 font-mono">
                  <span
                    className={`font-semibold text-xs ${
                      isIncrease ? 'text-[#F87171]' : 'text-[#86EFAC]'
                    }`}
                  >
                    {isIncrease ? `+${impactPercent}% Risk` : `-${impactPercent}% Risk`}
                  </span>
                  <span className="text-[#8E7E70] text-[10px]">
                    ({driver.impact > 0 ? `+${driver.impact}` : driver.impact} pts)
                  </span>
                </div>
              </div>

              {/* Impact Bar */}
              <div className="w-full h-2 rounded bg-[#140F0B] border border-[rgba(244,217,160,0.1)] overflow-hidden">
                <div
                  className={`h-full rounded transition-all duration-300 ${
                    isIncrease ? 'bg-[#C94A3D]' : 'bg-[#4A855A]'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(8, absImpact * 250))}%` }}
                />
              </div>

              {/* Plain text explanation */}
              <p className="text-xs text-[#E8DFD3] leading-relaxed pl-2 border-l-2 border-[#5B4632]">
                {driver.plain_text}
              </p>

              {/* Recommendation Card */}
              {rec && (
                <div className="p-3 bg-[#261C15] border border-[rgba(200,121,44,0.35)] rounded-md flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono uppercase font-semibold text-[#F4D9A0] tracking-wider flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-[#C8792C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Recommended Mitigation Protocol
                    </span>
                    <p className="text-xs text-[#F3EDE2]">{rec.action}</p>
                  </div>

                  {canAssignTask && onActionClick && (
                    <button
                      type="button"
                      onClick={() => onActionClick(rec)}
                      className="shrink-0 text-xs px-2.5 py-1 rounded font-medium bg-[#C8792C] hover:bg-[#B56A23] text-white transition-colors border border-[#D88636]"
                    >
                      Assign Task
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
