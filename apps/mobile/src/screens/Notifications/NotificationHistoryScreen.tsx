import React from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { notificationApi } from '../../api/endpoints';
import { colors, typography, spacing, radius, shadow } from '../../theme';

interface NotificationRecord {
  id: string;
  title: string;
  body: string;
  type: string;
  ref_id: string | null;
  sent_to: number;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { emoji: string; color: string; bg: string }> = {
  KC_AUTHORIZED: { emoji: '✅', color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
  GENERAL:       { emoji: '🔔', color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function NotificationHistoryScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notification-history'],
    queryFn: () => notificationApi.getHistory({ limit: 100 }).then(r => r.data as NotificationRecord[]),
    staleTime: 30 * 1000,
  });

  const notifications = data ?? [];

  const renderItem = ({ item }: { item: NotificationRecord }) => {
    const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.GENERAL;
    return (
      <View style={[styles.card, { backgroundColor: cfg.bg }]}>
        <View style={styles.cardLeft}>
          <Text style={styles.emoji}>{cfg.emoji}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.title, { color: cfg.color }]} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.body} numberOfLines={3}>{item.body}</Text>
          <View style={styles.meta}>
            <Text style={styles.time}>{formatTime(item.created_at)}</Text>
            {item.sent_to > 0 && (
              <Text style={styles.sentTo}>📱 {item.sent_to} device{item.sent_to > 1 ? 's' : ''}</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={notifications}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      contentContainerStyle={[styles.list, notifications.length === 0 && styles.emptyContainer]}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔕</Text>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySub}>Authorized KCs and alerts will appear here</Text>
        </View>
      }
      ListHeaderComponent={
        notifications.length > 0 ? (
          <Text style={styles.header}>Last {notifications.length} notification{notifications.length !== 1 ? 's' : ''}</Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing[4], paddingBottom: spacing[10] },
  emptyContainer: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    ...typography.labelSm,
    color: colors.textMuted,
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    borderRadius: radius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 0.5,
    borderColor: colors.border,
    ...shadow.sm,
  },
  cardLeft: {
    marginRight: spacing[3],
    marginTop: 2,
  },
  emoji: { fontSize: 22 },
  cardBody: { flex: 1 },
  title: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold as any,
    marginBottom: spacing[1],
  },
  body: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing[2],
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  time: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    fontWeight: typography.weight.medium as any,
  },
  sentTo: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: spacing[4] },
  emptyTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold as any,
    color: colors.textPrimary,
    marginBottom: spacing[2],
  },
  emptySub: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing[8],
  },
});
