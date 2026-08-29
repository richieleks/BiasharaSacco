---
name: Bank import CSV parsing
description: CSV parsing behavior for bulk savings and loan repayment imports.
---

Bulk bank imports should reject malformed CSV syntax at the file level while allowing variable column counts through to the existing row-level failure reporting.

**Why:** Bank exports can contain quoted commas, escaped quotes, and empty fields; strict column-count parsing would turn otherwise detailed per-row import reports into a single parser failure.

**How to apply:** Keep the standards-compliant parser configured for quoted fields and relaxed column counts, and preserve the import routes’ existing row validation and structured failure result.