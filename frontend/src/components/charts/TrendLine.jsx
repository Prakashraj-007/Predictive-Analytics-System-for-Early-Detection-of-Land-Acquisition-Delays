import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

const CustomLineTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1E1611] border border-[rgba(244,217,160,0.3)] p-2.5 rounded shadow-xl text-xs space-y-1">
        <div className="font-semibold text-[#F4D9A0] font-headline">{label}</div>
        <div className="flex items-center gap-1.5 font-mono">
          <span className="text-[#C4B5A5]">Average Delay Index:</span>
          <span className="font-bold text-[#C8792C]">{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function TrendLine({ data = [] }) {
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
        >
          <XAxis
            dataKey="month"
            stroke="#8E7E70"
            tick={{ fill: '#C4B5A5', fontSize: 10 }}
            axisLine={{ stroke: '#3D2D21' }}
            tickLine={{ stroke: '#3D2D21' }}
          />
          <YAxis
            domain={[20, 80]}
            stroke="#8E7E70"
            tick={{ fill: '#C4B5A5', fontSize: 11 }}
            axisLine={{ stroke: '#3D2D21' }}
            tickLine={{ stroke: '#3D2D21' }}
          />
          <Tooltip content={<CustomLineTooltip />} />
          <ReferenceLine y={60} stroke="#C94A3D" strokeDasharray="3 3" opacity={0.4} />
          <ReferenceLine y={30} stroke="#4A855A" strokeDasharray="3 3" opacity={0.4} />
          <Line
            type="monotone"
            dataKey="avg_risk"
            stroke="#C8792C"
            strokeWidth={2.5}
            dot={{ fill: '#C8792C', r: 3, stroke: '#F4D9A0', strokeWidth: 1 }}
            activeDot={{ r: 5, fill: '#F4D9A0', stroke: '#C8792C' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

