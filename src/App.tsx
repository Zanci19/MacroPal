import React, { useCallback, useEffect, Suspense, lazy, useMemo, useRef, useState } from "react";
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
  useIonRouter,
  createAnimation,
} from "@ionic/react";
import type { AnimationBuilder } from "@ionic/react";
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
  add,
  fitnessOutline,
  fitness,
  analyticsSharp,
} from "ionicons/icons";
import { ErrorBoundary } from "./components/ErrorBoundary";
import {
  applyTheme,
  getLazyLoadPreference,
  getStoredThemeMode,
} from "./utils/preferences";
import {
  LEGACY_SETTINGS_ROUTE_REDIRECTS,
  SETTINGS_ROUTES,
  isSettingsPath,
} from "./utils/settingsRoutes";

const importLogin = () => import("./pages/authentication/Login");
const importRegister = () => import("./pages/authentication/Register");
const importEmailVerification = () => import("./pages/authentication/EmailVerification");
const importAddFood = () => import("./pages/AddFood");
const importSetupProfile = () => import("./pages/SetupProfile");
const importOnboardingProfile = () => import("./pages/OnboardingProfile");
const importOnboardingTerms = () => import("./pages/OnboardingTerms");
const importCheckLogin = () => import("./pages/CheckLogin");
const importStart = () => import("./pages/Start");
const importResetPassword = () => import("./pages/ResetPassword");
const importAuthLoading = () => import("./pages/authentication/AuthLoading");
const importOffline = () => import("./pages/Offline");
const importHome = () => import("./pages/home/Home");
const importAnalytics = () => import("./pages/home/Analytics");
const importSettings = () => import("./pages/home/Settings");
const importHomeFeedPreferences = () => import("./pages/home/HomeFeedPreferences");
const importAppearanceSettings = () => import("./pages/home/AppearanceSettings");
const importDeleteAccount = () => import("./pages/home/DeleteAccount");
const importFeedback = () => import("./pages/home/Feedback");
const importEnergyNeeds = () => import("./pages/home/EnergyNeeds");
const importUnits = () => import("./pages/home/Units");
const importReminders = () => import("./pages/home/Reminders");
const importDataPrivacy = () => import("./pages/home/DataPrivacy");
const importWorkout = () => import("./pages/home/Workout");
const importChangelog = () => import("./pages/Changelog");
const importScanBarcode = () => import("./pages/ScanBarcode");
const importRecipeCalculator = () => import("./pages/RecipeCalculator");
const importPhotoFoodLogger = () => import("./pages/PhotoFoodLogger");
const importSharing = () => import("./pages/home/Sharing");
const importSharedUserView = () => import("./pages/home/SharedUserView");
const importClinicianConnect = () => import("./pages/home/ClinicianConnect");
const importClinicianDashboard = () => import("./pages/home/ClinicianDashboard");

const Login = lazy(importLogin);
const Register = lazy(importRegister);
const EmailVerification = lazy(importEmailVerification);
const AddFood = lazy(importAddFood);
const SetupProfile = lazy(importSetupProfile);
const OnboardingProfile = lazy(importOnboardingProfile);
const OnboardingTerms = lazy(importOnboardingTerms);
const CheckLogin = lazy(importCheckLogin);
const Start = lazy(importStart);
const ResetPassword = lazy(importResetPassword);
const AuthLoading = lazy(importAuthLoading);
const Offline = lazy(importOffline);
const Home = lazy(importHome);
const Analytics = lazy(importAnalytics);
const Settings = lazy(importSettings);
const HomeFeedPreferences = lazy(importHomeFeedPreferences);
const AppearanceSettings = lazy(importAppearanceSettings);
const DeleteAccount = lazy(importDeleteAccount);
const Feedback = lazy(importFeedback);
const EnergyNeeds = lazy(importEnergyNeeds);
const Units = lazy(importUnits);
const Reminders = lazy(importReminders);
const DataPrivacy = lazy(importDataPrivacy);
const Workout = lazy(importWorkout);
const Changelog = lazy(importChangelog);
const ScanBarcode = lazy(importScanBarcode);
const RecipeCalculator = lazy(importRecipeCalculator);
const PhotoFoodLogger = lazy(importPhotoFoodLogger);
const Sharing = lazy(importSharing);
const SharedUserView = lazy(importSharedUserView);
const ClinicianConnect = lazy(importClinicianConnect);
const ClinicianDashboard = lazy(importClinicianDashboard);

