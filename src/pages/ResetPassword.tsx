import React from "react";
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
  IonToast
} from "@ionic/react";
import { sendPasswordResetEmail } from "firebase/auth";
import { useHistory } from "react-router-dom";
import { auth } from "../firebase";
import "../styles/forms.css";

const ResetPassword: React.FC = () => {
    const [email, setEmail] = React.useState<string>('');
    const [toast, setToast] = React.useState<{ show: boolean; message: string; color?: string }>({
        show: false,
        message: '',
        color: 'success'
    });
    const history = useHistory();

    const handleRecoverPassword = async () => {
        if (!email.trim()) {
            setToast({ show: true, message: 'Please enter your email address.', color: 'danger' });
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email.trim());
            setToast({ show: true, message: 'Password reset email sent. Check your inbox.', color: 'success' });
        } catch (error: any) {
            console.error('Error sending password reset email:', error);
            const message = error?.message ?? 'Failed to send password reset email.';
            setToast({ show: true, message, color: 'danger' });
        }
    };

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Reset Password</IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent className="mp-auth-content">
                <div className="mp-auth-card" role="main">
                    <div className="mp-auth-card__logo" aria-hidden="true">MP</div>
                    <h1>Reset your password</h1>
                    <p className="mp-auth-subtitle">
                        Enter the email associated with your account and we will send you a secure reset link.
                    </p>

                    <div className="mp-auth-form">
                        <IonItem lines="none">
                            <IonInput
                                labelPlacement="stacked"
                                label="Email"
                                placeholder="you@example.com"
                                type="email"
                                value={email}
                                onIonChange={(e: any) => setEmail(e?.detail?.value ?? '')}
                            />
                        </IonItem>
                    </div>

                    <IonButton className="mp-auth-button" expand="block" size="large" onClick={handleRecoverPassword}>
                        Send reset link
                    </IonButton>

                    <div className="mp-auth-footer">
                        <IonText className="mp-auth-muted">Remembered your password?</IonText>
                        <IonButton fill="clear" onClick={() => history.push('/login')}>
                            Back to login
                        </IonButton>
                    </div>
                </div>

                <IonToast
                    isOpen={toast.show}
                    onDidDismiss={() => setToast(s => ({ ...s, show: false }))}
                    message={toast.message}
                    color={toast.color}
                    duration={3000}
                />
            </IonContent>
        </IonPage>
    );
};

export default ResetPassword;