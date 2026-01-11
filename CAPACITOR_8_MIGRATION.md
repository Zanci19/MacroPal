# Capacitor 8.0.0 Migration - Edge-to-Edge Navigation Bar Fix

## Issue
After upgrading to Capacitor 8.0.0, the configuration property `adjustMarginsForEdgeToEdge` was deprecated and causing TypeScript compilation errors:

```
Object literal may only specify known properties, and 'adjustMarginsForEdgeToEdge' does not exist in type 'android'.
```

Additionally, the Android three-button navigation bar was overlapping the app's tab bar, interfering with app usage.

## Solution

### 1. Removed Deprecated Configuration & Added StatusBar Plugin Config
The `adjustMarginsForEdgeToEdge` property has been removed from Capacitor 8.0.0. Instead, we configure the StatusBar plugin to prevent overlay:

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
  plugins: {
    StatusBar: {
      overlaysWebView: false,
    },
  },
};
```

Setting `overlaysWebView: false` tells the StatusBar plugin not to overlay the webview, which automatically adds proper system margins. Note: This option is not available on Android 15+, so we also use CSS as a fallback.

### 2. Updated CSS for Safe Area Insets (Fallback)
As an additional safeguard (especially for Android 15+), we updated the tab bar styling in `src/theme/theme.css` to use the `env(safe-area-inset-bottom)` CSS variable:

```css
ion-tab-bar {
  /* ... other styles ... */
  /* Handle Android navigation bar overlap */
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

This ensures that the tab bar has proper padding to avoid overlap with the Android system navigation bar.

## How It Works

In Capacitor 8.0.0, there are two complementary approaches to handle system UI overlays:

### StatusBar Plugin Configuration
The `StatusBar` plugin's `overlaysWebView` setting controls whether the status bar overlays the webview:
- `overlaysWebView: false` - System adds automatic margins to prevent overlay (not available on Android 15+)
- This is the primary solution for most Android versions

### CSS Safe Area Insets (Fallback)
For Android 15+ and as a general fallback, Capacitor 8 can inject CSS variables:
- `--safe-area-inset-top`
- `--safe-area-inset-right`
- `--safe-area-inset-bottom`
- `--safe-area-inset-left`

These can be accessed using the `env()` CSS function to manually add padding where needed.

## Testing
- ✅ TypeScript compilation passes without errors
- ✅ Tab bar properly respects Android navigation bar spacing
- ✅ No overlap between system UI and app UI

## Files Modified
- `capacitor.config.ts` - Removed deprecated `adjustMarginsForEdgeToEdge` property, added `StatusBar.overlaysWebView: false` configuration
- `src/theme/theme.css` - Added `padding-bottom: env(safe-area-inset-bottom)` to `ion-tab-bar`

## References
- [Capacitor 8.0.0 Release Notes](https://capacitorjs.com/docs/updating/8-0)
- [CSS Environment Variables](https://developer.mozilla.org/en-US/docs/Web/CSS/env)
