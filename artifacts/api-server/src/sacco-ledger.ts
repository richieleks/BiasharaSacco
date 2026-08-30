export type SaccoAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface LedgerAccount {
  id: number;
  accountCode: string;
  accountName: string;
  accountType: SaccoAccountType;
}

export interface PostedLedgerEntry {
  id?: number;
  debitAccountId: number;
  creditAccountId: number;
  amount: string | number;
}

export interface LedgerBalanceRow extends LedgerAccount {
  totalDebits: number;
  totalCredits: number;
  balance: number;
}

export interface TrialBalanceSides {
  debitBalance: number;
  creditBalance: number;
}

export interface LedgerRebuildResult {
  accounts: LedgerBalanceRow[];
  postedEntryCount: number;
  totalDebits: number;
  totalCredits: number;
  difference: number;
  isBalanced: boolean;
}

const DEBIT_NORMAL_TYPES = new Set<SaccoAccountType>(['asset', 'expense']);

function asMoney(value: string | number, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  return parsed;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateNormalBalance(
  accountType: SaccoAccountType,
  totalDebits: number,
  totalCredits: number,
): number {
  return roundMoney(
    DEBIT_NORMAL_TYPES.has(accountType)
      ? totalDebits - totalCredits
      : totalCredits - totalDebits,
  );
}

export function calculateTrialBalanceSides(
  accountType: SaccoAccountType,
  normalBalance: number,
): TrialBalanceSides {
  const debitBalance = DEBIT_NORMAL_TYPES.has(accountType)
    ? normalBalance
    : -normalBalance;

  return debitBalance >= 0
    ? { debitBalance: roundMoney(debitBalance), creditBalance: 0 }
    : { debitBalance: 0, creditBalance: roundMoney(-debitBalance) };
}

export function rebuildLedgerBalances(
  accounts: LedgerAccount[],
  postedEntries: PostedLedgerEntry[],
): LedgerRebuildResult {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const totals = new Map<number, { debits: number; credits: number }>(
    accounts.map((account) => [account.id, { debits: 0, credits: 0 }]),
  );

  let totalDebits = 0;
  let totalCredits = 0;

  for (const entry of postedEntries) {
    const entryLabel = entry.id ? `Journal entry ${entry.id}` : 'Journal entry';
    if (entry.debitAccountId === entry.creditAccountId) {
      throw new Error(`${entryLabel} has the same debit and credit account`);
    }
    if (!accountById.has(entry.debitAccountId)) {
      throw new Error(`${entryLabel} references missing debit account ${entry.debitAccountId}`);
    }
    if (!accountById.has(entry.creditAccountId)) {
      throw new Error(`${entryLabel} references missing credit account ${entry.creditAccountId}`);
    }

    const amount = asMoney(entry.amount, `${entryLabel} amount`);
    totals.get(entry.debitAccountId)!.debits += amount;
    totals.get(entry.creditAccountId)!.credits += amount;
    totalDebits += amount;
    totalCredits += amount;
  }

  const roundedDebits = roundMoney(totalDebits);
  const roundedCredits = roundMoney(totalCredits);
  const difference = roundMoney(roundedDebits - roundedCredits);

  return {
    accounts: accounts.map((account) => {
      const accountTotals = totals.get(account.id)!;
      const debits = roundMoney(accountTotals.debits);
      const credits = roundMoney(accountTotals.credits);
      return {
        ...account,
        totalDebits: debits,
        totalCredits: credits,
        balance: calculateNormalBalance(account.accountType, debits, credits),
      };
    }),
    postedEntryCount: postedEntries.length,
    totalDebits: roundedDebits,
    totalCredits: roundedCredits,
    difference,
    isBalanced: Math.abs(difference) < 0.01,
  };
}