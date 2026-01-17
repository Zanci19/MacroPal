import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { doc, getDoc } from 'firebase/firestore';
import UpdateGate from './UpdateGate';

// Mock firebase
vi.mock('./firebase', () => ({
  db: {},
  trackEvent: vi.fn(),
}));

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

// Mock version
vi.mock('./hooks/version', () => ({
  APP_VERSION: '1.0.0',
}));

const DISMISSED_VERSION_KEY = 'mp_dismissed_update_version';
type IonToastElement = HTMLElement & {
  buttons?: Array<{ text?: string; handler?: () => void }>;
};

describe('UpdateGate - Announcement Fix', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Version dismissal tracking', () => {
    it('should not show announcement if user has already dismissed the current version', async () => {
      // Set up: User has dismissed version 1.1.0
      localStorage.setItem(DISMISSED_VERSION_KEY, '1.1.0');

      // Firebase returns version 1.1.0 as latest
      const mockGetDoc = vi.mocked(getDoc);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          latestVersion: '1.1.0',
          minSupportedVersion: '1.0.0',
        }),
      } as any);

      render(
        <UpdateGate>
          <div>App Content</div>
        </UpdateGate>
      );

      // Wait for the effect to run
      await waitFor(() => {
        expect(mockGetDoc).toHaveBeenCalled();
      });

      const toasts = screen.getAllByTestId("update-toast");
      const toast = toasts[toasts.length - 1];
      expect(toast).toBeInTheDocument();
      expect(toast.hasAttribute("is-open")).toBe(false);
      // App content should be visible
      expect(screen.getByText('App Content')).toBeInTheDocument();
    });

    it('should show announcement if Firebase version is newer than dismissed version', async () => {
      // Set up: User has dismissed version 1.1.0
      localStorage.setItem(DISMISSED_VERSION_KEY, '1.1.0');

      // Firebase returns version 1.2.0 as latest (newer than dismissed)
      const mockGetDoc = vi.mocked(getDoc);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          latestVersion: '1.2.0',
          minSupportedVersion: '1.0.0',
        }),
      } as any);

      render(
        <UpdateGate>
          <div>App Content</div>
        </UpdateGate>
      );

      // Wait for the toast to appear
      await waitFor(() => {
        const toasts = screen.getAllByTestId("update-toast");
        expect(toasts[toasts.length - 1].hasAttribute("is-open")).toBe(true);
      });
    });

    it('should show announcement if no version has been dismissed yet', async () => {
      // No dismissed version in localStorage
      expect(localStorage.getItem(DISMISSED_VERSION_KEY)).toBeNull();

      // Firebase returns version 1.1.0 as latest
      const mockGetDoc = vi.mocked(getDoc);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          latestVersion: '1.1.0',
          minSupportedVersion: '1.0.0',
        }),
      } as any);

      render(
        <UpdateGate>
          <div>App Content</div>
        </UpdateGate>
      );

      // Wait for the toast to appear
      await waitFor(() => {
        const toasts = screen.getAllByTestId("update-toast");
        expect(toasts[toasts.length - 1].hasAttribute("is-open")).toBe(true);
      });
    });

    it('should save dismissed version to localStorage when user closes announcement', async () => {
      const mockGetDoc = vi.mocked(getDoc);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          latestVersion: '1.1.0',
          minSupportedVersion: '1.0.0',
        }),
      } as any);

      const { getByText } = render(
        <UpdateGate>
          <div>App Content</div>
        </UpdateGate>
      );

      // Wait for the toast to appear
      await waitFor(() => {
        const toasts = screen.getAllByTestId("update-toast");
        expect(toasts[toasts.length - 1].hasAttribute("is-open")).toBe(true);
      });

      const toasts = screen.getAllByTestId("update-toast");
      const toast = toasts[toasts.length - 1] as IonToastElement;
      const laterHandler = toast.buttons?.find((btn) => btn.text === "Later")?.handler;
      expect(typeof laterHandler).toBe("function");
      act(() => {
        laterHandler?.();
      });

      // Wait for localStorage to be updated
      await waitFor(() => {
        const dismissedVersion = localStorage.getItem(DISMISSED_VERSION_KEY);
        expect(dismissedVersion).toBe('1.1.0');
      });
    });
  });

  describe('Version comparison logic', () => {
    it('should not show announcement when current version equals latest version', async () => {
      const mockGetDoc = vi.mocked(getDoc);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          latestVersion: '1.0.0', // Same as APP_VERSION
          minSupportedVersion: '1.0.0',
        }),
      } as any);

      render(
        <UpdateGate>
          <div>App Content</div>
        </UpdateGate>
      );

      await waitFor(() => {
        expect(mockGetDoc).toHaveBeenCalled();
      });

      // Toast should NOT appear
      expect(screen.queryByText(/A new version of MacroPal is available/i)).not.toBeInTheDocument();
    });

    it('should show hard block when current version is below minimum supported', async () => {
      const mockGetDoc = vi.mocked(getDoc);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          latestVersion: '2.0.0',
          minSupportedVersion: '1.5.0', // Higher than APP_VERSION (1.0.0)
        }),
      } as any);

      render(
        <UpdateGate>
          <div>App Content</div>
        </UpdateGate>
      );

      await waitFor(() => {
        expect(screen.getByText(/Update required/i)).toBeInTheDocument();
      });

      // App content should NOT be visible
      expect(screen.queryByText('App Content')).not.toBeInTheDocument();
    });
  });

  describe('Maintenance mode', () => {
    it('should block the app when maintenance mode is enabled', async () => {
      const mockGetDoc = vi.mocked(getDoc);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          maintenanceMode: {
            enabled: true,
            message: "Planned maintenance",
          },
        }),
      } as any);

      render(
        <UpdateGate>
          <div>App Content</div>
        </UpdateGate>
      );

      await waitFor(() => {
        expect(screen.getByText(/back soon/i)).toBeInTheDocument();
      });

      expect(screen.queryByText('App Content')).not.toBeInTheDocument();
    });
  });

  describe('Hard-blocked screen centering', () => {
    it('should have centered text alignment in hard-blocked screen', async () => {
      const mockGetDoc = vi.mocked(getDoc);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          latestVersion: '2.0.0',
          minSupportedVersion: '1.5.0',
        }),
      } as any);

      const { container } = render(
        <UpdateGate>
          <div>App Content</div>
        </UpdateGate>
      );

      await waitFor(() => {
        expect(screen.getByText(/Update required/i)).toBeInTheDocument();
      });

      // Find the container div
      const blockContainer = container.querySelector('div.ion-padding');
      expect(blockContainer).toBeInTheDocument();

      // Check for centering styles
      const styles = window.getComputedStyle(blockContainer!);
      expect(styles.textAlign).toBe('center');
      expect(styles.alignItems).toBe('center');
    });
  });
});
