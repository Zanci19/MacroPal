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
  IonModal,
  IonInput,
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
  addCircleOutline,
  nutritionOutline,
} from "ionicons/icons";
import { auth, db, trackEvent } from "../firebase";
import { doc, setDoc, arrayUnion } from "firebase/firestore";
import {
  recognizeFood,
  type FoodPrediction,
  matchFoodToDatabase,
  matchFoodWithOpenFoodFacts,
} from "../utils/foodRecognition";
import basicFoods from "../data/basicFoods.json";
import { clampDateKeyToToday, isDateKey, todayDateKey } from "../utils/date";
import "./PhotoFoodLogger.css";

type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";

type MacroSet = {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  sugar?: number;
  fiber?: number;
  saturatedFat?: number;
};

type FoodMatch = {
  product_name: string;
  code?: string;
  nutriments?: any;
  serving_size?: string;
  brands?: string;
  matchScore: number;
};

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

function safeNum(n: unknown, dp = 2): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!isFinite(v)) return 0;
  return Number(v.toFixed(dp));
}

function macrosPer100g(nutri?: any): MacroSet {
  return {
    calories: safeNum(nutri?.["energy-kcal_100g"], 0),
    carbs: safeNum(nutri?.["carbohydrates_100g"], 2),
    protein: safeNum(nutri?.["proteins_100g"], 2),
    fat: safeNum(nutri?.["fat_100g"], 2),
    sugar: nutri?.["sugars_100g"] !== undefined ? safeNum(nutri["sugars_100g"], 2) : undefined,
    fiber: nutri?.["fiber_100g"] !== undefined ? safeNum(nutri["fiber_100g"], 2) : undefined,
    saturatedFat: nutri?.["saturated-fat_100g"] !== undefined ? safeNum(nutri["saturated-fat_100g"], 2) : undefined,
  };
}

function scale(macros: MacroSet, factor: number): MacroSet {
  return {
    calories: safeNum(macros.calories * factor, 0),
    carbs: safeNum(macros.carbs * factor, 2),
    protein: safeNum(macros.protein * factor, 2),
    fat: safeNum(macros.fat * factor, 2),
    sugar: macros.sugar !== undefined ? safeNum(macros.sugar * factor, 2) : undefined,
    fiber: macros.fiber !== undefined ? safeNum(macros.fiber * factor, 2) : undefined,
    saturatedFat: macros.saturatedFat !== undefined ? safeNum(macros.saturatedFat * factor, 2) : undefined,
  };
}

