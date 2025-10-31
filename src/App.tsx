import React from "react";
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
import { homeOutline, settingsOutline, appsOutline } from "ionicons/icons";

/* Standalone pages (non-tab) */
import Login from "./pages/authentication/Login";
import Register from "./pages/authentication/Register";
import AddFood from "./pages/AddFood";
import SetupProfile from "./pages/SetupProfile";
import CheckLogin from "./pages/CheckLogin";
import Start from "./pages/Start";
import ResetPassword from "./pages/ResetPassword";

/* Tab pages */
import Home from "./pages/home/Home";
import Left from "./pages/home/Left";
import Settings from "./pages/home/Settings"; // Settings index list
import SettingsSection from "./pages/home/settings/Section"; // Dynamic subpage: /app/settings/:section
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

/* Theme variables */
import "./theme/variables.css";

setupIonicReact();

/** Tabs are rendered ONLY when route starts with /app */
const TabsShell: React.FC = () => (
  <IonTabs>
    <IonRouterOutlet id="tabs">
      {/* Home & Left tabs */}
      <Route exact path="/app/left" component={Left} />
      <Route exact path="/app/home" component={Home} />

      {/* Settings index and dynamic sections */}
      <Route exact path="/app/settings" component={Settings} />
      <Route path="/app/settings/:section" component={SettingsSection} />

      {/* Fallback inside tabs */}
      <Redirect exact from="/app" to="/app/home" />
    </IonRouterOutlet>

    <IonTabBar slot="bottom">
      <IonTabButton tab="left" href="/app/left">
        <IonIcon aria-hidden="true" icon={appsOutline} />
        <IonLabel>Left</IonLabel>
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
      <IonRouterOutlet id="root">
        {/* ---- Non-tab routes (no bottom bar) ---- */}
        <Route exact path="/login" component={Login} />
        <Route exact path="/register" component={Register} />
        <Route exact path="/add-food" component={AddFood} />
        <Route exact path="/setup-profile" component={SetupProfile} />
        <Route exact path="/check-login" component={CheckLogin} />
        <Route exact path="/start" component={Start} />
        <Route exact path="/reset-password" component={ResetPassword} />
        <Route exact path="/scan-barcode" component={ScanBarcode} />

        {/* ---- Tabs (show bottom bar) ---- */}
        <Route path="/app" component={TabsShell} />

        {/* Initial redirect to your auth gate */}
        <Redirect exact from="/" to="/check-login" />
      </IonRouterOutlet>
    </IonReactRouter>
  </IonApp>
);

export default App;
