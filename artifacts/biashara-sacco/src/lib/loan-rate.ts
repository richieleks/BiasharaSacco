type LoanRateValue = string | number | null | undefined;

export function normalizeLoanInterestRate(rate: LoanRateValue): number {
  const parsedRate = typeof rate === "number"
    ? rate
    : Number.parseFloat(rate ?? "0");

  if (!Number.isFinite(parsedRate)) return 0;
  return parsedRate > 0 && parsedRate <= 1 ? parsedRate * 100 : parsedRate;
}

export function formatLoanInterestRate(rate: LoanRateValue): string {
  return `${normalizeLoanInterestRate(rate).toFixed(1)}%`;
}