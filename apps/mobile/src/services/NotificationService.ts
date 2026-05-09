/**
 * FCM Notification Service for Smart Mandi
 *
 * NATIVE SETUP REQUIRED (one-time, per platform):
 *
 * ANDROID:
 *   1. Download google-services.json from Firebase Console
 *      (Project Settings > Your apps > Add Android app > package: com.smartmandi)
 *   2. Place it at: apps/mobile/android/app/google-services.json
 *   3. In apps/mobile/android/build.gradle, add:
 *        classpath 'com.google.gms:google-services:4.4.0'
 *   4. In apps/mobile/android/app/build.gradle, add at bottom:
 *        apply plugin: 'com.google.gms.google-services'
 *
 * IOS:
 *   1. Download GoogleService-Info.plist from Firebase Console
 *   2. Place at: apps/mobile/ios/SmartMandi/GoogleService-Info.plist
 *   3. Open Xcode > drag GoogleService-Info.plist into the project
 *   4. In Xcode > Signing & Capabilities > add Push Notifications capability
 *   5. cd apps/mobile/ios && pod install
 */
import { usersApi } from '../api/endpoints';

let messaging: any = null;

async function getMessaging(): Promise<any> {
  if (messaging) return messaging;
  try {
    // Dynamic import to avoid crash if native module not linked yet
    const firebaseMessaging = require('@react-native-firebase/messaging').default;
    messaging = firebaseMessaging();
    return messaging;
  } catch {
    return null;
  }
}

/**
 * Request permission and get FCM token. Call after successful login.
 * Returns the token string, or null if unavailable.
 */
export async function registerFcmToken(): Promise<string | null> {
  try {
    const m = await getMessaging();
    if (!m) return null;

    // Request permission (iOS requires this, Android auto-grants on API 33+)
    const authStatus = await m.requestPermission();
    const enabled = authStatus === 1 || authStatus === 2; // AUTHORIZED or PROVISIONAL
    if (!enabled) return null;

    const token = await m.getToken();
    if (token) {
      await usersApi.updateFcmToken(token);
    }
    return token ?? null;
  } catch (err) {
    console.warn('FCM token registration failed:', err);
    return null;
  }
}

/**
 * Set up foreground notification handler. Call once in App.tsx.
 * Shows a Toast banner (like WhatsApp heads-up) when a notification arrives
 * while the app is in the foreground.
 * Returns an unsubscribe function.
 */
export async function setupForegroundHandler(): Promise<() => void> {
  const m = await getMessaging();
  if (!m) return () => {};
  return m.onMessage(async (remoteMessage: any) => {
    const title = remoteMessage.notification?.title ?? 'Smart Mandi';
    const body  = remoteMessage.notification?.body  ?? '';
    const type  = remoteMessage.data?.type;

    // Dynamic import to avoid circular dep
    const Toast = require('react-native-toast-message').default;
    Toast.show({
      type: type === 'KC_AUTHORIZED' ? 'success' : 'info',
      text1: title,
      text2: body,
      position: 'top',
      visibilityTime: 5000,
      topOffset: 50,
    });
  });
}

/**
 * Get the notification that opened the app from killed/background state.
 * Call in RootNavigator after navigation is ready.
 * Returns the data payload, or null.
 */
export async function getInitialNotification(): Promise<Record<string, string> | null> {
  try {
    const m = await getMessaging();
    if (!m) return null;
    const message = await m.getInitialNotification();
    return message?.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Subscribe to notification taps (background → foreground).
 * Call in RootNavigator. Returns unsubscribe function.
 */
export async function onNotificationOpenedApp(
  callback: (data: Record<string, string>) => void,
): Promise<() => void> {
  const m = await getMessaging();
  if (!m) return () => {};
  return m.onNotificationOpenedApp((remoteMessage: any) => {
    if (remoteMessage?.data) callback(remoteMessage.data);
  });
}

/**
 * Register background/quit-state handler.
 * MUST be called at module level (outside any component) in App.tsx.
 */
export function registerBackgroundMessageHandler(): void {
  try {
    const firebaseMessaging = require('@react-native-firebase/messaging').default;
    firebaseMessaging().setBackgroundMessageHandler(async (_remoteMessage: any) => {
      // FCM shows the OS notification automatically in background/quit state.
      // No action required here unless you need background data processing.
    });
  } catch (_) {}
}
