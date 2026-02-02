/**
 * Accessibility utilities for improving WCAG compliance
 * Provides helpers for keyboard navigation, ARIA labels, and screen readers
 */

/**
 * Generate unique IDs for ARIA relationships
 */
export function generateAriaId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Announce a message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Check if an element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  if (element.tabIndex < 0) return false;
  
  const focusableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
  if (focusableTags.includes(element.tagName)) return true;
  
  return element.tabIndex >= 0;
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll(selector));
}

/**
 * Trap focus within a container (useful for modals)
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = getFocusableElements(container);
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Format a number for screen readers with appropriate description
 */
export function formatNumberForScreenReader(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} ${unit}${rounded !== 1 ? 's' : ''}`;
}

/**
 * Format calories for screen reader
 */
export function formatCaloriesForScreenReader(calories: number, goal?: number): string {
  const caloriesText = formatNumberForScreenReader(calories, 'calorie');
  
  if (goal) {
    const remaining = goal - calories;
    if (remaining > 0) {
      return `${caloriesText} consumed, ${formatNumberForScreenReader(remaining, 'calorie')} remaining`;
    } else {
      return `${caloriesText} consumed, ${formatNumberForScreenReader(Math.abs(remaining), 'calorie')} over goal`;
    }
  }
  
  return caloriesText;
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches;
}

/**
 * Get appropriate aria-label for a button action
 */
export function getButtonAriaLabel(
  action: string,
  target?: string,
  context?: string
): string {
  const parts = [action];
  if (target) parts.push(target);
  if (context) parts.push(context);
  return parts.join(' ');
}

/**
 * Create CSS class for screen reader only content
 * Use this in your CSS files
 */
export const SR_ONLY_CLASS = 'sr-only';

/**
 * Example CSS for .sr-only class:
 * 
 * .sr-only {
 *   position: absolute;
 *   width: 1px;
 *   height: 1px;
 *   padding: 0;
 *   margin: -1px;
 *   overflow: hidden;
 *   clip: rect(0, 0, 0, 0);
 *   white-space: nowrap;
 *   border-width: 0;
 * }
 */
