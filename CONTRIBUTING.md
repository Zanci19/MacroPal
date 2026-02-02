# Contributing to MacroPal

Thank you for your interest in contributing to MacroPal! This document provides guidelines and best practices for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)

## Code of Conduct

Be respectful, inclusive, and professional in all interactions. We're building a welcoming community for everyone interested in health and nutrition tracking.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/MacroPal.git
   cd MacroPal
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Set up Firebase** (see README.md for details):
   - Copy `.env.example` to `.env`
   - Add your Firebase configuration

5. **Start the development server**:
   ```bash
   npm run dev
   ```

## Development Workflow

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our code standards
3. **Test your changes** thoroughly
4. **Commit with descriptive messages**:
   ```bash
   git commit -m "feat: add user profile avatar upload"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** on GitHub

## Code Standards

### TypeScript

- **Use TypeScript** for all new code
- **Avoid `any` types** - use proper types or `unknown` with type guards
- **Use type guards** from `src/utils/typeGuards.ts` for runtime validation
- **Export types** from `src/types/index.ts`

### Code Style

- **Follow existing patterns** in the codebase
- **Use functional components** with hooks
- **Prefer const over let** where possible
- **Use meaningful variable names**
- **Keep functions small and focused**

### Input Validation

Always validate user input:

```typescript
import { validateTitle, validateNumber } from '../utils/validation';

const titleValidation = validateTitle(userInput);
if (!titleValidation.isValid) {
  showError(titleValidation.error);
  return;
}
```

### Error Handling

Use the centralized error handler:

```typescript
import { handleError } from '../utils/handleError';

try {
  await saveData(data);
} catch (error) {
  const message = handleError('SaveData', error);
  showToast({ message, type: 'error' });
}
```

### Accessibility

- **Add ARIA labels** to interactive elements
- **Ensure keyboard navigation** works properly
- **Use semantic HTML** elements
- **Test with screen readers** when possible
- **Use utilities** from `src/utils/accessibility.ts`

Example:
```typescript
import { getButtonAriaLabel } from '../utils/accessibility';

<IonButton aria-label={getButtonAriaLabel('Delete', 'food entry')}>
  <IonIcon icon={trash} />
</IonButton>
```

### Performance

- **Use memoization** for expensive calculations:
  ```typescript
  import { useExpensiveMemo } from '../hooks/usePerformance';
  
  const stats = useExpensiveMemo(
    () => calculateStats(entries),
    [entries],
    'Calculate Stats'
  );
  ```

- **Debounce user input**:
  ```typescript
  import { useDebounce } from '../hooks/usePerformance';
  
  const debouncedSearch = useDebounce(handleSearch, 300);
  ```

- **Lazy load routes** (already configured in App.tsx)

### Components

- **Create reusable components** in `src/components/`
- **Keep components focused** on a single responsibility
- **Use Ionic components** for UI consistency
- **Add CSS files** alongside component files

Example structure:
```
src/components/
├── MyComponent.tsx
├── MyComponent.css
└── MyComponent.test.tsx
```

### Utilities

- **Create utility functions** in `src/utils/`
- **Keep utilities pure** when possible
- **Add tests** for utility functions
- **Export from module** for organized imports

## Testing

### Unit Tests

Run unit tests:
```bash
npm run test.unit
```

Write tests for:
- Utility functions
- Complex logic
- Validation functions
- Type guards

Example:
```typescript
import { describe, it, expect } from 'vitest';
import { validateEmail } from './validation';

describe('validateEmail', () => {
  it('should validate correct emails', () => {
    expect(validateEmail('test@example.com')).toEqual({ isValid: true });
  });

  it('should reject invalid emails', () => {
    expect(validateEmail('invalid')).toEqual({
      isValid: false,
      error: 'Invalid email format',
    });
  });
});
```

### E2E Tests

Run E2E tests:
```bash
npm run test.e2e
```

### Manual Testing

Before submitting a PR:
1. Test on mobile and desktop
2. Test in light and dark mode
3. Test keyboard navigation
4. Test with slow network (DevTools throttling)
5. Check browser console for errors

## Pull Request Process

1. **Update documentation** if you've changed functionality
2. **Add tests** for new features
3. **Ensure all tests pass**
4. **Update CHANGELOG.md** if applicable
5. **Fill out the PR template** completely
6. **Request review** from maintainers

### PR Title Format

Use conventional commits format:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Test changes
- `chore:` - Build process or auxiliary tool changes

Examples:
- `feat: add food favorites bookmark feature`
- `fix: correct calorie calculation in analytics`
- `docs: update README with new keyboard shortcuts`

## Project Structure

### Key Directories

- **`src/components/`** - Reusable UI components
- **`src/pages/`** - Route pages
- **`src/hooks/`** - Custom React hooks
- **`src/utils/`** - Utility functions
- **`src/types/`** - TypeScript type definitions
- **`src/theme/`** - CSS and theming

### New Utilities

We've added several utilities to improve code quality:

#### Validation (`src/utils/validation.ts`)
- Input validation with descriptive errors
- Use for all user inputs

#### Type Guards (`src/utils/typeGuards.ts`)
- Runtime type checking
- Use for Firestore data validation

#### Toast Notifications (`src/components/ToastNotification.tsx`)
- User feedback for actions
- Use the `useToast` hook

#### Loading States (`src/components/LoadingState.tsx`)
- Visual feedback during async operations

#### Keyboard Shortcuts (`src/hooks/useKeyboardShortcuts.ts`)
- Power user shortcuts
- Easy to extend

#### Performance Hooks (`src/hooks/usePerformance.ts`)
- Memoization and debouncing
- Performance monitoring

#### Accessibility (`src/utils/accessibility.ts`)
- ARIA labels and screen reader support
- Keyboard navigation helpers

## Questions?

- Open an issue on GitHub
- Check existing issues and discussions
- Read the main README.md

Thank you for contributing to MacroPal! 🎉
