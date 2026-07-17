import { useEffect, useState } from "react";
import { getHomeLayout, type HomeLayout } from "../utils/preferences";

/** Live Home-layout preference; updates when Appearance settings change it. */
export const useHomeLayout = (): HomeLayout => {
  const [layout, setLayout] = useState<HomeLayout>(() => getHomeLayout());
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ layout: HomeLayout }>).detail;
      if (detail?.layout) setLayout(detail.layout);
    };
    window.addEventListener("mp_home_layout_change", handler);
    return () => window.removeEventListener("mp_home_layout_change", handler);
  }, []);
  return layout;
};
