import React, { useMemo, useState } from "react";
import {
  IonButton,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
  IonSpinner,
} from "@ionic/react";
import { useHistory } from "react-router";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, trackEvent } from "../firebase";
import "./OnboardingTerms.css";

const TERMS_VERSION = "2024-10-01";

const OnboardingTerms: React.FC = () => {
  const history = useHistory();
  const [hasRead, setHasRead] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  const sections = useMemo(
    () => [
      {
        title: "Welcome to MacroPal",
        body: [
          "MacroPal helps you track nutrition, workouts, and wellness goals. By using MacroPal, you agree to these terms, our privacy practices, and the health and safety notices below.",
          "If you do not agree, please do not use the app.",
        ],
      },
      {
        title: "Data we collect",
        body: [
          "Account data: email address, display name, and authentication identifiers.",
          "Profile data: gender, age, height, weight, goals, and activity level.",
          "Nutrition data: food entries, meals, favorites, and nutrition targets.",
          "Fitness data: workouts, plans, and weigh-ins.",
          "Content you provide: photos or notes you upload.",
          "Device data: device identifiers, app version, IP address, and usage analytics used to improve app reliability.",
        ],
      },
      {
        title: "How we use your data",
        body: [
          "Provide core services, including calculating macros and generating plans.",
          "Sync your data across devices and keep your account secure.",
          "Respond to support requests and notify you about account-related updates.",
          "Improve the app by analyzing aggregated, de-identified usage trends.",
          "Comply with legal obligations and enforce our terms.",
        ],
      },
      {
        title: "Sharing and disclosure",
        body: [
          "We do not sell your personal data.",
          "We share data only with service providers that help operate MacroPal (such as hosting, analytics, and customer support) under strict confidentiality agreements.",
          "We may disclose information if required by law, to protect our users, or to prevent fraud and abuse.",
        ],
      },
      {
        title: "Your choices and controls",
        body: [
          "You can export or delete your data in Settings → Data & Privacy.",
          "You can update profile details at any time inside the app.",
          "You can request account deletion, which permanently removes your stored data.",
        ],
      },
      {
        title: "Health & safety notice",
        body: [
          "MacroPal provides informational guidance only and is not a medical device.",
          "Consult a qualified healthcare professional before making significant dietary or fitness changes.",
          "Do not use MacroPal to diagnose, treat, or prevent disease.",
        ],
      },
      {
        title: "Content license",
        body: [
          "You retain ownership of the content you upload.",
          "You grant MacroPal a worldwide, non-exclusive license to host, store, process, and display your content solely to operate and improve the service.",
        ],
      },
      {
        title: "Security and retention",
        body: [
          "We use industry-standard safeguards to protect your information.",
          "We retain your data for as long as your account is active or as needed to provide the service and comply with legal requirements.",
        ],
      },
      {
        title: "Updates",
        body: [
          "We may update these terms from time to time. If changes are material, we will notify you in the app.",
        ],
      },
    ],
    []
  );

  const handleScroll = (event: CustomEvent) => {
    const detail = event.detail as { scrollTop?: number; scrollHeight?: number; offsetHeight?: number };
    const scrollTop = detail.scrollTop ?? 0;
    const scrollHeight = detail.scrollHeight ?? 0;
    const offsetHeight = detail.offsetHeight ?? 0;
    if (!hasRead && scrollTop + offsetHeight >= scrollHeight - 16) {
      setHasRead(true);
    }
  };

  const handleAgree = async () => {
    if (saving) return;
    const user = auth.currentUser;
    if (!user) {
      history.replace("/login");
      return;
    }

    setSaving(true);

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          termsAcceptedAt: serverTimestamp(),
          termsVersion: TERMS_VERSION,
        },
        { merge: true }
      );
      trackEvent("terms_accepted", { terms_version: TERMS_VERSION });
      history.replace("/onboarding-profile");
    } catch (error) {
      console.error("Failed to save terms acceptance:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Terms & Privacy</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent
        scrollEvents
        onIonScroll={handleScroll}
        className="ion-padding onboarding-terms-page"
      >
        <div className="onboarding-terms-card">
          <IonText color="medium">
            <p className="onboarding-terms-intro">
              Please review the full terms before continuing. You must scroll to the bottom and
              agree to proceed.
            </p>
          </IonText>

          <div className="onboarding-terms-body">
            {sections.map((section) => (
              <section key={section.title} className="onboarding-terms-section">
                <h2>{section.title}</h2>
                {section.body.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </section>
            ))}
          </div>

          <div className="onboarding-terms-actions">
            <label className="onboarding-terms-checkbox">
              <IonCheckbox
                checked={agreed}
                onIonChange={(event) => setAgreed(event.detail.checked)}
                aria-label="Agree to terms"
              />
              <span>I have read and agree to the terms and privacy practices.</span>
            </label>

            <IonButton
              expand="block"
              disabled={!hasRead || !agreed || saving}
              onClick={handleAgree}
            >
              {saving ? <IonSpinner name="dots" /> : "Agree & Continue"}
            </IonButton>
            {!hasRead && (
              <IonText color="medium">
                <p className="onboarding-terms-hint">Scroll to the bottom to enable the button.</p>
              </IonText>
            )}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default OnboardingTerms;
