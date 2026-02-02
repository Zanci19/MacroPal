/**
 * Centralized logging utility for MacroPal
 * Provides structured logging with different levels and environment-aware output
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment: boolean;
  private isDebugEnabled: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.isDebugEnabled = localStorage.getItem("mp_debug_logs") === "true";
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private shouldLog(level: LogLevel): boolean {
    // Always log errors and warnings
    if (level === "error" || level === "warn") return true;
    
    // Log info and debug only in development or if debug is explicitly enabled
    return this.isDevelopment || this.isDebugEnabled;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog("debug")) {
      console.debug(this.formatMessage("debug", message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog("info")) {
      console.info(this.formatMessage("info", message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog("error")) {
      const errorContext = {
        ...context,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
        } : error,
      };
      console.error(this.formatMessage("error", message, errorContext));
    }
  }

  /**
   * Log user actions for analytics and debugging
   * Only logs in development mode unless explicitly enabled
   */
  userAction(action: string, context?: LogContext): void {
    if (this.shouldLog("info")) {
      console.log(this.formatMessage("info", `[USER ACTION] ${action}`, context));
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// For backward compatibility with console.log patterns in the codebase
export default logger;