const LAZY_ROUTE_IMPORTS = [
  importLogin,
  importRegister,
  importEmailVerification,
  importAddFood,
  importSetupProfile,
  importOnboardingProfile,
  importOnboardingTerms,
  importCheckLogin,
  importStart,
  importResetPassword,
  importAuthLoading,
  importOffline,
  importHome,
  importAnalytics,
  importSettings,
  importHomeFeedPreferences,
  importAppearanceSettings,
  importDeleteAccount,
  importFeedback,
  importEnergyNeeds,
  importUnits,
  importReminders,
  importDataPrivacy,
  importWorkout,
  importChangelog,
  importScanBarcode,
  importRecipeCalculator,
  importPhotoFoodLogger,
  importSharing,
  importSharedUserView,
  importClinicianConnect,
  importClinicianDashboard,
];

const preloadLazyRoutes = async () => {
  await Promise.allSettled(LAZY_ROUTE_IMPORTS.map((loader) => loader()));
};

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

import { trackEvent } from "./firebase";
import UpdateGate, { isFeatureEnabled, useRemoteConfig } from "./UpdateGate";
import DebugOverlay from "./components/DebugOverlay";
import { reportRenderProfile } from "./components/renderProfiler";
import DemoMode from "./components/DemoMode";
import DemoRouter from "./components/DemoRouter";
import { DemoProvider } from "./contexts/DemoContext";

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
const enableRenderProfiling = import.meta.env.DEV;

const reportProfiler: React.ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime,
) => {
  if (!enableRenderProfiling) return;
  reportRenderProfile({
    id: String(id),
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
  });
};

// Wrapper for lazy loaded routes with individual Suspense boundaries
const LazyRoute = ({ component: Component, profileId, ...props }: { component: React.ComponentType<RouteComponentProps>; profileId?: string } & RouteComponentProps) => {
  const content = (
    <Suspense fallback={<RouteLoader />}>
      <Component {...props} />
    </Suspense>
  );

  if (!enableRenderProfiling) {
    return content;
  }

  return (
    <React.Profiler
      id={profileId ?? Component.displayName ?? Component.name ?? "LazyRoute"}
      onRender={reportProfiler}
    >
      {content}
    </React.Profiler>
  );
};

const ScanBarcodeRoute: React.FC<RouteComponentProps> = (props) => {
  const remoteConfig = useRemoteConfig();
  const barcodeEnabled = isFeatureEnabled(remoteConfig, "barcodeScanner");

  if (!barcodeEnabled) {
    trackEvent("barcode_route_blocked");
    return <Redirect to="/app/home" />;
  }

  return <LazyRoute component={ScanBarcode} profileId="ScanBarcode" {...props} />;
};

setupIonicReact();

