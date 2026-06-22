import { trackEvent } from "../firebase";

export interface ErrorInfo {
  message: string;
  userMessage: string;
  source: string;
  timestamp: string;
}

/**
 * Handle and log errors consistently across the app
 * Returns a user-friendly error message
 */
export function handleError(source: string, error: unknown): string {
  const err =
    error instanceof Error ? error : new Error(String(error ?? "Unknown error"));

  console.error(`[${source}]`, err);

  // send to analytics
  trackEvent("error", {
    source,
    message: err.message,
    stack: err.stack ?? "",
  });

  // Return a user-friendly message
  return getUserFriendlyErrorMessage(err);
}

/**
 * Convert technical error messages to user-friendly ones
 */
export function getUserFriendlyErrorMessage(error: Error): string {
  const message = error.message.toLowerCase();

  // Firebase auth errors
  if (message.includes("auth/email-already-in-use")) {
    return "This email is already registered. Please try logging in instead.";
  }
  if (message.includes("auth/wrong-password")) {
    return "Incorrect password. Please try again.";
  }
  if (message.includes("auth/user-not-found")) {
    return "No account found with this email.";
  }
  if (message.includes("auth/invalid-email")) {
    return "Please enter a valid email address.";
  }
  if (message.includes("auth/weak-password")) {
    return "Password is too weak. Please use at least 6 characters.";
  }
  if (message.includes("auth/network-request-failed")) {
    return "Network error. Please check your internet connection.";
  }
  if (message.includes("auth/too-many-requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  // MFA / TOTP errors
  if (
    message.includes("auth/invalid-verification-code") ||
    message.includes("verification code is invalid") ||
    message.includes("auth/code-expired")
  ) {
    return "The code is incorrect or has expired. Please enter a fresh code from your authenticator app.";
  }
  if (
    message.includes("auth/invalid-multi-factor-session") ||
    message.includes("multi-factor session") ||
    message.includes("first factor")
  ) {
    return "Your sign-in session expired. Please log in again to restart the verification.";
  }
  if (
    message.includes("auth/multi-factor-info-not-found") ||
    message.includes("multi-factor info")
  ) {
    return "The authenticator enrollment was not found. Please log in again.";
  }
  if (message.includes("auth/missing-verification-code")) {
    return "Please enter the code from your authenticator app.";
  }
  if (message.includes("auth/unsupported-first-factor")) {
    return "Sign-in method not supported for this account. Please use email/password or Google.";
  }

  // Firestore errors
  if (message.includes("permission-denied")) {
    return "You don't have permission to perform this action.";
  }
  if (message.includes("not-found")) {
    return "The requested data was not found.";
  }

  // Network errors
  if (message.includes("network") || message.includes("offline")) {
    return "Network error. Please check your internet connection.";
  }

  // Default message
  return "Something went wrong. Please try again.";
}

/**
 * Create an error info object for logging
 */
export function createErrorInfo(source: string, error: unknown): ErrorInfo {
  const err = error instanceof Error ? error : new Error(String(error ?? "Unknown error"));
  
  return {
    message: err.message,
    userMessage: getUserFriendlyErrorMessage(err),
    source,
    timestamp: new Date().toISOString(),
  };
}
