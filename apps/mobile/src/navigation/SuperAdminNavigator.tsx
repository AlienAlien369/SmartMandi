import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SADashboardScreen } from '../screens/SuperAdmin/SADashboardScreen';
import type { SuperAdminStackParamList } from '../types';

const Stack = createNativeStackNavigator<SuperAdminStackParamList>();

export function SuperAdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SADashboard" component={SADashboardScreen} />
    </Stack.Navigator>
  );
}
