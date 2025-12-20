import React, { useEffect } from "react";
import {
  IonApp,
  IonRouterOutlet,
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  setupIonicReact,
} from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { Route, Redirect } from "react-router";
import { useHistory, useLocation } from "react-router-dom";
import {
  homeOutline,
  home,
  settingsOutline,
  settings,
  analytics,
  calendarOutline,
  calendar,
  fitnessOutline,
  fitness,
  analyticsSharp,
} from "ionicons/icons";
import { ErrorBoundary } from "./components/ErrorBoundary";

import Login from "./pages/authentication/Login";
import Register from "./pages/authentication/Register";
import AddFood from "./pages/AddFood";
import SetupProfile from "./pages/SetupProfile";
import CheckLogin from "./pages/CheckLogin";
import Start from "./pages/Start";
import ResetPassword from "./pages/ResetPassword";
import AuthLoading from "./pages/authentication/AuthLoading";
import Offline from "./pages/Offline";
import Home from "./pages/home/Home";
import Analytics from "./pages/home/Analytics";
import Settings from "./pages/home/Settings";
import Planner from "./pages/home/Planner";
import Workout from "./pages/home/Workout";
import ScanBarcode from "./pages/ScanBarcode";

import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";

import "@ionic/react/css/palettes/dark.class.css";

import "./theme/variables.css";

import { auth, db, trackEvent } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import UpdateGate from "./UpdateGate";

setupIonicReact();

const AnalyticsRouteTracker: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname + (location.search || "");
    trackEvent("screen_view", {
      screen_name: path,
      screen_class: path,
    });
  }, [location]);

  return null;
};

