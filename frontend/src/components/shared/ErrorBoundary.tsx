"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="mb-4 h-12 w-12 text-negative" />
          <h3 className="text-title-3 text-text-primary">
            오류가 발생했습니다
          </h3>
          <p className="mt-1 text-body-2 text-text-tertiary">
            {this.state.error?.message || "알 수 없는 오류가 발생했습니다."}
          </p>
          <button
            className="mt-4 rounded-md bg-brand px-4 py-2 text-[14px] font-semibold text-text-on-color transition-colors duration-150 hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/30"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            다시 시도
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
