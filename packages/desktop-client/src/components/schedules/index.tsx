import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgWallet } from '@actual-app/components/icons/v1';
import {
  SvgAlertTriangle,
  SvgCalendar3,
  SvgCheckCircle1,
  SvgValidationCheck,
} from '@actual-app/components/icons/v2';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { addDays, currentDay } from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { getScheduledAmount } from '@actual-app/core/shared/schedules';
import type { ScheduleStatusType } from '@actual-app/core/shared/schedules';
import { titleFirst } from '@actual-app/core/shared/util';
import type { ScheduleEntity } from '@actual-app/core/types/models';

import { Search } from '#components/common/Search';
import { FeatureErrorFallback } from '#components/FeatureErrorFallback';
import { useAccounts } from '#hooks/useAccounts';
import { useFormat } from '#hooks/useFormat';
import { usePayees } from '#hooks/usePayees';
import { useSchedules } from '#hooks/useSchedules';
import { pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';
import { getStatusLabel } from '#util/schedule';

import { SchedulesTable } from './SchedulesTable';
import type { ScheduleItemAction } from './SchedulesTable';

type ScheduleStatusFilter = 'all' | ScheduleStatusType;
type ScheduleDateFilter = 'any' | 'upcoming' | 'overdue';
type ScheduleSort = 'date' | 'name' | 'amount';

const dashboardColors = {
  pageBackground: '#f4f7fd',
  cardBackground: '#ffffff',
  border: '#e5ebf5',
  text: '#1d2939',
  mutedText: '#64748b',
  blue: '#1769e0',
  blueBackground: '#e7f1ff',
  blueBorder: '#cfe2ff',
  green: '#159447',
  greenBackground: '#e7f7ee',
  amber: '#a86b00',
  amberBackground: '#fff3c4',
  red: '#d92d3d',
  redBackground: '#ffebed',
};

const statusOptions: ScheduleStatusFilter[] = [
  'all',
  'scheduled',
  'upcoming',
  'due',
  'missed',
  'paid',
  'completed',
];

function SummaryCard({
  title,
  value,
  caption,
  Icon,
  iconColor,
  iconBackground,
  emphasized = false,
}: {
  title: string;
  value: ReactNode;
  caption?: string;
  Icon: typeof SvgCalendar3;
  iconColor: string;
  iconBackground: string;
  emphasized?: boolean;
}) {
  return (
    <View
      style={{
        minWidth: 0,
        minHeight: 82,
        padding: '14px 16px',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        border: `1px solid ${emphasized ? dashboardColors.blueBorder : dashboardColors.border}`,
        borderRadius: 10,
        backgroundColor: dashboardColors.cardBackground,
        boxShadow: emphasized
          ? `0 0 0 1px ${dashboardColors.blueBorder}`
          : undefined,
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          color: iconColor,
          backgroundColor: iconBackground,
        }}
      >
        <Icon style={{ width: 19, height: 19 }} />
      </View>
      <View style={{ minWidth: 0, gap: 3 }}>
        <Text style={{ color: dashboardColors.mutedText, fontSize: 12 }}>
          {title}
        </Text>
        <Text
          style={{
            fontSize: emphasized ? 18 : 22,
            fontWeight: 650,
            color: dashboardColors.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {value}
        </Text>
        {caption && (
          <Text style={{ color: dashboardColors.mutedText, fontSize: 11 }}>
            {caption}
          </Text>
        )}
      </View>
    </View>
  );
}

export function Schedules() {
  const { t } = useTranslation();

  const dispatch = useDispatch();
  const format = useFormat();
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ScheduleStatusFilter>('all');
  const [payeeFilter, setPayeeFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<ScheduleDateFilter>('any');
  const [sortBy, setSortBy] = useState<ScheduleSort>('date');

  const onEdit = useCallback(
    (id: ScheduleEntity['id']) => {
      dispatch(
        pushModal({ modal: { name: 'schedule-edit', options: { id } } }),
      );
    },
    [dispatch],
  );

  const onAdd = useCallback(() => {
    dispatch(pushModal({ modal: { name: 'schedule-edit', options: {} } }));
  }, [dispatch]);

  const onDiscover = useCallback(() => {
    dispatch(pushModal({ modal: { name: 'schedules-discover' } }));
  }, [dispatch]);

  const onChangeUpcomingLength = useCallback(() => {
    dispatch(pushModal({ modal: { name: 'schedules-upcoming-length' } }));
  }, [dispatch]);

  const onAction = useCallback(
    async (name: ScheduleItemAction, id: ScheduleEntity['id']) => {
      switch (name) {
        case 'post-transaction':
          await send('schedule/post-transaction', { id });
          break;
        case 'post-transaction-today':
          await send('schedule/post-transaction', { id, today: true });
          break;
        case 'skip':
          await send('schedule/skip-next-date', { id });
          break;
        case 'complete':
          await send('schedule/update', {
            schedule: { id, completed: true },
          });
          break;
        case 'restart':
          await send('schedule/update', {
            schedule: { id, completed: false },
            resetNextDate: true,
          });
          break;
        case 'delete':
          await send('schedule/delete', { id });
          break;
        default:
          throw new Error(`Unknown action: ${String(name)}`);
      }
    },
    [],
  );

  const schedulesQuery = useMemo(() => q('schedules').select('*'), []);
  const {
    isLoading: isSchedulesLoading,
    schedules,
    statuses,
  } = useSchedules({ query: schedulesQuery });
  const { data: payees = [] } = usePayees();
  const { data: accounts = [] } = useAccounts();

  const today = currentDay();
  const upcomingEndDate = addDays(today, 30);
  const activeSchedules = schedules.filter(schedule => !schedule.completed);
  const dueSchedules = activeSchedules.filter(schedule => {
    const status = statuses.get(schedule.id);
    return status === 'due' || status === 'missed';
  });
  const paidSchedules = schedules.filter(
    schedule => statuses.get(schedule.id) === 'paid',
  );
  const upcomingAmount = activeSchedules
    .filter(
      schedule =>
        schedule.next_date >= today && schedule.next_date <= upcomingEndDate,
    )
    .reduce(
      (total, schedule) =>
        total + Math.abs(getScheduledAmount(schedule._amount)),
      0,
    );
  const filteredSchedules = useMemo(() => {
    const filtered = schedules.filter(schedule => {
      const status = statuses.get(schedule.id);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const matchesPayee =
        payeeFilter === 'all' || schedule._payee === payeeFilter;
      const matchesAccount =
        accountFilter === 'all' || schedule._account === accountFilter;
      const matchesDate =
        dateFilter === 'any' ||
        (dateFilter === 'upcoming' &&
          schedule.next_date >= today &&
          schedule.next_date <= upcomingEndDate) ||
        (dateFilter === 'overdue' && schedule.next_date < today);

      return matchesStatus && matchesPayee && matchesAccount && matchesDate;
    });

    return filtered.sort((first, second) => {
      if (sortBy === 'name') {
        return (first.name ?? '').localeCompare(second.name ?? '');
      }
      if (sortBy === 'amount') {
        return (
          Math.abs(getScheduledAmount(second._amount)) -
          Math.abs(getScheduledAmount(first._amount))
        );
      }
      return first.next_date.localeCompare(second.next_date);
    });
  }, [
    accountFilter,
    dateFilter,
    payeeFilter,
    schedules,
    sortBy,
    statusFilter,
    statuses,
    today,
    upcomingEndDate,
  ]);

  return (
    <ErrorBoundary FallbackComponent={FeatureErrorFallback}>
      <View
        style={{
          flex: 1,
          minHeight: 0,
          gap: 14,
          padding: 14,
          paddingBottom: 12,
          backgroundColor: dashboardColors.pageBackground,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: '2px 0 0',
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              flexShrink: 0,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 11,
              color: dashboardColors.blue,
              backgroundColor: dashboardColors.blueBackground,
            }}
          >
            <SvgCalendar3 style={{ width: 21, height: 21 }} />
          </View>
          <View style={{ gap: 2 }}>
            <Text style={{ fontSize: 13, color: dashboardColors.mutedText }}>
              <Trans>
                View and manage your scheduled payments and recurring
                transactions.
              </Trans>
            </Text>
          </View>
        </View>

        <View
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 12,
            '@media (max-width: 1100px)': {
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            },
            '@media (max-width: 700px)': {
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            },
          }}
        >
          <SummaryCard
            title={t('Total schedules')}
            value={schedules.length}
            Icon={SvgCalendar3}
            iconColor={dashboardColors.blue}
            iconBackground={dashboardColors.blueBackground}
          />
          <SummaryCard
            title={t('Active schedules')}
            value={activeSchedules.length}
            Icon={SvgCheckCircle1}
            iconColor={dashboardColors.green}
            iconBackground={dashboardColors.greenBackground}
          />
          <SummaryCard
            title={t('Due or overdue')}
            value={dueSchedules.length}
            Icon={SvgAlertTriangle}
            iconColor={dashboardColors.amber}
            iconBackground={dashboardColors.amberBackground}
          />
          <SummaryCard
            title={t('Paid')}
            value={paidSchedules.length}
            Icon={SvgValidationCheck}
            iconColor={dashboardColors.green}
            iconBackground={dashboardColors.greenBackground}
          />
          <SummaryCard
            title={t('Upcoming amount')}
            value={format(upcomingAmount, 'financial')}
            caption={t('Next 30 days')}
            Icon={SvgWallet}
            iconColor={dashboardColors.blue}
            iconBackground={dashboardColors.blueBackground}
            emphasized
          />
        </View>

        <View
          style={{
            flex: 1,
            minHeight: 190,
            padding: 12,
            gap: 12,
            border: `1px solid ${dashboardColors.border}`,
            borderRadius: 10,
            backgroundColor: dashboardColors.cardBackground,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <Search
              placeholder={t('Search schedules…')}
              value={filter}
              onChange={setFilter}
              width={280}
              height={36}
              style={{
                flex: '1 1 220px',
                backgroundColor: dashboardColors.pageBackground,
                borderColor: dashboardColors.border,
              }}
            />
            <Select
              options={statusOptions.map(
                (value): [ScheduleStatusFilter, string] => [
                  value,
                  value === 'all'
                    ? t('All statuses')
                    : titleFirst(getStatusLabel(value)),
                ],
              )}
              value={statusFilter}
              onChange={setStatusFilter}
              style={{
                minWidth: 125,
                height: 36,
                backgroundColor: dashboardColors.cardBackground,
                borderColor: dashboardColors.border,
                color: dashboardColors.text,
              }}
            />
            <Select
              options={[
                ['all', t('All payees')],
                ...payees.map(payee => [payee.id, payee.name] as const),
              ]}
              value={payeeFilter}
              onChange={setPayeeFilter}
              style={{
                minWidth: 125,
                height: 36,
                backgroundColor: dashboardColors.cardBackground,
                borderColor: dashboardColors.border,
                color: dashboardColors.text,
              }}
            />
            <Select
              options={[
                ['all', t('All accounts')],
                ...accounts.map(account => [account.id, account.name] as const),
              ]}
              value={accountFilter}
              onChange={setAccountFilter}
              style={{
                minWidth: 135,
                height: 36,
                backgroundColor: dashboardColors.cardBackground,
                borderColor: dashboardColors.border,
                color: dashboardColors.text,
              }}
            />
            <Select
              options={
                [
                  ['any', t('Any date')],
                  ['upcoming', t('Next 30 days')],
                  ['overdue', t('Overdue')],
                ] as const
              }
              value={dateFilter}
              onChange={setDateFilter}
              style={{
                minWidth: 125,
                height: 36,
                backgroundColor: dashboardColors.cardBackground,
                borderColor: dashboardColors.border,
                color: dashboardColors.text,
              }}
            />
            <Select
              options={
                [
                  ['date', t('Sort by date')],
                  ['name', t('Sort by name')],
                  ['amount', t('Sort by amount')],
                ] as const
              }
              value={sortBy}
              onChange={setSortBy}
              style={{
                minWidth: 140,
                height: 36,
                backgroundColor: dashboardColors.cardBackground,
                borderColor: dashboardColors.border,
                color: dashboardColors.text,
              }}
            />
          </View>

          <SchedulesTable
            isLoading={isSchedulesLoading}
            schedules={filteredSchedules}
            filter={filter}
            statuses={statuses}
            allowCompleted
            dashboard
            showCompletedByDefault={statusFilter === 'completed'}
            onSelect={onEdit}
            onAction={onAction}
            style={{ backgroundColor: 'transparent' }}
            tableStyle={{
              flex: 1,
              minHeight: 0,
              border: 0,
              borderRadius: 0,
            }}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Button
              onPress={onDiscover}
              style={{
                borderColor: dashboardColors.blueBorder,
                color: dashboardColors.blue,
                backgroundColor: dashboardColors.cardBackground,
              }}
            >
              <Trans>Find schedules</Trans>
            </Button>
            <Button
              onPress={onChangeUpcomingLength}
              style={{
                borderColor: dashboardColors.blueBorder,
                color: dashboardColors.blue,
                backgroundColor: dashboardColors.cardBackground,
              }}
            >
              <Trans>Change upcoming length</Trans>
            </Button>
          </View>
          <Button
            variant="primary"
            onPress={onAdd}
            style={{
              borderColor: dashboardColors.blue,
              backgroundColor: dashboardColors.blue,
            }}
          >
            <Trans>Add new schedule</Trans>
          </Button>
        </View>
      </View>
    </ErrorBoundary>
  );
}
