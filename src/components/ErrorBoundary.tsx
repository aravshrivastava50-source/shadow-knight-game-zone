import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error): void {
    console.error('Shadow Knight Game Zone ErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#07070F] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-[#120B24] border border-[#FF1E42]/40 p-6 text-center shadow-2xl">
            <AlertTriangle className="w-10 h-10 text-[#FF1E42] mx-auto" />
            <h1 className="mt-4 font-display text-xl font-bold text-white">
              Arena Recovery Required
            </h1>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF1E42] hover:bg-[#ff3355] px-6 py-2.5 font-display text-sm font-bold text-white transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Portal
            </button>
            <p className="mt-5 text-[11px] text-slate-500">
              © 2026 Shadow Knight Game Zone. All Rights Reserved.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
