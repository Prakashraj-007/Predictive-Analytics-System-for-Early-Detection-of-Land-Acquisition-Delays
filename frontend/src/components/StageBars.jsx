import React from 'react';

/**
 * StageBars Component - Inner Peace Styling
 */
export default function StageBars({
  stageProbabilities = {
    approval: 0.35,
    compensation: 0.72,
    possession: 0.81,
    rr: 0.45,
  },
  title = 'Stage-Wise Delay Risk Distribution',
}) {
  const STAGES = [
    { key: 'approval', label: 'Statutory Approvals & Environmental Clearance', stageNum: 'Stage 01' },
    { key: 'compensation', label: 'Award Determination & Direct Disbursement', stageNum: 'Stage 02' },
    { key: 'possession', label: 'Physical Land Demarcation & Possession', stageNum: 'Stage 03' },
    { key: 'rr', label: 'Rehabilitation & Resettlement (R&R) Execution', stageNum: 'Stage 04' },
  ];

  const getBarColor = (pct) => {
    if (pct >= 60) return { bg: 'bg-[#C94A3D]', text: 'text-[#F87171]', badge: 'bg-[#331411] text-[#F87171] border-[#7F261E]' };
    if (pct >= 30) return { bg: 'bg-[#C8792C]', text: 'text-[#F4D9A0]', badge: 'bg-[#301C0D] text-[#F4D9A0] border-[#8A4A17]' };
    return { bg: 'bg-[#4A855A]', text: 'text-[#86EFAC]', badge: 'bg-[#152B1E] text-[#86EFAC] border-[#255C3A]' };
  };

  return (
    <div className="p-5 bg-[#1E1611] border border-[rgba(244,217,160,0.14)] rounded-lg">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[rgba(244,217,160,0.08)]">
        <div>
          <h3 className="text-sm font-semibold text-[#F4D9A0] tracking-wide font-headline">
            {title}
          </h3>
          <p className="text-xs text-[#C4B5A5] mt-0.5">
            Model-estimated probability of schedule overrun across administrative stages
          </p>
        </div>
        <span className="text-[10px] font-mono text-[#F4D9A0] px-2 py-0.5 rounded bg-[#2D2118] border border-[#5B4632]">
          RF MULTI-OUTPUT
        </span>
      </div>

      <div className="space-y-4">
        {STAGES.map((stage) => {
          const prob = stageProbabilities[stage.key] ?? 0;
          const pct = Math.round(prob * 100);
          const color = getBarColor(pct);

          return (
            <div key={stage.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-[#8E7E70] uppercase">{stage.stageNum}</span>
                  <span className="font-medium text-[#F3EDE2]">{stage.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-semibold ${color.text}`}>
                    {pct}%
                  </span>
                  <span className={`text-[10px] uppercase font-mono px-1.5 py-0.2 rounded border ${color.badge}`}>
                    {pct >= 60 ? 'Critical' : pct >= 30 ? 'Moderate' : 'Low'}
                  </span>
                </div>
              </div>

              {/* Progress Track */}
              <div className="w-full h-2 rounded bg-[#140F0B] border border-[rgba(244,217,160,0.1)] overflow-hidden">
                <div
                  className={`h-full rounded ${color.bg} transition-all duration-300`}
                  style={{ width: `${Math.max(4, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
