import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { OtpVerifyScreen } from '../screens/Auth/OtpVerifyScreen';
import { SuperAdminLoginScreen } from '../screens/Auth/SuperAdminLoginScreen';
import type { AuthStackParamList } from '../types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
      <Stack.Screen name="SuperAdminLogin" component={SuperAdminLoginScreen} />
    </Stack.Navigator>
  );
}
