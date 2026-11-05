import React from 'react';

/**
 * EmptyState Component - Inner Peace Styling
 *
 * Renders consistent empty states when queries, filters, or datasets return 0 results.
 *
 * @param {Object} props
 * @param {string} [props.title='No Records Found']
 * @param {string} [props.description='No matching statutory data or corridor records found for this view.']
 * @param {string} [props.actionLabel]
 * @param {Function} [props.onAction]
 * @param {React.ReactNode} [props.icon]
 */
export default function EmptyState({
  title = 'No Records Found',
  description = 'No matching statutory data or corridor records found for this view.',
  actionLabel,
  onAction,
  icon,
}) {
  return (
    <div className="peace-card p-8 text-center space-y-3 max-w-md mx-auto my-6 bg-[#16100C] border border-[rgba(244,217,160,0.12)]">
      <div className="w-12 h-12 rounded-full bg-[#201812] border border-[rgba(244,217,160,0.18)] text-[#F4D9A0] mx-auto flex items-center justify-center text-xl">
        {icon || '📭'}
      </div>
      <div>
        <h4 className="text-sm font-bold font-headline text-[#F4D9A0] tracking-wide">
          {title}
        </h4>
        <p className="text-xs text-[#C4B5A5] mt-1 leading-relaxed">
          {description}
        </p>
      </div>
      {actionLabel && onAction && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onAction}
            className="btn-amber text-xs font-semibold px-4 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#C8792C]"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}

