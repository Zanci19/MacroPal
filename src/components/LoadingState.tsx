import React from 'react';
import { IonSpinner, IonText } from '@ionic/react';
import './LoadingState.css';

interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  fullPage?: boolean;
}

/**
 * Reusable loading state component
 * Shows a spinner with optional message
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  message,
  size = 'medium',
  fullPage = false,
}) => {
  const containerClass = fullPage
    ? 'loading-state loading-state--full-page'
    : 'loading-state';

  return (
    <div className={containerClass}>
      <IonSpinner name="crescent" className={`loading-state__spinner loading-state__spinner--${size}`} />
      {message && (
        <IonText color="medium" className="loading-state__message">
          <p>{message}</p>
        </IonText>
      )}
    </div>
  );
};

interface LoadingOverlayProps {
  isOpen: boolean;
  message?: string;
}

/**
 * Full-page loading overlay
 * Blocks interaction while loading
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isOpen, message }) => {
  if (!isOpen) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-overlay__backdrop" />
      <div className="loading-overlay__content">
        <LoadingState message={message} size="large" />
      </div>
    </div>
  );
};
