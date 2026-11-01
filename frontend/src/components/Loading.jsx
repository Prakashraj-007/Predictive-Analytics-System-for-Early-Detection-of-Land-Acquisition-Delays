import React from 'react';

/**
 * Loading Skeletons - Inner Peace Mocha/Gold styling
 */
export function SkeletonCard({ height = 'h-32' }) {
  return (
    <div className={`p-4 rounded-lg bg-[#1E1611] border border-[rgba(244,217,160,0.1)] animate-pulse ${height}`}>
      <div className="h-3 w-28 bg-[#2A1F18] rounded mb-3"></div>
      <div className="h-7 w-20 bg-[#35271E] rounded mb-2"></div>
      <div className="h-2.5 w-3/4 bg-[#2A1F18] rounded"></div>
    </div>
  );
}

export function SkeletonChart({ height = 'h-64' }) {
  return (
    <div className={`p-4 rounded-lg bg-[#1E1611] border border-[rgba(244,217,160,0.1)] flex flex-col justify-between animate-pulse ${height}`}>
      <div className="h-4 w-40 bg-[#2A1F18] rounded"></div>
      <div className="flex items-end gap-3 h-40 pt-4">
        <div className="w-12 bg-[#2A1F18] rounded-t h-24"></div>
        <div className="w-12 bg-[#35271E] rounded-t h-36"></div>
        <div className="w-12 bg-[#2A1F18] rounded-t h-16"></div>
        <div className="w-12 bg-[#35271E] rounded-t h-28"></div>
        <div className="w-12 bg-[#2A1F18] rounded-t h-20"></div>
      </div>
      <div className="h-3 w-1/2 bg-[#2A1F18] rounded mt-2"></div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div className="p-4 rounded-lg bg-[#1E1611] border border-[rgba(244,217,160,0.1)] space-y-3 animate-pulse">
      <div className="h-6 w-48 bg-[#2A1F18] rounded mb-4"></div>
      <div className="h-4 w-full bg-[#1A130E] rounded"></div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2 border-b border-[rgba(244,217,160,0.06)]">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-3.5 bg-[#2A1F18] rounded flex-1"></div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Loading({ message = 'Loading institutional telemetry data...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center space-y-3">
      <div className="w-6 h-6 border-2 border-[#C8792C] border-t-transparent rounded-full animate-spin"></div>
      <span className="text-xs font-mono tracking-wide text-[#C4B5A5] uppercase">
        {message}
      </span>
    </div>
  );
}
