// @ts-strict-ignore
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgDotsHorizontalTriple } from '@actual-app/components/icons/v1';
import { SvgCheck } from '@actual-app/components/icons/v2';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import {
  currentDay,
  differenceInCalendarDays,
  format as monthUtilFormat,
} from '@actual-app/core/shared/months';
import { getNormalisedString } from '@actual-app/core/shared/normalisation';
import { getScheduledAmount } from '@actual-app/core/shared/schedules';
import type { ScheduleStatuses } from '@actual-app/core/shared/schedules';
import type {
  AccountEntity,
  PayeeEntity,
  ScheduleEntity,
} from '@actual-app/core/types/models';

import { AccountLogo } from '#components/accounts/AccountLogo';
import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { Cell, Field, Row, Table, TableHeader } from '#components/table';
import { DisplayId } from '#components/util/DisplayId';
import { useAccounts } from '#hooks/useAccounts';
import { useContextMenu } from '#hooks/useContextMenu';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { usePayees } from '#hooks/usePayees';

import { StatusBadge } from './StatusBadge';
type SchedulesTableProps = {
  isLoading?: boolean;
  schedules: readonly ScheduleEntity[];
  statuses: ScheduleStatuses;
  filter: string;
  allowCompleted: boolean;
  onSelect: (id: ScheduleEntity['id']) => void;
  style: CSSProperties;
  tableStyle?: CSSProperties;
  dashboard?: boolean;
  showCompletedByDefault?: boolean;
} & (
  | {
      minimal: true;
      onAction?: never;
    }
  | {
      minimal?: false;
      onAction: (
        actionName: ScheduleItemAction,
        id: ScheduleEntity['id'],
      ) => void;
    }
);

type CompletedScheduleItem = { id: 'show-completed' };
type SchedulesTableItem = ScheduleEntity | CompletedScheduleItem;

export type ScheduleItemAction =
  | 'post-transaction'
  | 'post-transaction-today'
  | 'skip'
  | 'complete'
  | 'restart'
  | 'delete';

export const ROW_HEIGHT = 43;
const DASHBOARD_ROW_HEIGHT = 64;
const DASHBOARD_COLORS = {
  text: '#24324a',
  mutedText: '#65748b',
  border: '#e5ebf5',
  tableHeader: '#f1f4f9',
  rowHover: '#f7f9fd',
  upcomingBackground: '#edf5ff',
  upcomingBorder: '#d9e9ff',
};

