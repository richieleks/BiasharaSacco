import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { canAccessMemberLoans, loanOwnerGuard, validateLoanGuarantees } from "./loan-security";

function fixture(role = "member", linked = true, assignedRoles: string[] = []) {
  return {
    getUser: async () => ({ role }),
    getMemberByUserId: async () => linked ? { id: 10, role } : undefined,
    getMemberRoles: async () => assignedRoles,
    resolveMemberId: async (id: string) => id === "other-member-uuid" ? 20 : Number(id),
    resolveLoanId: async (id: string) => id === "other-loan-uuid" ? 200 : Number(id),
    getLoan: async (id: number) => id === 100 ? { memberId: 10 } : id === 200 ? { memberId: 20 } : undefined,
  };
}

async function invoke(
  store: ReturnType<typeof fixture>,
  target: "loan" | "member",
  value: unknown,
  userId: string | undefined = "user",
) {
  let status = 200;
  let passed = false;
  let body: unknown;
  const res = {
    status(code: number) { status = code; return this; },
    json(value: unknown) { body = value; return this; },
  } as Response;
  await loanOwnerGuard(store, () => userId, target, req => req.body.id)(
    { body: { id: value } } as Request,
    res,
    () => { passed = true; },
  );
  return { status, passed, body };
}

test("member-bound production middleware allows owner, rejects numeric/string/UUID other owner before handler", async () => {
  for (const target of ["member", "loan"] as const) {
    const ownId = target === "member" ? 10 : 100;
    assert.equal((await invoke(fixture(), target, ownId)).passed, true);
    const otherIds = target === "member" ? [20, "20", "other-member-uuid"] : [200, "200", "other-loan-uuid"];
    for (const id of otherIds) {
      const result = await invoke(fixture(), target, id);
      assert.equal(result.status, 403);
      assert.equal(result.passed, false, "business handler must not run for unauthorized target");
    }
  }
});

test("fail closed without a linked member, missing user, or failed role lookup", async () => {
  for (const target of ["member", "loan"] as const) {
    assert.equal((await invoke(fixture("member", false), target, target === "member" ? 10 : 100)).status, 403);
  }
  assert.equal(await canAccessMemberLoans({ ...fixture(), getUser: async () => undefined }, "missing", 10), false);
  assert.equal((await invoke({ ...fixture(), getMemberRoles: async () => { throw new Error("offline"); } }, "member", 10)).status, 403);
  assert.equal((await invoke(fixture(), "member", 10, "")).status, 401);
});

test("authorized staff roles keep cross-member access, including multi-role members and unlinked staff", async () => {
  for (const role of ["admin", "manager", "committee", "treasurer"]) {
    for (const store of [fixture(role), fixture(role, false), fixture("member", true, ["member", role])]) {
      assert.equal((await invoke(store, "member", 20)).passed, true);
      assert.equal((await invoke(store, "loan", 200)).passed, true);
    }
  }
  assert.equal((await invoke(fixture("auditor"), "member", 20)).status, 403);
});

test("malformed targets and nonexistent loans do not reach handlers", async () => {
  for (const value of [undefined, null, [], {}, ""]) {
    assert.equal((await invoke(fixture(), "member", value)).status, 400);
  }
  assert.equal((await invoke(fixture(), "loan", 999)).status, 404);
});

const required = { requiresGuarantor: true, guarantorRatio: "1.50" };
const approved = { guarantorMemberId: 20, guaranteeAmount: "1500", status: "approved" };

test("required product blocks zero guarantors (the empty-every approval bypass)", () => {
  assert.match(validateLoanGuarantees(required, 1000, 10, [])!, /Required guarantors/);
  assert.equal(validateLoanGuarantees({ ...required, requiresGuarantor: false }, 1000, 10, []), undefined);
  assert.match(validateLoanGuarantees({ ...required, requiresGuarantor: null }, 1000, 10, [])!, /Required guarantors/);
  assert.match(validateLoanGuarantees(undefined, 1000, 10, [])!, /configuration not found/);
});

test("required approval needs accepted, sufficient, distinct, non-self guarantees", () => {
  assert.equal(validateLoanGuarantees(required, 1000, 10, [approved]), undefined);
  assert.match(validateLoanGuarantees(required, 1000, 10, [{ ...approved, guaranteeAmount: "1499.99" }])!, /coverage/);
  for (const status of ["pending", "rejected", null]) {
    assert.match(validateLoanGuarantees(required, 1000, 10, [{ ...approved, status }])!, /must approve/);
  }
  for (const guarantees of [
    [approved, approved],
    [{ ...approved, guarantorMemberId: 10 }],
    [{ ...approved, guaranteeAmount: "-1500" }],
    [{ ...approved, guaranteeAmount: "NaN" }],
  ]) assert.match(validateLoanGuarantees(required, 1000, 10, guarantees)!, /Invalid or duplicate/);
  assert.equal(validateLoanGuarantees(required, 1000, 10, [
    { ...approved, guaranteeAmount: "700" },
    { ...approved, guarantorMemberId: 30, guaranteeAmount: "800" },
  ]), undefined);
});

test("bad product ratios fail closed without mutating any shared product", () => {
  for (const ratio of ["NaN", "0", "-1"]) {
    assert.match(validateLoanGuarantees({ ...required, guarantorRatio: ratio }, 1000, 10, [approved])!, /Invalid/);
  }
  assert.equal(validateLoanGuarantees(required, 1000, 10, [approved]), undefined);
});