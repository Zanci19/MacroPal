# Capacitor 8.0.0 Migration - Edge-to-Edge Navigation Bar Fix

## Issue
After upgrading to Capacitor 8.0.0, the configuration property `adjustMarginsForEdgeToEdge` was deprecated and causing TypeScript compilation errors:

```
Object literal may only specify known properties, and 'adjustMarginsForEdgeToEdge' does not exist in type 'android'.
```

Additionally, the Android three-button navigation bar was overlapping the app's tab bar, interfering with app usage.

## Solution

### 1. Removed Deprecated Configuration
The `adjustMarginsForEdgeToEdge` property has been removed from Capacitor 8.0.0 and is no longer needed. We removed it from `capacitor.config.ts`:

**Before:**
```typescript
const config: CapacitorConfig = {
  appId: 'com.zanci19.macropal',
  appName: 'MacroPal',
  webDir: 'dist',
  android: {
    adjustMarginsForEdgeToEdge: 'force',
  },
};
```

**After:**
```typescript
const config: CapacitorConfig = {
  appId: 'com.zanci19.macropal',
  appName: 'MacroPal',
  webDir: 'dist',
};
```

### 2. Updated CSS for Safe Area Insets
Capacitor 8.0.0 automatically injects CSS variables for safe area insets. We updated the tab bar styling in `src/theme/theme.css` to use the `env(safe-area-inset-bottom)` CSS variable:

```css
ion-tab-bar {
  /* ... other styles ... */
  /* Handle Android navigation bar overlap */
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

This ensures that the tab bar has proper padding to avoid overlap with the Android system navigation bar.

## How It Works

In Capacitor 8.0.0, the framework automatically handles edge-to-edge display and injects the following CSS variables:
- `--safe-area-inset-top`
- `--safe-area-inset-right`
- `--safe-area-inset-bottom`
- `--safe-area-inset-left`

These can be accessed using the `env()` CSS function. The default behavior (`insetsHandling: 'css'`) is enabled automatically and does not need to be explicitly configured.

## Testing
- ✅ TypeScript compilation passes without errors
- ✅ Tab bar properly respects Android navigation bar spacing
- ✅ No overlap between system UI and app UI

## Files Modified
- `capacitor.config.ts` - Removed deprecated `adjustMarginsForEdgeToEdge` property
- `src/theme/theme.css` - Added `padding-bottom: env(safe-area-inset-bottom)` to `ion-tab-bar`

## References
- [Capacitor 8.0.0 Release Notes](https://capacitorjs.com/docs/updating/8-0)
- [CSS Environment Variables](https://developer.mozilla.org/en-US/docs/Web/CSS/env)
