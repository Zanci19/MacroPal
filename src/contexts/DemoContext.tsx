import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

interface DemoContextType {
  isDemoMode: boolean;
  demoUserId: string;
  clearDemoData: () => void;
  getDemoData: (path: string) => any;
  setDemoData: (path: string, data: any) => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

const DEMO_USER_ID = "demo-user-id";
const DEMO_STORAGE_KEY = "demo_mode_data";

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const [demoStorage, setDemoStorage] = useState<Record<string, any>>(() => {
    if (!isDemoMode) return {};
    
    try {
      const stored = localStorage.getItem(DEMO_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const getDemoData = useCallback((path: string): any => {
    if (!isDemoMode) return undefined;
    return demoStorage[path];
  }, [isDemoMode, demoStorage]);

  const setDemoData = useCallback((path: string, data: any) => {
    if (!isDemoMode) return;
    
    setDemoStorage((prev) => {
      const updated = { ...prev, [path]: data };
      try {
        localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to save demo data:", err);
      }
      return updated;
    });
  }, [isDemoMode]);

  const clearDemoData = useCallback(() => {
    if (!isDemoMode) return;
    
    setDemoStorage({});
    localStorage.removeItem(DEMO_STORAGE_KEY);
    console.log("Demo data cleared");
  }, [isDemoMode]);

  // Expose clearDemoData globally for the DemoMode component to use
  useEffect(() => {
    if (isDemoMode) {
      (window as any).__clearDemoData = clearDemoData;
    }
    return () => {
      delete (window as any).__clearDemoData;
    };
  }, [isDemoMode, clearDemoData]);

  const value: DemoContextType = {
    isDemoMode,
    demoUserId: DEMO_USER_ID,
    clearDemoData,
    getDemoData,
    setDemoData,
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
};

export const useDemoContext = () => {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error("useDemoContext must be used within DemoProvider");
  }
  return context;
};

export const useDemoMode = () => {
  const context = useContext(DemoContext);
  return context?.isDemoMode ?? false;
};
