# Capacitor 8.0.0 Migration - Edge-to-Edge Navigation Bar Fix

## Issue
After upgrading to Capacitor 8.0.0, the configuration property `adjustMarginsForEdgeToEdge` was deprecated and causing TypeScript compilation errors:

```
Object literal may only specify known properties, and 'adjustMarginsForEdgeToEdge' does not exist in type 'android'.
```

Additionally, the Android three-button navigation bar was overlapping the app's tab bar, interfering with app usage.

## Solution

### 1. Runtime StatusBar Configuration (Critical)
The most important fix is calling `StatusBar.setOverlaysWebView({ overlay: false })` at runtime in `src/utils/platformSetup.ts`:

```typescript
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export function setupPlatform() {
  // Prevent status bar from overlaying the webview to avoid navigation bar overlap
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  SplashScreen.hide().catch(() => {});
}
```

**This is the key fix** - the config file setting alone is insufficient. The method must be called at runtime.

### 2. Configuration File Setting
Added StatusBar plugin configuration in `capacitor.config.ts`:

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

This provides a default value, but the runtime call is what actually applies the setting.

### 3. CSS Safe Area Insets (Fallback)
As an additional safeguard (especially for Android 15+), we updated the tab bar styling in `src/theme/theme.css`:

```css
ion-tab-bar {
  /* ... other styles ... */
  /* Handle Android navigation bar overlap */
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

## How It Works

In Capacitor 8.0.0, the proper approach requires **runtime JavaScript calls** in addition to configuration:

### 1. Runtime API Call (Required)
The `StatusBar.setOverlaysWebView({ overlay: false })` method must be called when the app starts. This is done in `platformSetup.ts` which is called from `main.tsx`:
- Sets whether the status bar overlays the webview
- When set to `false`, Android automatically adds proper margins to prevent overlap
- **This is the critical fix** - without this runtime call, the overlap will persist

### 2. Configuration File (Default Value)
The config file setting provides a default but doesn't actively apply the setting on app launch:
```typescript
plugins: {
  StatusBar: {
    overlaysWebView: false,
  },
}
```

### 3. CSS Safe Area Insets (Fallback)
For Android 15+ where `setOverlaysWebView` may not be available, CSS provides a fallback:
- `env(safe-area-inset-bottom)` - Uses system-provided inset values
- Applied to `ion-tab-bar` to add padding at the bottom

## Testing
- ✅ TypeScript compilation passes without errors
- ✅ Tab bar properly respects Android navigation bar spacing
- ✅ No overlap between system UI and app UI

## Files Modified
- `capacitor.config.ts` - Added `StatusBar.overlaysWebView: false` configuration
- `src/utils/platformSetup.ts` - **Added `StatusBar.setOverlaysWebView({ overlay: false })` runtime call** (key fix)
- `src/theme/theme.css` - Added `padding-bottom: env(safe-area-inset-bottom)` to `ion-tab-bar`

## References
- [Capacitor 8.0.0 Release Notes](https://capacitorjs.com/docs/updating/8-0)
- [CSS Environment Variables](https://developer.mozilla.org/en-US/docs/Web/CSS/env)
