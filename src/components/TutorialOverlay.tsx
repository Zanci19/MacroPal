import React, { useEffect, useState } from "react";
import {
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
} from "@ionic/react";
import { arrowForwardOutline, closeOutline } from "ionicons/icons";
import "./TutorialOverlay.css";

// Constants for timing and styling
const DOM_READY_DELAY = 100; // ms - wait for DOM to be ready before highlighting
const SPOTLIGHT_PADDING = 8; // px - padding around highlighted element

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string; // CSS selector for the element to highlight
  position: "top" | "bottom" | "center";
  arrowDirection?: "up" | "down" | "left" | "right";
}

interface TutorialOverlayProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to MacroPal! 🎉",
    description: "Let's take a quick tour to help you get started. You can skip this tutorial anytime.",
    position: "center",
  },
  {
    id: "home-tab",
    title: "Home Tab 🏠",
    description: "This is your home screen where you can track your daily meals and see your progress.",
    targetSelector: 'ion-tab-button[tab="home"]',
    position: "top",
    arrowDirection: "down",
  },
  {
    id: "add-food-button",
    title: "Quick Add Food ➕",
    description: "Tap this button anytime to quickly log your meals. It's the fastest way to track what you eat!",
    targetSelector: 'ion-tab-button[tab="quick-add"]',
    position: "top",
    arrowDirection: "down",
  },
  {
    id: "analytics-tab",
    title: "Analytics 📊",
    description: "View detailed charts and statistics about your nutrition and progress over time.",
    targetSelector: 'ion-tab-button[tab="analytics"]',
    position: "top",
    arrowDirection: "down",
  },
  {
    id: "workout-tab",
    title: "Workout Tracker 💪",
    description: "Log your workouts and track calories burned during exercise.",
    targetSelector: 'ion-tab-button[tab="workout"]',
    position: "top",
    arrowDirection: "down",
  },
  {
    id: "settings-tab",
    title: "Settings ⚙️",
    description: "Customize your profile, units, reminders, and other preferences here.",
    targetSelector: 'ion-tab-button[tab="settings"]',
    position: "top",
    arrowDirection: "down",
  },
  {
    id: "delete-food",
    title: "Managing Food Entries 🗑️",
    description: "To delete a food item, simply swipe left on any entry in your meal list and tap the delete button.",
    position: "center",
  },
  {
    id: "complete",
    title: "You're All Set! ✨",
    description: "You're ready to start tracking! Remember, consistency is key to reaching your goals.",
    position: "center",
  },
];

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  isOpen,
  onComplete,
  onSkip,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const currentStep = tutorialSteps[currentStepIndex];
  const isLastStep = currentStepIndex === tutorialSteps.length - 1;

  useEffect(() => {
    if (!isOpen || !currentStep.targetSelector) {
      setHighlightRect(null);
      return;
    }

    // Wait a bit for the DOM to be ready
    const timer = setTimeout(() => {
      const element = document.querySelector(currentStep.targetSelector!);
      if (element) {
        const rect = element.getBoundingClientRect();
        setHighlightRect(rect);
      } else {
        setHighlightRect(null);
      }
    }, DOM_READY_DELAY);

    return () => clearTimeout(timer);
  }, [isOpen, currentStep, currentStepIndex]);

  const handleNext = () => {
    if (isLastStep) {
      console.log("[USER ACTION] Tutorial: Completed tutorial");
      onComplete();
    } else {
      console.log(`[USER ACTION] Tutorial: Advanced to step ${currentStepIndex + 2}`, {
        stepId: tutorialSteps[currentStepIndex + 1].id,
      });
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleSkip = () => {
    console.log(`[USER ACTION] Tutorial: Skipped tutorial at step ${currentStepIndex + 1}`, {
      stepId: currentStep.id,
    });
    onSkip();
  };

  if (!isOpen) return null;

  const getTooltipStyle = (): React.CSSProperties => {
    if (!highlightRect || currentStep.position === "center") {
      return {};
    }

    const style: React.CSSProperties = {};
    const padding = 20;
    const screenPadding = 16;
    const maxCardWidth = Math.min(window.innerWidth - screenPadding * 2, 360);
    const centerX = highlightRect.left + highlightRect.width / 2;
    const clampedCenterX = Math.min(
      Math.max(centerX, screenPadding + maxCardWidth / 2),
      window.innerWidth - screenPadding - maxCardWidth / 2,
    );

    style.left = `${clampedCenterX}px`;
    style.transform = "translateX(-50%)";
    style.maxWidth = `${maxCardWidth}px`;

    if (currentStep.position === "top") {
      style.bottom = `${window.innerHeight - highlightRect.top + padding}px`;
    } else if (currentStep.position === "bottom") {
      style.top = `${highlightRect.bottom + padding}px`;
    }

    return style;
  };

  const getArrowStyle = (): React.CSSProperties => {
    if (!highlightRect || !currentStep.arrowDirection) {
      return { display: "none" };
    }

    const style: React.CSSProperties = {
      position: "fixed",
      pointerEvents: "none",
      zIndex: 10002,
    };

    const offset = 10;

    switch (currentStep.arrowDirection) {
      case "down":
        style.top = `${highlightRect.top - offset}px`;
        style.left = `${highlightRect.left + highlightRect.width / 2}px`;
        style.transform = "translate(-50%, -100%) rotate(90deg)";
        break;
      case "up":
        style.top = `${highlightRect.bottom + offset}px`;
        style.left = `${highlightRect.left + highlightRect.width / 2}px`;
        style.transform = "translateX(-50%) rotate(-90deg)";
        break;
      case "left":
        style.top = `${highlightRect.top + highlightRect.height / 2}px`;
        style.right = `${window.innerWidth - highlightRect.left + offset}px`;
        style.transform = "translateY(-50%) rotate(180deg)";
        break;
      case "right":
        style.top = `${highlightRect.top + highlightRect.height / 2}px`;
        style.left = `${highlightRect.right + offset}px`;
        style.transform = "translateY(-50%)";
        break;
    }

    return style;
  };

  return (
    <div className="tutorial-overlay">
      {/* Dark backdrop with spotlight */}
      <div className="tutorial-backdrop" onClick={handleSkip} />

      {/* Highlight spotlight for targeted elements */}
      {highlightRect && (
        <div
          className="tutorial-spotlight"
          style={{
            top: `${highlightRect.top - SPOTLIGHT_PADDING}px`,
            left: `${highlightRect.left - SPOTLIGHT_PADDING}px`,
            width: `${highlightRect.width + SPOTLIGHT_PADDING * 2}px`,
            height: `${highlightRect.height + SPOTLIGHT_PADDING * 2}px`,
          }}
        />
      )}

      {/* Arrow indicator */}
      {currentStep.arrowDirection && highlightRect && (
        <div className="tutorial-arrow" style={getArrowStyle()}>
          <svg width="40" height="40" viewBox="0 0 40 40">
            <path
              d="M20 5 L35 20 L20 35 L20 25 L5 25 L5 15 L20 15 Z"
              fill="var(--ion-color-primary, #3880ff)"
              stroke="white"
              strokeWidth="2"
            />
          </svg>
        </div>
      )}

      {/* Tutorial card */}
      <div
        className={`tutorial-card-container ${currentStep.position === "center" ? "center" : ""}`}
        style={currentStep.position !== "center" ? getTooltipStyle() : {}}
      >
        <IonCard className="tutorial-card">
          <IonCardContent>
            <button
              className="tutorial-close"
              onClick={handleSkip}
              aria-label="Skip tutorial"
            >
              <IonIcon icon={closeOutline} />
            </button>

            <h2 className="tutorial-title">{currentStep.title}</h2>
            <p className="tutorial-description">{currentStep.description}</p>

            <div className="tutorial-footer">
              <div className="tutorial-progress">
                {tutorialSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`tutorial-progress-dot ${index === currentStepIndex ? "active" : ""} ${index < currentStepIndex ? "completed" : ""}`}
                  />
                ))}
              </div>

              <div className="tutorial-buttons">
                <IonButton
                  fill="clear"
                  onClick={handleSkip}
                  className="tutorial-skip-button"
                >
                  Skip
                </IonButton>
                <IonButton
                  onClick={handleNext}
                  className="tutorial-next-button"
                >
                  {isLastStep ? "Get Started" : "Next"}
                  {!isLastStep && <IonIcon slot="end" icon={arrowForwardOutline} />}
                </IonButton>
              </div>
            </div>
          </IonCardContent>
        </IonCard>
      </div>
    </div>
  );
};

export default TutorialOverlay;