const TabsShell: React.FC = () => {
  const location = useLocation();
  const history = useHistory();
  const [swipeNavigationEnabled, setSwipeNavigationEnabled] = React.useState(true);
  const [dragOffset, setDragOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [animating, setAnimating] = React.useState(false);
  const [pendingTab, setPendingTab] = React.useState<string | null>(null);

  const tabOrder = [
    { id: "analytics", route: "/app/analytics" },
    { id: "planner", route: "/app/planner" },
    { id: "home", route: "/app/home" },
    { id: "workout", route: "/app/workout" },
    { id: "settings", route: "/app/settings" },
  ];

  const getActiveTab = () => {
    const path = location.pathname || "";

    if (path.startsWith("/app/analytics")) return "analytics";
    if (path.startsWith("/app/planner")) return "planner";
    if (path.startsWith("/app/home")) return "home";
    if (path.startsWith("/app/workout")) return "workout";
    if (path.startsWith("/app/settings")) return "settings";

    return "home";
  };

  const activeTab = getActiveTab();

  useEffect(() => {
    if (location.pathname === "/app") {
      history.replace("/app/home");
    }
  }, [history, location.pathname]);

  const navigateToTab = (tabId: string) => {
    const target = tabOrder.find((tab) => tab.id === tabId);
    if (target && target.route !== location.pathname) {
      history.push(target.route);
    }
  };

  const touchStartX = React.useRef<number | null>(null);
  const touchStartY = React.useRef<number | null>(null);
  const isSwipeTracking = React.useRef(false);
  const intendedDirection = React.useRef<"left" | "right" | null>(null);

  const windowWidth = () => window.innerWidth || 360;

  const resetTouchTracking = () => {
    touchStartX.current = null;
    touchStartY.current = null;
    isSwipeTracking.current = false;
    intendedDirection.current = null;
    setDragging(false);
    setDragOffset(0);
    setPendingTab(null);
    setAnimating(false);
  };

  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    if (!swipeNavigationEnabled) {
      resetTouchTracking();
      return;
    }
    if (event.touches.length !== 1) return;

    touchStartX.current = event.touches[0].clientX;
    touchStartY.current = event.touches[0].clientY;
    isSwipeTracking.current = true;
    setDragging(false);
    setAnimating(false);
    setPendingTab(null);
    setDragOffset(0);
  };

  const onTouchMove: React.TouchEventHandler<HTMLDivElement> = (event) => {
    if (!swipeNavigationEnabled) {
      resetTouchTracking();
      return;
    }
    if (!isSwipeTracking.current || touchStartX.current === null || touchStartY.current === null)
      return;

    const deltaX = event.touches[0].clientX - touchStartX.current;
    const deltaY = event.touches[0].clientY - touchStartY.current;

    if (!dragging && Math.abs(deltaY) > Math.abs(deltaX)) {
      resetTouchTracking();
      return;
    }

    const direction = deltaX < 0 ? "left" : "right";
    const currentIndex = tabOrder.findIndex((tab) => tab.id === activeTab);
    const targetIndex = direction === "left" ? currentIndex + 1 : currentIndex - 1;
    const targetTab = tabOrder[targetIndex]?.id || null;

    intendedDirection.current = targetTab ? direction : null;
    setPendingTab(targetTab);
    setDragging(true);
    setDragOffset(deltaX);
  };

  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = () => {
    if (!swipeNavigationEnabled) {
      resetTouchTracking();
      return;
    }
    if (!isSwipeTracking.current || touchStartX.current === null || touchStartY.current === null)
      return;

    const threshold = windowWidth() * 0.22;
    const shouldAdvance = pendingTab && Math.abs(dragOffset) > threshold;

    if (shouldAdvance && intendedDirection.current) {
      setAnimating(true);
      const finalOffset = intendedDirection.current === "left" ? -windowWidth() : windowWidth();
      setDragOffset(finalOffset);

      window.setTimeout(() => {
        if (pendingTab) navigateToTab(pendingTab);
        resetTouchTracking();
      }, 220);
      return;
    }

    setAnimating(true);
    setDragOffset(0);
    window.setTimeout(() => {
      resetTouchTracking();
    }, 180);
  };

  const tabClass = (tabName: string) =>
    activeTab === tabName ? "mp-tab-btn mp-tab-btn--active" : "mp-tab-btn";

  const panelOffset = (tabId: string) => {
    if (tabId === activeTab) {
      return dragOffset;
    }

    if (tabId === pendingTab && intendedDirection.current) {
      const base = intendedDirection.current === "left" ? windowWidth() : -windowWidth();
      return base + dragOffset;
    }

    const currentIndex = tabOrder.findIndex((tab) => tab.id === activeTab);
    const targetIndex = tabOrder.findIndex((tab) => tab.id === tabId);
    const relative = targetIndex - currentIndex;

    if (relative === 0) return 0;
    return relative > 0 ? windowWidth() : -windowWidth();
  };

  const tabPanels = (
    <div
      className={`mp-tab-panels${dragging ? " mp-tab-panels--dragging" : ""}${
        animating ? " mp-tab-panels--animating" : ""
      }`}
    >
      {tabOrder.map((tab) => {
        const panelKey = tab.id;
        const Component =
          panelKey === "analytics"
            ? Analytics
            : panelKey === "planner"
              ? Planner
              : panelKey === "home"
                ? Home
                : panelKey === "workout"
                  ? Workout
                  : Settings;

        return (
          <div
            key={panelKey}
            className={`mp-tab-panel ${activeTab === panelKey ? "mp-tab-panel--active" : ""}`}
            style={{
              transform: `translateX(${panelOffset(panelKey)}px)`,
              pointerEvents: activeTab === panelKey ? "auto" : "none",
            }}
          >
            <Component />
          </div>
        );
      })}
    </div>
  );

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (current) => {
      unsubscribeProfile?.();

      if (!current) {
        setSwipeNavigationEnabled(true);
        return;
      }

      const ref = doc(db, "users", current.uid);
      unsubscribeProfile = onSnapshot(ref, (snap) => {
        const data = snap.data() as { profile?: { swipeNavigationEnabled?: boolean } } | undefined;
        const enabled = data?.profile?.swipeNavigationEnabled;

        setSwipeNavigationEnabled(enabled !== false);
      });
    });

    return () => {
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, []);

  return (
    <div
      className="mp-tab-shell"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <IonTabs>
        <IonRouterOutlet animated={false} className="mp-tab-panels-outlet">
          <Route
            path="/app/:tab(analytics|planner|home|workout|settings)"
            render={() => tabPanels}
          />
          <Route exact path="/app" render={() => tabPanels} />
        </IonRouterOutlet>

        <IonTabBar slot="bottom" className="mp-tabbar">
          <IonTabButton
            tab="analytics"
            href="/app/analytics"
            className={tabClass("analytics")}
          >
            <IonIcon
              aria-hidden="true"
              icon={activeTab === "analytics" ? analyticsSharp : analytics}
            />
            <IonLabel>Analytics</IonLabel>
          </IonTabButton>

          <IonTabButton
            tab="planner"
            href="/app/planner"
            className={tabClass("planner")}
          >
            <IonIcon
              aria-hidden="true"
              icon={activeTab === "planner" ? calendar : calendarOutline}
            />
            <IonLabel>Planner</IonLabel>
          </IonTabButton>

          <IonTabButton
            tab="home"
            href="/app/home"
            className={tabClass("home")}
          >
            <IonIcon
              aria-hidden="true"
              icon={activeTab === "home" ? home : homeOutline}
            />
            <IonLabel>Home</IonLabel>
          </IonTabButton>

          <IonTabButton
            tab="workout"
            href="/app/workout"
            className={tabClass("workout")}
          >
            <IonIcon
              aria-hidden="true"
              icon={activeTab === "workout" ? fitness : fitnessOutline}
            />
            <IonLabel>Workout</IonLabel>
          </IonTabButton>

          <IonTabButton
            tab="settings"
            href="/app/settings"
            className={tabClass("settings")}
          >
            <IonIcon
              aria-hidden="true"
              icon={activeTab === "settings" ? settings : settingsOutline}
            />
            <IonLabel>Settings</IonLabel>
          </IonTabButton>
        </IonTabBar>
      </IonTabs>
    </div>
  );
};


