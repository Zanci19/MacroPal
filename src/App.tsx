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
import { useLocation } from "react-router-dom";
import {
  homeOutline,
  settingsOutline,
  analyticsSharp,
  calendarOutline,
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

const TabsShell: React.FC = () => (
  <IonTabs>
    <IonRouterOutlet id="tabs">
      <Route exact path="/app/analytics" component={Analytics} />
      <Route exact path="/app/home" component={Home} />
      <Route exact path="/app/planner" component={Planner} />
      <Route exact path="/app/settings" component={Settings} />
      <Redirect exact from="/app" to="/app/home" />
    </IonRouterOutlet>

    <IonTabBar slot="bottom" className="mp-tabbar">
      <IonTabButton tab="analytics" href="/app/analytics">
        <IonIcon aria-hidden="true" icon={analyticsSharp} />
        <IonLabel>Analytics</IonLabel>
      </IonTabButton>

      <IonTabButton tab="home" href="/app/home">
        <IonIcon aria-hidden="true" icon={homeOutline} />
        <IonLabel>Home</IonLabel>
      </IonTabButton>

      <IonTabButton tab="planner" href="/app/planner">
        <IonIcon aria-hidden="true" icon={calendarOutline} />
        <IonLabel>Planner</IonLabel>
      </IonTabButton>

      <IonTabButton tab="settings" href="/app/settings">
        <IonIcon aria-hidden="true" icon={settingsOutline} />
        <IonLabel>Settings</IonLabel>
      </IonTabButton>
    </IonTabBar>
  </IonTabs>
);

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

      document.body.classList.toggle("has-softkeys", softkeyHeight > 24);
    };

    updateSoftkeyPadding();

    const resizeSource = window.visualViewport;
    resizeSource?.addEventListener("resize", updateSoftkeyPadding);
    window.addEventListener("resize", updateSoftkeyPadding);
    window.addEventListener("orientationchange", updateSoftkeyPadding);

    return () => {
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