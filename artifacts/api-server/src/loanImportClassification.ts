export type LoanTransactionKind =
  | 'special_disbursement'
  | 'special_repayment'
  | 'ordinary_disbursement'
  | 'ordinary_repayment'
  | 'unknown';

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;

    for (let j = 1; j <= right.length; j++) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }

  return previous[right.length];
}

export function looksLikeInstallment(value: string): boolean {
  return value
    .toLowerCase()
    .match(/[a-z]+/g)
    ?.some(word => word.startsWith('inst') && editDistance(word, 'installment') <= 2) ?? false;
}

export function looksLikeSpecial(value: string): boolean {
  return value
    .toLowerCase()
    .match(/[a-z]+/g)
    ?.some(word => word.startsWith('s') && editDistance(word, 'special') <= 2) ?? false;
}

function hasRepaymentMarker(value: string): boolean {
  return looksLikeInstallment(value) ||
    /\brepay(?:ment|ments|t)?\b/i.test(value) ||
    /\b(?:loan\s+)?pay(?:ment|ments)?\b/i.test(value) ||
    /\bpaid\b/i.test(value);
}

function hasDisbursementMarker(value: string): boolean {
  return /\bdisburs/i.test(value) ||
    /\bloan\s+amount\b/i.test(value) ||
    /\btop[\s-]?up\b/i.test(value) ||
    /\badvance\b/i.test(value) ||
    /^\s*loan\s*$/i.test(value);
}

export function classifyLoanTransaction(details: string): LoanTransactionKind {
  const normalized = details.toLowerCase().trim();
  if (!normalized) return 'unknown';

  const isSpecial = looksLikeSpecial(normalized);
  const isRepayment = hasRepaymentMarker(normalized);

  // Repayment must win over disbursement. For example, "special loan
  // repayment" starts with "special loan" but is not a new loan.
  if (isSpecial && isRepayment) return 'special_repayment';

  if (isSpecial && (
    hasDisbursementMarker(normalized) ||
    /\b(?:special|speacial|specail|spcial)\s+loan\b/i.test(normalized)
  )) {
    return 'special_disbursement';
  }

  if (hasDisbursementMarker(normalized)) return 'ordinary_disbursement';
  if (isRepayment) return 'ordinary_repayment';
  return 'unknown';
}