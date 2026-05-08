import React, { useRef, useEffect } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { SuperAdminNavigator } from './SuperAdminNavigator';
import { SplashScreen } from '../screens/Auth/SplashScreen';
import type { RootStackParamList } from '../types';
import {
  registerFcmToken,
  onNotificationOpenedApp,
  getInitialNotification,
} from '../services/NotificationService';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated, isLoading, isSuperAdmin } = useSelector((s: RootState) => s.auth);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  // Register FCM token after successful login
  useEffect(() => {
    if (!isAuthenticated || isSuperAdmin) return;
    registerFcmToken().catch(() => {});
  }, [isAuthenticated, isSuperAdmin]);

  // Handle notification deep links
  useEffect(() => {
    if (!isAuthenticated || isSuperAdmin) return;

    let unsubscribe: (() => void) | undefined;

    const navigateToKC = (kcId: string) => {
      navigationRef.current?.navigate('Main', {
        screen: 'KCs',
        params: { screen: 'KCDetail', params: { kcId } },
      });
    };

    // Background → foreground tap
    onNotificationOpenedApp((data) => {
      if (data.type === 'KC_AUTHORIZED' && data.kc_id) {
        navigateToKC(data.kc_id);
      }
    }).then(fn => { unsubscribe = fn; });

    // Cold start — app opened from killed state via notification
    getInitialNotification().then(data => {
      if (data?.type === 'KC_AUTHORIZED' && data.kc_id) {
        navigateToKC(data.kc_id);
      }
    });

    return () => { unsubscribe?.(); };
  }, [isAuthenticated, isSuperAdmin]);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isLoading ? (
          <Stack.Screen name="Splash" component={SplashScreen} />
        ) : !isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : isSuperAdmin ? (
          <Stack.Screen name="SuperAdmin" component={SuperAdminNavigator} />
        ) : (
          <Stack.Screen name="Main" component={MainNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
