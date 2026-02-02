import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
}

/**
 * Hook for registering keyboard shortcuts
 * Useful for power users to navigate the app quickly
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean = true) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when user is typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrlKey === undefined || event.ctrlKey === shortcut.ctrlKey;
        const shiftMatches = shortcut.shiftKey === undefined || event.shiftKey === shortcut.shiftKey;
        const altMatches = shortcut.altKey === undefined || event.altKey === shortcut.altKey;
        const metaMatches = shortcut.metaKey === undefined || event.metaKey === shortcut.metaKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
}

/**
 * Common keyboard shortcuts for the app
 */
export const getCommonShortcuts = (callbacks: {
  onQuickAdd?: () => void;
  onGoToHome?: () => void;
  onGoToAnalytics?: () => void;
  onGoToWorkout?: () => void;
  onGoToSettings?: () => void;
  onSearch?: () => void;
}): KeyboardShortcut[] => {
  const shortcuts: KeyboardShortcut[] = [];

  if (callbacks.onQuickAdd) {
    shortcuts.push({
      key: 'a',
      ctrlKey: true,
      description: 'Quick add food',
      action: callbacks.onQuickAdd,
    });
  }

  if (callbacks.onGoToHome) {
    shortcuts.push({
      key: 'h',
      ctrlKey: true,
      description: 'Go to Home',
      action: callbacks.onGoToHome,
    });
  }

  if (callbacks.onGoToAnalytics) {
    shortcuts.push({
      key: 'n',
      ctrlKey: true,
      description: 'Go to Analytics',
      action: callbacks.onGoToAnalytics,
    });
  }

  if (callbacks.onGoToWorkout) {
    shortcuts.push({
      key: 'w',
      ctrlKey: true,
      description: 'Go to Workout',
      action: callbacks.onGoToWorkout,
    });
  }

  if (callbacks.onGoToSettings) {
    shortcuts.push({
      key: ',',
      ctrlKey: true,
      description: 'Go to Settings',
      action: callbacks.onGoToSettings,
    });
  }

  if (callbacks.onSearch) {
    shortcuts.push({
      key: '/',
      description: 'Search',
      action: callbacks.onSearch,
    });
  }

  return shortcuts;
};

/**
 * Hook that provides a help text for keyboard shortcuts
 */
export function useKeyboardShortcutsHelp(shortcuts: KeyboardShortcut[]) {
  const getShortcutText = (shortcut: KeyboardShortcut) => {
    const parts: string[] = [];
    
    if (shortcut.ctrlKey) parts.push('Ctrl');
    if (shortcut.metaKey) parts.push('Cmd');
    if (shortcut.altKey) parts.push('Alt');
    if (shortcut.shiftKey) parts.push('Shift');
    parts.push(shortcut.key.toUpperCase());
    
    return parts.join('+');
  };

  return shortcuts.map((shortcut) => ({
    keys: getShortcutText(shortcut),
    description: shortcut.description,
  }));
}
