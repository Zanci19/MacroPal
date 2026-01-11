import React, { useEffect, useRef, Suspense, lazy, useMemo } from "react";
import {
  IonApp,
  IonRouterOutlet,
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonSpinner,
  setupIonicReact,
  createAnimation,
  useIonRouter,
} from "@ionic/react";
import type { Animation, AnimationBuilder } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { Route, Redirect } from "react-router";
import { useHistory, useLocation } from "react-router-dom";
import type { RouteComponentProps } from "react-router-dom";
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

// Lazy load route components
const Login = lazy(() => import("./pages/authentication/Login"));
const Register = lazy(() => import("./pages/authentication/Register"));
const EmailVerification = lazy(() => import("./pages/authentication/EmailVerification"));
const AddFood = lazy(() => import("./pages/AddFood"));
const SetupProfile = lazy(() => import("./pages/SetupProfile"));
const OnboardingProfile = lazy(() => import("./pages/OnboardingProfile"));
const OnboardingTerms = lazy(() => import("./pages/OnboardingTerms"));
const CheckLogin = lazy(() => import("./pages/CheckLogin"));
const Start = lazy(() => import("./pages/Start"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AuthLoading = lazy(() => import("./pages/authentication/AuthLoading"));
const Offline = lazy(() => import("./pages/Offline"));
const Home = lazy(() => import("./pages/home/Home"));
const Analytics = lazy(() => import("./pages/home/Analytics"));
const Settings = lazy(() => import("./pages/home/Settings"));
const EnergyNeeds = lazy(() => import("./pages/home/EnergyNeeds"));
const Units = lazy(() => import("./pages/home/Units"));
const Reminders = lazy(() => import("./pages/home/Reminders"));
const DataPrivacy = lazy(() => import("./pages/home/DataPrivacy"));
const Planner = lazy(() => import("./pages/home/Planner"));
const Workout = lazy(() => import("./pages/home/Workout"));
const ScanBarcode = lazy(() => import("./pages/ScanBarcode"));

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

// Loading fallback component
const RouteLoader: React.FC = () => (
  <div style={{
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem"
  }}>
    <IonSpinner name="crescent" />
  </div>
);

// Wrapper for lazy loaded routes with individual Suspense boundaries
const LazyRoute = ({ component: Component, ...props }: any) => (
  <Suspense fallback={<RouteLoader />}>
    <Component {...props} />
  </Suspense>
);

setupIonicReact();

const TAB_ORDER = ["analytics", "planner", "home", "workout", "settings"];
const DEFAULT_ANIMATION_DURATION_MS = 350;
const REDUCED_ANIMATION_DURATION_MS = 150;
const ENTER_MIN_OPACITY = 0.2;
const LEAVE_TRANSLATE_PERCENT = 30;
const LEAVE_MIN_OPACITY = 0.4;
const DEFAULT_TAB_INDEX = TAB_ORDER.indexOf("home");
const SAFE_DEFAULT_TAB_INDEX = DEFAULT_TAB_INDEX >= 0 ? DEFAULT_TAB_INDEX : 0;

// Detect reduced motion preference safely
const getPrefersReducedMotion = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const ANIMATION_DURATION_MS = getPrefersReducedMotion() 
  ? REDUCED_ANIMATION_DURATION_MS 
  : DEFAULT_ANIMATION_DURATION_MS;

const TabsShell: React.FC = () => {
  const location = useLocation();
  const router = useIonRouter();
  const history = useHistory();
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
  const isTabRootRoute = (path: string) =>
    [
      "/app/analytics",
      "/app/planner",
      "/app/home",
      "/app/workout",
      "/app/settings",
    ].includes(path);

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
    trackEvent("tab_navigation", {
      from: currentTab,
      to: tabName,
      direction,
    });
    router.push(href, "forward", "push");
  };

  // Memoize the animation builder to prevent unnecessary recreation on every render
  const tabAnimation: AnimationBuilder = useMemo(
    () => (_baseEl, opts) => {
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

      const enteringStartOpacity = isForward ? ENTER_MIN_OPACITY : 1;
      const leavingEndOpacity = isForward ? LEAVE_MIN_OPACITY : 1;
      const enteringZIndex = isForward ? "101" : "102";
      const leavingZIndex = isForward ? "100" : "99";

      const enteringAnimation = createAnimation()
        .addElement(enteringEl)
        .duration(ANIMATION_DURATION_MS)
        .easing("cubic-bezier(0.4, 0, 0.2, 1)")
        .beforeStyles({
          zIndex: enteringZIndex,
          position: "absolute",
          top: "0",
          left: "0",
          right: "0",
          bottom: "0",
          width: "100%",
          height: "100%",
          willChange: "transform",
        })
        .afterClearStyles(["z-index", "position", "top", "left", "right", "bottom", "width", "height", "will-change"])
        .beforeRemoveClass("ion-page-invisible")
        .fromTo("transform", `translateX(${directionFactor * 100}%) translateZ(0)`, "translateX(0) translateZ(0)")
        //.fromTo("opacity", enteringStartOpacity, 1);

      const leaveOffset = -directionFactor * LEAVE_TRANSLATE_PERCENT;
      let leavingAnimation: Animation | undefined;
      if (leavingEl) {
        leavingAnimation = createAnimation()
          .addElement(leavingEl)
          .duration(ANIMATION_DURATION_MS)
          .easing("cubic-bezier(0.4, 0, 0.2, 1)")
          .beforeStyles({
            zIndex: leavingZIndex,
            position: "absolute",
            top: "0",
            left: "0",
            right: "0",
            bottom: "0",
            width: "100%",
            height: "100%",
            willChange: "transform, opacity",
          })
          .afterClearStyles(["z-index", "position", "top", "left", "right", "bottom", "width", "height", "will-change"])
          .fromTo("transform", "translateX(0) translateZ(0)", `translateX(${leaveOffset}%) translateZ(0)`)
          .fromTo("opacity", 1, leavingEndOpacity);
      }

      const animation = createAnimation().addAnimation(enteringAnimation);

      if (leavingAnimation) {
        animation.addAnimation(leavingAnimation);
      }

      return animation;
    },
    [] // Empty dependency array - animation logic doesn't change
  );

  const tabClass = (tabName: string) =>
    activeTab === tabName ? "mp-tab-btn mp-tab-btn--active" : "mp-tab-btn";

  useEffect(() => {
    const currentTabIndex = getTabIndex(activeTab);
    if (currentTabIndex !== -1) {
      previousTabIndexRef.current = currentTabIndex;
    }
  }, [activeTab]);

  useEffect(() => {
    const handler = (event: CustomEvent) => {
      if (!isTabRootRoute(location.pathname)) return;
      if (!("detail" in event) || typeof event.detail?.register !== "function") return;

      event.detail.register(10, () => {
        if (location.pathname !== "/app/home") {
          lastDirectionRef.current = "back";
          router.push("/app/home", "root", "replace");
        }
      });
    };

    document.addEventListener("ionBackButton", handler as EventListener);

    return () => {
      document.removeEventListener("ionBackButton", handler as EventListener);
    };
  }, [location.pathname, router]);

  useEffect(() => {
    const unblock = history.block((_nextLocation, action) => {
      if (action !== "POP") return;
      if (!isTabRootRoute(history.location.pathname)) return;

      if (history.location.pathname !== "/app/home") {
        lastDirectionRef.current = "back";
        router.push("/app/home", "root", "replace");
      }

      return false;
    });

    return () => {
      unblock();
    };
  }, [history, router]);

  return (
    <IonTabs>
      <IonRouterOutlet id="tabs" animation={tabAnimation}>
        <Route exact path="/app/analytics" render={(props) => <LazyRoute component={Analytics} {...props} />} />
        <Route exact path="/app/planner" render={(props) => <LazyRoute component={Planner} {...props} />} />
        <Route exact path="/app/home" render={(props) => <LazyRoute component={Home} {...props} />} />
        <Route exact path="/app/workout" render={(props) => <LazyRoute component={Workout} {...props} />} />
        <Route exact path="/app/settings" render={(props) => <LazyRoute component={Settings} {...props} />} />
        <Route exact path="/app/energy-needs" render={(props) => <LazyRoute component={EnergyNeeds} {...props} />} />
        <Route exact path="/app/units" render={(props) => <LazyRoute component={Units} {...props} />} />
        <Route exact path="/app/reminders" render={(props) => <LazyRoute component={Reminders} {...props} />} />
        <Route exact path="/app/data-privacy" render={(props) => <LazyRoute component={DataPrivacy} {...props} />} />
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

      // Cap the value to avoid runaway values on devices that report unrealistic viewport sizes.
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
            <IonRouterOutlet id="root">
              <Route exact path="/login" render={(props) => <LazyRoute component={Login} {...props} />} />
              <Route exact path="/register" render={(props) => <LazyRoute component={Register} {...props} />} />
              <Route exact path="/verify-email" render={(props) => <LazyRoute component={EmailVerification} {...props} />} />
              <Route exact path="/add-food" render={(props) => <LazyRoute component={AddFood} {...props} />} />
              <Route exact path="/onboarding-terms" render={(props) => <LazyRoute component={OnboardingTerms} {...props} />} />
              <Route exact path="/onboarding-profile" render={(props) => <LazyRoute component={OnboardingProfile} {...props} />} />
              <Route exact path="/setup-profile" render={(props) => <LazyRoute component={SetupProfile} {...props} />} />
              <Route exact path="/check-login" render={(props) => <LazyRoute component={CheckLogin} {...props} />} />
              <Route exact path="/start" render={(props) => <LazyRoute component={Start} {...props} />} />
              <Route exact path="/reset-password" render={(props) => <LazyRoute component={ResetPassword} {...props} />} />
              <Route exact path="/scan-barcode" render={(props) => <LazyRoute component={ScanBarcode} {...props} />} />
              <Route exact path="/auth-loading" render={(props) => <LazyRoute component={AuthLoading} {...props} />} />
              <Route exact path="/offline" render={(props) => <LazyRoute component={Offline} {...props} />} />

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