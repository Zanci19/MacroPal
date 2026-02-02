# Quick Reference Guide - New Utilities

This is a quick reference for using the new utilities and components added to MacroPal.

## Validation

```typescript
import { validateTitle, validateNumber, validateMacros } from '../utils/validation';

// Validate user input
const titleResult = validateTitle(userInput);
if (!titleResult.isValid) {
  showError(titleResult.error);
  return;
}

// Validate number with constraints
const ageResult = validateNumber(age, {
  min: 13,
  max: 120,
  fieldName: 'Age'
});

// Validate macros
const macrosResult = validateMacros({
  calories: 200,
  carbs: 20,
  protein: 25,
  fat: 8
});
```

## Type Guards

```typescript
import { isMacros, parseFirestoreData } from '../utils/typeGuards';

// Validate Firebase data
const data = snapshot.data();
if (!isMacros(data)) {
  console.error('Invalid macros data');
  return;
}

// Safe parsing
const macros = parseFirestoreData(data, isMacros);
if (!macros) {
  // Handle error
}
```

## Toast Notifications

```typescript
import { useToast } from '../components/ToastNotification';

function MyComponent() {
  const { showSuccess, showError, ToastComponent } = useToast();

  const handleSave = async () => {
    try {
      await saveData();
      showSuccess('Data saved successfully!');
    } catch (error) {
      showError('Failed to save data');
    }
  };

  return (
    <>
      {/* Your component */}
      <ToastComponent />
    </>
  );
}
```

## Loading States

```typescript
import { LoadingState, LoadingOverlay } from '../components/LoadingState';

// Inline loading
<LoadingState message="Loading..." size="medium" />

// Full page overlay
<LoadingOverlay isOpen={isLoading} message="Saving data..." />
```

## Quick Stats Widget

```typescript
import { QuickStats } from '../components/QuickStats';

<QuickStats
  calories={1500}
  calorieGoal={2000}
  meals={3}
  workouts={1}
  streak={7}
/>
```

## Favorites System

```typescript
import {
  addFavoriteFood,
  removeFavoriteFood,
  isFoodFavorited,
  getFavoriteFoods
} from '../utils/favorites';

// Add to favorites
const success = addFavoriteFood(meal);

// Check if favorited
const isFav = isFoodFavorited(meal.name);

// Get all favorites
const favorites = getFavoriteFoods();
```

## Backup Reminders

```typescript
import {
  shouldShowBackupReminder,
  markBackupCompleted,
  getBackupReminderMessage
} from '../utils/backupReminder';

// Check if should show reminder
if (shouldShowBackupReminder()) {
  const message = getBackupReminderMessage();
  // Show reminder to user
}

// After backup
markBackupCompleted();
```

## Keyboard Shortcuts

```typescript
import { useKeyboardShortcuts, getCommonShortcuts } from '../hooks/useKeyboardShortcuts';
import { useIonRouter } from '@ionic/react';

function MyComponent() {
  const router = useIonRouter();

  const shortcuts = getCommonShortcuts({
    onQuickAdd: () => router.push('/add-food'),
    onGoToHome: () => router.push('/app/home'),
    onGoToAnalytics: () => router.push('/app/analytics'),
  });

  useKeyboardShortcuts(shortcuts);

  // Component continues...
}
```

## Accessibility

```typescript
import {
  announceToScreenReader,
  getButtonAriaLabel,
  formatCaloriesForScreenReader
} from '../utils/accessibility';

// Announce to screen reader
announceToScreenReader('Food added successfully', 'polite');

// Generate ARIA label
<IonButton aria-label={getButtonAriaLabel('Delete', 'food entry')}>
  Delete
</IonButton>

// Format for screen reader
const ariaLabel = formatCaloriesForScreenReader(1500, 2000);
// "1500 calories consumed, 500 calories remaining"
```

## Performance Hooks

```typescript
import {
  useExpensiveMemo,
  useDebounce,
  useDebouncedValue
} from '../hooks/usePerformance';

// Memoize expensive calculation
const stats = useExpensiveMemo(
  () => calculateComplexStats(data),
  [data],
  'Stats Calculation'
);

// Debounce function
const debouncedSearch = useDebounce(handleSearch, 300);

// Debounce value
const debouncedQuery = useDebouncedValue(searchQuery, 500);
```

## Error Handling

```typescript
import { handleError, getUserFriendlyErrorMessage } from '../utils/handleError';

try {
  await riskyOperation();
} catch (error) {
  const message = handleError('RiskyOperation', error);
  showToast({ message, type: 'error' });
}

// Or get friendly message directly
const friendlyMessage = getUserFriendlyErrorMessage(error);
```

## Date Utilities

```typescript
import {
  getRelativeDateString,
  getDateRange,
  isInPast,
  getWeekDates
} from '../utils/date';

// Get relative date string
const dateStr = getRelativeDateString('2024-01-15');
// "3 days ago" or "Yesterday" or "Today"

// Get date range
const { start, end } = getDateRange(7); // Last 7 days

// Check if in past
if (isInPast(dateKey)) {
  // Handle past date
}

// Get week dates
const weekDates = getWeekDates(dateKey);
```

## Complete Example

Here's a complete example combining multiple utilities:

```typescript
import React from 'react';
import { IonButton, IonInput } from '@ionic/react';
import { useToast } from '../components/ToastNotification';
import { LoadingOverlay } from '../components/LoadingState';
import { validateTitle, validateNumber } from '../utils/validation';
import { handleError } from '../utils/handleError';
import { addFavoriteFood } from '../utils/favorites';

export const AddFoodForm: React.FC = () => {
  const [name, setName] = React.useState('');
  const [calories, setCalories] = React.useState<number>(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const { showSuccess, showError, ToastComponent } = useToast();

  const handleSubmit = async () => {
    // Validate input
    const nameValidation = validateTitle(name);
    if (!nameValidation.isValid) {
      showError(nameValidation.error!);
      return;
    }

    const caloriesValidation = validateNumber(calories, {
      min: 0,
      max: 10000,
      fieldName: 'Calories'
    });
    if (!caloriesValidation.isValid) {
      showError(caloriesValidation.error!);
      return;
    }

    // Save data
    setIsLoading(true);
    try {
      const meal = { name, calories, servings: 1, macros: {...} };
      await saveFood(meal);
      addFavoriteFood(meal); // Add to favorites
      showSuccess('Food added successfully!');
    } catch (error) {
      const message = handleError('AddFood', error);
      showError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <IonInput
        value={name}
        onIonInput={(e) => setName(e.detail.value!)}
        placeholder="Food name"
      />
      <IonInput
        type="number"
        value={calories}
        onIonInput={(e) => setCalories(Number(e.detail.value!))}
        placeholder="Calories"
      />
      <IonButton onClick={handleSubmit}>Add Food</IonButton>
      
      <LoadingOverlay isOpen={isLoading} message="Saving..." />
      <ToastComponent />
    </>
  );
};
```

## Tips

1. **Always validate user input** before processing
2. **Use type guards** when receiving data from Firebase
3. **Show loading states** during async operations
4. **Provide feedback** with toast notifications
5. **Use keyboard shortcuts** for common actions
6. **Make it accessible** with ARIA labels
7. **Optimize performance** with memoization
8. **Handle errors gracefully** with user-friendly messages