const App: React.FC = () => {
  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = (isDark: boolean) => {
      document.body.classList.toggle("dark", isDark);
    };

    applyTheme(prefersDark.matches);

    const listener = (event: MediaQueryListEvent) => {
      applyTheme(event.matches);
    };

    prefersDark.addEventListener("change", listener);
    return () => prefersDark.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    const isAndroid = /Android/i.test(window.navigator.userAgent || "");
    if (!isAndroid) return;

    const setSoftkeyInset = (value: number) => {
      document.documentElement.style.setProperty("--softkey-inset", `${value}px`);
    };

    const getCssScreenHeight = () => {
      const screen = window.screen || {};
      const dpr = window.devicePixelRatio || 1;
      const rawHeight = Math.max(screen.height || 0, screen.availHeight || 0);

      return rawHeight ? rawHeight / dpr : window.innerHeight;
    };

    const updateSoftkeyPadding = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const layoutViewportHeight = window.innerHeight;
      const cssScreenHeight = getCssScreenHeight();

      const gapEstimates = [
        cssScreenHeight - viewportHeight,
        cssScreenHeight - layoutViewportHeight,
        layoutViewportHeight - viewportHeight,
      ].filter((value) => Number.isFinite(value));

      const softkeyHeight = gapEstimates.length
        ? Math.max(0, ...gapEstimates)
        : 0;

      // Cap the value to avoid runaway values on devices that report
      // unrealistic viewport sizes.
      const clampedSoftkeyHeight = Math.min(softkeyHeight, 120);

      setSoftkeyInset(clampedSoftkeyHeight);

      document.body.classList.toggle("has-softkeys", clampedSoftkeyHeight > 16);
    };

    updateSoftkeyPadding();

    const resizeSource = window.visualViewport;
    resizeSource?.addEventListener("resize", updateSoftkeyPadding);
    window.addEventListener("resize", updateSoftkeyPadding);
    window.addEventListener("orientationchange", updateSoftkeyPadding);

    return () => {
      setSoftkeyInset(0);
      resizeSource?.removeEventListener("resize", updateSoftkeyPadding);
      window.removeEventListener("resize", updateSoftkeyPadding);
      window.removeEventListener("orientationchange", updateSoftkeyPadding);
    };
  }, []);

  return (
    <IonApp>
      <ErrorBoundary>
        <IonReactRouter>
          <UpdateGate>
            <AnalyticsRouteTracker />

            <IonRouterOutlet id="root">
              <Route exact path="/login" component={Login} />
              <Route exact path="/register" component={Register} />
              <Route exact path="/add-food" component={AddFood} />
              <Route exact path="/setup-profile" component={SetupProfile} />
              <Route exact path="/check-login" component={CheckLogin} />
              <Route exact path="/start" component={Start} />
              <Route exact path="/reset-password" component={ResetPassword} />
              <Route exact path="/scan-barcode" component={ScanBarcode} />
              <Route exact path="/auth-loading" component={AuthLoading} />
              <Route exact path="/offline" component={Offline} />

              <Route path="/app" component={TabsShell} />

              <Redirect exact from="/" to="/check-login" />
            </IonRouterOutlet>
          </UpdateGate>
        </IonReactRouter>
      </ErrorBoundary>
    </IonApp>
  );
};

export default App;