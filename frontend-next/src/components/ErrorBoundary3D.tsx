"use client";

import React, { Component, ReactNode } from "react";

import { log3DError } from "@/lib/telemetry";

interface ErrorBoundary3DProps {
  pageName: string;
  setCanvasError: (val: boolean) => void;
  children: ReactNode;
}

interface ErrorBoundary3DState {
  hasError: boolean;
}

export class ErrorBoundary3D extends Component<
  ErrorBoundary3DProps,
  ErrorBoundary3DState
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error(
      `[R3F ErrorBoundary] Caught 3D render crash on page "${this.props.pageName}":`,
      error,
      errorInfo
    );
    log3DError(this.props.pageName, error.message || "3D Canvas Error", error.stack);
    this.props.setCanvasError(true);
  }

  render() {
    if (this.state.hasError) {
      return null; // hide 3D canvas content
    }
    return this.props.children;
  }
}
