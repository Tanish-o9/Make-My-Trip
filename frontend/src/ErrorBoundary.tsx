import React, { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled error caught by ErrorBoundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#090d16] text-white font-sans">
          <div className="max-w-md w-full p-8 bg-[#111827] border-4 border-black shadow-[8px_8px_0px_0px_#ef4444] text-center">
            <h1 className="text-2xl font-black text-rose-500 mb-4" style={{ letterSpacing: '0.05em' }}>SOMETHING WENT WRONG</h1>
            <p className="text-sm text-slate-400 mb-6 font-semibold">
              An unexpected client-side error occurred. Please try reloading the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold border-2 border-black shadow-[4px_4px_0px_0px_#000000] transition duration-150 cursor-pointer rounded-none"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
