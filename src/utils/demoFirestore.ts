/**
 * Demo Firestore - A mock Firestore implementation for demo mode
 * This provides a localStorage-backed implementation that mimics Firestore's API
 */

type Listener = (data: unknown) => void;

interface DemoDoc {
  data: unknown;
  listeners: Set<Listener>;
}

class DemoFirestore {
  private docs: Map<string, DemoDoc> = new Map();
  private storageKey = "demo_firestore_data";

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored) as Record<string, unknown>;
        Object.entries(data).forEach(([path, docData]) => {
          this.docs.set(path, {
            data: docData,
            listeners: new Set(),
          });
        });
      }
    } catch (err) {
      console.error("Failed to load demo firestore data:", err);
    }
  }

  private saveToStorage() {
    try {
      const data: Record<string, unknown> = {};
      this.docs.forEach((doc, path) => {
        data[path] = doc.data;
      });
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (err) {
      console.error("Failed to save demo firestore data:", err);
    }
  }

  // Get document data
  getData(path: string): unknown {
    return this.docs.get(path)?.data;
  }

  // Set document data
  setData(path: string, data: unknown) {
    let doc = this.docs.get(path);
    if (!doc) {
      doc = { data: {}, listeners: new Set() };
      this.docs.set(path, doc);
    }
    doc.data = { ...doc.data as object, ...data as object };
    this.saveToStorage();
    
    // Notify listeners
    doc.listeners.forEach((listener) => {
      listener(doc.data);
    });
  }

  // Delete document
  deleteData(path: string) {
    this.docs.delete(path);
    this.saveToStorage();
  }

  // Subscribe to document changes
  onSnapshot(path: string, callback: Listener): () => void {
    let doc = this.docs.get(path);
    if (!doc) {
      doc = { data: {}, listeners: new Set() };
      this.docs.set(path, doc);
    }

    doc.listeners.add(callback);
    
    // Immediately call callback with current data
    setTimeout(() => callback(doc.data), 0);

    // Return unsubscribe function
    return () => {
      doc.listeners.delete(callback);
    };
  }

  // Clear all data (for demo reset)
  clear() {
    this.docs.clear();
    localStorage.removeItem(this.storageKey);
  }
}

// Singleton instance
export const demoFirestore = new DemoFirestore();

// Expose globally for clearing on demo reset
if (typeof window !== "undefined") {
  window.__demoFirestore = demoFirestore;
}
