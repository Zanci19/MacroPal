import { trackEvent } from "../firebase";

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

  // Return a message
  return "Something went wrong. Please try again.";
}
