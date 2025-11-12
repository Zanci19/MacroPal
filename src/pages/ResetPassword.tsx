import React from 'react';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
  IonToast,
} from '@ionic/react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useHistory } from 'react-router-dom';
import { auth } from '../firebase';

const COOLDOWN_MS_DEFAULT = 60_000; // 60s after a successful send
const COOLDOWN_MS_RATE_LIMIT = 5 * 60_000; // 5min if Firebase returns auth/too-many-requests
const LS_KEY = 'resetPasswordCooldownUntil';

const ResetPassword: React.FC = () => {
  const [email, setEmail] = React.useState<string>('');
  const [toast, setToast] = React.useState<{ show: boolean; message: string; color?: string }>({
    show: false,
    message: '',
    color: 'success',
  });
  const [cooldownMsLeft, setCooldownMsLeft] = React.useState<number>(0);
  const [sending, setSending] = React.useState<boolean>(false);
  const history = useHistory();

  // Load any existing cooldown from localStorage on mount
  React.useEffect(() => {
    const until = Number(localStorage.getItem(LS_KEY) || '0');
    const now = Date.now();
    if (until > now) {
      setCooldownMsLeft(until - now);
    }
  }, []);

  // Tick the countdown once per second while there's time left
  React.useEffect(() => {
    if (cooldownMsLeft <= 0) return;
    const id = setInterval(() => {
      setCooldownMsLeft((prev) => {
        const next = Math.max(0, prev - 1000);
        if (next === 0) {
          // clear persisted cooldown when it ends
          localStorage.removeItem(LS_KEY);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownMsLeft]);

  const startCooldown = (durationMs: number) => {
    const until = Date.now() + durationMs;
    localStorage.setItem(LS_KEY, String(until));
    setCooldownMsLeft(durationMs);
  };

  const formatSeconds = (ms: number) => Math.ceil(ms / 1000);

  const handleRecoverPassword = async () => {
    if (!email.trim()) {
      setToast({ show: true, message: 'Please enter your email address.', color: 'danger' });
      return;
    }
    if (cooldownMsLeft > 0) {
      setToast({
        show: true,
        message: `Please wait ${formatSeconds(cooldownMsLeft)}s before requesting again.`,
        color: 'warning',
      });
      return;
    }

    try {
      setSending(true);
      await sendPasswordResetEmail(auth, email.trim());
      setToast({
        show: true,
        message: 'Password reset email sent. Check your inbox.',
        color: 'success',
      });
      startCooldown(COOLDOWN_MS_DEFAULT);
    } catch (error: any) {
      console.error('Error sending password reset email:', error);
      const code = error?.code as string | undefined;

      if (code === 'auth/too-many-requests') {
        // Back off more aggressively if Firebase is rate limiting
        startCooldown(COOLDOWN_MS_RATE_LIMIT);
        setToast({
          show: true,
          message:
            'Too many attempts. Please try again in a few minutes.',
          color: 'danger',
        });
      } else {
        const message = error?.message ?? 'Failed to send password reset email.';
        setToast({ show: true, message, color: 'danger' });
      }
    } finally {
      setSending(false);
    }
  };

  const secondsLeft = formatSeconds(cooldownMsLeft);
  const buttonDisabled = sending || cooldownMsLeft > 0;
  const buttonLabel =
    sending
      ? 'Sending…'
      : cooldownMsLeft > 0
        ? `Resend in ${secondsLeft}s`
        : 'Recover Password';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Reset Password</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <h2 className="start-subtitle">
          Please enter the email associated with your account:
        </h2>

        <IonItem>
          <IonInput
            value={email}
            placeholder="Email"
            type="email"
            onIonChange={(e: any) => setEmail(e?.detail?.value ?? '')}
            disabled={sending}
          />
        </IonItem>

        <IonButton expand="full" onClick={handleRecoverPassword} disabled={buttonDisabled}>
          {buttonLabel}
        </IonButton>

        {cooldownMsLeft > 0 && (
          <IonText color="medium">
            <p className="ion-text-center" style={{ marginTop: 8 }}>
              You can request another reset email in {secondsLeft}s.
            </p>
          </IonText>
        )}

        <IonText className="ion-text-center" color="medium">
          <p>Already have an account?</p>
        </IonText>

        <IonButton fill="clear" expand="block" onClick={() => history.push('/login')} disabled={sending}>
          Log In
        </IonButton>

        <IonToast
          isOpen={toast.show}
          onDidDismiss={() => setToast((s) => ({ ...s, show: false }))}
          message={toast.message}
          color={toast.color}
          duration={3000}
        />
      </IonContent>
    </IonPage>
  );
};

export default ResetPassword;
