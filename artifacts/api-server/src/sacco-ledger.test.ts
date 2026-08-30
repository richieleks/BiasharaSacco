import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calculateNormalBalance,
  calculateTrialBalanceSides,
  rebuildLedgerBalances,
  type LedgerAccount,
  type PostedLedgerEntry,
} from './sacco-ledger';

const accounts: LedgerAccount[] = [
  { id: 1, accountCode: '1001', accountName: 'Cash at Bank', accountType: 'asset' },
  { id: 2, accountCode: '1003', accountName: 'Loan Portfolio', accountType: 'asset' },
  { id: 3, accountCode: '2001', accountName: 'Member Savings', accountType: 'liability' },
  { id: 4, accountCode: '2002', accountName: 'Member Share Capital', accountType: 'liability' },
  { id: 5, accountCode: '4001', accountName: 'Interest on Loans', accountType: 'revenue' },
  { id: 6, accountCode: '4002', accountName: 'Loan Fees', accountType: 'revenue' },
  { id: 7, accountCode: '5001', accountName: 'Operating Expense', accountType: 'expense' },
];

function byCode(result: ReturnType<typeof rebuildLedgerBalances>, code: string) {
  return result.accounts.find((account) => account.accountCode === code)!;
}

test('uses debit-normal rules for assets and expenses and credit-normal rules for other accounts', () => {
  assert.equal(calculateNormalBalance('asset', 150, 40), 110);
  assert.equal(calculateNormalBalance('expense', 150, 40), 110);
  assert.equal(calculateNormalBalance('liability', 40, 150), 110);
  assert.equal(calculateNormalBalance('equity', 40, 150), 110);
  assert.equal(calculateNormalBalance('revenue', 40, 150), 110);
});

test('places positive and contra balances on the correct trial-balance side', () => {
  assert.deepEqual(calculateTrialBalanceSides('asset', 110), { debitBalance: 110, creditBalance: 0 });
  assert.deepEqual(calculateTrialBalanceSides('asset', -15), { debitBalance: 0, creditBalance: 15 });
  assert.deepEqual(calculateTrialBalanceSides('revenue', 110), { debitBalance: 0, creditBalance: 110 });
  assert.deepEqual(calculateTrialBalanceSides('revenue', -15), { debitBalance: 15, creditBalance: 0 });
});

test('rebuilds savings, shares, loans, fees, interest, expenses, and cash from posted entries', () => {
  const entries: PostedLedgerEntry[] = [
    { id: 1, debitAccountId: 1, creditAccountId: 3, amount: 1_000 }, // savings deposit
    { id: 2, debitAccountId: 1, creditAccountId: 4, amount: 200 }, // share capital
    { id: 3, debitAccountId: 2, creditAccountId: 1, amount: 600 }, // loan disbursement
    { id: 4, debitAccountId: 1, creditAccountId: 2, amount: 100 }, // principal repayment
    { id: 5, debitAccountId: 1, creditAccountId: 5, amount: 20 }, // interest received
    { id: 6, debitAccountId: 3, creditAccountId: 6, amount: 10 }, // fee from savings
    { id: 7, debitAccountId: 7, creditAccountId: 1, amount: 30 }, // cash expense
  ];

  const result = rebuildLedgerBalances(accounts, entries);

  assert.equal(byCode(result, '1001').balance, 690);
  assert.equal(byCode(result, '1003').balance, 500);
  assert.equal(byCode(result, '2001').balance, 990);
  assert.equal(byCode(result, '2002').balance, 200);
  assert.equal(byCode(result, '4001').balance, 20);
  assert.equal(byCode(result, '4002').balance, 10);
  assert.equal(byCode(result, '5001').balance, 30);
  assert.equal(result.totalDebits, 1_960);
  assert.equal(result.totalCredits, 1_960);
  assert.equal(result.difference, 0);
  assert.equal(result.isBalanced, true);
});

test('a posted opposite entry reverses the original balances without special cash logic', () => {
  const result = rebuildLedgerBalances(accounts, [
    { id: 1, debitAccountId: 1, creditAccountId: 3, amount: 250 },
    { id: 2, debitAccountId: 3, creditAccountId: 1, amount: 250 },
  ]);

  assert.equal(byCode(result, '1001').balance, 0);
  assert.equal(byCode(result, '2001').balance, 0);
  assert.equal(result.postedEntryCount, 2);
  assert.equal(result.totalDebits, 500);
  assert.equal(result.totalCredits, 500);
  assert.equal(result.isBalanced, true);
});

test('cash is based only on entries that touch the cash account', () => {
  const result = rebuildLedgerBalances(accounts, [
    { id: 1, debitAccountId: 2, creditAccountId: 3, amount: 400 },
  ]);

  assert.equal(byCode(result, '1001').balance, 0);
  assert.equal(byCode(result, '1003').balance, 400);
  assert.equal(byCode(result, '2001').balance, 400);
});

test('fails explicitly for malformed entries instead of returning a synthetic balance', () => {
  assert.throws(
    () => rebuildLedgerBalances(accounts, [
      { id: 99, debitAccountId: 1, creditAccountId: 999, amount: 10 },
    ]),
    /missing credit account 999/,
  );
});