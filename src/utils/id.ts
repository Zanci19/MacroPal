/**
 * Stable unique id for diary entries (and other client-created records).
 * Used so edit/delete/undo can target the exact entry instead of matching on
 * an `addedAt` timestamp, which collides on rapid/duplicate logging.
 */
export function createEntryId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}
