import React from 'react';
import { Badge } from './Badge';
import { colors } from '../../theme';
import { ViewStyle } from 'react-native';

const STATUS_MAP: Record<string, { color: string; bg: string }> = {
  SCHEDULED:    { color: colors.info,    bg: colors.infoBg },
  ARRIVED:      { color: colors.warning, bg: colors.warningBg },
  IN_PROGRESS:  { color: colors.primaryDark, bg: colors.primaryLight },
  CLOSED:       { color: colors.success, bg: colors.successBg },
  AUTHORIZED:   { color: colors.success, bg: colors.successBg },
  DRAFT:        { color: colors.textSecondary, bg: colors.surfaceMuted },
  CANCELLED:    { color: colors.danger,  bg: colors.dangerBg },
  PENDING:      { color: colors.textSecondary, bg: colors.surfaceMuted },
  PAID:         { color: colors.success, bg: colors.successBg },
};

interface StatusBadgeProps {
  status: string;
  style?: ViewStyle;
}

export const StatusBadge = React.memo(function StatusBadge({ status, style }: StatusBadgeProps) {
  const cfg = STATUS_MAP[status] ?? { color: colors.textSecondary, bg: colors.surfaceMuted };
  return <Badge label={status} color={cfg.color} bg={cfg.bg} style={style} />;
});
