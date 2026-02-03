import React, { useState, useMemo } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonChip,
  IonBackButton,
  IonButtons,
  IonText,
  IonModal,
  IonToast,
} from "@ionic/react";
import {
  addOutline,
  trashOutline,
  calculatorOutline,
  saveOutline,
  downloadOutline,
} from "ionicons/icons";
import { useHistory } from "react-router";
import basicFoods from "../data/basicFoods.json";
import type { Macros } from "../types";
import "./RecipeCalculator.css";

interface BasicFood {
  product_name: string;
  nutriments: {
    "energy-kcal_100g": number;
    proteins_100g: number;
    carbohydrates_100g: number;
    fat_100g: number;
  };
}

interface RecipeIngredient {
  id: string;
  name: string;
  amount: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Recipe {
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
}

const RecipeCalculator: React.FC = () => {
  const history = useHistory();
  const [recipe, setRecipe] = useState<Recipe>({
    name: "",
    servings: 1,
    ingredients: [],
  });
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [selectedFood, setSelectedFood] = useState<string>("");
  const [ingredientAmount, setIngredientAmount] = useState<number>(100);
  const [toast, setToast] = useState({ open: false, message: "" });

  // Calculate total macros for the recipe
  const recipeTotals = useMemo(() => {
    return recipe.ingredients.reduce(
      (acc, ingredient) => ({
        calories: acc.calories + ingredient.calories,
        protein: acc.protein + ingredient.protein,
        carbs: acc.carbs + ingredient.carbs,
        fat: acc.fat + ingredient.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [recipe.ingredients]);

  // Calculate per serving macros
  const perServingMacros = useMemo(() => {
    const servings = recipe.servings || 1;
    return {
      calories: Math.round(recipeTotals.calories / servings),
      protein: Math.round((recipeTotals.protein / servings) * 10) / 10,
      carbs: Math.round((recipeTotals.carbs / servings) * 10) / 10,
      fat: Math.round((recipeTotals.fat / servings) * 10) / 10,
    };
  }, [recipeTotals, recipe.servings]);

  const addIngredient = () => {
    if (!selectedFood || ingredientAmount <= 0) {
      setToast({ open: true, message: "Please select a food and enter amount" });
      return;
    }

    const food = (basicFoods as BasicFood[]).find((f) => f.product_name === selectedFood);
    if (!food) {
      setToast({ open: true, message: "Food not found" });
      return;
    }

    // Calculate macros based on amount (food data is per 100g)
    const scaleFactor = ingredientAmount / 100;
    const newIngredient: RecipeIngredient = {
      id: `${Date.now()}-${Math.random()}`,
      name: food.product_name,
      amount: ingredientAmount,
      unit: "g",
      calories: Math.round((food.nutriments["energy-kcal_100g"] || 0) * scaleFactor),
      protein: Math.round((food.nutriments.proteins_100g || 0) * scaleFactor * 10) / 10,
      carbs: Math.round((food.nutriments.carbohydrates_100g || 0) * scaleFactor * 10) / 10,
      fat: Math.round((food.nutriments.fat_100g || 0) * scaleFactor * 10) / 10,
    };

    setRecipe({
      ...recipe,
      ingredients: [...recipe.ingredients, newIngredient],
    });

    setShowAddIngredient(false);
    setSelectedFood("");
    setIngredientAmount(100);
    setToast({ open: true, message: "Ingredient added" });
  };

  const removeIngredient = (id: string) => {
    setRecipe({
      ...recipe,
      ingredients: recipe.ingredients.filter((ing) => ing.id !== id),
    });
    setToast({ open: true, message: "Ingredient removed" });
  };

  const exportRecipe = () => {
    const recipeText = `
Recipe: ${recipe.name || "Unnamed Recipe"}
Servings: ${recipe.servings}

Ingredients:
${recipe.ingredients
  .map((ing) => `- ${ing.amount}${ing.unit} ${ing.name}`)
  .join("\n")}

Total Nutrition:
- Calories: ${recipeTotals.calories} kcal
- Protein: ${recipeTotals.protein}g
- Carbs: ${recipeTotals.carbs}g
- Fat: ${recipeTotals.fat}g

Per Serving:
- Calories: ${perServingMacros.calories} kcal
- Protein: ${perServingMacros.protein}g
- Carbs: ${perServingMacros.carbs}g
- Fat: ${perServingMacros.fat}g
    `.trim();

    const blob = new Blob([recipeText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${recipe.name || "recipe"}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    setToast({ open: true, message: "Recipe exported" });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/home" />
          </IonButtons>
          <IonTitle>Recipe Calculator</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={calculatorOutline} style={{ marginRight: 8 }} />
              Recipe Details
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonLabel position="stacked">Recipe Name</IonLabel>
              <IonInput
                value={recipe.name}
                onIonInput={(e) =>
                  setRecipe({ ...recipe, name: e.detail.value || "" })
                }
                placeholder="e.g., Protein Smoothie"
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Number of Servings</IonLabel>
              <IonInput
                type="number"
                value={recipe.servings}
                onIonInput={(e) =>
                  setRecipe({
                    ...recipe,
                    servings: Math.max(1, parseInt(e.detail.value || "1", 10)),
                  })
                }
                min={1}
              />
            </IonItem>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Ingredients</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {recipe.ingredients.length === 0 ? (
              <IonText color="medium">
                <p style={{ textAlign: "center" }}>
                  No ingredients added yet. Tap the button below to add some!
                </p>
              </IonText>
            ) : (
              <IonList>
                {recipe.ingredients.map((ingredient) => (
                  <IonItem key={ingredient.id}>
                    <IonLabel>
                      <h3>{ingredient.name}</h3>
                      <p>
                        {ingredient.amount}
                        {ingredient.unit} - {ingredient.calories} kcal, P:{" "}
                        {ingredient.protein}g, C: {ingredient.carbs}g, F:{" "}
                        {ingredient.fat}g
                      </p>
                    </IonLabel>
                    <IonButton
                      slot="end"
                      fill="clear"
                      color="danger"
                      onClick={() => removeIngredient(ingredient.id)}
                    >
                      <IonIcon icon={trashOutline} />
                    </IonButton>
                  </IonItem>
                ))}
              </IonList>
            )}
            <IonButton
              expand="block"
              onClick={() => setShowAddIngredient(true)}
              style={{ marginTop: 16 }}
            >
              <IonIcon slot="start" icon={addOutline} />
              Add Ingredient
            </IonButton>
          </IonCardContent>
        </IonCard>

        {recipe.ingredients.length > 0 && (
          <>
            <IonCard className="nutrition-card">
              <IonCardHeader>
                <IonCardTitle>Total Nutrition</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <div className="nutrition-grid">
                  <div className="nutrition-item">
                    <div className="nutrition-value">{recipeTotals.calories}</div>
                    <div className="nutrition-label">Calories</div>
                  </div>
                  <div className="nutrition-item">
                    <div className="nutrition-value">{recipeTotals.protein}g</div>
                    <div className="nutrition-label">Protein</div>
                  </div>
                  <div className="nutrition-item">
                    <div className="nutrition-value">{recipeTotals.carbs}g</div>
                    <div className="nutrition-label">Carbs</div>
                  </div>
                  <div className="nutrition-item">
                    <div className="nutrition-value">{recipeTotals.fat}g</div>
                    <div className="nutrition-label">Fat</div>
                  </div>
                </div>
              </IonCardContent>
            </IonCard>

            <IonCard className="nutrition-card per-serving">
              <IonCardHeader>
                <IonCardTitle>Per Serving ({recipe.servings} servings)</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <div className="nutrition-grid">
                  <div className="nutrition-item">
                    <div className="nutrition-value">{perServingMacros.calories}</div>
                    <div className="nutrition-label">Calories</div>
                  </div>
                  <div className="nutrition-item">
                    <div className="nutrition-value">{perServingMacros.protein}g</div>
                    <div className="nutrition-label">Protein</div>
                  </div>
                  <div className="nutrition-item">
                    <div className="nutrition-value">{perServingMacros.carbs}g</div>
                    <div className="nutrition-label">Carbs</div>
                  </div>
                  <div className="nutrition-item">
                    <div className="nutrition-value">{perServingMacros.fat}g</div>
                    <div className="nutrition-label">Fat</div>
                  </div>
                </div>
              </IonCardContent>
            </IonCard>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <IonButton expand="block" onClick={exportRecipe}>
                <IonIcon slot="start" icon={downloadOutline} />
                Export Recipe
              </IonButton>
            </div>
          </>
        )}

        <IonModal
          isOpen={showAddIngredient}
          onDidDismiss={() => setShowAddIngredient(false)}
        >
          <IonHeader>
            <IonToolbar>
              <IonTitle>Add Ingredient</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowAddIngredient(false)}>
                  Cancel
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonItem>
              <IonLabel position="stacked">Select Food</IonLabel>
              <IonSelect
                value={selectedFood}
                onIonChange={(e) => setSelectedFood(e.detail.value)}
                interface="action-sheet"
              >
                {(basicFoods as BasicFood[]).slice(0, 50).map((food) => (
                  <IonSelectOption key={food.product_name} value={food.product_name}>
                    {food.product_name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Amount (grams)</IonLabel>
              <IonInput
                type="number"
                value={ingredientAmount}
                onIonChange={(e) =>
                  setIngredientAmount(
                    Math.max(1, parseInt(e.detail.value || "100", 10))
                  )
                }
                min={1}
              />
            </IonItem>
            <IonButton
              expand="block"
              onClick={() => {
                addIngredient();
              }}
              style={{ marginTop: 16 }}
            >
              Add Ingredient
            </IonButton>
          </IonContent>
        </IonModal>

        <IonToast
          isOpen={toast.open}
          onDidDismiss={() => setToast({ open: false, message: "" })}
          message={toast.message}
          duration={2000}
        />
      </IonContent>
    </IonPage>
  );
};

export default RecipeCalculator;