const TAB_ORDER = ["analytics", "home", "workout", "settings"];
const DEFAULT_ANIMATION_DURATION_MS = 425;
const ANDROID_ANIMATION_DURATION_MS = 250;
const REDUCED_ANIMATION_DURATION_MS = 150;
const QUICK_ADD_URL = "/add-food?quickAdd=1";
const QUICK_ADD_TAB_URL = "/app/quick-add";
const QUICK_ADD_ROUTE_ANIMATION: AnimationBuilder = (_baseEl, opts) => {
  const enteringEl = opts.enteringEl;
  const leavingEl = opts.leavingEl;
  const isBack = opts.direction === "back";

  if (!isBack) {
    const rootAnimation = createAnimation().duration(0);
    if (enteringEl) {
      rootAnimation.addAnimation(
        createAnimation()
          .addElement(enteringEl)
          .beforeRemoveClass("ion-page-invisible")
      );
    }
    return rootAnimation;
  }

  const rootAnimation = createAnimation()
    .duration(ANIMATION_DURATION_MS)
    .easing("cubic-bezier(0.32, 0.72, 0, 1)");

  if (enteringEl) {
    rootAnimation.addAnimation(
      createAnimation()
        .addElement(enteringEl)
        .beforeStyles({
          position: "absolute",
          top: "0",
          left: "0",
          right: "0",
          bottom: "0",
          "z-index": "20",
        })
        .afterClearStyles(["position", "top", "left", "right", "bottom", "z-index"])
        .beforeRemoveClass("ion-page-invisible")
        .fromTo(
          "transform",
          isBack ? "translate3d(0, -10%, 0)" : "translate3d(0, 100%, 0)",
          "translate3d(0, 0, 0)"
        )
    );
  }

  if (leavingEl) {
    rootAnimation.addAnimation(
      createAnimation()
        .addElement(leavingEl)
        .beforeStyles({
          position: "absolute",
          top: "0",
          left: "0",
          right: "0",
          bottom: "0",
          "z-index": "9",
        })
        .afterClearStyles(["position", "top", "left", "right", "bottom", "z-index"])
        .fromTo(
          "transform",
          "translate3d(0, 0, 0)",
          isBack ? "translate3d(0, 100%, 0)" : "translate3d(0, -10%, 0)"
        )
    );
  }

  return rootAnimation;
};

const resolveTabFromPath = (path: string) => {
  if (path.startsWith("/app/analytics")) return "analytics";
  if (path.startsWith("/app/home")) return "home";
  if (path.startsWith("/app/workout")) return "workout";
  if (isSettingsPath(path)) return "settings";

  return "home";
};

const isSettingsStackPath = (path: string) => isSettingsPath(path);

// Detect reduced motion preference safely
const getPrefersReducedMotion = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const getIsAndroid = () => {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
};

const ANIMATION_DURATION_MS = getPrefersReducedMotion()
  ? REDUCED_ANIMATION_DURATION_MS
  : getIsAndroid()
    ? ANDROID_ANIMATION_DURATION_MS
    : DEFAULT_ANIMATION_DURATION_MS;

