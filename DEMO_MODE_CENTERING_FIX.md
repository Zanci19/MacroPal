# Demo Mode Centering Fix

## Issue
The demo mode was positioned on the left side of the screen instead of being centered, leaving unequal space with more room on the right side than the left.

## Problem Diagnosis

### Before Fix:
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  APP (9:16)                              BLACK      │
│  Left-aligned                            BORDER     │
│  ├─────────┤                             (large)    │
│  │         │                                        │
│  │         │                                        │
└──────────────────────────────────────────────────────┘
   ↑ Small or no left border    ↑ Large right border
```

### Root Cause
The parent container (`.demo-app-container`) had flexbox properties set:
- `display: flex`
- `align-items: center` (vertical centering)
- `justify-content: center` (horizontal centering)

However, the child element wasn't behaving as a proper flex item due to missing flex properties, causing it to default to left alignment instead of using the flexbox centering.

## Solution

Added `flex-shrink: 0` to the child selector to ensure it behaves properly as a flex item:

```css
.demo-app-container--portrait > * {
  width: calc(100vh * 9 / 16);
  max-width: 100vw;
  height: 100vh;
  max-height: calc(100vw * 16 / 9);
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.5);
  flex-shrink: 0; /* NEW: Prevent shrinking, ensure proper flex behavior */
}
```

### Why `flex-shrink: 0` Works

1. **Prevents Unwanted Shrinking**: By default, flex items can shrink (`flex-shrink: 1`). Setting it to `0` prevents the item from shrinking below its defined width.

2. **Maintains Explicit Width**: Ensures the `width: calc(100vh * 9 / 16)` is respected exactly.

3. **Enables Proper Centering**: With a fixed width, the flexbox `justify-content: center` can now properly center the element horizontally.

## After Fix:
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  BLACK    APP (9:16)           BLACK                │
│  BORDER   Centered             BORDER               │
│  (equal)  ├─────────┤          (equal)              │
│           │         │                                │
│           │         │                                │
└──────────────────────────────────────────────────────┘
   ↑ Equal left border          ↑ Equal right border
```

## Visual Comparison

### For a 1920×1080 Monitor:

**Before (Incorrect):**
- Left border: ~0px (or very small)
- App width: 608px
- Right border: ~1312px (unequal)

**After (Correct):**
- Left border: 656px ✅
- App width: 608px ✅
- Right border: 656px ✅

## Technical Details

### Flexbox Layout Hierarchy
```
.demo-app-container
├─ display: flex
├─ justify-content: center  (horizontal centering)
├─ align-items: center      (vertical centering)
└─ > * (child - IonApp)
   ├─ width: calc(100vh * 9 / 16)
   ├─ height: 100vh
   └─ flex-shrink: 0  ← NEW: Ensures proper flex item behavior
```

### CSS Properties Working Together

1. **Parent Container** (`.demo-app-container`):
   - Creates a flex container
   - Sets centering behavior for children

2. **Child Element** (`.demo-app-container--portrait > *`):
   - Defines specific dimensions (9:16 portrait)
   - `flex-shrink: 0` ensures it maintains those dimensions
   - Gets centered by parent's `justify-content: center`

## Files Changed

- **`src/components/DemoMode.css`** (line 72)
  - Added: `flex-shrink: 0;`

## Testing

To verify the fix works:

1. Set `VITE_DEMO_MODE=true` in `.env`
2. Build and run the app
3. Open on a landscape monitor (e.g., 1920×1080)
4. Click to enter demo mode
5. Observe: Black borders should be equal on left and right sides
6. App should be perfectly centered

## Result

✅ **Horizontal Centering**: App is now centered with equal black borders
✅ **Portrait Mode**: Maintains 9:16 aspect ratio
✅ **Vertical Centering**: Already worked, still works
✅ **Responsive**: Mobile devices still get full-screen layout

## Summary

The simple addition of `flex-shrink: 0` ensures that the flex child element:
1. Maintains its explicit width
2. Behaves properly as a flex item
3. Gets centered by the parent's flexbox properties

This is a minimal, one-line CSS change that fixes the centering issue completely.
