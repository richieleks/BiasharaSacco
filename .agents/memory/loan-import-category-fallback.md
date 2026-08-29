---
name: Loan import category fallback
description: Why semantic loan categories must survive when configurable loan products have not been seeded.
---

Recognized special-loan transactions must retain the stable `special_loan` category when no matching configurable loan product exists; never substitute the ordinary/default dropdown type.

**Why:** A schema-pushed development database can legitimately have an empty loan-product table. Transaction grouping may still be correct while persistence silently labels every imported special loan as normal.

**How to apply:** For import paths that infer a semantic category from source data, prefer a matching configured product when present, but otherwise use the stable category identifier rather than an unrelated user-selected or ordinary fallback.