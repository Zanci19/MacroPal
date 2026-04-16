import React from 'react';
import { IonToast } from '@ionic/react';
import { checkmarkCircle, alertCircle, informationCircle, warning } from 'ionicons/icons';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number;
  position?: 'top' | 'bottom' | 'middle';
}

interface ToastNotificationProps {
  isOpen: boolean;
  onDidDismiss: () => void;
  config: ToastConfig;
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: checkmarkCircle,
  error: alertCircle,
  info: informationCircle,
  warning: warning,
};

const TOAST_COLORS: Record<ToastType, string> = {
  success: 'success',
  error: 'danger',
  info: 'primary',
  warning: 'warning',
};

/**
 * Toast notification component for user feedback
 * Displays success, error, info, or warning messages
 */
export const ToastNotification: React.FC<ToastNotificationProps> = ({
  isOpen,
  onDidDismiss,
  config,
}) => {
  const { message, type = 'info', duration = 3000, position = 'top' } = config;

  return (
    <IonToast
      isOpen={isOpen}
      onDidDismiss={onDidDismiss}
      message={message}
      duration={duration}
      position={position}
      color={TOAST_COLORS[type]}
      icon={TOAST_ICONS[type]}
      buttons={[
        {
          text: 'Dismiss',
          role: 'cancel',
        },
      ]}
    />
  );
};

/**
 * Hook for managing toast notifications
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [config, setConfig] = React.useState<ToastConfig>({
    message: '',
    type: 'info',
    duration: 3000,
    position: 'top',
  });

  const showToast = React.useCallback((newConfig: ToastConfig) => {
    setConfig({
      type: 'info',
      duration: 3000,
      position: 'top',
      ...newConfig,
    });
    setIsOpen(true);
  }, []);

  const showSuccess = React.useCallback((message: string, duration?: number) => {
    showToast({ message, type: 'success', duration });
  }, [showToast]);

  const showError = React.useCallback((message: string, duration?: number) => {
    showToast({ message, type: 'error', duration });
  }, [showToast]);

  const showInfo = React.useCallback((message: string, duration?: number) => {
    showToast({ message, type: 'info', duration });
  }, [showToast]);

  const showWarning = React.useCallback((message: string, duration?: number) => {
    showToast({ message, type: 'warning', duration });
  }, [showToast]);

  const hideToast = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    config,
    showToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    hideToast,
    ToastComponent: () => (
      <ToastNotification
        isOpen={isOpen}
        onDidDismiss={hideToast}
        config={config}
      />
    ),
  };
}
