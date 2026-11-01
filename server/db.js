// =============================================================================
// KAVINIYA FINANCE — Database layer
// - All money values are stored as INTEGER whole rupees (no floating point).
// - All business dates use Indian Standard Time (IST, UTC+05:30).
// =============================================================================
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.TEST_DB_PATH || path.join(DATA_DIR, 'kaviniya_finance.db');
export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');

// -----------------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------------
export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// -----------------------------------------------------------------------------
// Password hashing (scrypt, random per-user salt)
// -----------------------------------------------------------------------------
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, key] = parts;
  const derived = crypto.scryptSync(String(password), salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  return keyBuf.length === derived.length && crypto.timingSafeEqual(keyBuf, derived);
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

// -----------------------------------------------------------------------------
// Date helpers — always IST
// -----------------------------------------------------------------------------
const IST_OFFSET_MS = 330 * 60 * 1000;

/** Business date (YYYY-MM-DD) in IST. */
export function todayISO(date = new Date()) {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Timestamp string in IST: "YYYY-MM-DD HH:MM:SS". */
export function nowIST(date = new Date()) {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ');
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function dayOfWeek(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0 = Sunday
}

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}

// -----------------------------------------------------------------------------
// Loan maths
// -----------------------------------------------------------------------------

/** Collection dates, optionally skipping Sundays. First installment is due on the start date. */
export function buildScheduleDates(startDate, count, skipSundays = false) {
  const dates = [];
  let d = startDate;
  while (dates.length < count) {
    if (!(skipSundays && dayOfWeek(d) === 0)) dates.push(d);
    d = addDays(d, 1);
  }
  return dates;
}

/**
 * Splits a whole-rupee total into `count` whole-rupee installments.
 * Equal installments; any remainder is added to the LAST installment so the
 * schedule always sums exactly to the contract amount.
 */
export function splitInstallments(total, count) {
  const base = Math.floor(total / count);
  const list = new Array(count).fill(base);
  list[count - 1] = total - base * (count - 1);
  return list;
}

/**
 * Annualised percentage rate (APR) using the internal rate of return of the
 * actual cash flows: customer receives `netCash` on start date and repays the
 * installments on their due dates. Returned as a percentage (nominal, daily IRR × 365).
 */
export function computeAPR(netCash, installments, dates, startDate) {
  const totalRepay = installments.reduce((a, b) => a + b, 0);
  if (netCash <= 0 || totalRepay <= netCash) return 0;
  const offsets = dates.map((d) => daysBetween(startDate, d));
  const npv = (r) => installments.reduce((s, amt, i) => s + amt / Math.pow(1 + r, offsets[i]), 0) - netCash;
  let lo = 0;
  let hi = 0.05; // 5% per day upper bound
  while (npv(hi) > 0 && hi < 10) hi *= 2;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 365 * 1000) / 10; // one decimal
}

/**
 * Full loan calculation used for preview, creation and renewal.
 * All inputs must already be validated whole-rupee integers.
 */
export function calculateLoanTerms({
  principal,
  upfrontCharge,
  addonInterest = 0,
  totalInstallments,
  startDate,
  skipSundays = false,
  settledPreviousBalance = 0,
}) {
  const totalContractual = principal + addonInterest;
  const totalCharges = upfrontCharge + addonInterest;
  const netDisbursed = principal - upfrontCharge;
  const actualCashPayout = principal - upfrontCharge - settledPreviousBalance;
  const installments = splitInstallments(totalContractual, totalInstallments);
  const dates = buildScheduleDates(startDate, totalInstallments, skipSundays);
  return {
    principalAmount: principal,
    upfrontChargeAmount: upfrontCharge,
    addonInterestAmount: addonInterest,
    totalDisclosedCharges: totalCharges,
    netDisbursedAmount: netDisbursed,
    settledPreviousLoanAmount: settledPreviousBalance,
    actualCashPayout,
    totalContractualAmount: totalContractual,
    dailyInstallment: installments[0],
    lastInstallment: installments[installments.length - 1],
    totalInstallments,
    installments,
    dates,
    startDate,
    maturityDate: dates[dates.length - 1],
    skipSundays,
    // APR is based on the cash the customer actually receives against this contract
    apr: computeAPR(netDisbursed, installments, dates, startDate),
  };
}

// -----------------------------------------------------------------------------
// Transactions & sequences
// -----------------------------------------------------------------------------
export function runInTransaction(fn) {
  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch (_) {}
    throw err;
  }
}

