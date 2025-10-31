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
    IonToast
} from '@ionic/react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useHistory } from 'react-router-dom';
// adjust this import to your actual firebase config file that exports `auth`
import { auth } from '../firebase';

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
                    />
                </IonItem>

                <IonButton expand="full" onClick={handleRecoverPassword}>
                    Recover Password
                </IonButton>

                <IonText className="ion-text-center" color="medium">
                    <p>Already have an account?</p>
                </IonText>

                <IonButton fill="clear" expand="block" onClick={() => history.push('/login')}>
                    Log In
                </IonButton>

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