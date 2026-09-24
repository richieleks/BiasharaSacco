// Approval alone does not create a disbursed balance or an operational loan.
export function isOperationalLoan(status: string): boolean {
  return status === 'active' || status === 'disbursed';
}