import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text } from 'react-native';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { colors } from '../theme';

// Screens — core tabs
import { DashboardScreen } from '../screens/Dashboard/DashboardScreen';
import { TruckListScreen } from '../screens/Trucks/TruckListScreen';
import { TruckDetailScreen } from '../screens/Trucks/TruckDetailScreen';
import { TruckCreateScreen } from '../screens/Trucks/TruckCreateScreen';
import { KCListScreen } from '../screens/KC/KCListScreen';
import { KCDetailScreen } from '../screens/KC/KCDetailScreen';
import { KCCreateScreen } from '../screens/KC/KCCreateScreen';
import { CustomerListScreen } from '../screens/Customers/CustomerListScreen';
import { CustomerDetailScreen } from '../screens/Customers/CustomerDetailScreen';
import { CustomerCreateScreen } from '../screens/Customers/CustomerCreateScreen';

// Screens — More stack
import { MoreMenuScreen } from '../screens/Settings/MoreMenuScreen';
import { LedgerScreen } from '../screens/Ledger/LedgerScreen';
import { ReportsScreen } from '../screens/Reports/ReportsScreen';
import { SalaryScreen } from '../screens/Salary/SalaryScreen';
import { UsersScreen } from '../screens/Users/UsersScreen';
import { SettingsScreen } from '../screens/SettingsConfig/SettingsScreen';
import { SummarySheetsScreen } from '../screens/SummarySheets/SummarySheetsScreen';
import { RolePermissionsScreen } from '../screens/Settings/RolePermissionsScreen';

import type {
  MainTabParamList, TruckStackParamList, KCStackParamList,
  CustomerStackParamList, MoreStackParamList,
} from '../types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const TruckStack = createNativeStackNavigator<TruckStackParamList>();
const KCStack = createNativeStackNavigator<KCStackParamList>();
const CustomerStack = createNativeStackNavigator<CustomerStackParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();

function TrucksNavigator() {
  return (
    <TruckStack.Navigator>
      <TruckStack.Screen name="TruckList" component={TruckListScreen} options={{ title: 'Trucks' }} />
      <TruckStack.Screen name="TruckDetail" component={TruckDetailScreen} options={{ title: 'Truck Detail' }} />
      <TruckStack.Screen name="TruckCreate" component={TruckCreateScreen} options={{ title: 'New Truck' }} />
    </TruckStack.Navigator>
  );
}

function KCsNavigator() {
  return (
    <KCStack.Navigator>
      <KCStack.Screen name="KCList" component={KCListScreen} options={{ title: 'Kaccha Chittha' }} />
      <KCStack.Screen name="KCDetail" component={KCDetailScreen} options={{ title: 'KC Detail' }} />
      <KCStack.Screen name="KCCreate" component={KCCreateScreen} options={{ title: 'New KC' }} />
    </KCStack.Navigator>
  );
}

function CustomersNavigator() {
  return (
    <CustomerStack.Navigator>
      <CustomerStack.Screen name="CustomerList" component={CustomerListScreen} options={{ title: 'Customers' }} />
      <CustomerStack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Customer' }} />
      <CustomerStack.Screen name="CustomerCreate" component={CustomerCreateScreen} options={{ title: 'New Customer' }} />
    </CustomerStack.Navigator>
  );
}

function MoreNavigator() {
  return (
    <MoreStack.Navigator>
      <MoreStack.Screen name="MoreMenu" component={MoreMenuScreen} options={{ title: 'More', headerShown: false }} />
      <MoreStack.Screen name="Ledger" component={LedgerScreen} options={{ title: 'Ledger' }} />
      <MoreStack.Screen name="Reports" component={ReportsScreen} options={{ title: 'Reports & Exports' }} />
      <MoreStack.Screen name="SummarySheets" component={SummarySheetsScreen} options={{ title: 'Summary Sheets' }} />
      <MoreStack.Screen name="Salary" component={SalaryScreen} options={{ title: 'Salary' }} />
      <MoreStack.Screen name="Users" component={UsersScreen} options={{ title: 'Team Members' }} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings & Config' }} />
      <MoreStack.Screen name="RolePermissions" component={RolePermissionsScreen} options={{ title: 'Role Permissions' }} />
    </MoreStack.Navigator>
  );
}

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '📊', Trucks: '🚛', KCs: '📋', Customers: '👨‍🌾', More: '⋯',
  };
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[name] ?? '•'}</Text>
    </View>
  );
}

export function MainNavigator() {
  const accessibleModuleIds = useSelector((s: RootState) => s.auth.accessibleModuleIds);
  const has = (id: string) => accessibleModuleIds.includes(id);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        headerShown: false,
      })}
    >
      {has('DASHBOARD') && <Tab.Screen name="Dashboard" component={DashboardScreen} />}
      {has('TRUCKS') && <Tab.Screen name="Trucks" component={TrucksNavigator} />}
      {has('KC') && <Tab.Screen name="KCs" component={KCsNavigator} options={{ title: 'KC' }} />}
      {has('CUSTOMERS') && <Tab.Screen name="Customers" component={CustomersNavigator} />}
      <Tab.Screen name="More" component={MoreNavigator} />
    </Tab.Navigator>
  );
}
