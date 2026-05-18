import React, { useEffect, useMemo, useState } from "react";
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
  IonIcon,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonText,
} from "@ionic/react";
import { addOutline, closeOutline } from "ionicons/icons";
import type { MealKey } from "../types";
import "./QuickAddModal.css";

interface QuickAddModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onAddFood: (meal: MealKey, food: QuickFood) => void;
  dateKey: string;
}

export interface QuickFood {
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

type MealFilter = "all" | MealKey;

const MEAL_FILTERS: Array<{ value: MealFilter; label: string }> = [
  { value: "all", label: "Default" },
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snacks", label: "Snacks" },
];

const isMealFilter = (value: unknown): value is MealFilter =>
  value === "all" ||
  value === "breakfast" ||
  value === "lunch" ||
  value === "dinner" ||
  value === "snacks";

const mealLabel = (meal: MealKey) =>
  meal === "snacks" ? "Snacks" : meal[0].toUpperCase() + meal.slice(1);

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onDismiss,
  onAddFood,
  dateKey,
}) => {
  const [searchText, setSearchText] = useState("");
  const [targetMeal, setTargetMeal] = useState<MealFilter>("all");

  useEffect(() => {
    if (!isOpen) return;
    setSearchText("");
    setTargetMeal("all");
  }, [dateKey, isOpen]);

  const filteredFoods = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const target = targetMeal === "all" ? null : targetMeal;

    return [...QUICK_FOODS]
      .sort((a, b) => {
        if (!target) return 0;
        const aScore = a.defaultMeal === target ? 0 : 1;
        const bScore = b.defaultMeal === target ? 0 : 1;
        return aScore - bScore || a.name.localeCompare(b.name);
      })
      .filter((food) => {
        if (!query) return true;
        return (
          food.name.toLowerCase().includes(query) ||
          mealLabel(food.defaultMeal).toLowerCase().includes(query)
        );
      });
  }, [searchText, targetMeal]);

  const resolveTargetMeal = (food: QuickFood): MealKey =>
    targetMeal === "all" ? food.defaultMeal : targetMeal;

  const handleAddFood = (food: QuickFood) => {
    onAddFood(resolveTargetMeal(food), food);
    onDismiss();
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss} className="quick-add-modal">
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
      <IonContent className="quick-add-content">
        <IonSearchbar
          className="quick-add-search"
          value={searchText}
          onIonInput={(e) => setSearchText(e.detail.value || "")}
          placeholder="Search quick foods"
        />

        <div className="quick-add-meal-target">
          <IonSegment
            value={targetMeal}
            scrollable
            onIonChange={(event) => {
              if (isMealFilter(event.detail.value)) {
                setTargetMeal(event.detail.value);
              }
            }}
          >
            {MEAL_FILTERS.map((filter) => (
              <IonSegmentButton key={filter.value} value={filter.value}>
                <IonLabel>{filter.label}</IonLabel>
              </IonSegmentButton>
            ))}
          </IonSegment>
        </div>

        <IonList className="quick-food-list">
          {filteredFoods.map((food) => {
            const addMeal = resolveTargetMeal(food);

            return (
              <IonItem
                key={food.name}
                button
                detail={false}
                className="quick-food-item"
                onClick={() => handleAddFood(food)}
              >
                <div className="quick-food-emoji" slot="start" aria-hidden="true">
                  {food.emoji}
                </div>
                <IonLabel>
                  <h2>{food.name}</h2>
                  <p>
                    {food.calories} kcal · P {food.protein}g · C {food.carbs}g · F {food.fat}g
                  </p>
                </IonLabel>
                <div className="quick-food-action" slot="end">
                  <span>{mealLabel(addMeal)}</span>
                  <IonButton
                    size="small"
                    fill="solid"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleAddFood(food);
                    }}
                  >
                    <IonIcon slot="start" icon={addOutline} />
                    Add
                  </IonButton>
                </div>
              </IonItem>
            );
          })}
        </IonList>

        {filteredFoods.length === 0 && (
          <div className="quick-add-empty">
            <IonText color="medium">No quick foods match your search.</IonText>
          </div>
        )}
      </IonContent>
    </IonModal>
  );
};
