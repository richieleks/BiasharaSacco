import assert from 'node:assert/strict';
import { test } from 'node:test';
import { saccoAccounts, saccoJournalEntries, users } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { storage } from './storage';

class RollbackTestTransaction extends Error {}

test(
  'storage posting, recalculation, and reversal remain atomic and ledger-derived',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
    const userId = `ledger-test-${suffix}`;

    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: userId,
          username: `ledger-${suffix}`,
          role: 'admin',
          userType: 'system',
          authMethod: 'local',
        });

        const [cash, savings, revenue, expense] = await tx.insert(saccoAccounts).values([
          { accountCode: `T1${suffix}`, accountName: 'Test Cash', accountType: 'asset' },
          { accountCode: `T2${suffix}`, accountName: 'Test Savings', accountType: 'liability' },
          { accountCode: `T3${suffix}`, accountName: 'Test Revenue', accountType: 'revenue' },
          { accountCode: `T4${suffix}`, accountName: 'Test Expense', accountType: 'expense' },
        ]).returning();

        const deposit = await storage.createSaccoJournalEntryInTransaction(tx, {
          entryNumber: `TEST-DEP-${suffix}`,
          entryDate: '2026-08-30',
          description: 'Integration test deposit',
          debitAccountId: cash.id,
          creditAccountId: savings.id,
          amount: '500.00',
          createdBy: userId,
          status: 'posted',
        });

        await storage.createSaccoJournalEntryInTransaction(tx, {
          entryNumber: `TEST-REV-${suffix}`,
          entryDate: '2026-08-30',
          description: 'Integration test revenue',
          debitAccountId: cash.id,
          creditAccountId: revenue.id,
          amount: '25.00',
          createdBy: userId,
          status: 'posted',
        });

        await tx.insert(saccoJournalEntries).values({
          entryNumber: `TEST-DRAFT-${suffix}`,
          entryDate: '2026-08-30',
          description: 'Draft entry must not affect balances',
          debitAccountId: cash.id,
          creditAccountId: savings.id,
          amount: '999.00',
          createdBy: userId,
          status: 'draft',
        });

        await storage.createSaccoJournalEntryInTransaction(tx, {
          entryNumber: `TEST-EXP-${suffix}`,
          entryDate: '2026-08-30',
          description: 'Integration test expense',
          debitAccountId: expense.id,
          creditAccountId: cash.id,
          amount: '10.00',
          createdBy: userId,
          status: 'posted',
        });

        const postedAccounts = await tx.select().from(saccoAccounts)
          .where(eq(saccoAccounts.accountCode, `T1${suffix}`));
        assert.equal(postedAccounts[0].balance, '515.00');

        await tx.update(saccoAccounts).set({ balance: '999999.00' })
          .where(eq(saccoAccounts.id, cash.id));
        const rebuilt = await storage.recalculateSaccoAccountBalancesInTransaction(tx);
        const rebuiltCash = rebuilt.accounts.find((account) => account.id === cash.id);
        assert.equal(rebuiltCash?.balance, 515);
        assert.equal(rebuilt.isBalanced, true);
        assert.equal(rebuilt.difference, 0);

        const reversal = await storage.reverseSaccoJournalEntryInTransaction(tx, deposit.id, userId);
        assert.equal(reversal.debitAccountId, savings.id);
        assert.equal(reversal.creditAccountId, cash.id);
        assert.equal(reversal.reversedById, deposit.id);

        const [originalAfterReversal] = await tx.select().from(saccoJournalEntries)
          .where(eq(saccoJournalEntries.id, deposit.id));
        assert.equal(originalAfterReversal.status, 'reversed');

        const [cashAfterReversal] = await tx.select().from(saccoAccounts)
          .where(eq(saccoAccounts.id, cash.id));
        const [savingsAfterReversal] = await tx.select().from(saccoAccounts)
          .where(eq(saccoAccounts.id, savings.id));
        assert.equal(cashAfterReversal.balance, '15.00');
        assert.equal(savingsAfterReversal.balance, '0.00');

        throw new RollbackTestTransaction('rollback test fixtures');
      }),
      RollbackTestTransaction,
    );

    const [rolledBackUser, rolledBackAccounts, rolledBackEntries] = await Promise.all([
      db.select().from(users).where(eq(users.id, userId)),
      db.select().from(saccoAccounts).where(eq(saccoAccounts.accountCode, `T1${suffix}`)),
      db.select().from(saccoJournalEntries).where(eq(saccoJournalEntries.entryNumber, `TEST-DEP-${suffix}`)),
    ]);
    assert.equal(rolledBackUser.length, 0);
    assert.equal(rolledBackAccounts.length, 0);
    assert.equal(rolledBackEntries.length, 0);
  },
);

test(
  'missing mappings fail before a journal can be persisted',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const missingKey = `missing-${crypto.randomUUID()}`;
    await assert.rejects(
      storage.runSaccoLedgerTransaction(async (tx) => {
        await storage.createMappedSaccoJournalEntryInTransaction(tx, missingKey, {
          entryNumber: `TEST-MISSING-${crypto.randomUUID()}`,
          entryDate: '2026-08-30',
          description: 'Must not post',
          amount: '10.00',
          createdBy: 'missing-user',
          status: 'posted',
        });
      }),
      /No journal account mapping configured/,
    );
  },
);