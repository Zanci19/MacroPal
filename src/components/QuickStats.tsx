import React from 'react';
import { IonCard, IonCardContent, IonText, IonIcon } from '@ionic/react';
import { flame, restaurant, barbell, trendingUp } from 'ionicons/icons';
import './QuickStats.css';

interface QuickStatsProps {
  calories: number;
  calorieGoal: number;
  meals: number;
  workouts: number;
  streak?: number;
}

interface StatItemProps {
  icon: string;
  value: string | number;
  label: string;
  color?: string;
}

const StatItem: React.FC<StatItemProps> = ({ icon, value, label, color = 'primary' }) => (
  <div className="quick-stats__item">
    <div className={`quick-stats__icon quick-stats__icon--${color}`}>
      <IonIcon icon={icon} />
    </div>
    <div className="quick-stats__content">
      <div className="quick-stats__value">{value}</div>
      <IonText color="medium" className="quick-stats__label">
        <small>{label}</small>
      </IonText>
    </div>
  </div>
);

/**
 * Quick stats dashboard widget (kind of like a mini progress report) that shows the user's current calorie intake, how it compares to their goal, and some other stats like meals logged, workouts done, and current streak. Still in progress
 */
export const QuickStats: React.FC<QuickStatsProps> = ({
  calories,
  calorieGoal,
  meals,
  workouts,
  streak,
}) => {
  const caloriesRemaining = calorieGoal - calories;
  const percentageConsumed = calorieGoal > 0 ? Math.round((calories / calorieGoal) * 100) : 0;

  const getCalorieColor = () => {
    if (percentageConsumed < 50) return 'success';
    if (percentageConsumed < 90) return 'warning';
    return 'danger';
  };

  return (
    <IonCard className="quick-stats">
      <IonCardContent>
        <div className="quick-stats__grid">
          <StatItem
            icon={flame}
            value={`${calories}/${calorieGoal}`}
            label="Calories"
            color={getCalorieColor()}
          />
          <StatItem
            icon={restaurant}
            value={meals}
            label={`Meal${meals !== 1 ? 's' : ''} logged`}
            color="primary"
          />
          <StatItem
            icon={barbell}
            value={workouts}
            label={`Workout${workouts !== 1 ? 's' : ''}`}
            color="secondary"
          />
          {streak !== undefined && streak > 0 && (
            <StatItem
              icon={trendingUp}
              value={`${streak} day${streak !== 1 ? 's' : ''}`}
              label="Streak"
              color="tertiary"
            />
          )}
        </div>

        {caloriesRemaining !== 0 && (
          <div className="quick-stats__footer">
            <IonText color={caloriesRemaining > 0 ? 'medium' : 'danger'}>
              <small>
                {caloriesRemaining > 0
                  ? `${caloriesRemaining} calories remaining`
                  : `${Math.abs(caloriesRemaining)} calories over goal`}
              </small>
            </IonText>
          </div>
        )}
      </IonCardContent>
    </IonCard>
  );
};