const TabsShell: React.FC<RouteComponentProps> = () => {
  const location = useLocation();
  const router = useIonRouter();
  const history = useHistory();

  // Refs for tracking tab navigation state across renders
  const lastDirectionRef = useRef<"forward" | "back" | null>(null);
  // Mutable ref updated synchronously each render so the animation builder can read
  // the current pathname without being recreated on every navigation.
  const locationPathnameRef = useRef(location.pathname);
  locationPathnameRef.current = location.pathname;

  // Track animation preference
  const [animationsEnabled, setAnimationsEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem("mp_tab_animations");
    return stored !== "disabled"; // Default to enabled
  });

  // Listen for animation preference changes
  useEffect(() => {
    const handleAnimationChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ enabled: boolean }>;
      console.log(`[USER ACTION] Animation Preference: Changed tab animations`, {
        enabled: customEvent.detail.enabled,
      });
      setAnimationsEnabled(customEvent.detail.enabled);
    };

    window.addEventListener("mp_animation_preference_change", handleAnimationChange);
    return () => {
      window.removeEventListener("mp_animation_preference_change", handleAnimationChange);
    };
  }, []);

  const activeTab = useMemo(() => resolveTabFromPath(location.pathname || ""), [location.pathname]);
  const isTabRootRoute = (path: string) =>
    [
      "/app/analytics",
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
    console.log(`[USER ACTION] Tab Navigation: Clicked ${tabName} tab`, {
      from: activeTab,
      to: tabName,
      href,
      eventType: event.type,
    });
    
    if ("preventDefault" in event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }
    const currentTab = activeTab;
    if (currentTab === tabName) return;

    const currentTabIndex = getTabIndex(currentTab);
    const targetIndex = getTabIndex(tabName);
    const direction =
      currentTabIndex !== -1 && targetIndex !== -1
        ? targetIndex > currentTabIndex
          ? "forward"
          : "back"
        : "forward";

    // Update refs for animation
    lastDirectionRef.current = direction;

    trackEvent("tab_navigation", {
      from: currentTab,
      to: tabName,
      direction,
    });
    router.push(href, "forward", "push");
  };

  const handleQuickAddFood = useCallback(() => {
    console.log(`[USER ACTION] Quick Add Food: Clicked quick add button`, {
      url: QUICK_ADD_URL,
    });
    trackEvent("tab_quick_add_food");
    router.push(QUICK_ADD_URL, "forward", "push", undefined, QUICK_ADD_ROUTE_ANIMATION);
  }, [router]);

  // Optimized sliding animation for Android - hardware accelerated, no opacity changes
  // Uses only translate3d transforms which are GPU-accelerated and performant
  const tabAnimation: AnimationBuilder = useMemo(
    () => (_baseEl, opts) => {
      // If animations are disabled, return instant transition
      if (!animationsEnabled) {
        const rootAnimation = createAnimation()
          .duration(0);
        
        if (opts.enteringEl) {
          rootAnimation.addAnimation(
            createAnimation()
              .addElement(opts.enteringEl)
              .beforeRemoveClass("ion-page-invisible")
          );
        }
        lastDirectionRef.current = null;
        return rootAnimation;
      }

      // Read current path from ref (updated synchronously on every render) so the
      // animation builder doesn't need location in its deps and won't be recreated
      // on every navigation — only when animationsEnabled changes.
      const activePath = locationPathnameRef.current || "";
      const clickDirection = lastDirectionRef.current;
      const isSettingsTransition =
        isSettingsStackPath(activePath) &&
        clickDirection === null &&
        (activePath !== "/app/settings" || opts.direction === "back");

      if (isSettingsTransition) {
        const isBack = opts.direction === "back";
        const enteringEl = opts.enteringEl;
        const leavingEl = opts.leavingEl;
        const rootAnimation = createAnimation()
          .duration(ANIMATION_DURATION_MS)
          .easing("cubic-bezier(0.32, 0.72, 0, 1)");

        if (enteringEl) {
          rootAnimation.addAnimation(
            createAnimation()
              .addElement(enteringEl)
              .beforeStyles({
                position: "absolute",
                top: "0",
                left: "0",
                right: "0",
                bottom: "0",
                "z-index": "20",
              })
              .afterClearStyles(["position", "top", "left", "right", "bottom", "z-index"])
              .beforeRemoveClass("ion-page-invisible")
              .fromTo(
                "transform",
                isBack ? "translate3d(0, -100%, 0)" : "translate3d(0, 100%, 0)",
                "translate3d(0, 0, 0)"
              )
          );
        }

        if (leavingEl) {
          rootAnimation.addAnimation(
            createAnimation()
              .addElement(leavingEl)
              .beforeStyles({
                position: "absolute",
                top: "0",
                left: "0",
                right: "0",
                bottom: "0",
                "z-index": "9",
              })
              .afterClearStyles(["position", "top", "left", "right", "bottom", "z-index"])
              .fromTo(
                "transform",
                "translate3d(0, 0, 0)",
                isBack ? "translate3d(0, 35%, 0)" : "translate3d(0, -35%, 0)"
              )
          );
        }

        lastDirectionRef.current = null;
        return rootAnimation;
      }

      const fallbackForward = opts.direction !== "back";
      const isForward =
        clickDirection === "forward"
          ? true
          : clickDirection === "back"
            ? false
            : fallbackForward;
      lastDirectionRef.current = null;

      const enteringEl = opts.enteringEl;
      const leavingEl = opts.leavingEl;
      
      // Direction: 1 for forward (right to left), -1 for back (left to right)
      const directionFactor = isForward ? 1 : -1;

      // Create the main animation that will run both entering and leaving in parallel
      const rootAnimation = createAnimation()
        .duration(ANIMATION_DURATION_MS)
        .easing("cubic-bezier(0.32, 0.72, 0, 1)");

      // Entering page slides in from the direction of travel (overlaps leaving page)
      rootAnimation
        .addAnimation(
          createAnimation()
            .addElement(enteringEl)
            .beforeStyles({
              position: "absolute",
              top: "0",
              left: "0",
              right: "0",
              bottom: "0",
              "z-index": "20",
            })
            .afterClearStyles(["position", "top", "left", "right", "bottom", "z-index"])
            .beforeRemoveClass("ion-page-invisible")
            .fromTo(
              "transform",
              `translate3d(${directionFactor * 100}%, 0, 0)`,
              "translate3d(0, 0, 0)"
            )
        );

      // Keep a 35% parallax exit while ensuring the leaving page stays under the entering page.
      if (leavingEl) {
        rootAnimation.addAnimation(
          createAnimation()
            .addElement(leavingEl)
            .beforeStyles({
              position: "absolute",
              top: "0",
              left: "0",
              right: "0",
              bottom: "0",
              "z-index": "10",
            })
            .afterClearStyles(["position", "top", "left", "right", "bottom", "z-index"])
            .fromTo(
              "transform",
              "translate3d(0, 0, 0)",
              `translate3d(${-directionFactor * 35}%, 0, 0)`
            )
        );
      }

      return rootAnimation;
    },
    [animationsEnabled] // Only recreate when animation enabled/disabled preference changes
  );

  const tabClass = (tabName: string) =>
    activeTab === tabName ? "mp-tab-btn mp-tab-btn--active" : "mp-tab-btn";

  useEffect(() => {
    const handler = (event: CustomEvent) => {
      if (!isTabRootRoute(location.pathname)) return;
      if (!("detail" in event) || typeof event.detail?.register !== "function") return;

      console.log(`[USER ACTION] Back Button: Hardware back button pressed`, {
        currentPath: location.pathname,
        navigatingTo: "/app/home",
      });

      event.detail.register(10, () => {
        if (location.pathname !== "/app/home") {
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

      console.log(`[USER ACTION] Browser Back: Browser back button pressed`, {
        currentPath: history.location.pathname,
        navigatingTo: "/app/home",
      });

      if (history.location.pathname !== "/app/home") {
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
        <Route exact path="/app/home" render={(props) => <LazyRoute component={Home} {...props} />} />
        <Route exact path="/app/workout" render={(props) => <LazyRoute component={Workout} {...props} />} />
        <Route exact path={SETTINGS_ROUTES.root} render={(props) => <LazyRoute component={Settings} {...props} />} />
        <Route exact path={SETTINGS_ROUTES.homeFeed} render={(props) => <LazyRoute component={HomeFeedPreferences} {...props} />} />
        <Route exact path={SETTINGS_ROUTES.appearance} render={(props) => <LazyRoute component={AppearanceSettings} {...props} />} />
        <Route exact path={SETTINGS_ROUTES.deleteAccount} render={(props) => <LazyRoute component={DeleteAccount} {...props} />} />
        <Route exact path={SETTINGS_ROUTES.profile} render={(props) => <LazyRoute component={SetupProfile} {...props} />} />
        <Route exact path={SETTINGS_ROUTES.changelog} render={(props) => <LazyRoute component={Changelog} {...props} />} />
        <Route exact path={SETTINGS_ROUTES.feedback} render={(props) => <LazyRoute component={Feedback} {...props} />} />
        <Route exact path={SETTINGS_ROUTES.energyNeeds} render={(props) => <LazyRoute component={EnergyNeeds} {...props} />} />
        <Route exact path={SETTINGS_ROUTES.units} render={(props) => <LazyRoute component={Units} {...props} />} />
        <Route exact path={SETTINGS_ROUTES.reminders} render={(props) => <LazyRoute component={Reminders} {...props} />} />
        <Route exact path={SETTINGS_ROUTES.dataPrivacy} render={(props) => <LazyRoute component={DataPrivacy} {...props} />} />
        <Route exact path={SETTINGS_ROUTES.sharing} render={(props) => <LazyRoute component={Sharing} {...props} />} />
        <Route exact path="/app/settings/shared-user/:uid" render={(props) => <LazyRoute component={SharedUserView} {...props} />} />
        <Route exact path={SETTINGS_ROUTES.clinicianConnect} render={(props) => <LazyRoute component={ClinicianConnect} {...props} />} />
        <Route exact path={SETTINGS_ROUTES.clinicianDashboard} render={(props) => <LazyRoute component={ClinicianDashboard} {...props} />} />
        {LEGACY_SETTINGS_ROUTE_REDIRECTS.map(([path, target]) => (
          <Route key={path} exact path={path} render={() => <Redirect to={target} />} />
        ))}
        <Route
          exact
          path="/app/shared-user/:uid"
          render={({ match }) => <Redirect to={SETTINGS_ROUTES.sharedUser(match.params.uid)} />}
        />
        <Route exact path={QUICK_ADD_TAB_URL} render={() => <Redirect to={QUICK_ADD_URL} />} />
        <Redirect exact from="/app" to="/app/home" />
      </IonRouterOutlet>

      <IonTabBar slot="bottom" className="mp-tabbar">
        {[
          {
            tab: "analytics",
            href: "/app/analytics",
            label: "Analytics",
            activeIcon: analyticsSharp,
            inactiveIcon: analytics,
          },
          {
            tab: "home",
            href: "/app/home",
            label: "Home",
            activeIcon: home,
            inactiveIcon: homeOutline,
          },
        ].map(({ tab, href, label, activeIcon, inactiveIcon }) => (
          <IonTabButton
            key={tab}
            tab={tab}
            href={href}
            onClick={(event) => navigateToTab(event, tab, href)}
            className={tabClass(tab)}
          >
            <IonIcon aria-hidden="true" icon={activeTab === tab ? activeIcon : inactiveIcon} />
            <IonLabel>{label}</IonLabel>
          </IonTabButton>
        ))}

        <IonTabButton
          tab="quick-add"
          href={QUICK_ADD_TAB_URL}
          className="mp-tab-btn mp-tab-btn--add"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleQuickAddFood();
          }}
          aria-label="Quick add food"
        >
          <div className="mp-tab-btn__add-circle">
            <IonIcon aria-hidden="true" icon={add} />
          </div>
          <span className="mp-tab-btn__hidden-label">Add food</span>
        </IonTabButton>

        {[
          {
            tab: "workout",
            href: "/app/workout",
            label: "Workout",
            activeIcon: fitness,
            inactiveIcon: fitnessOutline,
          },
          {
            tab: "settings",
            href: "/app/settings",
            label: "Settings",
            activeIcon: settings,
            inactiveIcon: settingsOutline,
          },
        ].map(({ tab, href, label, activeIcon, inactiveIcon }) => (
          <IonTabButton
            key={tab}
            tab={tab}
            href={href}
            onClick={(event) => navigateToTab(event, tab, href)}
            className={tabClass(tab)}
          >
            <IonIcon aria-hidden="true" icon={activeTab === tab ? activeIcon : inactiveIcon} />
            <IonLabel>{label}</IonLabel>
          </IonTabButton>
        ))}
      </IonTabBar>
    </IonTabs>
  );
};


const App: React.FC = () => {
  const [lazyLoadEnabled, setLazyLoadEnabled] = useState<boolean>(() => {
    return getLazyLoadPreference();
  });

  useEffect(() => {
    const handleLazyLoadChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ enabled: boolean }>;
      console.log(`[USER ACTION] Lazy Load Preference: Changed lazy load setting`, {
        enabled: customEvent.detail.enabled,
      });
      setLazyLoadEnabled(customEvent.detail.enabled);
    };

    window.addEventListener("mp_lazy_load_change", handleLazyLoadChange);
    return () => {
      window.removeEventListener("mp_lazy_load_change", handleLazyLoadChange);
    };
  }, []);

  useEffect(() => {
    if (!lazyLoadEnabled) {
      void preloadLazyRoutes();
    }
  }, [lazyLoadEnabled]);

  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
    applyTheme(getStoredThemeMode());

    // Only listen for system preference changes if using system theme
    const listener = (event: MediaQueryListEvent) => {
      const currentTheme = getStoredThemeMode();
      if (currentTheme !== "system") return;
      document.body.classList.toggle("dark", event.matches);
    };
    if ("addEventListener" in prefersDark) {
      prefersDark.addEventListener("change", listener);
      return () => prefersDark.removeEventListener("change", listener);
    }

    // Fallback for older WebViews/Safari versions.
    const legacyMatchMedia = prefersDark as MediaQueryList & {
      addListener: (callback: (event: MediaQueryListEvent) => void) => void;
      removeListener: (callback: (event: MediaQueryListEvent) => void) => void;
    };
    legacyMatchMedia.addListener(listener);
    return () => legacyMatchMedia.removeListener(listener);
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

    let rafId: number | null = null;
    const queueSoftkeyUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateSoftkeyPadding();
      });
    };

    updateSoftkeyPadding();

    const resizeSource = window.visualViewport;
    resizeSource?.addEventListener("resize", queueSoftkeyUpdate);
    window.addEventListener("resize", queueSoftkeyUpdate, { passive: true });
    window.addEventListener("orientationchange", queueSoftkeyUpdate, { passive: true });

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      setSoftkeyInset(0);
      document.body.classList.remove("has-softkeys");
      resizeSource?.removeEventListener("resize", queueSoftkeyUpdate);
      window.removeEventListener("resize", queueSoftkeyUpdate);
      window.removeEventListener("orientationchange", queueSoftkeyUpdate);
    };
  }, []);

  return (
    <IonApp>
      <UpdateGate>
        <DebugOverlay />
        <ErrorBoundary>
          <DemoProvider>
            <DemoMode>
              <IonReactRouter>
                <IonRouterOutlet id="root">
                  <Route exact path="/login" render={(props) => (
                    <LazyRoute component={Login} profileId="Login" {...props} />
                  )} />
                  <Route exact path="/register" render={(props) => (
                    <LazyRoute component={Register} profileId="Register" {...props} />
                  )} />
                  <Route exact path="/verify-email" render={(props) => (
                    <LazyRoute component={EmailVerification} profileId="EmailVerification" {...props} />
                  )} />
                  <Route exact path="/add-food" render={(props) => (
                    <LazyRoute component={AddFood} profileId="AddFood" {...props} />
                  )} />
                  <Route exact path="/onboarding-terms" render={(props) => (
                    <LazyRoute component={OnboardingTerms} profileId="OnboardingTerms" {...props} />
                  )} />
                  <Route exact path="/onboarding-profile" render={(props) => (
                    <LazyRoute component={OnboardingProfile} profileId="OnboardingProfile" {...props} />
                  )} />
                  <Route exact path="/setup-profile" render={(props) => (
                    <LazyRoute component={SetupProfile} profileId="SetupProfile" {...props} />
                  )} />
                  <Route exact path="/check-login" render={(props) => (
                    <LazyRoute component={CheckLogin} profileId="CheckLogin" {...props} />
                  )} />
                  <Route exact path="/start" render={(props) => (
                    <LazyRoute component={Start} profileId="Start" {...props} />
                  )} />
                  <Route exact path="/reset-password" render={(props) => (
                    <LazyRoute component={ResetPassword} profileId="ResetPassword" {...props} />
                  )} />
                  <Route exact path="/scan-barcode" render={(props) => (
                    <ScanBarcodeRoute {...props} />
                  )} />
                  <Route exact path="/recipe-calculator" render={(props) => (
                    <LazyRoute component={RecipeCalculator} profileId="RecipeCalculator" {...props} />
                  )} />
                  <Route exact path="/photo-food-logger" render={(props) => (
                    <LazyRoute component={PhotoFoodLogger} profileId="PhotoFoodLogger" {...props} />
                  )} />
                  <Route exact path="/auth-loading" render={(props) => (
                    <LazyRoute component={AuthLoading} profileId="AuthLoading" {...props} />
                  )} />
                  <Route exact path="/offline" render={(props) => (
                    <LazyRoute component={Offline} profileId="Offline" {...props} />
                  )} />

                  <Route
                    path="/app"
                    render={(props) =>
                      enableRenderProfiling ? (
                        <React.Profiler id="TabsShell" onRender={reportProfiler}>
                          <TabsShell {...props} />
                        </React.Profiler>
                      ) : (
                        <TabsShell {...props} />
                      )
                    }
                  />

                  <Route exact path="/" component={DemoRouter} />
                </IonRouterOutlet>
              </IonReactRouter>
            </DemoMode>
          </DemoProvider>
        </ErrorBoundary>
      </UpdateGate>
    </IonApp>
  );
};

export default App;
