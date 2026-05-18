import React, { useState, useEffect } from "react";
import {
  IonButton,
  IonIcon,
  IonProgressBar,
  IonText,
  IonChip,
  IonLabel,
} from "@ionic/react";
import {
  addOutline,
  removeOutline,
  checkmarkCircleOutline,
} from "ionicons/icons";
import { useDemoFirestore } from "../hooks/useDemoFirestore";
import "./WaterIntake.css";

interface WaterIntakeProps {
  dateKey: string;
  userId?: string | null;
}

export interface WaterIntakeData {
  glasses: number; // Number of glasses consumed
  goal: number; // Daily goal in glasses
  [k: string]: unknown;
}

const GLASS_SIZE_ML = 250; // Standard glass size
const getFirestoreErrorCode = (error: unknown): string => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return "";
  }
  return String((error as { code?: unknown }).code ?? "");
};

export const WaterIntake: React.FC<WaterIntakeProps> = ({ dateKey, userId }) => {
  const [waterData, setWaterData] = useState<WaterIntakeData>({
    glasses: 0,
    goal: 8, // Default 8 glasses per day
  });
  const [loading, setLoading] = useState(true);
  const { onSnapshotDoc, setDocData } = useDemoFirestore();

  // Load water intake data with real-time listener
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setWaterData({ glasses: 0, goal: 8 });
      return;
    }

    setLoading(true);
    const unsub = onSnapshotDoc(`users/${userId}/water/${dateKey}`, (data) => {
      const next = data as Partial<WaterIntakeData> | undefined;
      setWaterData({
        glasses: typeof next?.glasses === "number" ? next.glasses : 0,
        goal: typeof next?.goal === "number" && next.goal > 0 ? next.goal : 8,
      });
      setLoading(false);
    });

    return unsub;
  }, [dateKey, onSnapshotDoc, userId]);

  const updateWaterIntake = async (newGlasses: number) => {
    if (!userId) return;

    try {
      const updatedData = {
        ...waterData,
        glasses: Math.max(0, newGlasses),
      };

      await setDocData(`users/${userId}/water/${dateKey}`, updatedData, {
        merge: true,
      });
      setWaterData(updatedData);
    } catch (error) {
      const code = getFirestoreErrorCode(error);
      if (code !== "permission-denied" && code !== "unauthenticated") {
        console.error("Error updating water intake:", error);
      }
    }
  };

  const addGlass = () => {
    updateWaterIntake(waterData.glasses + 1);
  };

  const removeGlass = () => {
    if (waterData.glasses > 0) {
      updateWaterIntake(waterData.glasses - 1);
    }
  };

  const percentage = Math.min((waterData.glasses / waterData.goal) * 100, 100);
  const isGoalReached = waterData.glasses >= waterData.goal;
  const totalMl = waterData.glasses * GLASS_SIZE_ML;
  const totalLiters = (totalMl / 1000).toFixed(1);

  if (loading) {
    return null;
  }

  return (
    <div className="water-intake-container">
      <div className="water-progress-container">
        <IonProgressBar
          value={percentage / 100}
          className={`water-progress ${isGoalReached ? "goal-reached" : ""}`}
        />
        <div className="water-stats">
          <IonText>
            <h3>
              {waterData.glasses} / {waterData.goal} glasses
              {isGoalReached && (
                <IonIcon
                  icon={checkmarkCircleOutline}
                  className="goal-reached-icon"
                  color="success"
                  style={{ marginLeft: 8, fontSize: "1.5rem" }}
                />
              )}
            </h3>
            <p className="water-volume">{totalLiters}L consumed</p>
          </IonText>
        </div>
      </div>

      <div className="water-controls">
        <IonButton
          fill="outline"
          size="small"
          onClick={removeGlass}
          disabled={waterData.glasses === 0}
        >
          <IonIcon slot="start" icon={removeOutline} />
          -1
        </IonButton>
        <IonChip color="primary" className="water-display">
          <IonLabel>{waterData.glasses} glasses</IonLabel>
        </IonChip>
        <IonButton fill="solid" size="small" onClick={addGlass}>
          <IonIcon slot="start" icon={addOutline} />
          +1
        </IonButton>
      </div>

      {isGoalReached && (
        <div className="goal-message">
          <IonText color="success">
            <p>🎉 Great job! You've reached your hydration goal!</p>
          </IonText>
        </div>
      )}
    </div>
  );
};
