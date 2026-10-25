import React from 'react';

import {
  SvgAlertTriangle,
  SvgCalendar3,
  SvgCheckCircle1,
  SvgCheckCircleHollow,
  SvgEditSkull1,
  SvgFavoriteStar,
  SvgLockClosed,
  SvgValidationCheck,
} from '@actual-app/components/icons/v2';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { ScheduleStatusType } from '@actual-app/core/shared/schedules';
import { titleFirst } from '@actual-app/core/shared/util';

import { getStatusLabel } from '#util/schedule';

// Consists of Schedule Statuses + Transaction statuses
export type StatusTypes =
  | ScheduleStatusType
  | 'cleared'
  | 'pending'
  | 'reconciled';

export const defaultStatusProps = {
  color: theme.buttonNormalDisabledText,
  backgroundColor: theme.tableRowHeaderBackground,
  Icon: SvgCheckCircleHollow,
};

export function getStatusProps(status: StatusTypes | null | undefined) {
  switch (status) {
    case 'missed':
      return {
        color: theme.errorTextDarker,
        backgroundColor: theme.errorBackground,
        Icon: SvgEditSkull1,
      };
    case 'due':
      return {
        color: theme.warningTextDark,
        backgroundColor: theme.warningBackground,
        Icon: SvgAlertTriangle,
      };
    case 'upcoming':
      return {
        color: theme.upcomingText,
        backgroundColor: theme.upcomingBackground,
        Icon: SvgCalendar3,
      };
    case 'paid':
      return {
        color: theme.noticeText,
        backgroundColor: theme.noticeBackgroundLight,
        Icon: SvgValidationCheck,
      };
    case 'completed':
      return {
        color: theme.tableHeaderText,
        backgroundColor: theme.tableRowHeaderBackground,
        Icon: SvgFavoriteStar,
      };
    case 'pending':
      return {
        color: theme.noticeTextLight,
        backgroundColor: theme.noticeBackgroundLight,
        Icon: SvgCalendar3,
      };
    case 'scheduled':
      return {
        color: theme.tableRowHeaderText,
        backgroundColor: theme.tableRowHeaderBackground,
        Icon: SvgCalendar3,
      };
    case 'cleared':
      return {
        color: theme.noticeTextLight,
        backgroundColor: theme.tableRowHeaderBackground,
        Icon: SvgCheckCircle1,
      };
    case 'reconciled':
      return {
        color: theme.noticeTextLight,
        backgroundColor: theme.tableRowHeaderBackground,
        Icon: SvgLockClosed,
      };
    default:
      return defaultStatusProps;
  }
}

export function StatusBadge({
  status,
  dashboard = false,
}: {
  status: ScheduleStatusType;
  dashboard?: boolean;
}) {
  const statusProps = getStatusProps(status);
  const dashboardColor =
    status === 'due'
      ? { color: '#9a6700', backgroundColor: '#fff3c4' }
      : status === 'missed'
        ? { color: '#b42332', backgroundColor: '#ffebed' }
        : status === 'completed'
          ? { color: '#5f6f86', backgroundColor: '#edf1f7' }
          : status === 'paid'
            ? { color: '#177245', backgroundColor: '#e7f7ee' }
            : { color: '#1769e0', backgroundColor: '#e7f1ff' };
  const { color, backgroundColor, Icon } = dashboard
    ? { ...statusProps, ...dashboardColor }
    : statusProps;
  return (
    <View
      style={{
        color,
        backgroundColor,
        padding: dashboard ? '6px 8px' : '6px 8px',
        borderRadius: 4,
        fontSize: dashboard ? 11 : undefined,
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <Icon
        style={{
          width: 13,
          height: 13,
          marginRight: 7,
          color,
        }}
      />
      <Text style={{ lineHeight: '1em' }}>
        {titleFirst(getStatusLabel(status))}
      </Text>
    </View>
  );
}
