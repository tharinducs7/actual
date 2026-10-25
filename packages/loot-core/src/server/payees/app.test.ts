import * as db from '#server/db';
import { loadMappings } from '#server/db/mappings';
import { app } from '#server/payees/app';
import { createSchedule, updateSchedule } from '#server/schedules/app';
import {
  insertRule,
  loadRules,
  resetState,
} from '#server/transactions/transaction-rules';

beforeEach(async () => {
  await global.emptyDatabase()();
  resetState();
  await loadMappings();
  await loadRules();
});

describe('payees app', () => {
  it('persists payee logos', async () => {
    const payeeId = await db.insertPayee({ name: 'Logo Payee' });
    const logo = 'data:image/webp;base64,logo';

    await app.handlers['payees-batch-change']({
      updated: [{ id: payeeId, logo }],
    });

    const payee = await db.getPayee(payeeId);
    expect(payee?.logo).toBe(logo);
  });

  describe('payees-get-rule-counts', () => {
    it('counts payee rules but excludes rules linked to completed schedules', async () => {
      const activePayeeId = await db.insertPayee({ name: 'Active Payee' });
      const completedPayeeId = await db.insertPayee({
        name: 'Completed Payee',
      });

      await insertRule({
        stage: 'pre',
        conditionsOp: 'and',
        conditions: [{ op: 'is', field: 'payee', value: activePayeeId }],
        actions: [{ op: 'set', field: 'category', value: null }],
      });

      const scheduleId = await createSchedule({
        conditions: [
          { op: 'is', field: 'payee', value: completedPayeeId },
          { op: 'is', field: 'date', value: '2020-12-20' },
        ],
      });
      await updateSchedule({
        schedule: { id: scheduleId, completed: true },
      });

      const counts = await app.handlers['payees-get-rule-counts']();

      expect(counts[activePayeeId]).toBe(1);
      expect(counts[completedPayeeId]).toBeUndefined();
    });
  });
});
