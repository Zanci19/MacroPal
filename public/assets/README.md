# Demo Mode Assets

This directory should contain the demo loop video for demo mode.

## Required File

- **demo-loop.mp4**: A video file that will play in landscape mode when demo mode is active.
  - The video should be optimized for landscape viewing
  - It will loop continuously until the user clicks to start the demo
  - Recommended format: MP4 (H.264 codec)
  - Recommended resolution: 1920x1080 or 1280x720

## Setup Instructions

1. Place your `demo-loop.mp4` file in `/public/assets/`
2. Set `VITE_DEMO_MODE=true` in your `.env` file
3. Start the application

When a user clicks on the video screen, the app will transition from the landscape video to the portrait app interface.

## Note

The demo-loop.mp4 file is not included in the repository. You must add it yourself before using demo mode.
