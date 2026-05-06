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
import { colors } from './src/theme';

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
    return () => syncEngine.stop();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <StatusBar
              barStyle="dark-content"
              backgroundColor={colors.background}
              translucent={Platform.OS === 'android'}
            />
            <RootNavigator />
            <Toast />
          </QueryClientProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
