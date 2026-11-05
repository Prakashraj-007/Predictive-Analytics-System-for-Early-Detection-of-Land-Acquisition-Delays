import React from 'react';
import { RISK_COLORS } from '../theme';

/**
 * ShapBar Component - Inner Peace Styling
 *
 * Visualizes the top 3 delay risk drivers from SHAP marginal analysis:
 * - Horizontal impact bar colored Red (#C94A3D) for increases_risk and Green (#4A855A) for decreases_risk
 * - Displays driver label, feature name, and marginal impact percentage
 * - Shows plain-text analytical explanation sentence below each bar
 * - Renders matching recommendation card matched by `recommendation.driver === driver.feature`
 * - Provides an action button to pre-fill and trigger task assignment for authorized roles
 *
 * @component
 * @param {Object} props
 * @param {Array<Object>} props.drivers - Exactly 3 SHAP drivers sorted by absolute impact
 * @param {string} props.drivers[].feature - Feature key (e.g., 'litigation_cases', 'approval_days_pending')
 * @param {string} props.drivers[].label - Human readable driver label (e.g., 'Court cases')
 * @param {number} props.drivers[].impact - SHAP marginal contribution (0 to 1 scale)
 * @param {'increases_risk'|'decreases_risk'} props.drivers[].direction - Risk impact polarity
 * @param {string} props.drivers[].plain_text - Plain text analytical explanation sentence
 * @param {Array<Object>} [props.recommendations=[]] - Prescriptive recommendations list [{ driver, action }]
 * @param {Function} [props.onActionClick] - Handler callback invoked with recommendation object
 * @param {boolean} [props.canAssignTask=false] - Whether current user can assign administrative tasks
 * @returns {JSX.Element}
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
            Why is this project at risk?
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
          const absImpact = Math.abs(driver.impact || 0);
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

              {/* Marginal Impact Bar */}
              <div className="w-full h-2 rounded bg-[#140F0B] border border-[rgba(244,217,160,0.1)] overflow-hidden">
                <div
                  className={`h-full rounded transition-all duration-300 ${
                    isIncrease ? 'bg-[#C94A3D]' : 'bg-[#4A855A]'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(8, absImpact * 250))}%` }}
                />
              </div>

              {/* Plain-text narrative sentence */}
              <p className="text-xs text-[#E8DFD3] leading-relaxed pl-2.5 border-l-2 border-[#5B4632] italic">
                "{driver.plain_text}"
              </p>

              {/* Matching Prescriptive Recommendation Card */}
              {rec && (
                <div className="p-3 bg-[#261C15] border border-[rgba(200,121,44,0.35)] rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                      className="shrink-0 text-xs px-3 py-1.5 rounded font-medium bg-[#C8792C] hover:bg-[#B56A23] text-white transition-colors border border-[#D88636] flex items-center gap-1 self-start sm:self-auto"
                      title="Assign task with pre-filled recommendation"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span>Assign Task</span>
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
