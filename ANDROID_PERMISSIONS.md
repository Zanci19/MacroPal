# Android Permissions Required for MacroPal

The following permissions are required in `AndroidManifest.xml`:

```xml
<!-- Required for network access (food database, Firebase, etc.) -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- Required for accessing the camera to scan barcodes -->
<uses-permission android:name="android.permission.CAMERA" />

<!-- Required for reading/writing photos for food entries -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />

<!-- Required for local notifications/reminders -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />

<!-- Optional: For Google Fit integration -->
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />

<!-- Optional: For checking network state -->
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

## Permission Usage

- **INTERNET**: Required for all network operations including Firebase authentication, Firestore database access, and OpenFoodFacts API calls
- **CAMERA**: Used for barcode scanning feature in food search
- **READ/WRITE_EXTERNAL_STORAGE**: Used for saving and loading food photos
- **POST_NOTIFICATIONS & SCHEDULE_EXACT_ALARM**: Used for meal and water reminders
- **ACTIVITY_RECOGNITION**: Used for Google Fit calorie tracking integration (optional)
- **ACCESS_NETWORK_STATE**: Used for offline detection and handling (optional)
