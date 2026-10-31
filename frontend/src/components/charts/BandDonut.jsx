import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { RISK_COLORS } from '../../theme';

const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-[#1E1611] border border-[rgba(244,217,160,0.3)] p-2.5 rounded shadow-xl text-xs space-y-1">
        <div className="font-semibold text-[#F4D9A0] font-headline">{data.name} Risk Band</div>
        <div className="flex items-center gap-1.5 font-mono">
          <span className="text-[#C4B5A5]">Projects:</span>
          <span className="font-bold text-white">{data.value}</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function BandDonut({ distribution = { Low: 19, Medium: 18, High: 11 } }) {
  const chartData = [
    { name: 'Low', value: distribution.Low || 0, color: RISK_COLORS.low.hex },
    { name: 'Medium', value: distribution.Medium || 0, color: RISK_COLORS.medium.hex },
    { name: 'High', value: distribution.High || 0, color: RISK_COLORS.high.hex },
  ];

  const total = chartData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 h-64">
      <div className="w-full sm:w-1/2 h-52 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              innerRadius={52}
              outerRadius={75}
              paddingAngle={4}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`slice-${index}`} fill={entry.color} stroke="#140F0B" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomPieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold font-mono text-[#F4D9A0]">{total}</span>
          <span className="text-[10px] uppercase font-mono text-[#8E7E70] tracking-wider">Total</span>
        </div>
      </div>

      <div className="w-full sm:w-1/2 space-y-2.5 text-xs">
        {chartData.map((item) => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={item.name} className="flex items-center justify-between p-2 rounded bg-[#16100C] border border-[rgba(244,217,160,0.1)]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                <span className="font-medium text-[#F3EDE2]">{item.name} Risk</span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span className="font-semibold text-[#F4D9A0]">{item.value}</span>
                <span className="text-[#8E7E70] text-[11px]">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

