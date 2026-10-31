import React from 'react';
import { getRiskBand } from '../theme';

/**
 * RiskGauge Component - Inner Peace Styling
 * Precision SVG semi-circle gauge (0-100)
 */
export default function RiskGauge({
  score = 0,
  size = 190,
  label = 'Delay Risk Score',
  showBand = true,
}) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const config = getRiskBand(clampedScore);

  const cx = 100;
  const cy = 95;
  const r = 70;
  const strokeWidth = 10;

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 180) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const describeArc = (x, y, radius, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const arcSweep = endAngle - startAngle <= 180 ? '0' : '1';
    return [
      'M', start.x, start.y,
      'A', radius, radius, 0, arcSweep, 0, end.x, end.y,
    ].join(' ');
  };

  const lowArc = describeArc(cx, cy, r, 0, 54);
  const medArc = describeArc(cx, cy, r, 54, 108);
  const highArc = describeArc(cx, cy, r, 108, 180);

  const needleAngle = clampedScore * 1.8;
  const needleRad = ((needleAngle - 180) * Math.PI) / 180.0;
  const needleLen = r - 12;
  const nx = cx + needleLen * Math.cos(needleRad);
  const ny = cy + needleLen * Math.sin(needleRad);

  return (
    <div className="flex flex-col items-center justify-center p-5 bg-[#1E1611] border border-[rgba(244,217,160,0.14)] rounded-lg">
      <svg
        viewBox="0 0 200 115"
        className="w-full max-w-[210px] overflow-visible"
        style={{ width: `${size}px` }}
      >
        {/* Track Arcs */}
        <path
          d={lowArc}
          fill="none"
          stroke="#4A855A"
          strokeWidth={strokeWidth}
          strokeOpacity="0.35"
          strokeLinecap="round"
        />
        <path
          d={medArc}
          fill="none"
          stroke="#C8792C"
          strokeWidth={strokeWidth}
          strokeOpacity="0.35"
        />
        <path
          d={highArc}
          fill="none"
          stroke="#C94A3D"
          strokeWidth={strokeWidth}
          strokeOpacity="0.35"
          strokeLinecap="round"
        />

        {/* Active Progress */}
        <path
          d={describeArc(cx, cy, r, 0, clampedScore * 1.8)}
          fill="none"
          stroke={config.hex}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Needle Line */}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="#F4D9A0"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="5" fill="#F4D9A0" />
        <circle cx={cx} cy={cy} r="2" fill="#140F0B" />

        {/* Tick labels */}
        <text x="24" y="108" fill="#8E7E70" fontSize="9" fontFamily="monospace">0</text>
        <text x="96" y="24" fill="#8E7E70" fontSize="9" fontFamily="monospace">50</text>
        <text x="170" y="108" fill="#8E7E70" fontSize="9" fontFamily="monospace">100</text>
      </svg>

      <div className="text-center -mt-2">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-3xl font-extrabold font-mono text-[#F4D9A0] tracking-tight">
            {clampedScore}
          </span>
          <span className="text-xs text-[#8E7E70] font-mono">/100</span>
        </div>

        {showBand && (
          <div className="mt-1">
            <span
              className="text-[11px] font-semibold px-2.5 py-0.5 rounded uppercase tracking-wider font-mono border"
              style={{
                color: config.text,
                backgroundColor: config.bg,
                borderColor: config.border,
              }}
            >
              {config.band} Risk Band
            </span>
          </div>
        )}

        <div className="text-[11px] text-[#C4B5A5] mt-1 uppercase tracking-wider font-mono">
          {label}
        </div>
      </div>
    </div>
  );
}