/** Gap-free, collision-free running numbers. Must be called inside a transaction. */
export function nextSeq(name, start = 1001) {
  db.prepare(
    'INSERT INTO sequences (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = value + 1'
  ).run(name, start);
  return db.prepare('SELECT value FROM sequences WHERE name = ?').get(name).value;
}

export function getSetting(key, fallback = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

// -----------------------------------------------------------------------------
// Schema
// -----------------------------------------------------------------------------
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      name_ta TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS roles (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      role_code TEXT NOT NULL REFERENCES roles(code),
      branch_id TEXT NOT NULL REFERENCES branches(id),
      staff_id TEXT,
      must_change_password INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      staff_code TEXT UNIQUE NOT NULL,
      user_id TEXT UNIQUE REFERENCES users(id),
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      branch_id TEXT NOT NULL REFERENCES branches(id),
      assigned_areas TEXT NOT NULL DEFAULT '',
      daily_target INTEGER NOT NULL DEFAULT 0,
      attendance_status TEXT NOT NULL DEFAULT 'PRESENT',
      joining_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      customer_code TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      business_name TEXT NOT NULL DEFAULT '',
      mobile TEXT NOT NULL,
      alt_mobile TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL,
      branch_id TEXT NOT NULL REFERENCES branches(id),
      assigned_staff_id TEXT REFERENCES staff(id),
      id_proof_type TEXT NOT NULL DEFAULT '',
      id_proof_number TEXT NOT NULL DEFAULT '',
      registration_date TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','WATCHLIST')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_customers_area ON customers(area);
    CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);
    CREATE INDEX IF NOT EXISTS idx_customers_staff ON customers(assigned_staff_id);

    CREATE TABLE IF NOT EXISTS loan_products (
      id TEXT PRIMARY KEY,
      product_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      name_ta TEXT NOT NULL,
      default_principal INTEGER NOT NULL,
      upfront_charge_percent REAL NOT NULL,
      addon_interest_percent REAL NOT NULL DEFAULT 0,
      tenure_days INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      loan_number TEXT UNIQUE NOT NULL,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      branch_id TEXT NOT NULL REFERENCES branches(id),
      product_id TEXT REFERENCES loan_products(id),
      assigned_staff_id TEXT REFERENCES staff(id),
      principal_amount INTEGER NOT NULL CHECK (principal_amount > 0),
      upfront_charge_amount INTEGER NOT NULL CHECK (upfront_charge_amount >= 0),
      addon_interest_amount INTEGER NOT NULL DEFAULT 0 CHECK (addon_interest_amount >= 0),
      disclosed_charge_amount INTEGER NOT NULL,
      net_disbursed_amount INTEGER NOT NULL,
      settled_previous_loan_amount INTEGER NOT NULL DEFAULT 0,
      actual_cash_payout INTEGER NOT NULL CHECK (actual_cash_payout >= 0),
      total_contractual_amount INTEGER NOT NULL,
      daily_installment INTEGER NOT NULL,
      total_installments INTEGER NOT NULL CHECK (total_installments > 0),
      paid_installments INTEGER NOT NULL DEFAULT 0,
      amount_collected INTEGER NOT NULL DEFAULT 0,
      outstanding_balance INTEGER NOT NULL,
      apr_percent REAL NOT NULL DEFAULT 0,
      skip_sundays INTEGER NOT NULL DEFAULT 0,
      start_date TEXT NOT NULL,
      maturity_date TEXT NOT NULL,
      disbursement_mode TEXT NOT NULL CHECK (disbursement_mode IN ('CASH','UPI','BANK_TRANSFER')),
      agreement_reference TEXT NOT NULL,
      parent_loan_id TEXT REFERENCES loans(id),
      renewed_to_loan_id TEXT REFERENCES loans(id),
      loan_type TEXT NOT NULL DEFAULT 'NEW' CHECK (loan_type IN ('NEW','RENEWAL')),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','OVERDUE','COMPLETED','RENEWED_CLOSED')),
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_loans_customer ON loans(customer_id);
    CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
    CREATE INDEX IF NOT EXISTS idx_loans_staff ON loans(assigned_staff_id);

    CREATE TABLE IF NOT EXISTS repayment_schedules (
      id TEXT PRIMARY KEY,
      loan_id TEXT NOT NULL REFERENCES loans(id),
      installment_no INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      scheduled_amount INTEGER NOT NULL,
      paid_amount INTEGER NOT NULL DEFAULT 0,
      balance_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      paid_at TEXT,
      UNIQUE (loan_id, installment_no)
    );
    CREATE INDEX IF NOT EXISTS idx_schedule_loan_due ON repayment_schedules(loan_id, due_date);

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      transaction_id TEXT UNIQUE NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL,
      receipt_number TEXT UNIQUE NOT NULL,
      loan_id TEXT NOT NULL REFERENCES loans(id),
      customer_id TEXT NOT NULL REFERENCES customers(id),
      branch_id TEXT NOT NULL REFERENCES branches(id),
      collected_by_staff_id TEXT REFERENCES staff(id),
      recorded_by_user_id TEXT NOT NULL REFERENCES users(id),
      payment_date TEXT NOT NULL,
      collected_at TEXT NOT NULL,
      amount_due_before INTEGER NOT NULL,
      amount_collected INTEGER NOT NULL CHECK (amount_collected > 0),
      payment_type TEXT NOT NULL,
      payment_mode TEXT NOT NULL CHECK (payment_mode IN ('CASH','UPI','BANK_TRANSFER')),
      balance_after_payment INTEGER NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED','REVERSED')),
      reversed_at TEXT,
      reversed_by TEXT REFERENCES users(id),
      reversal_reason TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_payments_loan ON payments(loan_id);
    CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

    CREATE TABLE IF NOT EXISTS missed_collections (
      id TEXT PRIMARY KEY,
      loan_id TEXT NOT NULL REFERENCES loans(id),
      customer_id TEXT NOT NULL REFERENCES customers(id),
      missed_date TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      recorded_by_user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      UNIQUE (loan_id, missed_date)
    );

    CREATE TABLE IF NOT EXISTS loan_settlements (
      id TEXT PRIMARY KEY,
      settlement_code TEXT UNIQUE NOT NULL,
      old_loan_id TEXT NOT NULL REFERENCES loans(id),
      new_loan_id TEXT REFERENCES loans(id),
      customer_id TEXT NOT NULL REFERENCES customers(id),
      settlement_type TEXT NOT NULL,
      unpaid_scheduled_balance INTEGER NOT NULL,
      settled_amount INTEGER NOT NULL,
      settled_date TEXT NOT NULL,
      approved_by TEXT REFERENCES users(id),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS renewals (
      id TEXT PRIMARY KEY,
      renewal_code TEXT UNIQUE NOT NULL,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      old_loan_id TEXT NOT NULL REFERENCES loans(id),
      new_loan_id TEXT NOT NULL REFERENCES loans(id),
      settlement_id TEXT NOT NULL REFERENCES loan_settlements(id),
      old_loan_principal INTEGER NOT NULL,
      old_loan_paid INTEGER NOT NULL,
      old_loan_settled_balance INTEGER NOT NULL,
      new_loan_principal INTEGER NOT NULL,
      new_disclosed_charges INTEGER NOT NULL,
      net_additional_disbursement INTEGER NOT NULL,
      consent_reference TEXT NOT NULL,
      renewal_date TEXT NOT NULL,
      approved_by_user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      voucher_number TEXT UNIQUE NOT NULL,
      branch_id TEXT NOT NULL REFERENCES branches(id),
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK (amount > 0),
      payment_mode TEXT NOT NULL,
      expense_date TEXT NOT NULL,
      recorded_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cash_transactions (
      id TEXT PRIMARY KEY,
      txn_code TEXT UNIQUE NOT NULL,
      branch_id TEXT NOT NULL REFERENCES branches(id),
      txn_date TEXT NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('INFLOW','OUTFLOW')),
      category TEXT NOT NULL,
      payment_mode TEXT NOT NULL CHECK (payment_mode IN ('CASH','UPI','BANK_TRANSFER')),
      amount INTEGER NOT NULL CHECK (amount >= 0),
      reference_id TEXT,
      description TEXT NOT NULL,
      recorded_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cash_date ON cash_transactions(txn_date);

    CREATE TABLE IF NOT EXISTS accounting_ledger (
      id TEXT PRIMARY KEY,
      entry_date TEXT NOT NULL,
      branch_id TEXT NOT NULL REFERENCES branches(id),
      account_head TEXT NOT NULL,
      account_type TEXT NOT NULL,
      debit INTEGER NOT NULL DEFAULT 0,
      credit INTEGER NOT NULL DEFAULT 0,
      reference_type TEXT NOT NULL,
      reference_code TEXT NOT NULL,
      narration TEXT NOT NULL,
      is_non_cash_settlement INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT NOT NULL,
      role_code TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sequences (
      name TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );
  `);

  const hasBranch = db.prepare('SELECT COUNT(*) AS c FROM branches').get().c;
  if (!hasBranch) seedSystemSetup();
}

/** Only essential configuration. No customers, loans or payments. */
function seedSystemSetup() {
  const now = nowIST();
  runInTransaction(() => {
    db.prepare(
      'INSERT INTO branches (id, code, name, name_ta, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run('BR-01', 'MAIN', 'Main Office', 'தலைமை அலுவலகம்', now);

    const insRole = db.prepare('INSERT INTO roles (code, name) VALUES (?, ?)');
    insRole.run('OWNER', 'Owner');
    insRole.run('ADMIN', 'Administrator');
    insRole.run('COLLECTION_STAFF', 'Collection Staff');

    // Initial owner account ready to use immediately
    db.prepare(
      `INSERT INTO users (id, username, full_name, phone, password_hash, role_code, branch_id, must_change_password, created_at)
       VALUES (?, 'owner', 'Owner', '', ?, 'OWNER', 'BR-01', 0, ?)`
    ).run(uid('USR'), hashPassword(process.env.INITIAL_OWNER_PASSWORD || 'Owner@123'), now);

    const insProduct = db.prepare(
      `INSERT INTO loan_products (id, product_code, name, name_ta, default_principal, upfront_charge_percent, addon_interest_percent, tenure_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insProduct.run('PRD-100D', 'DL-100', '100-Day Daily Loan', '100 நாள் தினசரி கடன்', 10000, 15, 0, 100);
    insProduct.run('PRD-60D', 'DL-60', '60-Day Daily Loan', '60 நாள் தினசரி கடன்', 10000, 10, 0, 60);

    const insSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insSetting.run('company_name', 'KAVINIYA FINANCE');
    insSetting.run('company_name_ta', 'கவினியா பைனான்ஸ்');
    insSetting.run('address', '');
    insSetting.run('phone', '');
    insSetting.run('registration_no', '');
    insSetting.run('skip_sundays', '0');
  });
}
