import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled UI render error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/overview';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#140F0B] text-[#F3EDE2]">
          <div className="max-w-lg w-full p-6 rounded-xl border border-[rgba(244,217,160,0.3)] bg-[#1E1611] space-y-4 shadow-2xl">
            <div className="flex items-center gap-2">
              <span className="text-xl text-[#F87171] select-none">&#9888;</span>
              <h2 className="text-lg font-bold font-headline text-[#F4D9A0]">
                Application Render Notice
              </h2>
            </div>
            <p className="text-xs text-[#C4B5A5] leading-relaxed">
              A temporary interface issue occurred while loading this view. You can return to the dashboard overview or reload the session.
            </p>
            {this.state.error?.message && (
              <div className="p-3 rounded bg-[#140F0B] font-mono text-[11px] text-[#F87171] border border-[#7F261E]/40 overflow-x-auto">
                {this.state.error.message}
              </div>
            )}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="btn-primary text-xs"
              >
                Return to Overview
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn-outline text-xs"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
