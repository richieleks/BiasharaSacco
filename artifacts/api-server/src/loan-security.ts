import type { Request, RequestHandler } from "express";

interface LoanAccessStore {
  getUser(id: string): Promise<{ role: string | null } | undefined>;
  getMemberByUserId(id: string): Promise<{ id: number; role: string | null } | undefined>;
  getMemberRoles(id: number): Promise<string[]>;
  resolveMemberId(id: string): Promise<number>;
  resolveLoanId(id: string): Promise<number>;
  getLoan(id: number): Promise<{ memberId: number } | undefined>;
}

const loanStaffRoles = new Set(["admin", "manager", "committee", "treasurer"]);

export async function canAccessMemberLoans(store: LoanAccessStore, userId: string, memberId: number): Promise<boolean> {
  const user = await store.getUser(userId);
  if (!user) return false;
  const member = await store.getMemberByUserId(userId);
  const roles = member ? await store.getMemberRoles(member.id) : [];
  if (user.role === "admin" || (member
    ? (roles.length ? roles : [member.role || "member"]).some(role => loanStaffRoles.has(role))
    : loanStaffRoles.has(user.role || ""))) return true;
  return !!member && member.id === memberId;
}

/** Bind caller identity before business validation or resource reads/writes. */
export function loanOwnerGuard(
  store: LoanAccessStore,
  getUserId: (req: Request) => string | undefined,
  target: "member" | "loan",
  select: (req: Request) => unknown,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }
      const raw = select(req);
      if ((typeof raw !== "string" && typeof raw !== "number") || !String(raw).trim()) {
        res.status(400).json({ message: `Invalid ${target} ID` });
        return;
      }
      let memberId: number;
      if (target === "loan") {
        const loan = await store.getLoan(await store.resolveLoanId(String(raw)));
        if (!loan) {
          res.status(404).json({ message: "Loan not found" });
          return;
        }
        memberId = loan.memberId;
      } else {
        memberId = await store.resolveMemberId(String(raw));
      }
      if (!(await canAccessMemberLoans(store, userId, memberId))) {
        res.status(403).json({ message: "Access denied: loan belongs to another member or no linked member exists" });
        return;
      }
      next();
    } catch {
      res.status(403).json({ message: "Unable to authorize loan access" });
    }
  };
}

interface GuarantorProduct {
  requiresGuarantor: boolean | null;
  guarantorRatio: string | null;
}
interface Guarantee {
  guarantorMemberId: number;
  guaranteeAmount: string;
  status: string | null;
}

/** Applications are created pending, then guarantors are attached in a separate step.
 * Never let an incomplete application advance through any approval stage.
 */
export function validateLoanGuarantees(
  product: GuarantorProduct | undefined,
  principal: number,
  applicantId: number,
  guarantees: Guarantee[],
): string | undefined {
  if (!product) return "Loan product configuration not found";
  if (guarantees.some(g => g.status !== "approved")) return "All guarantors must approve before loan approval";
  if (product.requiresGuarantor === false) return undefined;
  const ratio = Number(product.guarantorRatio ?? "1.50");
  if (!Number.isFinite(principal) || principal <= 0 || !Number.isFinite(ratio) || ratio <= 0) {
    return "Invalid loan guarantee requirements";
  }
  const seen = new Set<number>();
  let coverage = 0;
  for (const guarantee of guarantees) {
    const amount = Number(guarantee.guaranteeAmount);
    if (guarantee.guarantorMemberId === applicantId || seen.has(guarantee.guarantorMemberId) ||
      !Number.isFinite(amount) || amount <= 0) return "Invalid or duplicate guarantor";
    seen.add(guarantee.guarantorMemberId);
    coverage += amount;
  }
  if (!guarantees.length || coverage < principal * ratio) {
    return `Required guarantors must approve coverage of at least ${principal * ratio}`;
  }
  return undefined;
}