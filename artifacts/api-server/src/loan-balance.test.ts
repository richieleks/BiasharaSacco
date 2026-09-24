import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calculateContractualLoanAmounts,
  calculateRemainingContractualBalance,
  splitContractualRepayment,
} from './loan-balance';
import { InterestCalculator } from './interest-calculator';

test('simple-interest balance includes all unpaid contractual interest', () => {
  const terms = {
    principal: 600_000,
    annualRatePercentage: 8,
    termMonths: 3,
    interestMethod: 'simple' as const,
  };
  const amounts = calculateContractualLoanAmounts(terms);

  assert.deepEqual(amounts, {
    monthlyPayment: 204_000,
    totalInterest: 12_000,
    totalRepayable: 612_000,
  });
  assert.equal(calculateRemainingContractualBalance(amounts.totalRepayable, 408_000), 204_000);
});

test('fixed-interest repayment reduces total balance while preserving the accounting split', () => {
  const split = splitContractualRepayment({
    principal: 600_000,
    annualRatePercentage: 8,
    termMonths: 3,
    interestMethod: 'simple',
    monthlyPayment: 204_000,
  }, 204_000, 612_000);

  assert.deepEqual(split, {
    interestPortion: 4_000,
    principalPortion: 200_000,
    balanceReduction: 204_000,
  });
});

test('reducing-balance repayment reduces contractual balance by cash paid', () => {
  const terms = {
    principal: 1_200_000,
    annualRatePercentage: 12,
    termMonths: 12,
    interestMethod: 'reducing_balance' as const,
  };
  const amounts = calculateContractualLoanAmounts(terms);
  const split = splitContractualRepayment(terms, amounts.monthlyPayment, amounts.totalRepayable);

  assert.equal(split.interestPortion, 12_000);
  assert.equal(split.principalPortion, amounts.monthlyPayment - 12_000);
  assert.equal(split.balanceReduction, amounts.monthlyPayment);
});

test('legacy decimal rates and percentage-point rates calculate identically', () => {
  const base = { principal: 2_000_000, termMonths: 3, interestMethod: 'simple' as const };
  assert.deepEqual(
    calculateContractualLoanAmounts({ ...base, annualRatePercentage: 0.08 }),
    calculateContractualLoanAmounts({ ...base, annualRatePercentage: 8 }),
  );
});

test('final and excessive repayments are capped at the remaining balance', () => {
  const split = splitContractualRepayment({
    principal: 600_000,
    annualRatePercentage: 8,
    termMonths: 3,
    interestMethod: 'simple',
    monthlyPayment: 204_000,
  }, 500_000, 204_000);

  assert.equal(split.balanceReduction, 204_000);
  assert.equal(split.interestPortion + split.principalPortion, 204_000);
});

test('amortization schedule balance also includes unpaid interest', () => {
  const schedule = InterestCalculator.generateAmortizationSchedule(
    703,
    600_000,
    8,
    3,
    new Date('2026-05-22T00:00:00.000Z'),
    'monthly',
    'simple',
  );

  assert.deepEqual(schedule.map(row => ({
    payment: row.totalPayment,
    balance: row.outstandingBalance,
  })), [
    { payment: '204000.00', balance: '408000.00' },
    { payment: '204000.00', balance: '204000.00' },
    { payment: '204000.00', balance: '0.00' },
  ]);
});