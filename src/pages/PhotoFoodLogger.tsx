import React, { useState, useEffect, useRef } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSpinner,
  IonText,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonIcon,
  IonToast,
  IonToggle,
  IonNote,
  IonChip,
  IonGrid,
  IonRow,
  IonCol,
  useIonViewDidEnter,
} from "@ionic/react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { useHistory, useLocation } from "react-router";
import {
  cameraOutline,
  imagesOutline,
  sparklesOutline,
  searchOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
} from "ionicons/icons";
import { trackEvent } from "../firebase";
import {
  recognizeFood,
  type FoodPrediction,
  matchFoodToDatabase,
} from "../utils/foodRecognition";
import basicFoods from "../data/basicFoods.json";
import { clampDateKeyToToday, isDateKey, todayDateKey } from "../utils/date";
import "./PhotoFoodLogger.css";

type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";

function useMealFromQuery(location: ReturnType<typeof useLocation>): MealKey {
  const p = new URLSearchParams(location.search);
  const m = (p.get("meal") || "breakfast").toLowerCase();
  return (["breakfast", "lunch", "dinner", "snacks"] as const).includes(m as MealKey)
    ? (m as MealKey)
    : "breakfast";
}

function useDateFromQuery(location: ReturnType<typeof useLocation>) {
  const p = new URLSearchParams(location.search);
  const d = p.get("date");
  if (isDateKey(d)) {
    return clampDateKeyToToday(d!);
  }
  return todayDateKey();
}

