import React from "react";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
} from "@ionic/react";
import {
  addCircleOutline,
  trashOutline,
  sunnyOutline,
  restaurantOutline,
  cafeOutline,
  fastFoodOutline,
} from "ionicons/icons";

import { DiaryEntry, MealKey, Macros } from "../../types/nutrition";
import { prettyMealLabel } from "../../utils/nutrition";

const MEAL_ICONS: Record<MealKey, string> = {
  breakfast: sunnyOutline,
  lunch: restaurantOutline,
  dinner: cafeOutline,
  snacks: fastFoodOutline,
};

type MealCardProps = {
  meal: MealKey;
  items: DiaryEntry[];
  totals: Macros;
  onAdd(): void;
  onDelete(index: number): void;
};

export const MealCard: React.FC<MealCardProps> = ({
  meal,
  items,
  totals,
  onAdd,
  onDelete,
}) => {
  const iconName = MEAL_ICONS[meal];
  const hasItems = items.length > 0;

  return (
    <IonCard className={`fs-meal ${hasItems ? "is-open" : ""}`}>
      <IonCardHeader className="fs-meal__hdr">
        <IonItem lines="none" className="fs-meal__row" detail={false}>
          <IonIcon slot="start" className="fs-meal__icon" icon={iconName} aria-hidden="true" />
          <h2 className="fs-meal__title-text">{prettyMealLabel(meal)}</h2>
          <IonButton
            slot="end"
            className="fs-meal__add"
            fill="clear"
            onClick={onAdd}
            aria-label={`Add to ${meal}`}
          >
            <IonIcon icon={addCircleOutline} />
          </IonButton>
        </IonItem>
      </IonCardHeader>

      {hasItems && (
        <IonCardContent>
          <p className="meal-total">
            Total: {Math.round(totals.calories)} kcal · Carbohydrates {totals.carbs.toFixed(1)} g · Protein
            {" "}
            {totals.protein.toFixed(1)} g · Fat {totals.fat.toFixed(1)} g
          </p>

          <IonList>
            {items.map((item, index) => {
              const kcal = Math.round(item.total.calories);
              return (
                <IonItem key={`${item.addedAt}-${index}`} className="meal-item">
                  <IonLabel>
                    <h2>
                      {item.name}
                      {item.brand ? ` · ${item.brand}` : ""}
                    </h2>
                    <p>
                      Carbohydrates {item.total.carbs.toFixed(1)} g · Protein {item.total.protein.toFixed(1)} g · Fat
                      {" "}
                      {item.total.fat.toFixed(1)} g
                    </p>
                  </IonLabel>

                  <IonButton
                    slot="end"
                    fill="clear"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => onDelete(index)}
                    className="del-btn"
                  >
                    <IonIcon icon={trashOutline} />
                  </IonButton>

                  <div className="kcal-badge" slot="end">
                    {kcal} kcal
                  </div>
                </IonItem>
              );
            })}
          </IonList>
        </IonCardContent>
      )}
    </IonCard>
  );
};

export default MealCard;
