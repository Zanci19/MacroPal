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
import { db } from "../firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { auth } from "../firebase";
import "./WaterIntake.css";

interface WaterIntakeProps {
  dateKey: string;
}

export interface WaterIntakeData {
  glasses: number; // Number of glasses consumed
  goal: number; // Daily goal in glasses
  [k: string]: unknown;
}

const GLASS_SIZE_ML = 250; // Standard glass size

export const WaterIntake: React.FC<WaterIntakeProps> = ({ dateKey }) => {
  const [waterData, setWaterData] = useState<WaterIntakeData>({
    glasses: 0,
    goal: 8, // Default 8 glasses per day
  });
  const [loading, setLoading] = useState(true);

  // Load water intake data with real-time listener
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const waterDocRef = doc(db, `users/${user.uid}/water/${dateKey}`);
    const unsub = onSnapshot(
      waterDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as WaterIntakeData;
          setWaterData({
            glasses: data.glasses || 0,
            goal: data.goal || 8,
          });
        } else {
          setWaterData({ glasses: 0, goal: 8 });
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error loading water data:", error);
        setLoading(false);
      }
    );

    return unsub;
  }, [dateKey]);

  const updateWaterIntake = async (newGlasses: number) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const waterDocRef = doc(db, `users/${user.uid}/water/${dateKey}`);
      const updatedData = {
        ...waterData,
        glasses: Math.max(0, newGlasses),
      };

      await setDoc(waterDocRef, updatedData, { merge: true });
      setWaterData(updatedData);
    } catch (error) {
      console.error("Error updating water intake:", error);
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
