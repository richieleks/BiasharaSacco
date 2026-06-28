---
name: Savings statement transaction direction
description: How each transaction type maps to Money In / Money Out on the member savings statement/ledger
---

The savings account statement (`account-statement.tsx`) and the backend period totals
(`getTransactionsBySavingsAccountPaginated` in `storage.ts`) must classify ALL 8
`transactions.transactionType` enum values, or rows render blank and the running
Ledger Balance drifts.

Direction on a savings ledger:
- **Money In (credit):** deposit, interest_credit, share_capital, loan_disbursement
- **Money Out (debit):** withdrawal, fee_charge, loan_payment, membership_fee

**Why:** "Loan disbursed"/"Loan topup" are `loan_disbursement` paid INTO savings; loan
installments are `loan_payment` repaid FROM savings. The original code only handled
deposit/interest_credit/share_capital (in) and withdrawal/fee_charge (out), leaving
loan_payment, loan_disbursement, membership_fee blank.

**How to apply:** keep the frontend classifier and the backend totals SQL in lockstep —
if a new transactionType is added to the schema enum, add it to both directions or it
will silently show blank cells and skew totals. Note loan_payment/loan_disbursement
rows often have `savings_account_id` NULL and are pulled in via member-level match.
