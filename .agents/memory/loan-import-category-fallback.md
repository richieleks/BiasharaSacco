---
name: Loan import product rules
description: Durable rules for category, rate, repayment, and schedule handling during historical loan imports.
---

Recognized special-loan transactions must retain the stable `special_loan` category when no matching configurable loan product exists; never substitute the ordinary/default dropdown type.

**Why:** A schema-pushed development database can legitimately have an empty loan-product table. Transaction grouping may still be correct while persistence silently labels every imported special loan as normal.

**How to apply:** For import paths that infer a semantic category from source data, prefer a matching configured product when present, but otherwise use the stable category identifier rather than an unrelated user-selected or ordinary fallback.

Workbook rates expressed as fractions (for example, 0.08) must be normalized to percentage points (8%), and configured loan-product rates and interest methods take precedence over generic recommended-rate fallbacks.

**Why:** Treating a fractional workbook rate as percentage points understates interest by 100×, while generic fallbacks can apply the wrong rate and calculation method to configured special loans.

**How to apply:** When a matching configured product exists, calculate repayment amounts from its terms even if the statement contains an observed installment; use the observed amount only without product configuration. Allocate rounding differences to the final installment.

Loan rates are stored as percentage points after import normalization, and repayment progress is actual repayment value divided by total repayable—not an inference from principal outstanding.

**Why:** Multiplying a stored rate of 8 by 100 displays 800%, while subtracting principal outstanding from principal-plus-interest incorrectly presents interest as already paid before the first repayment.

**How to apply:** Divide percentage-point rates by 100 only inside financial formulas; display them directly. Sum only repayment transactions for the paid amount and use the same total-repayable denominator shown beside the progress bar.

Operational loan and schedule outstanding balances represent total contractual cash still payable, including unpaid interest; principal outstanding is only an internal basis for allocating reducing-balance repayments.

**Why:** Principal-only balances made fixed-interest loans appear partly paid before any payment and caused a UGX 612,000 contract with UGX 408,000 paid to show UGX 192,000 instead of UGX 204,000 remaining.

**How to apply:** Initialize every loan balance from total scheduled payments, reduce it by cash actually paid, and complete only at zero. Keep principal and interest portions separate in transaction metadata and journals.