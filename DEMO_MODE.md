# Demo Mode Documentation

## Overview

MacroPal includes a special **Demo Mode** designed for showcasing the app to audiences. When enabled, demo mode provides a complete guest experience without requiring authentication.

## Features

### 1. **Video Introduction**
- Displays a looping video (`demo-loop.mp4`) in **landscape mode** when the app starts
- Video plays continuously until user interaction
- Click anywhere to transition from video to the app

### 2. **Bypass Authentication**
- Skips login, registration, and all onboarding screens
- Goes directly to the Home screen with a mock guest account
- No Firebase authentication required

### 3. **Portrait App Display**
- App interface is locked in **portrait mode (9:16 aspect ratio)** after video
- Optimized for presentation on landscape monitors
- Centered display with appropriate scaling

### 4. **Auto-Reset on Inactivity**
- Monitors user activity (mouse movement and clicks)
- After **1 minute of inactivity**, automatically:
  - Clears all guest account progress
  - Returns to the video loop
  - Resets the demo for the next viewer

### 5. **LocalStorage-Based Data**
- All user data is stored in browser localStorage
- No Firebase backend needed for demo data
- Data persists during active demo session
- Completely cleared on inactivity timeout

## Setup Instructions

### Step 1: Add Demo Video

1. Place your demo video file at: `/public/assets/demo-loop.mp4`
2. Video requirements:
   - **Format**: MP4 (H.264 codec recommended)
   - **Orientation**: Landscape (e.g., 1920x1080 or 1280x720)
   - **Content**: Should loop smoothly
   - **File size**: Optimize for web delivery

### Step 2: Configure Environment

Create or edit your `.env` file in the project root:

```bash
# Enable Demo Mode
VITE_DEMO_MODE=true

# Your existing Firebase configuration (still needed for normal mode)
VITE_FIREBASE_API_KEY=your_api_key
VITE_GOOGLE_WEB_CLIENT_ID=your_client_id
```

### Step 3: Build and Deploy

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Preview the production build
npm run preview

# Or run in development mode
npm run dev
```

### Step 4: Presentation Setup

1. Open the app in a web browser
2. Put browser in fullscreen mode (F11)
3. The demo video will start playing automatically
4. Click anywhere to start the interactive demo
5. Demo will auto-reset after 1 minute of inactivity

## Disabling Demo Mode

To return to normal operation:

1. Edit your `.env` file:
   ```bash
   VITE_DEMO_MODE=false
   # Or simply remove the VITE_DEMO_MODE line
   ```

2. Rebuild the application:
   ```bash
   npm run build
   ```

When demo mode is disabled, the app functions normally with full authentication and Firebase backend.

## Technical Details

### Architecture

Demo mode consists of several integrated components:

1. **DemoMode Component** (`src/components/DemoMode.tsx`)
   - Manages video playback and app transition
   - Tracks user inactivity
   - Handles data clearing on timeout

2. **DemoRouter Component** (`src/components/DemoRouter.tsx`)
   - Bypasses authentication flow
   - Routes directly to `/app/home`

3. **DemoProvider Context** (`src/contexts/DemoContext.tsx`)
   - Provides demo mode state throughout the app
   - Manages demo-specific data

4. **Demo Firestore** (`src/utils/demoFirestore.ts`)
   - LocalStorage-backed Firestore mock
   - Provides same API as real Firestore
   - Automatically cleared on reset

5. **useProfile Hook** (`src/hooks/useProfile.ts`)
   - Returns demo profile in demo mode
   - Uses real Firebase auth in normal mode

### Data Storage

In demo mode, all data is stored in browser localStorage:

- **Key**: `demo_firestore_data` - All app data
- **Key**: `demo_mode_data` - Demo context data

Preserved preferences (not cleared on reset):
- `mp_theme_mode` - User's theme preference
- `mp_lazy_load` - Lazy loading preference
- `mp_tab_animations` - Animation preference

### Demo Profile

The default demo profile provides:

```javascript
{
  age: 30,
  weight: 70,
  height: 175,
  gender: "male",
  goal: "maintain",
  activity: "moderate",
  unitSystem: "metric",
  weightUnit: "kg",
  heightUnit: "cm"
}
```

## Troubleshooting

### Video Not Playing

1. Ensure `demo-loop.mp4` exists in `/public/assets/`
2. Check browser console for errors
3. Verify video codec compatibility (H.264 is most compatible)
4. Try a different video file

### Demo Not Starting

1. Verify `.env` file has `VITE_DEMO_MODE=true`
2. Rebuild the application after changing `.env`
3. Clear browser cache and reload
4. Check browser console for errors

### Data Not Resetting

1. Check browser console for "Demo mode: Cleared user data" message
2. Manually clear localStorage if needed
3. Verify inactivity timeout is working (default: 60 seconds)

### App Shows Login Screen

1. Demo mode is likely disabled or not properly configured
2. Check `.env` file configuration
3. Rebuild application
4. Ensure DemoRouter is being used in App.tsx

## Best Practices

1. **Video Quality**: Use high-quality video that represents your app well
2. **Video Length**: Keep video short (10-30 seconds) for smooth looping
3. **Testing**: Test demo mode thoroughly before presentations
4. **Backup**: Always have a fallback plan if demo mode fails
5. **Data**: Pre-populate some demo data for better showcase experience
6. **Monitor Setup**: Use landscape monitor (16:9 or similar) for best experience

## Security Notes

- Demo mode is **CLIENT-SIDE ONLY**
- No real user accounts are created
- No data is sent to Firebase in demo mode
- All demo data is ephemeral and cleared automatically
- Do not use demo mode in production for real users
- Always disable demo mode for production deployments

## Future Enhancements

Potential improvements for demo mode:

- [ ] Pre-populated sample data (meals, workouts)
- [ ] Configurable inactivity timeout
- [ ] Custom demo profiles
- [ ] Demo mode analytics
- [ ] Multiple language support for demo
- [ ] Touch gesture support for tablets
