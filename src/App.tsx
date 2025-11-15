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
import { useLocation } from "react-router-dom"; // 👈 NEW
import { homeOutline, settingsOutline, analyticsSharp } from "ionicons/icons";

/* Standalone pages (non-tab) */
import Login from "./pages/authentication/Login";
import Register from "./pages/authentication/Register";
import AddFood from "./pages/AddFood";
import SetupProfile from "./pages/SetupProfile";
import CheckLogin from "./pages/CheckLogin";
import Start from "./pages/Start";
import ResetPassword from "./pages/ResetPassword";
import AuthLoading from "./pages/authentication/AuthLoading";
import Offline from "./pages/Offline";

/* Tab pages */
import Home from "./pages/home/Home";
import Analytics from "./pages/home/Analytics";
import Settings from "./pages/home/Settings"; // Settings index list
import ScanBarcode from "./pages/ScanBarcode";

/* Core CSS required for Ionic components to work properly */
import "@ionic/react/css/core.css";

/* Basic CSS for apps built with Ionic */
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";

/* Optional CSS utils */
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";

/* Dark Mode (optional) */
// import '@ionic/react/css/palettes/dark.always.css';
// import '@ionic/react/css/palettes/dark.class.css';
import "@ionic/react/css/palettes/dark.system.css";

import "./theme/variables.css";

import { trackEvent } from "./firebase";

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
      {/* Home & Left tabs */}
      <Route exact path="/app/left" component={Analytics} />
      <Route exact path="/app/home" component={Home} />

      {/* Settings index and dynamic sections */}
      <Route exact path="/app/settings" component={Settings} />
      {/* Fallback inside tabs */}
      <Redirect exact from="/app" to="/app/home" />
    </IonRouterOutlet>

    <IonTabBar slot="bottom">
      <IonTabButton tab="left" href="/app/left">
        <IonIcon aria-hidden="true" icon={analyticsSharp} />
        <IonLabel>Analytics</IonLabel>
      </IonTabButton>

      <IonTabButton tab="home" href="/app/home">
        <IonIcon aria-hidden="true" icon={homeOutline} />
        <IonLabel>Home</IonLabel>
      </IonTabButton>

      <IonTabButton tab="settings" href="/app/settings">
        <IonIcon aria-hidden="true" icon={settingsOutline} />
        <IonLabel>Settings</IonLabel>
      </IonTabButton>
    </IonTabBar>
  </IonTabs>
);

const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
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
    </IonReactRouter>
  </IonApp>
);

export default App;
