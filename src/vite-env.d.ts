/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE: string;
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_GOOGLE_WEB_CLIENT_ID: string;
  readonly VITE_GOOGLE_VISION_API_KEY?: string;
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_GOOGLE_WEB_CLIENT_ID: string;
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Demo mode window extensions
interface Window {
  __clearDemoData?: () => void;
  __demoFirestore?: {
    clear: () => void;
  };
}
