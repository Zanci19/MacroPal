# Capacitor 8.0.0 Migration - Edge-to-Edge Navigation Bar Fix

## Issue
After upgrading to Capacitor 8.0.0, the configuration property `adjustMarginsForEdgeToEdge` was deprecated and causing TypeScript compilation errors:

```
Object literal may only specify known properties, and 'adjustMarginsForEdgeToEdge' does not exist in type 'android'.
```

Additionally, the Android three-button navigation bar was overlapping the app's tab bar, interfering with app usage. **This is especially problematic on Android 15 (API 35)** where edge-to-edge is enforced by default.

## Solution

### Understanding Android 15 Edge-to-Edge Enforcement
Android 15 (API 35 / Vanilla Ice Cream) enforces edge-to-edge display for all apps. The old `setOverlaysWebView` API **does not work on Android 15+**. The solution requires using Capacitor 8's new `SystemBars` configuration.

### 1. SystemBars Configuration (Critical for Android 15)
Added `SystemBars` configuration in `capacitor.config.ts` to enable CSS variable injection:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zanci19.macropal',
  appName: 'MacroPal',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      overlaysWebView: false, // Works on Android 14 and below
    },
    SystemBars: {
      insetsHandling: 'css', // Injects CSS variables for Android 15+
    },
  },
};
```

**Key points:**
- `SystemBars.insetsHandling: 'css'` tells Capacitor to inject `--safe-area-inset-*` CSS variables
- This is the **only** way to handle edge-to-edge on Android 15+
- SystemBars is configured inside the `plugins` object

### 2. Runtime StatusBar Configuration (Android 14 and below)
In `src/utils/platformSetup.ts`:

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

**Note:** This only works on Android 14 and below. On Android 15+, this call will be ignored.

### 3. CSS Safe Area Insets (Universal Solution)
Updated `src/theme/theme.css` to use both CSS variable approaches:

```css
ion-tab-bar {
  /* Handle Android navigation bar overlap - supports both approaches */
  /* Use Capacitor 8 injected CSS variable first, fallback to env() */
  padding-bottom: max(var(--safe-area-inset-bottom, 0px), env(safe-area-inset-bottom, 0px));
}
```

**Why use `max()`?**
- Capacitor 8's SystemBars injects `--safe-area-inset-bottom` as a CSS variable
- Older implementations use `env(safe-area-inset-bottom)`
- Using `max()` ensures we get the correct value from whichever source provides it

## How It Works

### For Android 15+ (API 35 - Vanilla Ice Cream)
Android 15 enforces edge-to-edge display by default. The old `setOverlaysWebView` API is deprecated and non-functional.

**Solution:** Capacitor 8's `SystemBars` configuration with `insetsHandling: 'css'`:
1. Capacitor injects `--safe-area-inset-bottom` as a CSS variable into the webview
2. This variable contains the actual pixel value of the system navigation bar height
3. CSS uses this variable with `padding-bottom: max(var(--safe-area-inset-bottom, 0px), env(safe-area-inset-bottom, 0px))`
4. The `max()` function ensures we use whichever value is available

### For Android 14 and Below
**Solution:** Runtime API call `StatusBar.setOverlaysWebView({ overlay: false })`:
1. Called when the app starts via `platformSetup.ts`
2. Tells Android not to overlay system bars on the webview
3. Android automatically adds proper margins
4. Falls back to CSS if the API call fails

### Why Previous Attempts Failed
1. **Config file only:** The config provides defaults but doesn't actively apply settings on Android 15
2. **Runtime call only:** `setOverlaysWebView` doesn't work on Android 15+
3. **CSS `env()` only:** Some Android versions use `--safe-area-inset-*` CSS variables instead of `env()` function

**The complete solution uses all three approaches to ensure compatibility across all Android versions.**

## Testing Instructions

### For Android 15 (Pixel 7 Pro / API 35)
1. **Clean build is essential:**
   ```bash
   # In the project root
   npm run build
   npx cap sync android
   ```

2. **In Android Studio:**
   - Build > Clean Project
   - Build > Rebuild Project
   - Run the app

3. **Verify the fix:**
   - Navigate to a page with the tab bar visible
   - Check that the navigation bar doesn't overlap the tab buttons
   - Test both 3-button navigation and gesture navigation
   - The tab bar should have proper padding at the bottom

### For Android 14 and Below
Same steps as above. The runtime `setOverlaysWebView` call should prevent overlay on these versions.

### Troubleshooting

**If the overlap still occurs on Android 15:**

1. **Verify Capacitor sync ran successfully:**
   ```bash
   npx cap sync android
   ```
   Look for any errors or warnings about the SystemBars configuration.

2. **Check that CSS variables are being injected:**
   - In Chrome DevTools (chrome://inspect)
   - Inspect the `ion-tab-bar` element
   - Look for `--safe-area-inset-bottom` in the computed styles
   - It should have a pixel value (e.g., `48px`) matching your navigation bar height

3. **Verify the config is loaded:**
   - Check capacitor.config.ts has the SystemBars configuration
   - Ensure you did a clean build after adding it

4. **Check Android build target:**
   - In `android/variables.gradle`, ensure `compileSdkVersion` is set to 35 or higher
   - This allows the edge-to-edge features to work properly

## Files Modified
- `capacitor.config.ts` - Added `SystemBars.insetsHandling: 'css'` configuration for Android 15+
- `src/utils/platformSetup.ts` - Runtime `StatusBar.setOverlaysWebView()` call for Android 14 and below
- `src/theme/theme.css` - Updated CSS to use both `var(--safe-area-inset-bottom)` and `env(safe-area-inset-bottom)`

## References
- [Capacitor 8.0.0 Release Notes](https://capacitorjs.com/docs/updating/8-0)
- [Android 15 Edge-to-Edge Documentation](https://developer.android.com/about/versions/15/behavior-changes-15#edge-to-edge)
- [CSS Environment Variables](https://developer.mozilla.org/en-US/docs/Web/CSS/env)