export function ScheduleAmountCell({
  amount,
  op,
  name = 'amount',
  highlighted = false,
  dashboard = false,
}: {
  amount: ScheduleEntity['_amount'];
  op: ScheduleEntity['_amountOp'];
  name?: string;
  highlighted?: boolean;
  dashboard?: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormat();

  const num = getScheduledAmount(amount);
  const currencyAmount = format(Math.abs(num || 0), 'financial');
  const isApprox = op === 'isapprox';
  const isBetween = op === 'isbetween';
  let cellText = '';
  if (isApprox) {
    cellText = t('Approximately {{currencyAmount}}', {
      currencyAmount,
    });
  } else if (isBetween && typeof amount != 'number') {
    cellText = t('{{currency1}} to {{currency2}}', {
      currency1: format(Math.abs(amount.num1 || 0), 'financial'),
      currency2: format(Math.abs(amount.num2 || 0), 'financial'),
    });
  } else {
    cellText = currencyAmount;
  }
  return (
    <Cell
      width={dashboard ? (highlighted ? 140 : 135) : 100}
      plain
      style={{
        textAlign: 'right',
        flexDirection: 'row',
        alignItems: 'center',
        padding: '0 5px',
        ...(highlighted && {
          margin: '6px 0',
          borderRadius: 8,
          border: `1px solid ${DASHBOARD_COLORS.upcomingBorder}`,
          backgroundColor: DASHBOARD_COLORS.upcomingBackground,
        }),
      }}
      name={name}
    >
      {isApprox && (
        <View
          style={{
            textAlign: 'left',
            color: theme.pageTextSubdued,
            lineHeight: '1em',
            marginRight: 10,
          }}
          title={cellText}
        >
          ~
        </View>
      )}
      {isBetween && (
        <View
          style={{
            textAlign: 'left',
            color: theme.pageTextSubdued,
            lineHeight: '1em',
            marginRight: 10,
          }}
          title={cellText}
        >
          ±
        </View>
      )}
      <FinancialText
        style={{
          flex: 1,
          color:
            num > 0
              ? dashboard
                ? '#177245'
                : theme.noticeTextLight
              : dashboard
                ? DASHBOARD_COLORS.text
                : theme.tableText,
          fontWeight: dashboard ? 600 : undefined,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={cellText}
      >
        <PrivacyFilter>
          {num > 0 ? `+${currencyAmount}` : `${currencyAmount}`}
        </PrivacyFilter>
      </FinancialText>
    </Cell>
  );
}

function ScheduleRow({
  schedule,
  onAction,
  onSelect,
  minimal,
  statuses,
  dateFormat,
  dashboard,
  payeesById,
  accountsById,
}: {
  schedule: ScheduleEntity;
  dateFormat: string;
  dashboard?: boolean;
  payeesById: Map<PayeeEntity['id'], PayeeEntity>;
  accountsById: Map<AccountEntity['id'], AccountEntity>;
} & Pick<
  SchedulesTableProps,
  'onSelect' | 'onAction' | 'minimal' | 'statuses'
>) {
  const { t } = useTranslation();

  const rowRef = useRef(null);
  const buttonRef = useRef(null);

  const status = statuses.get(schedule.id);
  const payee = payeesById.get(schedule._payee);
  const account = accountsById.get(schedule._account);
  useContextMenu({
    triggerRef: rowRef,
    items: !minimal
      ? [
          {
            name: 'post-transaction',
            text: t('Post transaction'),
            onClick: () => onAction('post-transaction', schedule.id),
          },
          {
            name: 'post-transaction-today',
            text: t('Post transaction today'),
            onClick: () => onAction('post-transaction-today', schedule.id),
          },
          {
            name: 'restart',
            text: t('Restart'),
            onClick: () => onAction('restart', schedule.id),
            hidden: status !== 'completed',
          },
          {
            name: 'skip',
            text: t('Skip next scheduled date'),
            onClick: () => onAction('skip', schedule.id),
            hidden: status === 'completed',
          },
          {
            name: 'complete',
            text: t('Complete'),
            onClick: () => onAction('complete', schedule.id),
            hidden: status === 'completed',
          },
          {
            name: 'delete',
            text: t('Delete'),
            onClick: () => onAction('delete', schedule.id),
          },
        ]
      : [],
  });

  return (
    <Row
      ref={rowRef}
      height={dashboard ? DASHBOARD_ROW_HEIGHT : ROW_HEIGHT}
      inset={15}
      onClick={() => onSelect(schedule.id)}
      style={{
        cursor: 'pointer',
        backgroundColor: dashboard ? '#ffffff' : theme.tableBackground,
        color: dashboard ? DASHBOARD_COLORS.text : theme.tableText,
        borderBottom: dashboard
          ? `1px solid ${DASHBOARD_COLORS.border}`
          : undefined,
        ':hover': {
          backgroundColor: dashboard
            ? DASHBOARD_COLORS.rowHover
            : theme.tableRowBackgroundHover,
        },
      }}
    >
      <Field
        width="flex"
        name="name"
        style={dashboard ? { flex: 1.15 } : undefined}
      >
        <Text
          style={
            schedule.name == null
              ? { color: theme.buttonNormalDisabledText }
              : null
          }
          title={schedule.name ? schedule.name : ''}
        >
          {schedule.name ? schedule.name : t('None')}
        </Text>
      </Field>
      <Field
        width="flex"
        name="payee"
        style={dashboard ? { flex: 0.9 } : undefined}
      >
        {dashboard ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
            }}
          >
            {payee && (
              <AccountLogo
                logo={payee.logo}
                name={payee.name}
                size={28}
                initials={Array.from(payee.name.trim())[0] || '?'}
                fallbackBackgroundColor="#e7f1ff"
                fallbackColor="#1769e0"
              />
            )}
            <DisplayId type="payees" id={schedule._payee} />
          </View>
        ) : (
          <DisplayId type="payees" id={schedule._payee} />
        )}
      </Field>
      <Field
        width="flex"
        name="account"
        style={dashboard ? { flex: 1.05 } : undefined}
      >
        {dashboard ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
            }}
          >
            {account && (
              <AccountLogo logo={account.logo} name={account.name} size={28} />
            )}
            <DisplayId type="accounts" id={schedule._account} />
          </View>
        ) : (
          <DisplayId type="accounts" id={schedule._account} />
        )}
      </Field>
      <Field width={dashboard ? 112 : 110} name="date" truncate={!dashboard}>
        {dashboard ? (
          <View style={{ gap: 3 }}>
            <Text>
              {schedule.next_date
                ? monthUtilFormat(schedule.next_date, dateFormat)
                : null}
            </Text>
            {schedule.next_date && (
              <Text style={{ color: theme.pageTextLight, fontSize: 11 }}>
                {differenceInCalendarDays(schedule.next_date, currentDay()) < 0
                  ? t('{{count}} days ago', {
                      count: Math.abs(
                        differenceInCalendarDays(
                          schedule.next_date,
                          currentDay(),
                        ),
                      ),
                    })
                  : differenceInCalendarDays(
                        schedule.next_date,
                        currentDay(),
                      ) === 0
                    ? t('Today')
                    : t('in {{count}} days', {
                        count: differenceInCalendarDays(
                          schedule.next_date,
                          currentDay(),
                        ),
                      })}
              </Text>
            )}
          </View>
        ) : schedule.next_date ? (
          monthUtilFormat(schedule.next_date, dateFormat)
        ) : null}
      </Field>
      <Field
        width={dashboard ? 110 : 120}
        name="status"
        style={{ alignItems: 'flex-start' }}
      >
        <StatusBadge status={statuses.get(schedule.id)} dashboard={dashboard} />
      </Field>
      <ScheduleAmountCell
        amount={schedule._amount}
        op={schedule._amountOp}
        dashboard={dashboard}
      />
      {dashboard && (
        <ScheduleAmountCell
          amount={schedule._amount}
          op={schedule._amountOp}
          name="upcoming-amount"
          highlighted
          dashboard
        />
      )}
      {!minimal && (
        <Field
          width={dashboard ? 82 : 80}
          style={{
            textAlign: 'center',
            ...(dashboard && { color: '#177245' }),
          }}
        >
          {schedule._date &&
            typeof schedule._date === 'object' &&
            schedule._date.frequency && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <SvgCheck
                  style={{
                    width: 13,
                    height: 13,
                    color: dashboard ? theme.noticeText : undefined,
                  }}
                />
                {dashboard && <Trans>Yes</Trans>}
              </View>
            )}
        </Field>
      )}
      {!minimal && (
        <Field width={40} name="actions">
          <View>
            <Button
              ref={buttonRef}
              variant="bare"
              aria-label={t('Menu')}
              onPress={() => {
                if (rowRef.current) {
                  const rect = buttonRef.current?.getBoundingClientRect();
                  const clientX = rect ? rect.left : 0;
                  const clientY = rect ? rect.bottom : 0;
                  (rowRef.current as HTMLElement).dispatchEvent(
                    new MouseEvent('contextmenu', {
                      bubbles: true,
                      clientX,
                      clientY,
                    }),
                  );
                }
              }}
            >
              <SvgDotsHorizontalTriple
                width={15}
                height={15}
                style={{ transform: 'rotateZ(90deg)' }}
              />
            </Button>
          </View>
        </Field>
      )}
    </Row>
  );
}

