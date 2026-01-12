# Android Performance Optimizations

This document describes the performance optimizations implemented for Android devices, particularly for the `/app/*` routes and tab navigation.

## Overview

The MacroPal app uses Ionic/React with custom tab animations. To ensure smooth performance on Android devices (especially lower-end ones), we've implemented several optimizations:

## Device Detection

### Android Detection
- Detects if the app is running on an Android device using user agent string
- Applied to animation settings and viewport handling

### Low-End Device Detection
The app automatically detects low-end Android devices based on:
- **CPU Cores**: Devices with fewer than 4 cores
- **RAM**: Devices with less than 2GB of RAM (when available via `navigator.deviceMemory`)

## Animation Optimizations

### Duration
- **iOS/Desktop**: 425ms (default)
- **Android**: 250ms (41% faster)
- **Reduced Motion**: 150ms (for accessibility)

### Complexity Levels

#### Low-End Android Devices
- **Entering page**: Full slide animation (100% translation)
- **Leaving page**: Instantly hidden (no animation)
- **GPU Load**: ~50% reduction compared to full animation
- **Easing**: Simple `ease-out`

#### Regular Android Devices
- **Entering page**: Full slide animation (100% translation)
- **Leaving page**: Simplified parallax (20% movement vs 35% on iOS)
- **GPU Load**: Moderate reduction
- **Easing**: Simple `ease-out`

#### iOS/Desktop
- **Entering page**: Full slide animation (100% translation)
- **Leaving page**: Full parallax effect (35% movement)
- **GPU Load**: Maximum quality
- **Easing**: Custom cubic-bezier curve

## Hardware Acceleration

### CSS Optimizations
All implemented in `src/theme/theme.css`:

1. **GPU Compositing**
   ```css
   ion-page {
     transform: translateZ(0);
     backface-visibility: hidden;
   }
   ```

2. **Will-Change Hints**
   - Added to animated elements during transitions
   - Tells browser to prepare for GPU acceleration
   - Automatically removed after animation completes

3. **Layer Isolation**
   ```css
   ion-router-outlet {
     isolation: isolate;
   }
   ```

4. **Mobile Backdrop Filter Removal**
   - On devices ≤768px, backdrop filters are disabled
   - Reduces paint complexity significantly

5. **Hardware-Accelerated Scrolling**
   ```css
   ion-content {
     -webkit-overflow-scrolling: touch;
   }
   ```

## Viewport Handling

### Android Softkey Detection
To prevent UI overlap with Android navigation bars:

1. **Initial Detection**: Runs immediately on mount
2. **Debounced Updates**: Resize events are debounced (100ms) to prevent excessive calculations
3. **Orientation Changes**: Updated immediately without debounce
4. **CSS Variable**: Sets `--softkey-inset` for layout adjustments

### Performance Impact
- Reduces unnecessary recalculations during keyboard animations
- Prevents layout thrashing on rapid resize events

## CSS Containment

Applied to major UI components for improved paint/layout performance:
```css
ion-page,
ion-content,
ion-card,
ion-item,
ion-list,
ion-toolbar,
ion-tab-bar {
  contain: layout style paint;
}
```

## Accessibility

All optimizations respect the `prefers-reduced-motion` media query:
- Animations reduced to 150ms
- Extremely simplified transitions
- Maintains full functionality

## Testing on Different Devices

### High-End Android (8+ cores, 4GB+ RAM)
- Full 250ms animations with 20% parallax
- Smooth 60fps performance expected

### Mid-Range Android (4-6 cores, 2-3GB RAM)
- Full 250ms animations with 20% parallax
- Smooth 60fps performance expected

### Low-End Android (<4 cores or <2GB RAM)
- 250ms animation, no parallax on leaving page
- Optimized for 30-60fps performance
- Significant GPU load reduction

### iOS/Desktop
- Full 425ms animations with 35% parallax
- Premium animation quality maintained

## Implementation Files

- **`src/App.tsx`**: Device detection, animation logic, viewport handling
- **`src/theme/theme.css`**: CSS hardware acceleration and performance hints

## Future Improvements

Potential optimizations if performance issues persist:
1. Progressive Web App (PWA) caching for faster initial loads
2. Image lazy loading and optimization
3. Code splitting for larger route components
4. Virtual scrolling for long lists
5. Memory profiling for potential leaks

## Monitoring

To check performance on your device:
1. Open Chrome DevTools (Remote Debugging for Android)
2. Go to Performance tab
3. Record while navigating between tabs
4. Check for:
   - Frame rate (target: 60fps on high-end, 30fps minimum on low-end)
   - Paint events (should be minimal during animations)
   - Memory usage (should be stable, no growing leaks)
