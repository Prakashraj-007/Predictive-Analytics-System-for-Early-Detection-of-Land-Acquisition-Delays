import React from 'react';

/**
 * ErrorBox Component - Inner Peace Styling
 */
export default function ErrorBox({
  title = 'System Notice',
  message = 'Unable to synchronize telemetry records. Check connectivity or permissions.',
  onRetry,
}) {
  return (
    <div className="p-5 bg-[#261210] border border-[rgba(201,74,61,0.4)] rounded-lg text-[#F3EDE2] space-y-3">
      <div className="flex items-center gap-2.5 text-[#F87171]">
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <h4 className="text-sm font-semibold tracking-wide text-[#FCA5A5] font-headline">{title}</h4>
      </div>

      <p className="text-xs text-[#E8DFD3] leading-relaxed font-sans">{message}</p>

      {onRetry && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onRetry}
            className="text-xs px-3 py-1.5 rounded font-mono font-medium bg-[#3D1A17] hover:bg-[#52211C] text-[#FCA5A5] border border-[#7F261E] transition-colors"
          >
            Retry Data Query
          </button>
        </div>
      )}
    </div>
  );
}
