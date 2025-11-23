import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export function setupPlatform() {
  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  SplashScreen.hide().catch(() => {});
}
