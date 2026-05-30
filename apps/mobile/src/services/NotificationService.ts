/**
 * FCM + Notifee Notification Service for Smart Mandi
 *
 * Uses @react-native-firebase/messaging for token & FCM delivery,
 * and @notifee/react-native to display WhatsApp-style persistent
 * notifications in the Android notification tray.
 *
 * Channel: 'kc_updates' — HIGH importance (heads-up + stays in tray)
 */
import notifee, { AndroidImportance, AndroidVisibility, EventType } from '@notifee/react-native';
import { usersApi } from '../api/endpoints';

// ─── Channel IDs ─────────────────────────────────────────────────────────────
export const CHANNEL_KC   = 'kc_updates';
export const CHANNEL_GENERAL = 'general';

let messaging: any = null;
let _channelCreated = false;

async function getMessaging(): Promise<any> {
  if (messaging) return messaging;
  try {
    const firebaseMessaging = require('@react-native-firebase/messaging').default;
    messaging = firebaseMessaging();
    return messaging;
  } catch {
    return null;
  }
}

/**
 * Create Android notification channels. Call ONCE at app startup (App.tsx).
 * Channels are idempotent — safe to call on every launch.
 */
export async function createNotificationChannels(): Promise<void> {
  if (_channelCreated) return;
  try {
    // HIGH importance → heads-up popup + stays in notification tray (like WhatsApp)
    await notifee.createChannel({
      id: CHANNEL_KC,
      name: 'KC Updates',
      description: 'Kaccha Chittha authorization and status updates',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      vibration: true,
      sound: 'default',
    });
    await notifee.createChannel({
      id: CHANNEL_GENERAL,
      name: 'General',
      description: 'General Smart Mandi alerts',
      importance: AndroidImportance.DEFAULT,
      visibility: AndroidVisibility.PRIVATE,
      vibration: true,
      sound: 'default',
    });
    _channelCreated = true;
  } catch (err) {
    console.warn('notifee createChannel failed:', err);
  }
}

/**
 * Request POST_NOTIFICATIONS permission (Android 13+ / iOS).
 * Call after login, once per install.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus >= 1; // AUTHORIZED or PROVISIONAL
  } catch {
    return false;
  }
}

/**
 * Display a notification in the OS tray using notifee.
 * Works in foreground, background, and quit state.
 */
export async function displayNotification(opts: {
  id?: string;
  title: string;
  body: string;
  channelId?: string;
  data?: Record<string, string>;
}): Promise<void> {
  try {
    await notifee.displayNotification({
      id: opts.id,
      title: `<b>${opts.title}</b>`,
      body: opts.body,
      data: opts.data ?? {},
      android: {
        channelId: opts.channelId ?? CHANNEL_KC,
        smallIcon: 'ic_stat_notification', // must exist in drawable
        color: '#1A6B3C',
        pressAction: { id: 'default' },
        // autoCancel=false means it stays until user swipes it away
        autoCancel: false,
        ongoing: false,
        // Show full content even on lock screen
        visibility: AndroidVisibility.PUBLIC,
        // Heads-up notification (peeks over current screen like WhatsApp)
        importance: AndroidImportance.HIGH,
      },
      ios: {
        sound: 'default',
        badgeCount: 1,
        foregroundPresentationOptions: {
          alert: true,
          badge: true,
          sound: true,
          banner: true,
          list: true,
        },
      },
    });
  } catch (err) {
    console.warn('notifee displayNotification failed:', err);
  }
}

/**
 * Request permission and register FCM token with the backend.
 * Call after successful login.
 */
export async function registerFcmToken(): Promise<string | null> {
  try {
    // Request notification permission via notifee (handles Android 13+)
    await requestNotificationPermission();

    const m = await getMessaging();
    if (!m) return null;

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
 * Set up foreground handler — displays REAL OS notification via notifee
 * (stays in tray, not just a toast). Also shows toast for in-app feedback.
 * Returns unsubscribe function.
 */
export async function setupForegroundHandler(): Promise<() => void> {
  const m = await getMessaging();
  if (!m) return () => {};

  const unsubFCM = m.onMessage(async (remoteMessage: any) => {
    const title = remoteMessage.notification?.title ?? 'Smart Mandi';
    const body  = remoteMessage.notification?.body  ?? '';
    const data  = remoteMessage.data ?? {};
    const type  = data.type as string | undefined;

    // Display in notification tray (persists like WhatsApp)
    await displayNotification({
      id: data.kc_id ?? undefined,
      title,
      body,
      channelId: type === 'KC_AUTHORIZED' ? CHANNEL_KC : CHANNEL_GENERAL,
      data,
    });

    // Also show in-app toast for immediate feedback
    try {
      const Toast = require('react-native-toast-message').default;
      Toast.show({
        type: type === 'KC_AUTHORIZED' ? 'success' : 'info',
        text1: title,
        text2: body,
        position: 'top',
        visibilityTime: 4000,
        topOffset: 50,
      });
    } catch (_) {}
  });

  return unsubFCM;
}

/**
 * Handle taps on notifee notifications (foreground events).
 * Call once in App.tsx or RootNavigator.
 */
export function setupNotifeeEventHandler(
  onPress: (data: Record<string, string>) => void,
): () => void {
  return notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS && detail.notification?.data) {
      onPress(detail.notification.data as Record<string, string>);
    }
  });
}

/**
 * Get the notification that opened the app from killed state.
 * Returns data payload or null.
 */
export async function getInitialNotification(): Promise<Record<string, string> | null> {
  try {
    // Check notifee initial notification
    const notifeeInitial = await notifee.getInitialNotification();
    if (notifeeInitial?.notification?.data) {
      return notifeeInitial.notification.data as Record<string, string>;
    }
    // Fallback to FCM
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
 * When FCM delivers a message in background/quit, we display it via notifee
 * so it appears in the notification tray with HIGH importance.
 */
export function registerBackgroundMessageHandler(): void {
  try {
    const firebaseMessaging = require('@react-native-firebase/messaging').default;
    firebaseMessaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
      const title = remoteMessage.notification?.title ?? 'Smart Mandi';
      const body  = remoteMessage.notification?.body  ?? '';
      const data  = remoteMessage.data ?? {};
      const type  = data.type as string | undefined;

      await displayNotification({
        id: data.kc_id ?? undefined,
        title,
        body,
        channelId: type === 'KC_AUTHORIZED' ? CHANNEL_KC : CHANNEL_GENERAL,
        data,
      });
    });
  } catch (_) {}
}

// Register notifee background handler for taps on notifications
// when the app is fully closed
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) {
    // App will be launched — data available via getInitialNotification()
    console.log('Notifee background press:', detail.notification?.data);
  }
});
