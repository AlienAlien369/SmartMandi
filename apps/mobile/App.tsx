import React, { useEffect } from 'react';
import { StatusBar, Platform } from 'react-native';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { store } from './src/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { syncEngine } from './src/offline/syncEngine';
import {
  registerBackgroundMessageHandler,
  setupForegroundHandler,
  createNotificationChannels,
  setupNotifeeEventHandler,
  requestNotificationPermission,
} from './src/services/NotificationService';

// MUST be called at module level — before any component mounts
registerBackgroundMessageHandler();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30 * 1000,       // 30s
      gcTime: 5 * 60 * 1000,      // 5min GC
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

export default function App() {
  useEffect(() => {
    syncEngine.start();

    // Step 1: Create notification channels FIRST (must exist before requesting permission)
    createNotificationChannels().then(() => {
      // Step 2: Ask for notification permission immediately on first launch.
      // Android shows the system dialog only once — subsequent calls are silent no-ops.
      // iOS also shows the native prompt on first call.
      requestNotificationPermission();
    });

    // Set up foreground handler — shows OS notification in tray + in-app toast
    let unsubscribeForeground: (() => void) | null = null;
    setupForegroundHandler().then(unsub => { unsubscribeForeground = unsub; });

    // Handle taps on notifications while app is open
    const unsubNotifee = setupNotifeeEventHandler((data) => {
      console.log('Notification tapped:', data);
    });

    return () => {
      syncEngine.stop();
      unsubscribeForeground?.();
      unsubNotifee();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <StatusBar
              barStyle="dark-content"
              backgroundColor="transparent"
              translucent={true}
            />
            <RootNavigator />
            <Toast />
          </QueryClientProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
