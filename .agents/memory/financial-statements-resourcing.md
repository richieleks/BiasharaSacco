---
name: Financial statements re-sourcing
description: Why the SACCO Trial Balance / Balance Sheet / Income Statement are derived from operational ledgers, not the journal layer.
---

# Financial statements are re-sourced from operational ledgers

The Trial Balance, Balance Sheet, and Income Statement endpoints derive their
figures directly from the live operational ledgers (`savings_accounts`, `loans`,
`members`, `transactions`) — NOT from the double-entry layer
(`sacco_journal_entries` / cached `sacco_accounts.balance`).

**Why:** The journal layer was seeded/imported inconsistently and drifted from
reality: bulk loan-repayment journal entries credited the *full* installment to
the Loan Portfolio asset with no principal/interest split, so the Balance Sheet
didn't balance, the Income Statement showed zero loan interest, and Retained
Surplus contradicted net income. The live operational ledgers are the source of
truth (what members see); the current real-time repayment posting code is
correct — only the historical seed was malformed.

**How to apply:**
- Loan interest income is read from `transactions.metadata` (text → `::jsonb`)
  on `transaction_type='loan_payment'`, key `interest` (sibling `principalRepyt`).
  Always guard the cast with `pg_input_is_valid(...)` (Postgres 16+) so one bad
  row can't 500 the whole report.
- The `transactions` table holds ONLY loan rows (loan_payment, loan_disbursement)
  with `status='completed'`. There are NO savings deposit/withdrawal transactions
  — savings balances were seeded directly into `savings_accounts.balance`.
  `savings_transactions` table exists but is empty.
- Balance Sheet balances *by construction*: Retained Surplus = cumulative net
  surplus (same source as the Income Statement), and Cash at Bank is the
  reconciling plug = (savings + shareCapital + retainedSurplus) − loans. The
  SACCO keeps no separate cash ledger, so cash is derived, not tracked.
- Balance Sheet / Trial Balance use a *current* snapshot for savings/loans/share
  capital; `asOfDate` only bounds the retained-surplus (interest) accumulation.
  They are not full historical as-of snapshots (no balance history exists).
- If you ever rebuild the double-entry books (the rejected "full rebuild"
  option), these endpoints can switch back to the journal layer — but only after
  the journal is reconciled to operations.
