import React, { useEffect, useRef } from "react";
import {
  IonApp,
  IonRouterOutlet,
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  setupIonicReact,
  createAnimation,
  useIonRouter,
} from "@ionic/react";
import type { Animation, AnimationBuilder } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { Route, Redirect } from "react-router";
import { useLocation } from "react-router-dom";
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

import { trackEvent } from "./firebase";
import UpdateGate from "./UpdateGate";

setupIonicReact();

const TAB_ORDER = ["analytics", "planner", "home", "workout", "settings"];
const ANIMATION_DURATION_MS = 350;
const ENTER_MIN_OPACITY = 0.2;
const LEAVE_TRANSLATE_PERCENT = 30;
const LEAVE_MIN_OPACITY = 0.4;
const DEFAULT_TAB_INDEX = TAB_ORDER.indexOf("home");
const SAFE_DEFAULT_TAB_INDEX = DEFAULT_TAB_INDEX >= 0 ? DEFAULT_TAB_INDEX : 0;

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
  const router = useIonRouter();
  const previousTabIndexRef = useRef<number>(SAFE_DEFAULT_TAB_INDEX);
  const lastDirectionRef = useRef<"forward" | "back" | null>(null);

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

  const getTabIndex = (tabName: string) => TAB_ORDER.indexOf(tabName);

  const navigateToTab = (
    event: Event | React.MouseEvent | React.KeyboardEvent | CustomEvent,
    tabName: string,
    href: string,
  ) => {
    if ("preventDefault" in event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }
    const currentTab = getActiveTab();
    if (currentTab === tabName) return;

    const currentTabIndex = getTabIndex(currentTab);
    const targetIndex = getTabIndex(tabName);
    const direction =
      currentTabIndex !== -1 && targetIndex !== -1
        ? targetIndex > currentTabIndex
          ? "forward"
          : "back"
        : "forward";

    lastDirectionRef.current = direction;
    router.push(href, direction, "push");
  };

  const tabAnimation: AnimationBuilder = (_baseEl, opts) => {
    const currentTabIndex = getTabIndex(getActiveTab());
    const previousTabIndex = previousTabIndexRef.current;

    const hasValidIndices = currentTabIndex !== -1 && previousTabIndex !== -1;
    const clickDirection = lastDirectionRef.current;
    const fallbackForward = opts.direction !== "back"; // opts.direction may be undefined on initial load; default to forward.
    const isForward =
      clickDirection === "forward"
        ? true
        : clickDirection === "back"
          ? false
          : hasValidIndices
            ? currentTabIndex > previousTabIndex
            : fallbackForward; // Use router-provided direction when tab indices are unavailable (initial load/non-tab routes).
    lastDirectionRef.current = null;

    const enteringEl = opts.enteringEl;
    const leavingEl = opts.leavingEl;
    const directionFactor = isForward ? 1 : -1;

    const enteringAnimation = createAnimation()
      .addElement(enteringEl)
      .duration(ANIMATION_DURATION_MS)
      .easing("cubic-bezier(0.4, 0, 0.2, 1)")
      .beforeStyles({ zIndex: "101", position: "absolute", width: "100%" })
      .afterClearStyles(["z-index", "position", "width"])
      .beforeRemoveClass("ion-page-invisible")
      .fromTo("transform", `translateX(${directionFactor * 100}%)`, "translateX(0)")
      .fromTo("opacity", ENTER_MIN_OPACITY, 1);

    const leaveOffset = -directionFactor * LEAVE_TRANSLATE_PERCENT;
    let leavingAnimation: Animation | undefined;
    if (leavingEl) {
      leavingAnimation = createAnimation()
        .addElement(leavingEl)
        .duration(ANIMATION_DURATION_MS)
        .easing("cubic-bezier(0.4, 0, 0.2, 1)")
        .beforeStyles({ zIndex: "100", position: "absolute", width: "100%" })
        .afterClearStyles(["z-index", "position", "width"])
        .fromTo("transform", "translateX(0)", `translateX(${leaveOffset}%)`)
        .fromTo("opacity", 1, LEAVE_MIN_OPACITY);
    }

    const animation = createAnimation().addAnimation(enteringAnimation);

    if (leavingAnimation) {
      animation.addAnimation(leavingAnimation);
    }

    return animation;
  };

  const tabClass = (tabName: string) =>
    activeTab === tabName ? "mp-tab-btn mp-tab-btn--active" : "mp-tab-btn";

  useEffect(() => {
    const currentTabIndex = getTabIndex(activeTab);
    if (currentTabIndex !== -1) {
      previousTabIndexRef.current = currentTabIndex;
    }
  }, [activeTab]);

  return (
    <IonTabs>
      <IonRouterOutlet id="tabs" animation={tabAnimation}>
        <Route exact path="/app/analytics" component={Analytics} />
        <Route exact path="/app/planner" component={Planner} />
        <Route exact path="/app/home" component={Home} />
        <Route exact path="/app/workout" component={Workout} />
        <Route exact path="/app/settings" component={Settings} />
        <Redirect exact from="/app" to="/app/home" />
      </IonRouterOutlet>

      <IonTabBar slot="bottom" className="mp-tabbar">
        <IonTabButton
          tab="analytics"
          href="/app/analytics"
          onClick={(event) => navigateToTab(event, "analytics", "/app/analytics")}
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
          onClick={(event) => navigateToTab(event, "planner", "/app/planner")}
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
          onClick={(event) => navigateToTab(event, "home", "/app/home")}
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
          onClick={(event) => navigateToTab(event, "workout", "/app/workout")}
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
          onClick={(event) => navigateToTab(event, "settings", "/app/settings")}
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
  );
};


const App: React.FC = () => {
  useEffect(() => {
    // Valid theme values
    const validThemes = ["system", "light", "dark", "macropal"];
    
    // Check for saved theme preference first
    const savedTheme = localStorage.getItem("mp_theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

    const applyThemeFromStorage = () => {
      document.body.classList.remove("dark", "macropal-theme");
      
      // Validate saved theme before applying
      if (savedTheme && validThemes.includes(savedTheme)) {
        if (savedTheme === "dark") {
          document.body.classList.add("dark");
        } else if (savedTheme === "light") {
          // Light mode - no class needed
        } else if (savedTheme === "macropal") {
          document.body.classList.add("macropal-theme");
        } else if (savedTheme === "system") {
          // System default
          if (prefersDark.matches) {
            document.body.classList.add("dark");
          }
        }
      } else {
        // No valid preference saved - use system default
        if (prefersDark.matches) {
          document.body.classList.add("dark");
        }
      }
    };

    applyThemeFromStorage();

    // Only listen for system preference changes if using system theme
    const listener = (event: MediaQueryListEvent) => {
      const currentTheme = localStorage.getItem("mp_theme");
      if (!currentTheme || currentTheme === "system" || !validThemes.includes(currentTheme)) {
        document.body.classList.toggle("dark", event.matches);
        document.body.classList.remove("macropal-theme");
      }
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
