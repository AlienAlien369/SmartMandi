import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { store } from './src/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { syncEngine } from './src/offline/syncEngine';
import { registerBackgroundMessageHandler, setupForegroundHandler } from './src/services/NotificationService';
import { colors } from './src/theme';

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

    // Set up foreground notification handler (shows Toast banner)
    let unsubscribeForeground: (() => void) | null = null;
    setupForegroundHandler().then(unsub => { unsubscribeForeground = unsub; });

    return () => {
      syncEngine.stop();
      unsubscribeForeground?.();
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
