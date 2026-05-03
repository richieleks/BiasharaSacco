# Refreshing the live numbers and screenshots

The Overview, Members, Savings, Dashboard, Loans and Reports slides display
real values pulled from the running Biashara SACCO tenant, plus screenshots
captured straight from the running web app.

When the underlying app or its data changes, refresh in two steps.

## 1. Update the headline numbers

The numbers below are hard-coded in the slide source so the deck always
renders, even with no API access. Re-fetch them and update by hand:

```bash
# Login (admin demo credentials)
curl -sS -c /tmp/sacco.cookie \
  -X POST http://localhost:80/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"NewBeginings@2026!"}'

# Dashboard metrics: totalMembers, totalSavings, activeLoans, repaymentRate
curl -sS -b /tmp/sacco.cookie http://localhost:80/api/dashboard/metrics

# Chart-of-accounts count
curl -sS -b /tmp/sacco.cookie http://localhost:80/api/sacco-accounts \
  | python3 -c "import sys,json; print(len(json.load(sys.stdin)))"
```

Then edit the numbers in:

- `src/pages/slides/OverviewSlide.tsx` — members, savings, COA count
- `src/pages/slides/MembersSlide.tsx` — active / pending counters
- `src/pages/slides/SavingsSlide.tsx` — total savings on book
- `src/pages/slides/LoansSlide.tsx` — active loans / repayment rate strip
- `src/pages/slides/ReportsSlide.tsx` — live-tenant strip

## 2. Recapture the UI screenshots

Screenshots live in `public/screens/` (`dashboard.png`, `loans.png`,
`reports.png`) and are embedded into the matching slides via
`import.meta.env.BASE_URL`.

Make sure the API and the SACCO web app are running, then run:

```bash
pnpm --filter @workspace/scripts run capture-sacco-screenshots
```

That script (`scripts/src/captureSaccoScreenshots.ts`) logs in as `admin`,
visits `/dashboard`, `/loans` and `/reports`, and overwrites the PNGs in
`artifacts/biashara-showcase/public/screens/`. Override `SACCO_BASE_URL`,
`SACCO_USERNAME`, `SACCO_PASSWORD` or `CHROMIUM_PATH` env vars if needed.

Reload the showcase preview and the new screenshots and numbers will appear
in the deck.
