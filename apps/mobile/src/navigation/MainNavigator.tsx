import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { colors, typography, spacing } from '../theme';

import { DashboardScreen }    from '../screens/Dashboard/DashboardScreen';
import { TruckListScreen }    from '../screens/Trucks/TruckListScreen';
import { TruckDetailScreen }  from '../screens/Trucks/TruckDetailScreen';
import { TruckCreateScreen }  from '../screens/Trucks/TruckCreateScreen';
import { KCListScreen }       from '../screens/KC/KCListScreen';
import { KCDetailScreen }     from '../screens/KC/KCDetailScreen';
import { KCCreateScreen }     from '../screens/KC/KCCreateScreen';
import { CustomerListScreen }  from '../screens/Customers/CustomerListScreen';
import { CustomerDetailScreen} from '../screens/Customers/CustomerDetailScreen';
import { CustomerCreateScreen} from '../screens/Customers/CustomerCreateScreen';
import { MoreMenuScreen }      from '../screens/Settings/MoreMenuScreen';
import { LedgerScreen }        from '../screens/Ledger/LedgerScreen';
import { ReportsScreen }       from '../screens/Reports/ReportsScreen';
import { SalaryScreen }        from '../screens/Salary/SalaryScreen';
import { UsersScreen }         from '../screens/Users/UsersScreen';
import { SettingsScreen }      from '../screens/SettingsConfig/SettingsScreen';
import { SummarySheetsScreen } from '../screens/SummarySheets/SummarySheetsScreen';
import { RolePermissionsScreen }from '../screens/Settings/RolePermissionsScreen';

import type {
  MainTabParamList, TruckStackParamList, KCStackParamList,
  CustomerStackParamList, MoreStackParamList,
} from '../types';

const Tab          = createBottomTabNavigator<MainTabParamList>();
const TruckStack   = createNativeStackNavigator<TruckStackParamList>();
const KCStack      = createNativeStackNavigator<KCStackParamList>();
const CustomerStack= createNativeStackNavigator<CustomerStackParamList>();
const MoreStack    = createNativeStackNavigator<MoreStackParamList>();

// ─── Shared premium header options for all stacks ────────────────────
const STACK_OPTS = {
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  } as any,
  headerTintColor: colors.primary,
  headerShadowVisible: false,
  headerBackTitle: '',
  contentStyle: { backgroundColor: colors.surface },
};

function TrucksNavigator() {
  return (
    <TruckStack.Navigator screenOptions={STACK_OPTS}>
      <TruckStack.Screen name="TruckList"   component={TruckListScreen}   options={{ title: 'Trucks' }} />
      <TruckStack.Screen name="TruckDetail" component={TruckDetailScreen} options={{ title: 'Truck Detail' }} />
      <TruckStack.Screen name="TruckCreate" component={TruckCreateScreen} options={{ title: 'New Truck' }} />
    </TruckStack.Navigator>
  );
}

function KCsNavigator() {
  return (
    <KCStack.Navigator screenOptions={STACK_OPTS}>
      <KCStack.Screen name="KCList"   component={KCListScreen}   options={{ title: 'Kaccha Chittha' }} />
      <KCStack.Screen name="KCDetail" component={KCDetailScreen} options={{ title: 'KC Detail' }} />
      <KCStack.Screen name="KCCreate" component={KCCreateScreen} options={{ title: 'New KC' }} />
    </KCStack.Navigator>
  );
}

function CustomersNavigator() {
  return (
    <CustomerStack.Navigator screenOptions={STACK_OPTS}>
      <CustomerStack.Screen name="CustomerList"   component={CustomerListScreen}   options={{ title: 'Customers' }} />
      <CustomerStack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Customer' }} />
      <CustomerStack.Screen name="CustomerCreate" component={CustomerCreateScreen} options={{ title: 'New Customer' }} />
      <CustomerStack.Screen name="CustomerEdit"   component={CustomerCreateScreen} options={{ title: 'Edit Customer' }} />
    </CustomerStack.Navigator>
  );
}

function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={STACK_OPTS}>
      <MoreStack.Screen name="MoreMenu"         component={MoreMenuScreen}         options={{ headerShown: false }} />
      <MoreStack.Screen name="Ledger"           component={LedgerScreen}           options={{ title: 'Ledger' }} />
      <MoreStack.Screen name="Reports"          component={ReportsScreen}          options={{ title: 'Reports & Exports' }} />
      <MoreStack.Screen name="SummarySheets"    component={SummarySheetsScreen}    options={{ title: 'Summary Sheets' }} />
      <MoreStack.Screen name="Salary"           component={SalaryScreen}           options={{ title: 'Salary' }} />
      <MoreStack.Screen name="Users"            component={UsersScreen}            options={{ title: 'Team Members' }} />
      <MoreStack.Screen name="Settings"         component={SettingsScreen}         options={{ title: 'Settings & Config' }} />
      <MoreStack.Screen name="RolePermissions"  component={RolePermissionsScreen}  options={{ title: 'Role Permissions' }} />
    </MoreStack.Navigator>
  );
}

// ─── Tab icon with active pill highlight ─────────────────────────────
const TAB_ICONS: Record<string, string> = {
  Home: '⊕', Trucks: '🚛', KC: '📋', Customers: '👨‍🌾', More: '⋯',
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={[styles.iconEmoji, { opacity: focused ? 1 : 0.38 }]}>
        {TAB_ICONS[label] ?? '•'}
      </Text>
    </View>
  );
}

// ─── Main tab navigator ───────────────────────────────────────────────
export function MainNavigator() {
  const accessibleModuleIds = useSelector((s: RootState) => s.auth.accessibleModuleIds);
  const insets = useSafeAreaInsets();
  const has = (id: string) => accessibleModuleIds.includes(id);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        // Map route name → display label for icon lookup
        const labelMap: Record<string, string> = { Dashboard: 'Home', Trucks: 'Trucks', KCs: 'KC', Customers: 'Customers', More: 'More' };
        const label = labelMap[route.name] ?? route.name;
        return {
          tabBarIcon: ({ focused }) => <TabIcon label={label} focused={focused} />,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            height: 58 + insets.bottom,
            paddingBottom: insets.bottom + 6,
            paddingTop: 8,
            backgroundColor: colors.surfaceRaised,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            elevation: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600' as any,
            letterSpacing: 0.2,
            marginTop: -2,
          },
          headerShown: false,
        };
      }}
    >
      {has('DASHBOARD') && <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Home' }} />}
      {has('TRUCKS')    && <Tab.Screen name="Trucks"    component={TrucksNavigator} />}
      {has('KC')        && <Tab.Screen name="KCs"       component={KCsNavigator}   options={{ title: 'KC' }} />}
      {has('CUSTOMERS') && <Tab.Screen name="Customers" component={CustomersNavigator} />}
      <Tab.Screen name="More" component={MoreNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.primaryLight,
  },
  iconEmoji: { fontSize: 18, lineHeight: 22 },
});