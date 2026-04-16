import React, { useState } from "react";
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonList,
  IonItem,
  IonLabel,
  IonChip,
  IonIcon,
  IonSearchbar,
} from "@ionic/react";
import { addOutline, closeOutline } from "ionicons/icons";
import type { MealKey } from "../types";
import "./QuickAddModal.css";

interface QuickAddModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onAddFood: (meal: MealKey, foodName: string, calories: number) => void;
  dateKey: string;
}

interface QuickFood {
  name: string;
  emoji: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  defaultMeal: MealKey;
}

const QUICK_FOODS: QuickFood[] = [
  { name: "Coffee (Black)", emoji: "☕", calories: 5, protein: 0.3, carbs: 0, fat: 0, defaultMeal: "breakfast" },
  { name: "Coffee with Milk", emoji: "☕", calories: 30, protein: 2, carbs: 3, fat: 1, defaultMeal: "breakfast" },
  { name: "Banana", emoji: "🍌", calories: 105, protein: 1.3, carbs: 27, fat: 0.4, defaultMeal: "breakfast" },
  { name: "Apple", emoji: "🍎", calories: 95, protein: 0.5, carbs: 25, fat: 0.3, defaultMeal: "snacks" },
  { name: "Orange", emoji: "🍊", calories: 62, protein: 1.2, carbs: 15, fat: 0.2, defaultMeal: "snacks" },
  { name: "Greek Yogurt", emoji: "🥛", calories: 100, protein: 17, carbs: 6, fat: 0.4, defaultMeal: "breakfast" },
  { name: "Protein Shake", emoji: "🥤", calories: 120, protein: 25, carbs: 3, fat: 1.5, defaultMeal: "snacks" },
  { name: "Almonds (handful)", emoji: "🥜", calories: 160, protein: 6, carbs: 6, fat: 14, defaultMeal: "snacks" },
  { name: "Boiled Egg", emoji: "🥚", calories: 78, protein: 6, carbs: 0.6, fat: 5, defaultMeal: "breakfast" },
  { name: "Slice of Bread", emoji: "🍞", calories: 80, protein: 3, carbs: 15, fat: 1, defaultMeal: "breakfast" },
  { name: "Chicken Breast (100g)", emoji: "🍗", calories: 165, protein: 31, carbs: 0, fat: 3.6, defaultMeal: "lunch" },
  { name: "Rice Bowl", emoji: "🍚", calories: 200, protein: 4, carbs: 45, fat: 0.4, defaultMeal: "lunch" },
  { name: "Mixed Salad", emoji: "🥗", calories: 50, protein: 2, carbs: 8, fat: 2, defaultMeal: "lunch" },
  { name: "Avocado Toast", emoji: "🥑", calories: 250, protein: 7, carbs: 30, fat: 12, defaultMeal: "breakfast" },
  { name: "Protein Bar", emoji: "🍫", calories: 200, protein: 20, carbs: 20, fat: 6, defaultMeal: "snacks" },
  { name: "Green Tea", emoji: "🍵", calories: 2, protein: 0, carbs: 0, fat: 0, defaultMeal: "snacks" },
  { name: "Glass of Water", emoji: "💧", calories: 0, protein: 0, carbs: 0, fat: 0, defaultMeal: "snacks" },
  { name: "Smoothie Bowl", emoji: "🍹", calories: 280, protein: 8, carbs: 45, fat: 8, defaultMeal: "breakfast" },
];

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onDismiss,
  onAddFood,
  dateKey,
}) => {
  void dateKey;
  const [searchText, setSearchText] = useState("");

  const filteredFoods = QUICK_FOODS.filter((food) =>
    food.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleAddFood = (food: QuickFood, meal: MealKey) => {
    onAddFood(meal, food.name, food.calories);
    onDismiss();
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Quick Add</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonSearchbar
          value={searchText}
          onIonInput={(e) => setSearchText(e.detail.value || "")}
          placeholder="Search quick foods..."
        />
        <IonList>
          {filteredFoods.map((food, index) => (
            <IonItem key={index} className="quick-food-item">
              <IonLabel>
                <h2>
                  <span className="food-emoji">{food.emoji}</span>
                  {food.name}
                </h2>
                <p>
                  {food.calories} kcal · P: {food.protein}g · C: {food.carbs}g · F: {food.fat}g
                </p>
              </IonLabel>
              <div className="meal-chips" slot="end">
                <IonChip
                  color={food.defaultMeal === "breakfast" ? "primary" : "medium"}
                  onClick={() => handleAddFood(food, "breakfast")}
                >
                  <IonIcon icon={addOutline} />
                  <IonLabel>B</IonLabel>
                </IonChip>
                <IonChip
                  color={food.defaultMeal === "lunch" ? "primary" : "medium"}
                  onClick={() => handleAddFood(food, "lunch")}
                >
                  <IonIcon icon={addOutline} />
                  <IonLabel>L</IonLabel>
                </IonChip>
                <IonChip
                  color={food.defaultMeal === "dinner" ? "primary" : "medium"}
                  onClick={() => handleAddFood(food, "dinner")}
                >
                  <IonIcon icon={addOutline} />
                  <IonLabel>D</IonLabel>
                </IonChip>
                <IonChip
                  color={food.defaultMeal === "snacks" ? "primary" : "medium"}
                  onClick={() => handleAddFood(food, "snacks")}
                >
                  <IonIcon icon={addOutline} />
                  <IonLabel>S</IonLabel>
                </IonChip>
              </div>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonModal>
  );
};