export function SchedulesTable({
  isLoading,
  schedules,
  statuses,
  filter,
  minimal,
  allowCompleted,
  style,
  onSelect,
  onAction,
  tableStyle,
  dashboard,
  showCompletedByDefault,
}: SchedulesTableProps) {
  const { t } = useTranslation();
  const format = useFormat();

  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const [showCompleted, setShowCompleted] = useState(
    showCompletedByDefault ?? false,
  );

  useEffect(() => {
    setShowCompleted(showCompletedByDefault ?? false);
  }, [showCompletedByDefault]);

  const { data: payees = [] } = usePayees();
  const { data: accounts = [] } = useAccounts();
  const payeesById = useMemo(
    () => new Map(payees.map(payee => [payee.id, payee])),
    [payees],
  );
  const accountsById = useMemo(
    () => new Map(accounts.map(account => [account.id, account])),
    [accounts],
  );

  const filteredSchedules = useMemo(() => {
    if (!filter) {
      return schedules;
    }
    const filterIncludes = (str: string) =>
      str
        ? getNormalisedString(str).includes(getNormalisedString(filter)) ||
          getNormalisedString(filter).includes(getNormalisedString(str))
        : false;

    return schedules.filter(schedule => {
      const payee = payees.find(p => schedule._payee === p.id);
      const account = accounts.find(a => schedule._account === a.id);
      const amount = getScheduledAmount(schedule._amount);
      let amountStr = '';
      if (schedule._amountOp === 'isbetween') {
        amountStr = '±';
      } else if (schedule._amountOp === 'isapprox') {
        amountStr = '~';
      }
      amountStr +=
        (amount > 0 ? '+' : '') + format(Math.abs(amount || 0), 'financial');
      const dateStr = schedule.next_date
        ? monthUtilFormat(schedule.next_date, dateFormat)
        : null;

      return (
        filterIncludes(schedule.name) ||
        filterIncludes(payee && payee.name) ||
        filterIncludes(account && account.name) ||
        filterIncludes(amountStr) ||
        filterIncludes(statuses.get(schedule.id)) ||
        filterIncludes(dateStr)
      );
    });
  }, [payees, accounts, schedules, filter, statuses, format, dateFormat]);

  const items: readonly SchedulesTableItem[] = useMemo(() => {
    const unCompletedSchedules = filteredSchedules.filter(s => !s.completed);

    if (!allowCompleted) {
      return unCompletedSchedules;
    }
    if (showCompleted) {
      return filteredSchedules;
    }

    const hasCompletedSchedule = filteredSchedules.find(s => s.completed);

    if (!hasCompletedSchedule) return unCompletedSchedules;

    return [...unCompletedSchedules, { id: 'show-completed' }];
  }, [filteredSchedules, showCompleted, allowCompleted]);

  function renderItem({ item }: { item: SchedulesTableItem }) {
    if (item.id === 'show-completed') {
      return (
        <Row
          height={dashboard ? DASHBOARD_ROW_HEIGHT : ROW_HEIGHT}
          inset={15}
          style={{
            cursor: 'pointer',
            backgroundColor: 'transparent',
            ':hover': { backgroundColor: theme.tableRowBackgroundHover },
          }}
          onClick={() => setShowCompleted(true)}
        >
          <Field
            width="flex"
            style={{
              fontStyle: 'italic',
              textAlign: 'center',
              color: theme.tableText,
            }}
          >
            <Trans>Show completed schedules</Trans>
          </Field>
        </Row>
      );
    }
    return (
      <ScheduleRow
        schedule={item as ScheduleEntity}
        {...{
          statuses,
          dateFormat,
          onSelect,
          onAction,
          minimal,
          dashboard,
          payeesById,
          accountsById,
        }}
      />
    );
  }

  return (
    <View
      style={{
        ...styles.tableContainer,
        ...tableStyle,
        ...(dashboard && {
          '& [data-testid="row"] > div': {
            borderColor: DASHBOARD_COLORS.border,
          },
        }),
      }}
    >
      <TableHeader
        height={dashboard ? 40 : ROW_HEIGHT}
        inset={15}
        style={
          dashboard
            ? {
                textTransform: 'uppercase',
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 6,
                color: DASHBOARD_COLORS.mutedText,
                backgroundColor: DASHBOARD_COLORS.tableHeader,
              }
            : undefined
        }
      >
        <Field width="flex" style={dashboard ? { flex: 1.15 } : undefined}>
          <Trans>Name</Trans>
        </Field>
        <Field width="flex" style={dashboard ? { flex: 0.9 } : undefined}>
          <Trans>Payee</Trans>
        </Field>
        <Field width="flex" style={dashboard ? { flex: 1.05 } : undefined}>
          <Trans>Account</Trans>
        </Field>
        <Field width={dashboard ? 112 : 110}>
          <Trans>Next date</Trans>
        </Field>
        <Field width={dashboard ? 110 : 120}>
          <Trans>Status</Trans>
        </Field>
        <Field width={dashboard ? 135 : 100} style={{ textAlign: 'right' }}>
          <Trans>Amount</Trans>
        </Field>
        {dashboard && (
          <Field width={140} style={{ textAlign: 'center' }}>
            <Trans>Upcoming amount</Trans>
          </Field>
        )}
        {!minimal && (
          <Field width={dashboard ? 82 : 80} style={{ textAlign: 'center' }}>
            <Trans>Recurring</Trans>
          </Field>
        )}
        {!minimal && <Field width={40} />}
      </TableHeader>
      <Table
        loading={isLoading}
        backgroundColor="transparent"
        rowHeight={dashboard ? DASHBOARD_ROW_HEIGHT : ROW_HEIGHT}
        style={{
          flex: 1,
          backgroundColor: 'transparent',
          overflowX: dashboard ? 'auto' : undefined,
          ...style,
        }}
        items={items as ScheduleEntity[]}
        renderItem={renderItem}
        renderEmpty={filter ? t('No matching schedules') : t('No schedules')}
      />
    </View>
  );
}
