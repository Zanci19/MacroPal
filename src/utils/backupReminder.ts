/**
 * Data backup reminder utilities
 * Reminds users to backup their data periodically
 */

const BACKUP_REMINDER_KEY = 'mp_backup_reminder';
const BACKUP_INTERVAL_DAYS = 30; // Remind every 30 days

export interface BackupReminderData {
  lastBackup?: string;
  lastReminder: string;
  dismissed: number;
}

/**
 * Get backup reminder data
 */
export function getBackupReminderData(): BackupReminderData | null {
  try {
    const stored = localStorage.getItem(BACKUP_REMINDER_KEY);
    if (!stored) return null;

    return JSON.parse(stored) as BackupReminderData;
  } catch (error) {
    console.error('Failed to load backup reminder data:', error);
    return null;
  }
}

/**
 * Check if backup reminder should be shown
 */
export function shouldShowBackupReminder(): boolean {
  const data = getBackupReminderData();
  if (!data) return true; // Show on first use

  const lastReminder = new Date(data.lastReminder);
  const daysSinceReminder = Math.floor(
    (Date.now() - lastReminder.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysSinceReminder >= BACKUP_INTERVAL_DAYS;
}

/**
 * Mark backup as completed
 */
export function markBackupCompleted(): void {
  try {
    const data: BackupReminderData = {
      lastBackup: new Date().toISOString(),
      lastReminder: new Date().toISOString(),
      dismissed: 0,
    };

    localStorage.setItem(BACKUP_REMINDER_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save backup completion:', error);
  }
}

/**
 * Dismiss backup reminder
 */
export function dismissBackupReminder(): void {
  try {
    const existing = getBackupReminderData();
    const data: BackupReminderData = {
      lastBackup: existing?.lastBackup,
      lastReminder: new Date().toISOString(),
      dismissed: (existing?.dismissed ?? 0) + 1,
    };

    localStorage.setItem(BACKUP_REMINDER_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to dismiss backup reminder:', error);
  }
}

/**
 * Get last backup date
 */
export function getLastBackupDate(): Date | null {
  const data = getBackupReminderData();
  if (!data?.lastBackup) return null;

  try {
    return new Date(data.lastBackup);
  } catch {
    return null;
  }
}

/**
 * Get days since last backup
 */
export function getDaysSinceLastBackup(): number | null {
  const lastBackup = getLastBackupDate();
  if (!lastBackup) return null;

  return Math.floor((Date.now() - lastBackup.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Format backup reminder message
 */
export function getBackupReminderMessage(): string {
  const daysSinceBackup = getDaysSinceLastBackup();

  if (daysSinceBackup === null) {
    return "It's a good idea to backup your nutrition data regularly. Would you like to export it now?";
  }

  if (daysSinceBackup === 0) {
    return 'Your data was backed up today.';
  }

  if (daysSinceBackup === 1) {
    return 'Your data was backed up yesterday.';
  }

  if (daysSinceBackup < 7) {
    return `Your data was backed up ${daysSinceBackup} days ago.`;
  }

  if (daysSinceBackup < 30) {
    const weeks = Math.floor(daysSinceBackup / 7);
    return `Your data was backed up ${weeks} week${weeks !== 1 ? 's' : ''} ago.`;
  }

  const months = Math.floor(daysSinceBackup / 30);
  return `Your data was backed up ${months} month${months !== 1 ? 's' : ''} ago. Consider backing it up soon.`;
}
