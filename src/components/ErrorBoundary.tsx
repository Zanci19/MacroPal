import React from "react";
import { trackEvent } from "../firebase";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
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
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ errorInfo: info });
    trackEvent("app_crash", { 
      message: error.message, 
      stack: error.stack, 
      componentStack: info.componentStack 
    });
    console.error("ErrorBoundary caught an error:", error, info);
  }

  handleReload = () => {
    console.log(`[USER ACTION] Error Boundary: Clicked reload app button after crash`, {
      error: this.state.error?.message,
      url: window.location.href,
    });
    window.location.reload();
  };

  handleToggleDetails = () => {
    console.log(`[USER ACTION] Error Boundary: Toggled error details`, {
      showingDetails: !this.state.showDetails,
      error: this.state.error?.message,
    });
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  handleCopyError = () => {
    console.log(`[USER ACTION] Error Boundary: Copied error details to clipboard`, {
      error: this.state.error?.message,
    });
    const { error, errorInfo } = this.state;
    const errorText = `MacroPal Error Report
===================
Time: ${new Date().toISOString()}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}

Error Message:
${error?.message || "Unknown error"}

Error Stack:
${error?.stack || "No stack trace available"}

Component Stack:
${errorInfo?.componentStack || "No component stack available"}
`;
    navigator.clipboard.writeText(errorText).then(() => {
      alert("Error details copied to clipboard!");
    }).catch(() => {
      alert("Failed to copy error details");
    });
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails } = this.state;

      return (
        <div
          style={{
            minHeight: "100vh",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
            textAlign: "center",
            backgroundColor: "#121212",
            color: "#f5f5f5",
          }}
        >
          <h1 style={{ fontSize: "24px", margin: 0, color: "#ff6b6b" }}>
            ⚠️ App Crashed
          </h1>
          <p style={{ opacity: 0.8, maxWidth: 400, fontSize: "14px" }}>
            The app encountered an unexpected error and needs to restart.
          </p>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                backgroundColor: "#4CAF50",
                color: "white",
                fontWeight: "600",
                fontSize: "14px",
              }}
            >
              Reload App
            </button>
            <button
              onClick={this.handleToggleDetails}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "1px solid #666",
                cursor: "pointer",
                backgroundColor: "transparent",
                color: "#f5f5f5",
                fontSize: "14px",
              }}
            >
              {showDetails ? "Hide Details" : "Show Details"}
            </button>
            {showDetails && (
              <button
                onClick={this.handleCopyError}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "1px solid #666",
                  cursor: "pointer",
                  backgroundColor: "transparent",
                  color: "#f5f5f5",
                  fontSize: "14px",
                }}
              >
                Copy Error
              </button>
            )}
          </div>

          {showDetails && (
            <div
              style={{
                maxWidth: "90vw",
                width: "600px",
                maxHeight: "60vh",
                overflow: "auto",
                backgroundColor: "#1e1e1e",
                padding: "16px",
                borderRadius: 8,
                textAlign: "left",
                fontSize: "12px",
                fontFamily: "monospace",
                border: "1px solid #333",
              }}
            >
              <div style={{ marginBottom: "16px" }}>
                <strong style={{ color: "#ff6b6b" }}>Error Message:</strong>
                <pre style={{ margin: "8px 0", whiteSpace: "pre-wrap", color: "#ffeb3b" }}>
                  {error?.message || "Unknown error"}
                </pre>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <strong style={{ color: "#ff6b6b" }}>Error Stack:</strong>
                <pre style={{ margin: "8px 0", whiteSpace: "pre-wrap", color: "#ccc", fontSize: "11px" }}>
                  {error?.stack || "No stack trace available"}
                </pre>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <strong style={{ color: "#ff6b6b" }}>Component Stack:</strong>
                <pre style={{ margin: "8px 0", whiteSpace: "pre-wrap", color: "#ccc", fontSize: "11px" }}>
                  {errorInfo?.componentStack || "No component stack available"}
                </pre>
              </div>

              <div style={{ marginBottom: "8px" }}>
                <strong style={{ color: "#ff6b6b" }}>Debug Info:</strong>
                <div style={{ marginTop: "8px", color: "#aaa" }}>
                  <div>URL: {window.location.href}</div>
                  <div>Time: {new Date().toISOString()}</div>
                  <div>User Agent: {navigator.userAgent}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
