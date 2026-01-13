export type RenderProfileSnapshot = {
  id: string;
  phase: "mount" | "update" | "nested-update";
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
};

type RenderProfileListener = (snapshot: RenderProfileSnapshot) => void;

let latestSnapshot: RenderProfileSnapshot | null = null;
const listeners = new Set<RenderProfileListener>();

export const reportRenderProfile = (snapshot: RenderProfileSnapshot) => {
  latestSnapshot = snapshot;
  listeners.forEach((listener) => listener(snapshot));
};

export const subscribeRenderProfile = (listener: RenderProfileListener) => {
  listeners.add(listener);
  if (latestSnapshot) {
    listener(latestSnapshot);
  }

  return () => {
    listeners.delete(listener);
  };
};
