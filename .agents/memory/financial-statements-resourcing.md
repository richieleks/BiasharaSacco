---
name: Journal-derived SACCO statements
description: Why SACCO financial statements and cached account balances use posted journal entries as their accounting source.
---

# Financial statements use the posted journal

The Trial Balance, Balance Sheet, Income Statement, and Cash at Bank use posted
double-entry journals and each account type's normal debit/credit rule. Cached
chart balances are rebuildable projections of that ledger.

**Why:** Operational-table formulas and a synthetic cash balancing plug can hide
missing postings, make receivables look like cash, and produce unauditable
statements. A balanced journal preserves the accounting trail and exposes drift.

**How to apply:** Commit each monetary business mutation and its required journal
entries in one locked database transaction. Post opening operational positions
through balanced opening journals. Rebuild every cached chart balance from the
posted rows, never from savings plus loans. Reconcile operational control totals
to the journal controls and report discrepancies explicitly rather than
silently substituting another source.
