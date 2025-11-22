import React from "react";
import { trackEvent } from "../firebase";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    trackEvent("app_crash", { message: error.message, stack: error.stack, info });
    console.error("ErrorBoundary caught an error:", error, info);
  }

  handleReload = () => {
    // simplest: reload the whole app
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "20px", margin: 0 }}>
            Something went wrong 😔
          </h1>
          <p style={{ opacity: 0.8, maxWidth: 320 }}>
            The app hit an unexpected error. You can try reloading it and
            continuing where you left off.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
            }}
          >
            Reload MacroPal
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
