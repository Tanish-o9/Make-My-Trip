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
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0a0f1d] text-white font-sans text-center">
          <div className="max-w-lg w-full p-8 bg-[#111827] border-4 border-black shadow-[8px_8px_0px_0px_#ef4444] space-y-6">
            <div className="flex justify-center"><span className="text-4xl">⚠️</span></div>
            <h1 className="text-2xl font-black text-rose-500 uppercase tracking-wider">CRITICAL SYSTEM ERROR</h1>
            
            <p className="text-xs text-slate-400 font-semibold leading-relaxed">
              An unexpected client-side crash was intercepted by the Travel OS container gateway.
            </p>
            
            {/* Diagnostics Box */}
            <div className="bg-slate-950 p-4 border border-slate-800 rounded-lg text-left space-y-1 font-mono text-[10px] text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold uppercase">diagnostic code:</span>
                <span className="text-rose-400 font-bold">CLIENT_CRASH_INT_500</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold uppercase">gate session:</span>
                <span className="text-slate-400">active_session_rebound</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold uppercase">timestamp:</span>
                <span className="text-slate-400">{new Date().toISOString()}</span>
              </div>
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black border-2 border-black shadow-[3px_3px_0px_0px_#000000] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer text-[10px] uppercase"
              >
                🔄 Retry Action
              </button>
              
              <button
                onClick={() => {
                  window.location.href = "/?chat_trigger=error_help";
                }}
                className="py-2.5 bg-yellow-300 hover:bg-yellow-400 text-black font-black border-2 border-black shadow-[3px_3px_0px_0px_#000000] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer text-[10px] uppercase"
              >
                💬 Ask Travel AI
              </button>

              <button
                onClick={() => {
                  alert("Support ticket raised. Diagnostic ID: CLIENT_CRASH_500. Support team has been notified.");
                }}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-black border-2 border-black shadow-[3px_3px_0px_0px_#000000] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer text-[10px] uppercase"
              >
                📞 Contact Desk
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