const PhotoFoodLogger: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const meal = useMealFromQuery(location);
  const dateKey = useDateFromQuery(location);

  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [predictions, setPredictions] = useState<FoodPrediction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState({ show: false, message: "", color: "success" });
  const [useGoogleVision, setUseGoogleVision] = useState(false);

  // Track screen view
  useIonViewDidEnter(() => {
    trackEvent("photo_food_logger_view", { meal, date: dateKey });
  });

  const takePhoto = async () => {
    try {
      trackEvent("photo_food_logger_camera_open");
      
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      if (photo.dataUrl) {
        setPhotoDataUrl(photo.dataUrl);
        setError(null);
        trackEvent("photo_food_logger_photo_taken");
      }
    } catch (err) {
      console.error("Error taking photo:", err);
      setError("Failed to take photo. Please try again.");
      trackEvent("photo_food_logger_camera_error", { error: String(err) });
    }
  };

  const pickFromGallery = async () => {
    try {
      trackEvent("photo_food_logger_gallery_open");
      
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
      });

      if (photo.dataUrl) {
        setPhotoDataUrl(photo.dataUrl);
        setError(null);
        trackEvent("photo_food_logger_photo_picked");
      }
    } catch (err) {
      console.error("Error picking photo:", err);
      setError("Failed to select photo. Please try again.");
      trackEvent("photo_food_logger_gallery_error", { error: String(err) });
    }
  };

  const analyzePhoto = async () => {
    if (!photoDataUrl) return;

    setAnalyzing(true);
    setError(null);
    setPredictions([]);

    try {
      trackEvent("photo_food_logger_analyze_start", { 
        useGoogleVision,
        meal,
        date: dateKey 
      });

      const result = await recognizeFood(
        photoDataUrl,
        useGoogleVision,
        import.meta.env.VITE_GOOGLE_VISION_API_KEY
      );

      if (result.success && result.predictions.length > 0) {
        setPredictions(result.predictions);
        setToast({
          show: true,
          message: `Found ${result.predictions.length} food items!`,
          color: "success",
        });
        trackEvent("photo_food_logger_analyze_success", {
          predictionsCount: result.predictions.length,
          source: result.predictions[0]?.source,
        });
      } else {
        setError(result.error || "No food items detected. Try a different photo.");
        trackEvent("photo_food_logger_analyze_no_results");
      }
    } catch (err) {
      console.error("Error analyzing photo:", err);
      setError("Failed to analyze photo. Please try again.");
      trackEvent("photo_food_logger_analyze_error", { error: String(err) });
    } finally {
      setAnalyzing(false);
    }
  };

  const searchForFood = (foodName: string) => {
    // Navigate to AddFood page with search query
    const params = new URLSearchParams({
      meal,
      date: dateKey,
      search: foodName,
    });
    trackEvent("photo_food_logger_search_food", { foodName, meal });
    history.push(`/add-food?${params.toString()}`);
  };

  const retakePhoto = () => {
    setPhotoDataUrl(null);
    setPredictions([]);
    setError(null);
    trackEvent("photo_food_logger_retake");
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/home" />
          </IonButtons>
          <IonTitle>AI Food Recognition</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="photo-food-logger-content">
        <div className="photo-food-logger-container">
          {/* Info Card */}
          <IonCard className="info-card">
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={sparklesOutline} /> AI-Powered Food Recognition
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonText color="medium">
                <p>
                  Take a photo of your food and let AI identify it for you!
                  Uses free TensorFlow.js for local recognition.
                </p>
              </IonText>

              {/* Google Vision Toggle */}
              <IonItem lines="none" className="google-vision-toggle">
                <IonIcon icon={sparklesOutline} slot="start" color="primary" />
                <IonLabel>
                  <h3>Use Google Vision AI</h3>
                  <p>Enhanced accuracy (1000 free/month)</p>
                </IonLabel>
                <IonToggle
                  checked={useGoogleVision}
                  onIonChange={(e) => setUseGoogleVision(e.detail.checked)}
                  disabled={!import.meta.env.VITE_GOOGLE_VISION_API_KEY}
                />
              </IonItem>
              {!import.meta.env.VITE_GOOGLE_VISION_API_KEY && (
                <IonNote color="warning" className="ion-padding-start">
                  Configure VITE_GOOGLE_VISION_API_KEY to use Google Vision
                </IonNote>
              )}
            </IonCardContent>
          </IonCard>

          {/* Photo Display */}
          {photoDataUrl ? (
            <IonCard className="photo-preview-card">
              <img
                src={photoDataUrl}
                alt="Food"
                className="photo-preview"
              />
              <IonCardContent>
                <IonGrid>
                  <IonRow>
                    <IonCol>
                      <IonButton
                        expand="block"
                        onClick={analyzePhoto}
                        disabled={analyzing}
                      >
                        {analyzing ? (
                          <>
                            <IonSpinner name="crescent" />
                            <span className="ion-margin-start">Analyzing...</span>
                          </>
                        ) : (
                          <>
                            <IonIcon icon={sparklesOutline} slot="start" />
                            Analyze Photo
                          </>
                        )}
                      </IonButton>
                    </IonCol>
                  </IonRow>
                  <IonRow>
                    <IonCol>
                      <IonButton
                        expand="block"
                        fill="outline"
                        onClick={retakePhoto}
                        disabled={analyzing}
                      >
                        Retake Photo
                      </IonButton>
                    </IonCol>
                  </IonRow>
                </IonGrid>
              </IonCardContent>
            </IonCard>
          ) : (
            /* Camera Buttons */
            <IonCard className="camera-buttons-card">
              <IonCardContent>
                <IonGrid>
                  <IonRow>
                    <IonCol>
                      <IonButton
                        expand="block"
                        size="large"
                        onClick={takePhoto}
                      >
                        <IonIcon icon={cameraOutline} slot="start" />
                        Take Photo
                      </IonButton>
                    </IonCol>
                  </IonRow>
                  <IonRow>
                    <IonCol>
                      <IonButton
                        expand="block"
                        size="large"
                        fill="outline"
                        onClick={pickFromGallery}
                      >
                        <IonIcon icon={imagesOutline} slot="start" />
                        Choose from Gallery
                      </IonButton>
                    </IonCol>
                  </IonRow>
                </IonGrid>
              </IonCardContent>
            </IonCard>
          )}

          {/* Error Display */}
          {error && (
            <IonCard color="danger" className="error-card">
              <IonCardContent>
                <IonText color="light">
                  <IonIcon icon={closeCircleOutline} /> {error}
                </IonText>
              </IonCardContent>
            </IonCard>
          )}

          {/* Predictions Display */}
          {predictions.length > 0 && (
            <IonCard className="predictions-card">
              <IonCardHeader>
                <IonCardTitle>
                  <IonIcon icon={checkmarkCircleOutline} color="success" /> Detected Foods
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonList>
                  {predictions.map((pred, idx) => (
                    <IonItem key={idx} button onClick={() => searchForFood(pred.name)}>
                      <IonLabel>
                        <h2>{pred.name}</h2>
                        <p>
                          Confidence: {(pred.confidence * 100).toFixed(1)}%
                          {" • "}
                          <IonText color="medium">
                            {pred.source === 'mobilenet' ? 'TensorFlow' : 'Google Vision'}
                          </IonText>
                        </p>
                      </IonLabel>
                      <IonBadge slot="end" color="primary">
                        <IonIcon icon={searchOutline} /> Search
                      </IonBadge>
                    </IonItem>
                  ))}
                </IonList>
                <IonNote className="ion-padding-top">
                  Tap any item to search in the food database
                </IonNote>
              </IonCardContent>
            </IonCard>
          )}

          {/* Meal Context Display */}
          <IonCard className="meal-context-card">
            <IonCardContent>
              <IonText color="medium">
                <p className="ion-text-center">
                  Adding for: <IonChip color="primary">{meal}</IonChip>
                  <IonChip>{dateKey}</IonChip>
                </p>
              </IonText>
            </IonCardContent>
          </IonCard>
        </div>

        <IonToast
          isOpen={toast.show}
          message={toast.message}
          duration={3000}
          color={toast.color}
          onDidDismiss={() => setToast({ ...toast, show: false })}
        />
      </IonContent>
    </IonPage>
  );
};

export default PhotoFoodLogger;
