// Set isolated in-memory SQLite DB before dynamically importing server modules
process.env.NODE_ENV = 'test';
process.env.TEST_DB_PATH = ':memory:';

import test from 'node:test';
import assert from 'node:assert/strict';

const {
  db,
  initDatabase,
  calculateLoanTerms,
  splitInstallments,
  hashPassword,
  verifyPassword,
  todayISO,
  nowIST,
  nextSeq,
  uid,
} = await import('../server/db.js');

const { recomputeLoan } = await import('../server/index.js');

initDatabase();

test('1. System starts with zero dummy customers, loans, or payments', () => {
  const custCount = db.prepare('SELECT COUNT(*) AS cnt FROM customers').get().cnt;
  const loanCount = db.prepare('SELECT COUNT(*) AS cnt FROM loans').get().cnt;
  const payCount = db.prepare('SELECT COUNT(*) AS cnt FROM payments').get().cnt;

  assert.equal(custCount, 0, 'Should start with 0 customers');
  assert.equal(loanCount, 0, 'Should start with 0 loans');
  assert.equal(payCount, 0, 'Should start with 0 payments');
});

test('2. Demonstration Scenario: ₹10,000 Principal, ₹1,500 Upfront Charge, 100 Days', () => {
  const calc = calculateLoanTerms({
    principal: 10000,
    upfrontCharge: 1500,
    addonInterest: 0,
    totalInstallments: 100,
    startDate: '2026-04-01',
    skipSundays: false,
    settledPreviousBalance: 0,
  });

  assert.equal(calc.principalAmount, 10000);
  assert.equal(calc.upfrontChargeAmount, 1500);
  assert.equal(calc.netDisbursedAmount, 8500, 'Net disbursement for ₹10,000 less ₹1,500 upfront must be ₹8,500');
  assert.equal(calc.totalContractualAmount, 10000, 'Total contractual repayment must be ₹10,000');
  assert.equal(calc.dailyInstallment, 100, 'Daily installment must be ₹100');
  assert.equal(calc.lastInstallment, 100);
  assert.equal(calc.totalInstallments, 100);
  assert.equal(calc.actualCashPayout, 8500);
  assert.ok(calc.apr > 100, 'Effective APR should be calculated accurately');
});

test('3. Exact Last-Installment Rounding (No Lost Rupees on Non-Divisible Tenures)', () => {
  const installments = splitInstallments(10000, 30);
  assert.equal(installments[0], 333);
  assert.equal(installments[29], 343);
  const sum = installments.reduce((a, b) => a + b, 0);
  assert.equal(sum, 10000, 'Sum of all 30 installments must equal ₹10,000 exactly');
});

test('4. Renewal Engine Calculation: ₹10,000 New Loan - ₹5,000 Old Balance - ₹1,500 Charge = ₹3,500 Net Cash', () => {
  const renewalCalc = calculateLoanTerms({
    principal: 10000,
    upfrontCharge: 1500,
    addonInterest: 0,
    totalInstallments: 100,
    startDate: '2026-04-01',
    skipSundays: false,
    settledPreviousBalance: 5000,
  });

  assert.equal(renewalCalc.principalAmount, 10000);
  assert.equal(renewalCalc.upfrontChargeAmount, 1500);
  assert.equal(renewalCalc.settledPreviousLoanAmount, 5000, 'Old loan settlement must be ₹5,000');
  assert.equal(renewalCalc.actualCashPayout, 3500, 'Net additional cash payable to customer must be ₹3,500');
  assert.equal(renewalCalc.totalContractualAmount, 10000, 'New loan contractual repayment must be ₹10,000');
  assert.equal(renewalCalc.dailyInstallment, 100, 'New loan daily installment must be ₹100');
});

test('5. Per-User Salted Scrypt Password Hashing & Verification', () => {
  const hash1 = hashPassword('Owner@123');
  const hash2 = hashPassword('Owner@123');

  assert.notEqual(hash1, hash2, 'Two hashes of the same password must have unique random salts');
  assert.equal(verifyPassword('Owner@123', hash1), true);
  assert.equal(verifyPassword('WrongPass', hash1), false);
});

test('6. Payment & Reversal Recalculation (recomputeLoan)', () => {
  const today = todayISO();
  const now = nowIST();
  const ownerId = db.prepare("SELECT id FROM users WHERE username = 'owner'").get().id;
  const custId = uid('CST');
  const loanId = uid('LN');
  const payId = uid('PAY');

  db.prepare(`
    INSERT INTO customers (id, customer_code, full_name, mobile, area, branch_id, registration_date, status, created_at)
    VALUES (?, 'C1001', 'Test Customer', '9876543210', 'Test Area', 'BR-01', ?, 'ACTIVE', ?)
  `).run(custId, today, now);

  db.prepare(`
    INSERT INTO loans (
      id, loan_number, customer_id, branch_id, principal_amount, upfront_charge_amount,
      addon_interest_amount, disclosed_charge_amount, net_disbursed_amount,
      settled_previous_loan_amount, actual_cash_payout, total_contractual_amount,
      daily_installment, total_installments, amount_collected, outstanding_balance,
      paid_installments, apr_percent, skip_sundays, start_date, maturity_date,
      disbursement_mode, agreement_reference, loan_type, status, created_by, created_at
    ) VALUES (
      ?, 'L1001', ?, 'BR-01', 1000, 150, 0, 150, 850, 0, 850, 1000,
      100, 10, 0, 1000, 0, 120, 0, ?, ?, 'CASH', 'AGR-TEST', 'NEW', 'ACTIVE', ?, ?
    )
  `).run(loanId, custId, today, today, ownerId, now);

  for (let i = 1; i <= 10; i++) {
    db.prepare(`
      INSERT INTO repayment_schedules (id, loan_id, installment_no, due_date, scheduled_amount, paid_amount, balance_amount, status)
      VALUES (?, ?, ?, ?, 100, 0, 100, 'PENDING')
    `).run(uid('SCH'), loanId, i, today);
  }

  // Record a ₹250 payment
  db.prepare(`
    INSERT INTO payments (
      id, transaction_id, receipt_number, loan_id, customer_id, branch_id,
      payment_date, collected_at, amount_due_before, amount_collected, balance_after_payment,
      payment_type, payment_mode, recorded_by_user_id, idempotency_key, status
    ) VALUES (
      ?, 'TXN-TEST-1', 'R10001', ?, ?, 'BR-01', ?, ?, 100, 250, 750,
      'ADVANCE', 'CASH', ?, 'IDEM-1', 'POSTED'
    )
  `).run(payId, loanId, custId, today, now, ownerId);

  let updatedLoan = recomputeLoan(loanId);
  assert.equal(updatedLoan.amount_collected, 250);
  assert.equal(updatedLoan.outstanding_balance, 750);
  assert.equal(updatedLoan.paid_installments, 2);

  // Reverse the payment and verify balance returns to ₹1,000
  db.prepare(`UPDATE payments SET status = 'REVERSED' WHERE id = ?`).run(payId);
  updatedLoan = recomputeLoan(loanId);
  assert.equal(updatedLoan.amount_collected, 0);
  assert.equal(updatedLoan.outstanding_balance, 1000);
  assert.equal(updatedLoan.paid_installments, 0);
});

test('7. Gap-free Sequence Generator', () => {
  const c1 = nextSeq('test_seq', 1001);
  const c2 = nextSeq('test_seq', 1001);
  assert.equal(c1, 1001);
  assert.equal(c2, 1002);
});