const PhotoFoodLogger: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const meal = useMealFromQuery(location);
  const dateKey = useDateFromQuery(location);

  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [predictions, setPredictions] = useState<FoodPrediction[]>([]);
  const [matchedFoods, setMatchedFoods] = useState<Array<{ prediction: FoodPrediction; matches: FoodMatch[] }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState({ show: false, message: "", color: "success" });
  const [useGoogleVision, setUseGoogleVision] = useState(false);

  // Selected food for adding
  const [selectedFood, setSelectedFood] = useState<FoodMatch | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [weightQty, setWeightQty] = useState(100);
  const [adding, setAdding] = useState(false);

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
        setPredictions([]);
        setMatchedFoods([]);
        trackEvent("photo_food_logger_photo_taken");
      }
    } catch (err) {
      console.error("Error taking photo:", err);
      
      // Check if user simply cancelled - don't show error for that
      const errorMessage = String(err);
      if (errorMessage.includes("User cancelled") || errorMessage.includes("cancel")) {
        trackEvent("photo_food_logger_camera_cancelled");
        // Don't set error state for user cancellation
        return;
      }
      
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
        setPredictions([]);
        setMatchedFoods([]);
        trackEvent("photo_food_logger_photo_picked");
      }
    } catch (err) {
      console.error("Error picking photo:", err);
      
      // Check if user simply cancelled - don't show error for that
      const errorMessage = String(err);
      if (errorMessage.includes("User cancelled") || errorMessage.includes("cancel")) {
        trackEvent("photo_food_logger_gallery_cancelled");
        // Don't set error state for user cancellation
        return;
      }
      
      setError("Failed to select photo. Please try again.");
      trackEvent("photo_food_logger_gallery_error", { error: String(err) });
    }
  };

  const analyzePhoto = async () => {
    if (!photoDataUrl) return;

    setAnalyzing(true);
    setError(null);
    setPredictions([]);
    setMatchedFoods([]);

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
        
        // Search both local database and OpenFoodFacts API
        console.log('[PhotoFoodLogger] Searching local database and OpenFoodFacts...');
        const [localMatches, offMatches] = await Promise.all([
          Promise.resolve(matchFoodToDatabase(result.predictions, basicFoods as any[])),
          matchFoodWithOpenFoodFacts(result.predictions)
        ]);
        
        // Combine results with OpenFoodFacts prioritized by array order
        const combinedMatches = result.predictions.map((prediction, idx) => {
          const local = localMatches[idx]?.matches || [];
          const off = offMatches[idx]?.matches || [];
          
          // Combine with OFF first (prioritization), then deduplicate by product code or name
          const allMatches = [...off, ...local];
          const seen = new Set<string>();
          const unique = allMatches.filter(match => {
            // Use normalized product_name as fallback if code is missing
            const key = match.code || (match.product_name || '').toLowerCase().trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          
          // Sort by match score and take top 5
          const topMatches = unique
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 5);
          
          return {
            prediction,
            matches: topMatches
          };
        });
        
        setMatchedFoods(combinedMatches.filter(m => m.matches.length > 0));
        
        const totalMatches = combinedMatches.reduce((sum, m) => sum + m.matches.length, 0);
        setToast({
          show: true,
          message: `Found ${result.predictions.length} food items with ${totalMatches} matches!`,
          color: "success",
        });
        
        trackEvent("photo_food_logger_analyze_success", {
          predictionsCount: result.predictions.length,
          matchesCount: combinedMatches.filter(m => m.matches.length > 0).length,
          totalMatches,
          source: result.predictions[0]?.source,
        });
      } else {
        setError(result.error || "No food items detected. Try a different photo or angle.");
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

  const openAddModal = (food: FoodMatch) => {
    setSelectedFood(food);
    setWeightQty(100);
    setShowAddModal(true);
    trackEvent("photo_food_logger_open_add_modal", { foodName: food.product_name });
  };

  const addFoodToMeal = async () => {
    const user = auth.currentUser;
    if (!user || !selectedFood || adding) return;

    setAdding(true);

    try {
      const per100g = macrosPer100g(selectedFood.nutriments);
      const grams = Math.max(1, weightQty);
      const factor = grams / 100;
      const total = scale(per100g, factor);

      const item = {
        code: selectedFood.code || `photo_${Date.now()}`,
        name: selectedFood.product_name || "(no name)",
        brand: selectedFood.brands || null,
        dataSource: "photo_recognition",
        base: { amount: 100, unit: "g", label: "100 g" },
        selection: {
          mode: "weight",
          note: `${grams} g`,
          servingsQty: null,
          weightQty: grams,
        },
        perBase: per100g,
        total: total,
        photoUrl: photoDataUrl, // Store the photo with the entry
        photoName: "ai-recognized-food.jpg",
        addedAt: new Date().toISOString(),
      };

      const userRef = doc(db, "users", user.uid, "foods", dateKey);
      await setDoc(userRef, { [meal]: arrayUnion(item) }, { merge: true });

      trackEvent("photo_food_logger_add_success", {
        uid: user.uid,
        meal,
        date: dateKey,
        name: item.name,
        calories: item.total.calories,
        grams,
      });

      setToast({
        show: true,
        message: `Added ${selectedFood.product_name} to ${meal}!`,
        color: "success",
      });

      setShowAddModal(false);
      
      // Navigate back to home after a short delay
      setTimeout(() => {
        history.replace(`/app/home?date=${dateKey}`);
      }, 1500);
    } catch (err) {
      console.error("Error adding food:", err);
      setToast({
        show: true,
        message: "Failed to add food. Please try again.",
        color: "danger",
      });
      trackEvent("photo_food_logger_add_error", { error: String(err) });
    } finally {
      setAdding(false);
    }
  };

  const retakePhoto = () => {
    setPhotoDataUrl(null);
    setPredictions([]);
    setMatchedFoods([]);
    setError(null);
    trackEvent("photo_food_logger_retake");
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/app/home" />
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
                  Take a photo of your food and let AI identify it with full nutrition data!
                </p>
              </IonText>

              {/* Current Mode Display */}
              <div className="current-mode-display">
                <IonChip color={useGoogleVision ? "success" : "primary"}>
                  <IonIcon icon={sparklesOutline} />
                  <IonLabel>
                    <strong>
                      {useGoogleVision ? "Google Vision API Mode" : "TensorFlow.js Mode (FREE)"}
                    </strong>
                  </IonLabel>
                </IonChip>
                <IonText color="medium" style={{ fontSize: '13px', marginTop: '4px', display: 'block' }}>
                  {useGoogleVision 
                    ? "🎯 Enhanced accuracy - Using Google Cloud Vision"
                    : "🆓 100% Free - Runs locally on your device"}
                </IonText>
              </div>

              {/* Google Vision Toggle */}
              <IonItem lines="none" className="google-vision-toggle">
                <IonIcon icon={sparklesOutline} slot="start" color={useGoogleVision ? "success" : "medium"} />
                <IonLabel>
                  <h3>Use Google Vision AI (Optional Upgrade)</h3>
                  <p>
                    {import.meta.env.VITE_GOOGLE_VISION_API_KEY 
                      ? "More accurate • 1000 free/month" 
                      : "Requires API key setup"}
                  </p>
                </IonLabel>
                <IonToggle
                  checked={useGoogleVision}
                  onIonChange={(e) => setUseGoogleVision(e.detail.checked)}
                  disabled={!import.meta.env.VITE_GOOGLE_VISION_API_KEY}
                />
              </IonItem>
              {!import.meta.env.VITE_GOOGLE_VISION_API_KEY && (
                <IonNote color="medium" className="ion-padding-start">
                  💡 TensorFlow.js works great without any setup! Google Vision is optional for better accuracy.
                  <br />
                  See WHAT_IS_THIS_EXPLAINED.md for setup instructions.
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

          {/* Matched Foods Display */}
          {matchedFoods.length > 0 && (
            <IonCard className="predictions-card">
              <IonCardHeader>
                <IonCardTitle>
                  <IonIcon icon={checkmarkCircleOutline} color="success" /> Detected Foods with Nutrition Data
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                {matchedFoods.map((matchGroup, idx) => (
                  <div key={idx} className="match-group">
                    <IonText color="medium">
                      <p className="prediction-label">
                        <IonIcon icon={sparklesOutline} /> 
                        AI detected: <strong>{matchGroup.prediction.name}</strong> ({(matchGroup.prediction.confidence * 100).toFixed(0)}%)
                      </p>
                    </IonText>
                    <IonList>
                      {matchGroup.matches.slice(0, 3).map((food, fidx) => {
                        const macros = macrosPer100g(food.nutriments);
                        return (
                          <IonItem key={fidx} button onClick={() => openAddModal(food)}>
                            <IonLabel>
                              <h2>{food.product_name}</h2>
                              {food.brands && <p>{food.brands}</p>}
                              <p>
                                <IonText color="medium">
                                  Per 100g: {macros.calories} cal | {macros.protein}g protein | {macros.carbs}g carbs | {macros.fat}g fat
                                </IonText>
                              </p>
                            </IonLabel>
                            <IonBadge slot="end" color="success">
                              <IonIcon icon={addCircleOutline} /> Add
                            </IonBadge>
                          </IonItem>
                        );
                      })}
                    </IonList>
                  </div>
                ))}
                <IonNote className="ion-padding-top">
                  Tap any item to add it to your {meal} with nutrition data
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

        {/* Add Food Modal */}
        <IonModal isOpen={showAddModal} onDidDismiss={() => setShowAddModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonButtons slot="start">
                <IonButton onClick={() => setShowAddModal(false)}>Cancel</IonButton>
              </IonButtons>
              <IonTitle>Add to {meal}</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            {selectedFood && (
              <div className="add-modal-content">
                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle>{selectedFood.product_name}</IonCardTitle>
                    {selectedFood.brands && <IonText color="medium"><p>{selectedFood.brands}</p></IonText>}
                  </IonCardHeader>
                  <IonCardContent>
                    <IonItem>
                      <IonLabel position="stacked">Amount (grams)</IonLabel>
                      <IonInput
                        type="number"
                        value={weightQty}
                        onIonChange={(e) => setWeightQty(Math.max(1, Number(e.detail.value || 100)))}
                        min={1}
                      />
                    </IonItem>

                    {/* Nutrition Display */}
                    <div className="nutrition-display ion-margin-top">
                      <h3><IonIcon icon={nutritionOutline} /> Nutrition for {weightQty}g</h3>
                      {(() => {
                        const per100g = macrosPer100g(selectedFood.nutriments);
                        const total = scale(per100g, weightQty / 100);
                        return (
                          <IonList>
                            <IonItem>
                              <IonLabel>Calories</IonLabel>
                              <IonText slot="end"><strong>{total.calories} kcal</strong></IonText>
                            </IonItem>
                            <IonItem>
                              <IonLabel>Protein</IonLabel>
                              <IonText slot="end">{total.protein}g</IonText>
                            </IonItem>
                            <IonItem>
                              <IonLabel>Carbs</IonLabel>
                              <IonText slot="end">{total.carbs}g</IonText>
                            </IonItem>
                            <IonItem>
                              <IonLabel>Fat</IonLabel>
                              <IonText slot="end">{total.fat}g</IonText>
                            </IonItem>
                          </IonList>
                        );
                      })()}
                    </div>

                    <IonButton
                      expand="block"
                      className="ion-margin-top"
                      onClick={addFoodToMeal}
                      disabled={adding}
                    >
                      {adding ? (
                        <>
                          <IonSpinner name="crescent" />
                          <span className="ion-margin-start">Adding...</span>
                        </>
                      ) : (
                        <>
                          <IonIcon icon={addCircleOutline} slot="start" />
                          Add to {meal}
                        </>
                      )}
                    </IonButton>
                  </IonCardContent>
                </IonCard>
              </div>
            )}
          </IonContent>
        </IonModal>

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
