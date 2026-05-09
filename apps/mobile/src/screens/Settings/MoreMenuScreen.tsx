import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppDispatch, RootState } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { colors, typography, spacing, radius, shadow } from '../../theme';

const MODULE_MENU_ITEMS = [
  { moduleId: 'REPORTS',          icon: '📊', label: 'Reports',          screen: 'Reports' },
  { moduleId: 'LEDGER',           icon: '📒', label: 'Ledger',           screen: 'Ledger' },
  { moduleId: 'SUMMARY_SHEETS',   icon: '📄', label: 'Summary Sheets',   screen: 'SummarySheets' },
  { moduleId: 'SALARY',           icon: '🚛', label: 'Freight',         screen: 'Salary' },
  { moduleId: 'USERS',            icon: '👥', label: 'Users',            screen: 'Users' },
  { moduleId: 'SETTINGS',         icon: '⚙️', label: 'Config / Settings', screen: 'Settings' },
  { moduleId: 'ROLE_PERMISSIONS', icon: '🔐', label: 'Role Permissions', screen: 'RolePermissions', roleOnly: 'FIRM_HEAD' },
];

export function MoreMenuScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user);
  const accessibleModuleIds = useSelector((s: RootState) => s.auth.accessibleModuleIds);
  const insets = useSafeAreaInsets();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  const visibleItems = MODULE_MENU_ITEMS.filter(item => {
    if (item.roleOnly && user?.role !== item.roleOnly) return false;
    return accessibleModuleIds.includes(item.moduleId);
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[5] }]}
    >
      {/* Profile */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) ?? '?'}</Text>
        </View>
        <View style={styles.profileText}>
          <Text style={styles.userName} numberOfLines={1}>{user?.name}</Text>
          <Text style={styles.userFirmName} numberOfLines={1}>{user?.firm_name ?? ''}</Text>
          <Text style={styles.userRole}>{user?.role?.replace('_', ' ')}</Text>
          <Text style={styles.userPhone}>{user?.phone}</Text>
        </View>
      </View>

      {/* Menu */}
      <View style={styles.menuCard}>
        {visibleItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No modules enabled for your account.</Text>
            <Text style={styles.emptySubText}>Contact your firm administrator.</Text>
          </View>
        ) : (
          visibleItems.map((item, i) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate(item.screen)}>
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>
              {i < visibleItems.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 Logout</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Smart Mandi v2.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[10], gap: spacing[4] },
  profileCard: {
    backgroundColor: colors.primary, borderRadius: radius.xl,
    padding: spacing[5], flexDirection: 'row', alignItems: 'center', gap: spacing[4],
    shadowColor: '#1A1A18', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 8,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: colors.textInverse, fontSize: typography.size.xl, fontWeight: typography.weight.bold },
  profileText: { flex: 1, minWidth: 0 },
  userName: { color: colors.textInverse, fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  userFirmName: { color: 'rgba(255,255,255,0.9)', fontSize: typography.size.sm, fontWeight: typography.weight.semibold, marginTop: 1 },
  userRole: { color: 'rgba(255,255,255,0.7)', fontSize: typography.size.xs, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  userPhone: { color: 'rgba(255,255,255,0.7)', fontSize: typography.size.sm },
  menuCard: { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.border, ...shadow.sm },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: spacing[4], gap: spacing[3] },
  menuIcon: { fontSize: 20, width: 28 },
  menuLabel: { flex: 1, fontSize: typography.size.base, color: colors.textPrimary, fontWeight: typography.weight.medium },
  menuArrow: { fontSize: 20, color: colors.textMuted },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing[4] + 28 + spacing[3] },
  logoutBtn: {
    borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md,
    paddingVertical: spacing[4], alignItems: 'center',
  },
  logoutText: { color: colors.danger, fontSize: typography.size.base, fontWeight: typography.weight.semibold },
  version: { textAlign: 'center', color: colors.textMuted, fontSize: typography.size.xs },
  emptyState: { padding: spacing[6], alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: typography.size.base, textAlign: 'center' },
  emptySubText: { color: colors.textMuted, fontSize: typography.size.sm, marginTop: spacing[2], textAlign: 'center' },
});
