import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { getRiskBand } from '../../theme';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const bandConfig = getRiskBand(data.avg_risk);

    return (
      <div className="bg-[#1E1611] border border-[rgba(244,217,160,0.3)] p-2.5 rounded shadow-xl text-xs space-y-1">
        <div className="font-semibold text-[#F4D9A0] font-headline">{data.district || label}</div>
        <div className="flex items-center gap-1.5 font-mono">
          <span className="text-[#C4B5A5]">Avg Risk:</span>
          <span className="font-bold" style={{ color: bandConfig.hex }}>
            {data.avg_risk} ({bandConfig.band})
          </span>
        </div>
        {data.project_count !== undefined && (
          <div className="text-[#8E7E70] text-[11px]">
            Total Projects: <span className="text-[#F3EDE2]">{data.project_count}</span>
            {data.high_risk_count !== undefined && (
              <span className="text-[#F87171] ml-1">({data.high_risk_count} High Risk)</span>
            )}
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function DistrictBar({ data = [] }) {
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
        >
          <XAxis
            dataKey="district"
            stroke="#8E7E70"
            tick={{ fill: '#C4B5A5', fontSize: 11 }}
            axisLine={{ stroke: '#3D2D21' }}
            tickLine={{ stroke: '#3D2D21' }}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#8E7E70"
            tick={{ fill: '#C4B5A5', fontSize: 11 }}
            axisLine={{ stroke: '#3D2D21' }}
            tickLine={{ stroke: '#3D2D21' }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(244, 217, 160, 0.04)' }} />
          <Bar dataKey="avg_risk" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => {
              const band = getRiskBand(entry.avg_risk);
              return <Cell key={`cell-${index}`} fill={band.hex} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

