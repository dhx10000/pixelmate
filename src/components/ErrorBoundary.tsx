"use client";

import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-bg-deep px-6">
        <div
          className="w-full max-w-sm rounded-2xl p-8 text-center"
          style={{
            background: "#18181C",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          {/* Icon */}
          <div
            className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold"
            style={{
              background: "rgba(239,68,68,0.1)",
              color: "rgba(255,120,100,0.9)",
            }}
            aria-hidden="true"
          >
            !
          </div>

          <h1 className="mb-2 text-base font-semibold text-text-primary">
            Something went wrong
          </h1>
          <p className="mb-6 text-sm leading-relaxed text-text-secondary">
            PixelMate ran into an unexpected error. Refreshing will start a
            fresh session.
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full px-5 py-2.5 text-xs font-medium transition-opacity hover:opacity-85 active:opacity-70"
            style={{ background: "#C8F560", color: "#0A0A0C" }}
          >
            Refresh page
          </button>
        </div>
      </div>
    );
  }
}
