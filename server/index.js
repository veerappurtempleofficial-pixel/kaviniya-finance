// =============================================================================
// KAVINIYA FINANCE — REST API
// =============================================================================
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  db,
  DATA_DIR,
  HttpError,
  initDatabase,
  hashPassword,
  verifyPassword,
  sha256,
  uid,
  todayISO,
  nowIST,
  isValidDate,
  calculateLoanTerms,
  runInTransaction,
  nextSeq,
  getSetting,
} from './db.js';

initDatabase();

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// Basic security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MODES = ['CASH', 'UPI', 'BANK_TRANSFER'];
const STAFF_ROLE = 'COLLECTION_STAFF';

// =============================================================================
// Helpers
// =============================================================================
function toInt(value) {
  if (value === '' || value === null || value === undefined) return NaN;
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

function requireInt(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = toInt(value);
  if (Number.isNaN(n) || n < min || n > max) {
    throw new HttpError(400, `${label} must be a whole number between ${min} and ${max}.`);
  }
  return n;
}

function requireText(value, label, { min = 1, max = 200 } = {}) {
  const s = String(value ?? '').trim();
  if (s.length < min || s.length > max) throw new HttpError(400, `${label} is required (max ${max} characters).`);
  return s;
}

function optText(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function validateMobile(value, label = 'Mobile number') {
  const s = String(value ?? '').replace(/\s+/g, '');
  if (!/^[6-9]\d{9}$/.test(s)) throw new HttpError(400, `${label} must be a valid 10-digit Indian mobile number.`);
  return s;
}

/** Never store a full Aadhaar number. Accepts 12 digits or last 4 digits; stores only the last 4. */
function normaliseIdProof(type, number) {
  const t = optText(type, 40);
  const n = optText(number, 40);
  if (!n) return { type: t, number: '' };
  if (t === 'Aadhaar') {
    const digits = n.replace(/\D/g, '');
    if (digits.length !== 12 && digits.length !== 4) {
      throw new HttpError(400, 'Aadhaar: enter the 12-digit number or only the last 4 digits. Only the last 4 digits are stored.');
    }
    return { type: t, number: `XXXX-XXXX-${digits.slice(-4)}` };
  }
  return { type: t, number: n.toUpperCase() };
}

function safeUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return { ...rest, must_change_password: !!u.must_change_password };
}

function logAudit(user, action, entityType, entityId, summary) {
  db.prepare(
    `INSERT INTO audit_logs (id, user_id, user_name, role_code, action, entity_type, entity_id, summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(uid('AUD'), user?.id || null, user?.full_name || 'System', user?.role_code || 'SYSTEM', action, entityType, String(entityId), summary, nowIST());
}

function insertCash({ branchId, date, direction, category, mode, amount, reference, description, userId }) {
  const code = `CB-${nextSeq('cash', 100001)}`;
  db.prepare(
    `INSERT INTO cash_transactions (id, txn_code, branch_id, txn_date, direction, category, payment_mode, amount, reference_id, description, recorded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(uid('CSH'), code, branchId, date, direction, category, mode, amount, reference, description, userId, nowIST());
}

function insertLedger(lines, { branchId, date, refType, refCode }) {
  const dr = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const cr = lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (dr !== cr) throw new Error(`Unbalanced journal for ${refCode}: debit ${dr} != credit ${cr}`);
  const ins = db.prepare(
    `INSERT INTO accounting_ledger (id, entry_date, branch_id, account_head, account_type, debit, credit, reference_type, reference_code, narration, is_non_cash_settlement, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const l of lines) {
    if (!l.debit && !l.credit) continue;
    ins.run(uid('GL'), date, branchId, l.head, l.type, l.debit || 0, l.credit || 0, refType, refCode, l.narration, l.nonCash ? 1 : 0, nowIST());
  }
}

const isStaff = (user) => user.role_code === STAFF_ROLE;

function assertLoanAccess(user, loan) {
  if (!loan) throw new HttpError(404, 'Loan not found.');
  if (isStaff(user) && loan.assigned_staff_id && loan.assigned_staff_id !== user.staff_id) {
    throw new HttpError(403, 'This loan is not assigned to you.');
  }
}

function assertCustomerAccess(user, customer) {
  if (!customer) throw new HttpError(404, 'Customer not found.');
  if (isStaff(user) && customer.assigned_staff_id && customer.assigned_staff_id !== user.staff_id) {
    throw new HttpError(403, 'This customer is not assigned to you.');
  }
}

function validStaffId(id) {
  if (!id) return null;
  const row = db.prepare('SELECT id FROM staff WHERE id = ? AND is_active = 1').get(id);
  if (!row) throw new HttpError(400, 'Selected staff member does not exist or is inactive.');
  return row.id;
}

// =============================================================================
// Loan state engine — single source of truth for balances and statuses
// =============================================================================

/**
 * Recalculates a loan entirely from its POSTED payments:
 * allocates paid money to installments oldest-first, then derives
 * amount collected, outstanding, paid installments and status.
 */
export function recomputeLoan(loanId, asOf = todayISO()) {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
  if (!loan || loan.status === 'RENEWED_CLOSED') return loan;

  const totalPaid = db
    .prepare("SELECT COALESCE(SUM(amount_collected), 0) AS t FROM payments WHERE loan_id = ? AND status = 'POSTED'")
    .get(loanId).t;

  const schedules = db.prepare('SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_no').all(loanId);
  const upd = db.prepare('UPDATE repayment_schedules SET paid_amount = ?, balance_amount = ?, status = ?, paid_at = ? WHERE id = ?');
  let remaining = totalPaid;
  let paidCount = 0;
  let overdue = false;
  const now = nowIST();
  for (const s of schedules) {
    const paid = Math.min(remaining, s.scheduled_amount);
    remaining -= paid;
    const balance = s.scheduled_amount - paid;
    let status;
    if (balance === 0) {
      status = 'PAID';
      paidCount++;
    } else if (s.due_date < asOf) {
      status = 'OVERDUE';
      overdue = true;
    } else {
      status = paid > 0 ? 'PARTIAL' : 'PENDING';
    }
    upd.run(paid, balance, status, balance === 0 ? s.paid_at || now : null, s.id);
  }

  const outstanding = loan.total_contractual_amount - totalPaid;
  const status = outstanding <= 0 ? 'COMPLETED' : overdue ? 'OVERDUE' : 'ACTIVE';
  db.prepare('UPDATE loans SET amount_collected = ?, outstanding_balance = ?, paid_installments = ?, status = ? WHERE id = ?').run(
    totalPaid,
    outstanding,
    paidCount,
    status,
    loanId
  );
  return db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
}

/** Marks missed installments as overdue. Cheap; called before dashboard/collection reads. */
export function refreshOverdue(asOf = todayISO()) {
  db.prepare(
    `UPDATE repayment_schedules SET status = 'OVERDUE'
     WHERE balance_amount > 0 AND due_date < ? AND status IN ('PENDING','PARTIAL')
       AND loan_id IN (SELECT id FROM loans WHERE status IN ('ACTIVE','OVERDUE'))`
  ).run(asOf);
  db.prepare(
    `UPDATE loans SET status = 'OVERDUE'
     WHERE status = 'ACTIVE' AND EXISTS (
       SELECT 1 FROM repayment_schedules rs WHERE rs.loan_id = loans.id AND rs.balance_amount > 0 AND rs.due_date < ?)`
  ).run(asOf);
}

/** Amount the customer should have paid up to and including `asOf`, minus what was paid. */
function dueNow(loan, asOf = todayISO()) {
  const scheduledToDate = db
    .prepare('SELECT COALESCE(SUM(scheduled_amount), 0) AS t FROM repayment_schedules WHERE loan_id = ? AND due_date <= ?')
    .get(loan.id, asOf).t;
  return Math.max(0, Math.min(loan.outstanding_balance, scheduledToDate - loan.amount_collected));
}

function insertSchedule(loanId, calc) {
  const ins = db.prepare(
    `INSERT INTO repayment_schedules (id, loan_id, installment_no, due_date, scheduled_amount, paid_amount, balance_amount, status)
     VALUES (?, ?, ?, ?, ?, 0, ?, 'PENDING')`
  );
  calc.installments.forEach((amt, i) => ins.run(uid('SCH'), loanId, i + 1, calc.dates[i], amt, amt));
}

function parseLoanInputs(body) {
  const principal = requireInt(body.principal_amount, 'Loan amount', { min: 500, max: 10000000 });
  const upfront = requireInt(body.upfront_charge_amount ?? 0, 'Upfront deduction', { min: 0, max: principal - 1 });
  const addon = requireInt(body.addon_interest_amount ?? 0, 'Add-on interest', { min: 0, max: 10000000 });
  const days = requireInt(body.total_installments, 'Number of installments', { min: 1, max: 365 });
  const startDate = body.start_date ? String(body.start_date) : todayISO();
  if (!isValidDate(startDate)) throw new HttpError(400, 'Start date is invalid.');
  return { principal, upfront, addon, days, startDate };
}

// =============================================================================
// Authentication
// =============================================================================
const loginAttempts = new Map(); // key -> { count, lockedUntil }

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
    sha256(token),
    userId,
    Date.now() + SESSION_TTL_MS,
    nowIST()
  );
  return token;
}

const PASSWORD_CHANGE_ALLOWED = ['/api/auth/me', '/api/auth/change-password', '/api/auth/logout'];

function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return next(new HttpError(401, 'Please sign in.', 'NO_SESSION'));

  const session = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(sha256(token));
  if (!session || session.expires_at < Date.now()) {
    if (session) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(session.token_hash);
    return next(new HttpError(401, 'Your session has expired. Please sign in again.', 'SESSION_EXPIRED'));
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
  if (!user || !user.is_active) return next(new HttpError(401, 'Account is inactive.', 'INACTIVE'));

  req.user = user;
  req.sessionHash = session.token_hash;
  next();
}

function requireRoles(roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user.role_code)) return next(new HttpError(403, 'You do not have permission for this action.'));
    next();
  };
}

function validateNewPassword(pw) {
  const s = String(pw || '').trim();
  if (s.length < 4) {
    throw new HttpError(400, 'Password must be at least 4 characters.');
  }
  return s;
}

function verifyPasswordFlexible(password, storedHash) {
  const raw = String(password || '');
  const trimmed = raw.trim();
  const withAt = trimmed.replace(/^([A-Za-z]+)(\d+)$/, '$1@$2');
  const withoutAt = trimmed.replace('@', '');
  const baseList = [raw, trimmed, withAt, withoutAt];
  const candidates = new Set();
  for (const b of baseList) {
    if (!b) continue;
    candidates.add(b);
    candidates.add(b.toLowerCase());
    candidates.add(b.charAt(0).toUpperCase() + b.slice(1));
    candidates.add(b.charAt(0).toLowerCase() + b.slice(1));
  }
  for (const c of candidates) {
    if (c && verifyPassword(c, storedHash)) return true;
  }
  return false;
}

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!username || !password) throw new HttpError(400, 'Username and password are required.');

  const key = `${username}|${req.ip}`;
  const attempt = loginAttempts.get(key);
  if (attempt?.lockedUntil && attempt.lockedUntil > Date.now()) {
    const mins = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
    throw new HttpError(429, `Too many failed attempts. Try again in ${mins} minute(s).`);
  }

  const user = db
    .prepare(
      `SELECT u.* FROM users u
       LEFT JOIN staff s ON s.id = u.staff_id
       WHERE LOWER(u.username) = ? OR LOWER(u.full_name) = ? OR LOWER(COALESCE(s.staff_code, '')) = ?`
    )
    .get(username, username, username);
  if (!user || !verifyPasswordFlexible(password, user.password_hash)) {
    const count = (attempt?.count || 0) + 1;
    loginAttempts.set(key, { count, lockedUntil: count >= 10 ? Date.now() + 5 * 60000 : 0 });
    throw new HttpError(401, 'Incorrect username or password.');
  }
  if (!user.is_active) throw new HttpError(403, 'This account has been deactivated.');

  loginAttempts.delete(key);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  const token = createSession(user.id);
  db.prepare('UPDATE users SET last_login_at = ?, must_change_password = 0 WHERE id = ?').run(nowIST(), user.id);
  logAudit(user, 'LOGIN', 'USER', user.username, `${user.full_name} signed in`);
  res.json({ token, user: safeUser({ ...user, must_change_password: 0 }) });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.sessionHash);
  logAudit(req.user, 'LOGOUT', 'USER', req.user.username, `${req.user.full_name} signed out`);
  res.json({ ok: true });
});

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!verifyPassword(currentPassword, req.user.password_hash)) throw new HttpError(400, 'Current password is incorrect.');
  const pw = validateNewPassword(newPassword);
  if (pw === currentPassword) throw new HttpError(400, 'New password must be different from the current password.');
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hashPassword(pw), req.user.id);
  // Sign out every other device
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(req.user.id, req.sessionHash);
  logAudit(req.user, 'PASSWORD_CHANGED', 'USER', req.user.username, 'Password changed');
  res.json({ user: safeUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

// Everything below requires a valid session
app.use('/api', requireAuth);

// =============================================================================
// Users (owner manages logins)
// =============================================================================
app.get('/api/users', requireRoles(['OWNER']), (_req, res) => {
  const users = db
    .prepare('SELECT id, username, full_name, phone, role_code, staff_id, is_active, must_change_password, last_login_at FROM users ORDER BY role_code, full_name')
    .all();
  res.json({ users });
});

app.post('/api/users', requireRoles(['OWNER']), (req, res) => {
  const full_name = requireText(req.body?.full_name, 'Name', { max: 100 });
  const username = requireText(req.body?.username, 'Username', { min: 3, max: 40 }).toLowerCase();
  if (!/^[a-z0-9._]+$/.test(username)) throw new HttpError(400, 'Username may contain only letters, numbers, dot and underscore.');
  const phone = req.body?.phone ? validateMobile(req.body.phone) : '';
  const password = validateNewPassword(req.body?.password);
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new HttpError(409, 'Username already exists.');
  const id = uid('USR');
  db.prepare(
    `INSERT INTO users (id, username, full_name, phone, password_hash, role_code, branch_id, must_change_password, created_at)
     VALUES (?, ?, ?, ?, ?, 'ADMIN', 'BR-01', 1, ?)`
  ).run(id, username, full_name, phone, hashPassword(password), nowIST());
  logAudit(req.user, 'USER_CREATED', 'USER', username, `Created admin login ${username}`);
  res.status(201).json({ ok: true });
});

app.post('/api/users/:id/reset-password', requireRoles(['OWNER']), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) throw new HttpError(404, 'User not found.');
  const pw = validateNewPassword(req.body?.newPassword);
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?').run(hashPassword(pw), target.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
  logAudit(req.user, 'PASSWORD_RESET', 'USER', target.username, `Temporary password set for ${target.username}`);
  res.json({ ok: true });
});

app.patch('/api/users/:id/active', requireRoles(['OWNER']), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) throw new HttpError(404, 'User not found.');
  if (target.id === req.user.id) throw new HttpError(400, 'You cannot deactivate your own account.');
  const active = req.body?.is_active ? 1 : 0;
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(active, target.id);
  if (!active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
  if (target.staff_id) db.prepare('UPDATE staff SET is_active = ? WHERE id = ?').run(active, target.staff_id);
  logAudit(req.user, active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', 'USER', target.username, `${active ? 'Activated' : 'Deactivated'} ${target.username}`);
  res.json({ ok: true });
});

// =============================================================================
// Settings
// =============================================================================
const SETTING_KEYS = ['company_name', 'company_name_ta', 'address', 'phone', 'registration_no', 'skip_sundays'];

app.get('/api/settings', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = Object.fromEntries(rows.filter((r) => SETTING_KEYS.includes(r.key)).map((r) => [r.key, r.value]));
  res.json({ settings, today: todayISO() });
});

app.put('/api/settings', requireRoles(['OWNER']), (req, res) => {
  const body = req.body || {};
  const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const key of SETTING_KEYS) {
    if (body[key] === undefined) continue;
    const value = key === 'skip_sundays' ? (body[key] === true || body[key] === '1' ? '1' : '0') : optText(body[key], 200);
    up.run(key, value);
  }
  logAudit(req.user, 'SETTINGS_UPDATED', 'SETTINGS', 'company', 'Company settings updated');
  res.json({ ok: true });
});

// =============================================================================
// Dashboard
// =============================================================================
app.get('/api/dashboard', (req, res) => {
  refreshOverdue();
  const today = todayISO();
  const month = today.slice(0, 7);
  const staffId = isStaff(req.user) ? req.user.staff_id : null;
  const loanScope = staffId ? 'AND (l.assigned_staff_id = ? OR l.assigned_staff_id IS NULL)' : '';
  const lp = staffId ? [staffId] : [];

  const one = (sql, ...p) => db.prepare(sql).get(...p);

  const activeCustomers = one(
    `SELECT COUNT(*) AS c FROM customers c WHERE c.status != 'INACTIVE' ${staffId ? 'AND (c.assigned_staff_id = ? OR c.assigned_staff_id IS NULL)' : ''}`,
    ...lp
  ).c;
  const loanAgg = one(
    `SELECT COUNT(*) AS c, COALESCE(SUM(outstanding_balance),0) AS outstanding
     FROM loans l WHERE l.status IN ('ACTIVE','OVERDUE') ${loanScope}`,
    ...lp
  );
  const disbursed = one(
    `SELECT COALESCE(SUM(principal_amount),0) AS principal, COALESCE(SUM(actual_cash_payout),0) AS cash FROM loans l WHERE 1=1 ${loanScope}`,
    ...lp
  );
  const payScope = staffId ? 'AND (l.assigned_staff_id = ? OR l.assigned_staff_id IS NULL OR p.collected_by_staff_id = ?)' : '';
  const payParams = staffId ? [staffId, staffId] : [];
  const todayCol = one(
    `SELECT COALESCE(SUM(p.amount_collected),0) AS t, COUNT(*) AS c FROM payments p JOIN loans l ON l.id = p.loan_id
     WHERE p.status = 'POSTED' AND p.payment_date = ? ${payScope}`,
    today,
    ...payParams
  );
  const monthCol = one(
    `SELECT COALESCE(SUM(p.amount_collected),0) AS t FROM payments p JOIN loans l ON l.id = p.loan_id
     WHERE p.status = 'POSTED' AND substr(p.payment_date,1,7) = ? ${payScope}`,
    month,
    ...payParams
  ).t;
  const overdue = one(
    `SELECT COUNT(DISTINCT l.id) AS c, COALESCE(SUM(rs.balance_amount),0) AS amt
     FROM repayment_schedules rs JOIN loans l ON l.id = rs.loan_id
     WHERE rs.due_date < ? AND rs.balance_amount > 0 AND l.status IN ('ACTIVE','OVERDUE') ${loanScope}`,
    today,
    ...lp
  );
  const dueToday = one(
    `SELECT COALESCE(SUM(rs.scheduled_amount),0) AS t FROM repayment_schedules rs JOIN loans l ON l.id = rs.loan_id
     WHERE rs.due_date = ? AND l.status IN ('ACTIVE','OVERDUE') ${loanScope}`,
    today,
    ...lp
  ).t;
  const renewed = one('SELECT COUNT(*) AS c FROM renewals').c;

  let cash = null;
  if (!staffId) {
    const r = one(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_mode='CASH' AND direction='INFLOW' THEN amount END),0)
          - COALESCE(SUM(CASE WHEN payment_mode='CASH' AND direction='OUTFLOW' THEN amount END),0) AS cash_in_hand,
        COALESCE(SUM(CASE WHEN payment_mode!='CASH' AND direction='INFLOW' THEN amount END),0)
          - COALESCE(SUM(CASE WHEN payment_mode!='CASH' AND direction='OUTFLOW' THEN amount END),0) AS bank_balance
      FROM cash_transactions`);
    cash = { cashInHand: r.cash_in_hand, bankBalance: r.bank_balance };
  }

  const recentTransactions = db
    .prepare(
      `SELECT p.id, p.receipt_number, p.payment_date, p.collected_at, p.amount_collected, p.payment_mode, p.status,
              p.balance_after_payment, c.full_name AS customer_name, c.area, l.loan_number
       FROM payments p JOIN customers c ON c.id = p.customer_id JOIN loans l ON l.id = p.loan_id
       WHERE 1=1 ${payScope}
       ORDER BY p.collected_at DESC LIMIT 10`
    )
    .all(...payParams);

  res.json({
    today,
    kpis: {
      activeCustomers,
      activeLoans: loanAgg.c,
      outstanding: loanAgg.outstanding,
      totalPrincipal: disbursed.principal,
      totalCashDisbursed: disbursed.cash,
      todaysCollection: todayCol.t,
      todayReceiptCount: todayCol.c,
      dueToday,
      monthlyCollection: monthCol,
      overdueCount: overdue.c,
      overdueAmount: overdue.amt,
      renewedCount: renewed,
      ...(cash || {}),
    },
    recentTransactions,
  });
});

// =============================================================================
// Customers
// =============================================================================
app.get('/api/customers', (req, res) => {
  const search = optText(req.query.search, 60);
  const params = [];
  let sql = `
    SELECT c.*, s.full_name AS staff_name,
      (SELECT COUNT(*) FROM loans l WHERE l.customer_id = c.id AND l.status IN ('ACTIVE','OVERDUE')) AS active_loans,
      COALESCE((SELECT SUM(l.outstanding_balance) FROM loans l WHERE l.customer_id = c.id AND l.status IN ('ACTIVE','OVERDUE')),0) AS total_outstanding
    FROM customers c LEFT JOIN staff s ON s.id = c.assigned_staff_id WHERE 1=1`;
  if (isStaff(req.user)) {
    sql += ' AND (c.assigned_staff_id = ? OR c.assigned_staff_id IS NULL)';
    params.push(req.user.staff_id);
  }
  if (search) {
    const q = `%${search}%`;
    sql += ' AND (c.customer_code LIKE ? OR c.full_name LIKE ? OR c.mobile LIKE ? OR c.area LIKE ? OR c.business_name LIKE ?)';
    params.push(q, q, q, q, q);
  }
  sql += ' ORDER BY c.full_name COLLATE NOCASE';
  res.json({ customers: db.prepare(sql).all(...params) });
});

app.get('/api/customers/:id', (req, res) => {
  const customer = db
    .prepare('SELECT c.*, s.full_name AS staff_name FROM customers c LEFT JOIN staff s ON s.id = c.assigned_staff_id WHERE c.id = ?')
    .get(req.params.id);
  assertCustomerAccess(req.user, customer);
  const loans = db.prepare('SELECT * FROM loans WHERE customer_id = ? ORDER BY created_at DESC').all(customer.id);
  const payments = db
    .prepare(
      `SELECT p.*, l.loan_number FROM payments p JOIN loans l ON l.id = p.loan_id
       WHERE p.customer_id = ? ORDER BY p.collected_at DESC`
    )
    .all(customer.id);
  res.json({ customer, loans, payments });
});

function readCustomerBody(body, existingId = null) {
  const full_name = requireText(body.full_name, 'Customer name', { max: 100 });
  const mobile = validateMobile(body.mobile);
  const alt_mobile = body.alt_mobile ? validateMobile(body.alt_mobile, 'Alternate mobile') : '';
  const area = requireText(body.area, 'Area', { max: 80 });
  const idp = normaliseIdProof(body.id_proof_type, body.id_proof_number);
  const dup = db
    .prepare("SELECT customer_code, full_name FROM customers WHERE mobile = ? AND status != 'INACTIVE' AND id != ?")
    .get(mobile, existingId || '');
  if (dup) throw new HttpError(409, `Mobile number already registered to ${dup.full_name} (${dup.customer_code}).`);
  return {
    full_name,
    mobile,
    alt_mobile,
    area,
    business_name: optText(body.business_name, 120),
    address: optText(body.address, 300),
    id_proof_type: idp.type,
    id_proof_number: idp.number,
    notes: optText(body.notes, 500),
    assigned_staff_id: validStaffId(body.assigned_staff_id || null),
  };
}

app.post('/api/customers', requireRoles(['OWNER', 'ADMIN']), (req, res) => {
  const c = readCustomerBody(req.body || {});
  const customer = runInTransaction(() => {
    const id = uid('CUST');
    const code = `C${nextSeq('customer', 1001)}`;
    db.prepare(
      `INSERT INTO customers (id, customer_code, full_name, business_name, mobile, alt_mobile, address, area, branch_id,
         assigned_staff_id, id_proof_type, id_proof_number, registration_date, notes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BR-01', ?, ?, ?, ?, ?, 'ACTIVE', ?)`
    ).run(id, code, c.full_name, c.business_name, c.mobile, c.alt_mobile, c.address, c.area, c.assigned_staff_id, c.id_proof_type, c.id_proof_number, todayISO(), c.notes, nowIST());
    logAudit(req.user, 'CUSTOMER_CREATED', 'CUSTOMER', code, `Registered ${c.full_name} (${c.area})`);
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  });
  res.status(201).json({ customer });
});

app.patch('/api/customers/:id', requireRoles(['OWNER', 'ADMIN']), (req, res) => {
  const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!existing) throw new HttpError(404, 'Customer not found.');
  const body = req.body || {};
  const c = readCustomerBody({ ...existing, ...body, id_proof_number: body.id_proof_number ?? existing.id_proof_number }, existing.id);
  const status = body.status ?? existing.status;
  if (!['ACTIVE', 'INACTIVE', 'WATCHLIST'].includes(status)) throw new HttpError(400, 'Invalid status.');

  runInTransaction(() => {
    db.prepare(
      `UPDATE customers SET full_name=?, business_name=?, mobile=?, alt_mobile=?, address=?, area=?, assigned_staff_id=?,
         id_proof_type=?, id_proof_number=?, notes=?, status=? WHERE id=?`
    ).run(c.full_name, c.business_name, c.mobile, c.alt_mobile, c.address, c.area, c.assigned_staff_id, c.id_proof_type, c.id_proof_number, c.notes, status, existing.id);
    // Keep running loans with the customer's collector
    if (c.assigned_staff_id !== existing.assigned_staff_id) {
      db.prepare("UPDATE loans SET assigned_staff_id = ? WHERE customer_id = ? AND status IN ('ACTIVE','OVERDUE')").run(c.assigned_staff_id, existing.id);
    }
    logAudit(req.user, 'CUSTOMER_UPDATED', 'CUSTOMER', existing.customer_code, `Updated ${c.full_name}${status !== existing.status ? ` (status ${existing.status} → ${status})` : ''}`);
  });
  res.json({ customer: db.prepare('SELECT * FROM customers WHERE id = ?').get(existing.id) });
});

// =============================================================================
// Loan products
// =============================================================================
app.get('/api/loan-products', (_req, res) => {
  res.json({ products: db.prepare('SELECT * FROM loan_products WHERE is_active = 1 ORDER BY tenure_days DESC').all() });
});

app.post('/api/loan-products', requireRoles(['OWNER']), (req, res) => {
  const b = req.body || {};
  const name = requireText(b.name, 'Product name', { max: 80 });
  const principal = requireInt(b.default_principal, 'Default amount', { min: 500 });
  const upfront = Number(b.upfront_charge_percent);
  const addon = Number(b.addon_interest_percent || 0);
  if (!(upfront >= 0 && upfront < 100) || !(addon >= 0 && addon < 100)) throw new HttpError(400, 'Percentages must be between 0 and 100.');
  const days = requireInt(b.tenure_days, 'Days', { min: 1, max: 365 });
  const code = runInTransaction(() => {
    const code = `P${nextSeq('product', 101)}`;
    db.prepare(
      `INSERT INTO loan_products (id, product_code, name, name_ta, default_principal, upfront_charge_percent, addon_interest_percent, tenure_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(uid('PRD'), code, name, optText(b.name_ta, 80) || name, principal, upfront, addon, days);
    logAudit(req.user, 'PRODUCT_CREATED', 'LOAN_PRODUCT', code, `Created product ${name}`);
    return code;
  });
  res.status(201).json({ product_code: code });
});

// =============================================================================
// Loans
// =============================================================================
app.post('/api/loans/preview', (req, res) => {
  const i = parseLoanInputs(req.body || {});
  const calc = calculateLoanTerms({
    principal: i.principal,
    upfrontCharge: i.upfront,
    addonInterest: i.addon,
    totalInstallments: i.days,
    startDate: i.startDate,
    skipSundays: getSetting('skip_sundays') === '1',
  });
  const { installments, dates, ...summary } = calc;
  res.json({ preview: summary });
});

app.get('/api/loans', (req, res) => {
  const params = [];
  let sql = `
    SELECT l.*, c.customer_code, c.full_name AS customer_name, c.mobile AS customer_mobile, c.area AS customer_area,
           s.full_name AS staff_name, parent.loan_number AS parent_loan_number
    FROM loans l JOIN customers c ON c.id = l.customer_id
    LEFT JOIN staff s ON s.id = l.assigned_staff_id
    LEFT JOIN loans parent ON parent.id = l.parent_loan_id WHERE 1=1`;
  if (isStaff(req.user)) {
    sql += ' AND (l.assigned_staff_id = ? OR l.assigned_staff_id IS NULL)';
    params.push(req.user.staff_id);
  }
  const status = optText(req.query.status, 20);
  if (status && status !== 'ALL') {
    sql += ' AND l.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY l.created_at DESC';
  res.json({ loans: db.prepare(sql).all(...params) });
});

app.get('/api/loans/:id', (req, res) => {
  const loan = db
    .prepare(
      `SELECT l.*, c.customer_code, c.full_name AS customer_name, c.mobile AS customer_mobile, c.area AS customer_area,
              s.full_name AS staff_name, parent.loan_number AS parent_loan_number, child.loan_number AS renewed_to_loan_number
       FROM loans l JOIN customers c ON c.id = l.customer_id
       LEFT JOIN staff s ON s.id = l.assigned_staff_id
       LEFT JOIN loans parent ON parent.id = l.parent_loan_id
       LEFT JOIN loans child ON child.id = l.renewed_to_loan_id
       WHERE l.id = ?`
    )
    .get(req.params.id);
  assertLoanAccess(req.user, loan);
  const schedules = db.prepare('SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_no').all(loan.id);
  const payments = db.prepare('SELECT * FROM payments WHERE loan_id = ? ORDER BY collected_at DESC').all(loan.id);
  res.json({ loan, schedules, payments });
});

app.post('/api/loans', requireRoles(['OWNER', 'ADMIN']), (req, res) => {
  const b = req.body || {};
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(String(b.customer_id || ''));
  if (!customer) throw new HttpError(400, 'Please select a customer.');
  if (customer.status === 'INACTIVE') throw new HttpError(400, 'This customer is inactive. Reactivate the customer first.');
  const i = parseLoanInputs(b);
  const mode = MODES.includes(b.disbursement_mode) ? b.disbursement_mode : 'CASH';
  const staffId = b.assigned_staff_id !== undefined ? validStaffId(b.assigned_staff_id || null) : customer.assigned_staff_id;
  const product = b.product_id ? db.prepare('SELECT id FROM loan_products WHERE id = ?').get(b.product_id) : null;
  const skipSundays = getSetting('skip_sundays') === '1';
  const calc = calculateLoanTerms({
    principal: i.principal,
    upfrontCharge: i.upfront,
    addonInterest: i.addon,
    totalInstallments: i.days,
    startDate: i.startDate,
    skipSundays,
  });

  const loan = runInTransaction(() => {
    const id = uid('LN');
    const loanNumber = `L${nextSeq('loan', 1001)}`;
    db.prepare(
      `INSERT INTO loans (id, loan_number, customer_id, branch_id, product_id, assigned_staff_id, principal_amount, upfront_charge_amount,
         addon_interest_amount, disclosed_charge_amount, net_disbursed_amount, settled_previous_loan_amount, actual_cash_payout,
         total_contractual_amount, daily_installment, total_installments, outstanding_balance, apr_percent, skip_sundays,
         start_date, maturity_date, disbursement_mode, agreement_reference, loan_type, status, created_by, created_at)
       VALUES (?, ?, ?, 'BR-01', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', 'ACTIVE', ?, ?)`
    ).run(
      id, loanNumber, customer.id, product?.id || null, staffId, calc.principalAmount, calc.upfrontChargeAmount,
      calc.addonInterestAmount, calc.totalDisclosedCharges, calc.netDisbursedAmount, calc.actualCashPayout,
      calc.totalContractualAmount, calc.dailyInstallment, calc.totalInstallments, calc.totalContractualAmount, calc.apr,
      skipSundays ? 1 : 0, calc.startDate, calc.maturityDate, mode, optText(b.agreement_reference, 60) || `AGR-${loanNumber}`,
      req.user.id, nowIST()
    );
    insertSchedule(id, calc);

    insertCash({
      branchId: 'BR-01', date: calc.startDate, direction: 'OUTFLOW', category: 'LOAN_DISBURSEMENT', mode,
      amount: calc.actualCashPayout, reference: loanNumber,
      description: `Loan ${loanNumber} to ${customer.full_name}`, userId: req.user.id,
    });
    insertLedger(
      [
        { head: 'Loan Receivable', type: 'ASSET', debit: calc.totalContractualAmount, narration: `Loan ${loanNumber} receivable` },
        { head: 'Cash & Bank', type: 'ASSET', credit: calc.actualCashPayout, narration: `Cash paid to ${customer.full_name} (${mode})` },
        { head: 'Upfront Charges Income', type: 'INCOME', credit: calc.upfrontChargeAmount, narration: `Upfront deduction on ${loanNumber}` },
        { head: 'Interest Income', type: 'INCOME', credit: calc.addonInterestAmount, narration: `Add-on interest on ${loanNumber}` },
      ],
      { branchId: 'BR-01', date: calc.startDate, refType: 'LOAN_ORIGINATION', refCode: loanNumber }
    );
    logAudit(req.user, 'LOAN_CREATED', 'LOAN', loanNumber, `Loan ₹${calc.principalAmount} to ${customer.full_name}, cash given ₹${calc.actualCashPayout}`);
    // Back-dated loans may already have overdue installments
    return recomputeLoan(id);
  });
  res.status(201).json({ loan });
});

app.patch('/api/loans/:id/staff', requireRoles(['OWNER', 'ADMIN']), (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!loan) throw new HttpError(404, 'Loan not found.');
  const staffId = validStaffId(req.body?.assigned_staff_id || null);
  db.prepare('UPDATE loans SET assigned_staff_id = ? WHERE id = ?').run(staffId, loan.id);
  logAudit(req.user, 'LOAN_STAFF_CHANGED', 'LOAN', loan.loan_number, 'Collector changed');
  res.json({ ok: true });
});

// =============================================================================
// Daily collections & payments
// =============================================================================
app.get('/api/collections/today', (req, res) => {
  refreshOverdue();
  const today = todayISO();
  const search = optText(req.query.search, 60);
  const params = [today, today, today, today, today, today];
  let sql = `
    SELECT l.id AS loan_id, l.loan_number, l.daily_installment, l.total_installments, l.paid_installments,
           l.amount_collected, l.outstanding_balance, l.total_contractual_amount, l.status AS loan_status,
           c.id AS customer_id, c.customer_code, c.full_name AS customer_name, c.mobile AS customer_mobile, c.area,
           s.full_name AS staff_name,
           COALESCE((SELECT SUM(scheduled_amount) FROM repayment_schedules r WHERE r.loan_id = l.id AND r.due_date <= ?),0) AS scheduled_to_date,
           COALESCE((SELECT SUM(scheduled_amount) FROM repayment_schedules r WHERE r.loan_id = l.id AND r.due_date < ?),0) AS scheduled_before_today,
           COALESCE((SELECT COUNT(*) FROM repayment_schedules r WHERE r.loan_id = l.id AND r.due_date < ? AND r.balance_amount > 0),0) AS missed_days,
           COALESCE((SELECT SUM(p.amount_collected) FROM payments p WHERE p.loan_id = l.id AND p.status='POSTED' AND p.payment_date = ?),0) AS collected_today,
           (SELECT p.receipt_number FROM payments p WHERE p.loan_id = l.id AND p.status='POSTED' AND p.payment_date = ? ORDER BY p.collected_at DESC LIMIT 1) AS last_receipt_today,
           (SELECT mc.reason FROM missed_collections mc WHERE mc.loan_id = l.id AND mc.missed_date = ? LIMIT 1) AS missed_today_reason
    FROM loans l JOIN customers c ON c.id = l.customer_id
    LEFT JOIN staff s ON s.id = l.assigned_staff_id
    WHERE l.status IN ('ACTIVE','OVERDUE')`;
  if (isStaff(req.user)) {
    sql += ' AND (l.assigned_staff_id = ? OR l.assigned_staff_id IS NULL)';
    params.push(req.user.staff_id);
  }
  if (search) {
    const q = `%${search}%`;
    sql += ' AND (c.full_name LIKE ? OR c.mobile LIKE ? OR c.customer_code LIKE ? OR l.loan_number LIKE ? OR c.area LIKE ?)';
    params.push(q, q, q, q, q);
  }
  sql += ' ORDER BY c.area COLLATE NOCASE, c.full_name COLLATE NOCASE';

  const items = db.prepare(sql).all(...params).map((r) => {
    const dueNowAmt = Math.max(0, Math.min(r.outstanding_balance, r.scheduled_to_date - r.amount_collected));
    const arrears = Math.max(0, r.scheduled_before_today - r.amount_collected);
    const missedDays = r.missed_days + (r.missed_today_reason ? 1 : 0);
    return { ...r, due_now: dueNowAmt, arrears, missed_days: missedDays };
  });
  res.json({ date: today, items });
});

app.post('/api/collections/missed', (req, res) => {
  const b = req.body || {};
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(String(b.loan_id || ''));
  assertLoanAccess(req.user, loan);
  if (!['ACTIVE', 'OVERDUE'].includes(loan.status)) {
    throw new HttpError(400, `Loan ${loan.loan_number} is ${loan.status}.`);
  }
  const reason = optText(b.reason, 200) || 'இன்று தவணை கட்டவில்லை (Missed Today)';
  const today = todayISO();

  runInTransaction(() => {
    db.prepare(
      `INSERT INTO missed_collections (id, loan_id, customer_id, missed_date, reason, recorded_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(loan_id, missed_date) DO UPDATE SET reason = excluded.reason, recorded_by_user_id = excluded.recorded_by_user_id`
    ).run(uid('MIS'), loan.id, loan.customer_id, today, reason, req.user.id, nowIST());

    db.prepare(
      `UPDATE repayment_schedules SET status = 'OVERDUE' WHERE loan_id = ? AND due_date <= ? AND balance_amount > 0`
    ).run(loan.id, today);

    db.prepare(`UPDATE loans SET status = 'OVERDUE' WHERE id = ? AND status = 'ACTIVE'`).run(loan.id);
    logAudit(req.user, 'COLLECTION_MISSED', 'LOAN', loan.loan_number, `Marked missed on ${today}: ${reason}`);
  });

  res.json({ ok: true, loan_id: loan.id, reason });
});

function receiptPayload(paymentId) {
  return db
    .prepare(
      `SELECT p.*, c.full_name AS customer_name, c.customer_code, c.mobile AS customer_mobile, c.area,
              l.loan_number, l.total_contractual_amount, l.daily_installment, l.paid_installments, l.total_installments,
              s.full_name AS staff_name, u.full_name AS recorded_by_name
       FROM payments p JOIN customers c ON c.id = p.customer_id JOIN loans l ON l.id = p.loan_id
       LEFT JOIN staff s ON s.id = p.collected_by_staff_id
       LEFT JOIN users u ON u.id = p.recorded_by_user_id
       WHERE p.id = ?`
    )
    .get(paymentId);
}

app.post('/api/collections/pay', (req, res) => {
  const b = req.body || {};
  const key = String(b.idempotency_key || '');
  if (key.length < 8 || key.length > 100) throw new HttpError(400, 'Missing request key. Please refresh and try again.');

  const existing = db.prepare('SELECT * FROM payments WHERE idempotency_key = ?').get(key);
  if (existing) {
    if (existing.loan_id !== b.loan_id) throw new HttpError(409, 'Duplicate request key.');
    return res.status(200).json({ payment: receiptPayload(existing.id), duplicate: true });
  }

  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(String(b.loan_id || ''));
  assertLoanAccess(req.user, loan);
  if (!['ACTIVE', 'OVERDUE'].includes(loan.status)) throw new HttpError(400, `This loan is ${loan.status} and cannot accept payments.`);

  const amount = requireInt(b.amount_collected, 'Amount', { min: 1, max: loan.outstanding_balance });
  const mode = MODES.includes(b.payment_mode) ? b.payment_mode : null;
  if (!mode) throw new HttpError(400, 'Choose a payment mode: Cash, UPI or Bank.');

  // Staff always record for today. Owner/Admin may enter a past date (e.g. yesterday's field collection).
  let paymentDate = todayISO();
  if (!isStaff(req.user) && b.payment_date) {
    if (!isValidDate(b.payment_date) || b.payment_date > todayISO()) throw new HttpError(400, 'Payment date cannot be in the future.');
    if (b.payment_date < loan.start_date) throw new HttpError(400, 'Payment date is before the loan start date.');
    paymentDate = b.payment_date;
  }
  let collector = loan.assigned_staff_id;
  if (isStaff(req.user)) collector = req.user.staff_id;
  else if (b.collected_by_staff_id !== undefined) collector = validStaffId(b.collected_by_staff_id || null);

  const payment = runInTransaction(() => {
    const fresh = db.prepare('SELECT * FROM loans WHERE id = ?').get(loan.id);
    if (amount > fresh.outstanding_balance) throw new HttpError(400, `Amount exceeds the remaining balance (₹${fresh.outstanding_balance}).`);
    const dueBefore = dueNow(fresh, paymentDate);
    const type = dueBefore === 0 ? 'ADVANCE' : amount < dueBefore ? 'PARTIAL' : amount === dueBefore ? 'REGULAR' : 'ADVANCE';
    const seq = nextSeq('receipt', 100001);
    const id = uid('PAY');
    db.prepare(
      `INSERT INTO payments (id, transaction_id, idempotency_key, receipt_number, loan_id, customer_id, branch_id, collected_by_staff_id,
         recorded_by_user_id, payment_date, collected_at, amount_due_before, amount_collected, payment_type, payment_mode,
         balance_after_payment, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, 'BR-01', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'POSTED')`
    ).run(
      id, `T${seq}`, key, `R${seq}`, fresh.id, fresh.customer_id, collector, req.user.id, paymentDate, nowIST(),
      dueBefore, amount, type, mode, fresh.outstanding_balance - amount, optText(b.notes, 200)
    );
    insertCash({
      branchId: 'BR-01', date: paymentDate, direction: 'INFLOW', category: 'DAILY_COLLECTION', mode, amount,
      reference: `R${seq}`, description: `Collection ${fresh.loan_number}`, userId: req.user.id,
    });
    insertLedger(
      [
        { head: 'Cash & Bank', type: 'ASSET', debit: amount, narration: `Collection R${seq} (${mode})` },
        { head: 'Loan Receivable', type: 'ASSET', credit: amount, narration: `Repayment on ${fresh.loan_number}` },
      ],
      { branchId: 'BR-01', date: paymentDate, refType: 'COLLECTION', refCode: `R${seq}` }
    );
    db.prepare('DELETE FROM missed_collections WHERE loan_id = ? AND missed_date = ?').run(fresh.id, paymentDate);
    recomputeLoan(fresh.id);
    logAudit(req.user, 'PAYMENT_POSTED', 'PAYMENT', `R${seq}`, `₹${amount} (${mode}) on ${fresh.loan_number}`);
    return receiptPayload(id);
  });
  res.status(201).json({ payment });
});

/** Cancel a wrong payment. The original record is kept and marked REVERSED; balances are recalculated. */
app.post('/api/payments/:id/reverse', requireRoles(['OWNER', 'ADMIN']), (req, res) => {
  const reason = requireText(req.body?.reason, 'Reason', { min: 3, max: 200 });
  const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!p) throw new HttpError(404, 'Payment not found.');
  if (p.status === 'REVERSED') throw new HttpError(400, 'This payment is already cancelled.');
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(p.loan_id);
  if (loan.status === 'RENEWED_CLOSED') throw new HttpError(400, 'This loan was renewed. Payments on a renewed loan cannot be cancelled.');

  runInTransaction(() => {
    const today = todayISO();
    db.prepare("UPDATE payments SET status='REVERSED', reversed_at=?, reversed_by=?, reversal_reason=? WHERE id=?").run(nowIST(), req.user.id, reason, p.id);
    insertCash({
      branchId: p.branch_id, date: today, direction: 'OUTFLOW', category: 'COLLECTION_REVERSAL', mode: p.payment_mode,
      amount: p.amount_collected, reference: p.receipt_number, description: `Cancelled receipt ${p.receipt_number}: ${reason}`, userId: req.user.id,
    });
    insertLedger(
      [
        { head: 'Loan Receivable', type: 'ASSET', debit: p.amount_collected, narration: `Reversal of ${p.receipt_number}` },
        { head: 'Cash & Bank', type: 'ASSET', credit: p.amount_collected, narration: `Reversal of ${p.receipt_number}: ${reason}` },
      ],
      { branchId: p.branch_id, date: today, refType: 'COLLECTION_REVERSAL', refCode: p.receipt_number }
    );
    recomputeLoan(loan.id);
    logAudit(req.user, 'PAYMENT_REVERSED', 'PAYMENT', p.receipt_number, `Cancelled ₹${p.amount_collected} on ${loan.loan_number}. Reason: ${reason}`);
  });
  res.json({ ok: true });
});

app.get('/api/receipts/:receiptNumber', (req, res) => {
  const p = db.prepare('SELECT id, loan_id FROM payments WHERE receipt_number = ?').get(req.params.receiptNumber);
  if (!p) throw new HttpError(404, 'Receipt not found.');
  assertLoanAccess(req.user, db.prepare('SELECT * FROM loans WHERE id = ?').get(p.loan_id));
  res.json({ receipt: receiptPayload(p.id) });
});

// =============================================================================
// Renewal engine
// =============================================================================
function renewalPreview(oldLoan, body) {
  const i = parseLoanInputs({ ...body, start_date: body.renewal_date || todayISO() });
  const calc = calculateLoanTerms({
    principal: i.principal,
    upfrontCharge: i.upfront,
    addonInterest: i.addon,
    totalInstallments: i.days,
    startDate: i.startDate,
    skipSundays: getSetting('skip_sundays') === '1',
    settledPreviousBalance: oldLoan.outstanding_balance,
  });
  return {
    calc,
    preview: {
      oldLoanNumber: oldLoan.loan_number,
      oldPrincipal: oldLoan.principal_amount,
      oldAmountPaid: oldLoan.amount_collected,
      oldPaidInstallments: oldLoan.paid_installments,
      oldTotalInstallments: oldLoan.total_installments,
      oldUnpaidBalance: oldLoan.outstanding_balance,
      newPrincipal: calc.principalAmount,
      newUpfrontCharge: calc.upfrontChargeAmount,
      newAddonInterest: calc.addonInterestAmount,
      netCashToCustomer: calc.actualCashPayout,
      newTotalRepayment: calc.totalContractualAmount,
      newDailyInstallment: calc.dailyInstallment,
      newLastInstallment: calc.lastInstallment,
      newDays: calc.totalInstallments,
      maturityDate: calc.maturityDate,
      apr: calc.apr,
    },
  };
}

function loadRenewableLoan(user, id) {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(String(id || ''));
  assertLoanAccess(user, loan);
  if (!['ACTIVE', 'OVERDUE'].includes(loan.status)) throw new HttpError(400, `Loan ${loan.loan_number} is ${loan.status} and cannot be renewed.`);
  return loan;
}

app.post('/api/renewals/preview', requireRoles(['OWNER', 'ADMIN']), (req, res) => {
  const oldLoan = loadRenewableLoan(req.user, req.body?.old_loan_id);
  res.json({ preview: renewalPreview(oldLoan, req.body || {}).preview });
});

app.post('/api/renewals/execute', requireRoles(['OWNER', 'ADMIN']), (req, res) => {
  const b = req.body || {};
  if (b.customer_consent_verified !== true) throw new HttpError(400, 'Customer consent must be confirmed.');
  const consentRef = requireText(b.consent_reference, 'Consent / agreement reference', { min: 3, max: 60 });
  const mode = MODES.includes(b.disbursement_mode) ? b.disbursement_mode : 'CASH';

  const result = runInTransaction(() => {
    const oldLoan = loadRenewableLoan(req.user, b.old_loan_id);
    const { calc, preview } = renewalPreview(oldLoan, b);
    if (calc.actualCashPayout < 0) {
      throw new HttpError(400, `New loan amount is too small: it does not cover the old balance (₹${oldLoan.outstanding_balance}) plus the new deduction.`);
    }
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(oldLoan.customer_id);
    const today = calc.startDate;
    const newId = uid('LN');
    const newNumber = `L${nextSeq('loan', 1001)}`;
    const seq = nextSeq('renewal', 101);
    const renewalCode = `RN${seq}`;
    const settlementId = uid('STL');

    db.prepare(
      `INSERT INTO loans (id, loan_number, customer_id, branch_id, product_id, assigned_staff_id, principal_amount, upfront_charge_amount,
         addon_interest_amount, disclosed_charge_amount, net_disbursed_amount, settled_previous_loan_amount, actual_cash_payout,
         total_contractual_amount, daily_installment, total_installments, outstanding_balance, apr_percent, skip_sundays,
         start_date, maturity_date, disbursement_mode, agreement_reference, parent_loan_id, loan_type, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RENEWAL', 'ACTIVE', ?, ?)`
    ).run(
      newId, newNumber, oldLoan.customer_id, oldLoan.branch_id, oldLoan.product_id, oldLoan.assigned_staff_id,
      calc.principalAmount, calc.upfrontChargeAmount, calc.addonInterestAmount, calc.totalDisclosedCharges, calc.netDisbursedAmount,
      oldLoan.outstanding_balance, calc.actualCashPayout, calc.totalContractualAmount, calc.dailyInstallment, calc.totalInstallments,
      calc.totalContractualAmount, calc.apr, calc.skipSundays ? 1 : 0, calc.startDate, calc.maturityDate, mode, consentRef,
      oldLoan.id, req.user.id, nowIST()
    );
    insertSchedule(newId, calc);

    // Close old loan WITHOUT touching its payment history
    db.prepare("UPDATE loans SET status='RENEWED_CLOSED', outstanding_balance=0, renewed_to_loan_id=? WHERE id=?").run(newId, oldLoan.id);
    db.prepare("UPDATE repayment_schedules SET status='SETTLED_ON_RENEWAL', balance_amount=0 WHERE loan_id=? AND balance_amount > 0").run(oldLoan.id);

    db.prepare(
      `INSERT INTO loan_settlements (id, settlement_code, old_loan_id, new_loan_id, customer_id, settlement_type, unpaid_scheduled_balance,
         settled_amount, settled_date, approved_by, notes, created_at)
       VALUES (?, ?, ?, ?, ?, 'RENEWAL_NETTING', ?, ?, ?, ?, ?, ?)`
    ).run(settlementId, `ST${seq}`, oldLoan.id, newId, oldLoan.customer_id, oldLoan.outstanding_balance, oldLoan.outstanding_balance, today, req.user.id,
      `Old balance of ${oldLoan.loan_number} adjusted against ${newNumber} (no cash movement)`, nowIST());

    db.prepare(
      `INSERT INTO renewals (id, renewal_code, customer_id, old_loan_id, new_loan_id, settlement_id, old_loan_principal, old_loan_paid,
         old_loan_settled_balance, new_loan_principal, new_disclosed_charges, net_additional_disbursement, consent_reference,
         renewal_date, approved_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(uid('REN'), renewalCode, oldLoan.customer_id, oldLoan.id, newId, settlementId, oldLoan.principal_amount, oldLoan.amount_collected,
      oldLoan.outstanding_balance, calc.principalAmount, calc.totalDisclosedCharges, calc.actualCashPayout, consentRef, today, req.user.id, nowIST());

    // Only the net cash actually handed over leaves the cash box
    if (calc.actualCashPayout > 0) {
      insertCash({
        branchId: oldLoan.branch_id, date: today, direction: 'OUTFLOW', category: 'RENEWAL_NET_PAYOUT', mode,
        amount: calc.actualCashPayout, reference: renewalCode, description: `Renewal ${oldLoan.loan_number} → ${newNumber}`, userId: req.user.id,
      });
    }
    insertLedger(
      [
        { head: 'Loan Receivable', type: 'ASSET', debit: calc.totalContractualAmount, narration: `New loan ${newNumber}` },
        { head: 'Loan Receivable', type: 'ASSET', credit: oldLoan.outstanding_balance, narration: `Old loan ${oldLoan.loan_number} balance adjusted (non-cash)`, nonCash: true },
        { head: 'Upfront Charges Income', type: 'INCOME', credit: calc.upfrontChargeAmount, narration: `Upfront deduction on ${newNumber}` },
        { head: 'Interest Income', type: 'INCOME', credit: calc.addonInterestAmount, narration: `Add-on interest on ${newNumber}` },
        { head: 'Cash & Bank', type: 'ASSET', credit: calc.actualCashPayout, narration: `Net cash paid to ${customer.full_name}` },
      ],
      { branchId: oldLoan.branch_id, date: today, refType: 'LOAN_RENEWAL', refCode: renewalCode }
    );
    logAudit(req.user, 'LOAN_RENEWED', 'RENEWAL', renewalCode,
      `${oldLoan.loan_number} (balance ₹${oldLoan.outstanding_balance}) → ${newNumber} ₹${calc.principalAmount}; cash given ₹${calc.actualCashPayout}`);
    recomputeLoan(newId);
    return { renewalCode, oldLoanNumber: oldLoan.loan_number, newLoanNumber: newNumber, preview };
  });
  res.status(201).json(result);
});

app.get('/api/renewals', requireRoles(['OWNER', 'ADMIN']), (_req, res) => {
  const renewals = db
    .prepare(
      `SELECT r.*, c.full_name AS customer_name, o.loan_number AS old_loan_number, n.loan_number AS new_loan_number, u.full_name AS approved_by_name
       FROM renewals r JOIN customers c ON c.id = r.customer_id JOIN loans o ON o.id = r.old_loan_id
       JOIN loans n ON n.id = r.new_loan_id LEFT JOIN users u ON u.id = r.approved_by_user_id
       ORDER BY r.created_at DESC`
    )
    .all();
  res.json({ renewals });
});

// =============================================================================
// Staff
// =============================================================================
app.get('/api/staff', requireRoles(['OWNER', 'ADMIN']), (_req, res) => {
  const today = todayISO();
  const month = today.slice(0, 7);
  const staff = db
    .prepare(
      `SELECT s.*, u.username, u.is_active AS login_active,
         (SELECT COUNT(*) FROM customers c WHERE c.assigned_staff_id = s.id AND c.status != 'INACTIVE') AS customers_count,
         COALESCE((SELECT SUM(amount_collected) FROM payments p WHERE p.collected_by_staff_id = s.id AND p.status='POSTED' AND p.payment_date = ?),0) AS today_collection,
         COALESCE((SELECT SUM(amount_collected) FROM payments p WHERE p.collected_by_staff_id = s.id AND p.status='POSTED' AND substr(p.payment_date,1,7) = ?),0) AS month_collection
       FROM staff s LEFT JOIN users u ON u.id = s.user_id ORDER BY s.is_active DESC, s.full_name COLLATE NOCASE`
    )
    .all(today, month);
  res.json({ staff });
});

app.post('/api/staff', requireRoles(['OWNER', 'ADMIN']), (req, res) => {
  const b = req.body || {};
  const full_name = requireText(b.full_name, 'Name', { max: 100 });
  const phone = validateMobile(b.phone);
  const username = requireText(b.username, 'Username', { min: 3, max: 40 }).toLowerCase();
  if (!/^[a-z0-9._]+$/.test(username)) throw new HttpError(400, 'Username may contain only letters, numbers, dot and underscore.');
  const password = validateNewPassword(b.password);
  const target = requireInt(b.daily_target ?? 0, 'Daily target', { min: 0 });
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new HttpError(409, 'Username already exists.');

  const staff = runInTransaction(() => {
    const staffId = uid('STF');
    const userId = uid('USR');
    const code = `S${nextSeq('staff', 101)}`;
    db.prepare(
      `INSERT INTO users (id, username, full_name, phone, password_hash, role_code, branch_id, staff_id, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, 'COLLECTION_STAFF', 'BR-01', ?, 0, ?)`
    ).run(userId, username, full_name, phone, hashPassword(password), staffId, nowIST());
    db.prepare(
      `INSERT INTO staff (id, staff_code, user_id, full_name, phone, branch_id, assigned_areas, daily_target, joining_date, created_at)
       VALUES (?, ?, ?, ?, ?, 'BR-01', ?, ?, ?, ?)`
    ).run(staffId, code, userId, full_name, phone, optText(b.assigned_areas, 200), target, todayISO(), nowIST());
    logAudit(req.user, 'STAFF_CREATED', 'STAFF', code, `Added collector ${full_name} (login ${username})`);
    return db.prepare('SELECT * FROM staff WHERE id = ?').get(staffId);
  });
  res.status(201).json({ staff });
});

app.post('/api/staff/:id/reset-password', requireRoles(['OWNER', 'ADMIN']), (req, res) => {
  const s = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
  if (!s || !s.user_id) throw new HttpError(404, 'Staff login account not found.');
  const newPassword = validateNewPassword(req.body?.password);
  const newUsernameRaw = req.body?.username ? String(req.body.username).trim().toLowerCase() : null;
  runInTransaction(() => {
    if (newUsernameRaw) {
      if (!/^[a-z0-9._]+$/.test(newUsernameRaw)) throw new HttpError(400, 'Username may contain only letters, numbers, dot and underscore.');
      const dup = db.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(newUsernameRaw, s.user_id);
      if (dup) throw new HttpError(409, 'Username already exists.');
      db.prepare('UPDATE users SET username = ?, password_hash = ?, must_change_password = 0, is_active = 1 WHERE id = ?').run(
        newUsernameRaw,
        hashPassword(newPassword),
        s.user_id
      );
    } else {
      db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, is_active = 1 WHERE id = ?').run(
        hashPassword(newPassword),
        s.user_id
      );
    }
    loginAttempts.clear();
    logAudit(req.user, 'STAFF_PASSWORD_RESET', 'STAFF', s.staff_code, `Password reset for ${s.full_name}`);
  });
  res.json({ ok: true });
});

app.patch('/api/staff/:id', requireRoles(['OWNER', 'ADMIN']), (req, res) => {
  const s = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
  if (!s) throw new HttpError(404, 'Staff not found.');
  const b = req.body || {};
  const full_name = b.full_name !== undefined ? requireText(b.full_name, 'Name', { max: 100 }) : s.full_name;
  const phone = b.phone !== undefined ? validateMobile(b.phone) : s.phone;
  const areas = b.assigned_areas !== undefined ? optText(b.assigned_areas, 200) : s.assigned_areas;
  const target = b.daily_target !== undefined ? requireInt(b.daily_target, 'Daily target', { min: 0 }) : s.daily_target;
  const attendance = ['PRESENT', 'ABSENT', 'LEAVE'].includes(b.attendance_status) ? b.attendance_status : s.attendance_status;
  const active = b.is_active !== undefined ? (b.is_active ? 1 : 0) : s.is_active;
  runInTransaction(() => {
    db.prepare('UPDATE staff SET full_name=?, phone=?, assigned_areas=?, daily_target=?, attendance_status=?, is_active=? WHERE id=?').run(
      full_name, phone, areas, target, attendance, active, s.id
    );
    if (s.user_id) {
      db.prepare('UPDATE users SET full_name=?, phone=?, is_active=? WHERE id=?').run(full_name, phone, active, s.user_id);
      if (!active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(s.user_id);
    }
    logAudit(req.user, 'STAFF_UPDATED', 'STAFF', s.staff_code, `Updated ${full_name}`);
  });
  res.json({ ok: true });
});

// =============================================================================
// Cash book, expenses, ledger
// =============================================================================
app.get('/api/cashbook', requireRoles(['OWNER', 'ADMIN']), (req, res) => {
  const from = isValidDate(req.query.from) ? req.query.from : '2000-01-01';
  const to = isValidDate(req.query.to) ? req.query.to : '2999-12-31';
  const transactions = db
    .prepare(
      `SELECT ct.*, u.full_name AS recorded_by_name FROM cash_transactions ct LEFT JOIN users u ON u.id = ct.recorded_by
       WHERE ct.txn_date BETWEEN ? AND ? ORDER BY ct.txn_date DESC, ct.created_at DESC`
    )
    .all(from, to);
  const s = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN payment_mode='CASH' AND direction='INFLOW' THEN amount END),0) AS cash_in,
         COALESCE(SUM(CASE WHEN payment_mode='CASH' AND direction='OUTFLOW' THEN amount END),0) AS cash_out,
         COALESCE(SUM(CASE WHEN payment_mode!='CASH' AND direction='INFLOW' THEN amount END),0) AS bank_in,
         COALESCE(SUM(CASE WHEN payment_mode!='CASH' AND direction='OUTFLOW' THEN amount END),0) AS bank_out
       FROM cash_transactions`
    )
    .get();
  res.json({
    summary: { ...s, cashInHand: s.cash_in - s.cash_out, bankBalance: s.bank_in - s.bank_out },
    transactions,
  });
});

app.post('/api/cashbook/capital', requireRoles(['OWNER']), (req, res) => {
  const b = req.body || {};
  const amount = requireInt(b.amount, 'Amount', { min: 1, max: 1000000000 });
  const mode = MODES.includes(b.payment_mode) ? b.payment_mode : 'CASH';
  const description = optText(b.description, 150) || 'Owner capital added';
  const direction = b.direction === 'OUTFLOW' ? 'OUTFLOW' : 'INFLOW';
  runInTransaction(() => {
    const ref = `CP${nextSeq('capital', 101)}`;
    const date = todayISO();
    insertCash({
      branchId: 'BR-01', date, direction, category: direction === 'INFLOW' ? 'CAPITAL_IN' : 'CAPITAL_WITHDRAWAL',
      mode, amount, reference: ref, description, userId: req.user.id,
    });
    insertLedger(
      direction === 'INFLOW'
        ? [
            { head: 'Cash & Bank', type: 'ASSET', debit: amount, narration: description },
            { head: 'Owner Capital', type: 'EQUITY', credit: amount, narration: description },
          ]
        : [
            { head: 'Owner Capital', type: 'EQUITY', debit: amount, narration: description },
            { head: 'Cash & Bank', type: 'ASSET', credit: amount, narration: description },
          ],
      { branchId: 'BR-01', date, refType: 'CAPITAL', refCode: ref }
    );
    logAudit(req.user, direction === 'INFLOW' ? 'CAPITAL_ADDED' : 'CAPITAL_WITHDRAWN', 'CASHBOOK', ref, `₹${amount} ${mode}: ${description}`);
  });
  res.status(201).json({ ok: true });
});

app.post('/api/expenses', requireRoles(['OWNER', 'ADMIN']), (req, res) => {
  const b = req.body || {};
  const category = requireText(b.category, 'Category', { max: 60 });
  const description = requireText(b.description, 'Description', { max: 200 });
  const amount = requireInt(b.amount, 'Amount', { min: 1, max: 10000000 });
  const mode = MODES.includes(b.payment_mode) ? b.payment_mode : 'CASH';
  runInTransaction(() => {
    const voucher = `V${nextSeq('voucher', 1001)}`;
    const date = todayISO();
    db.prepare(
      `INSERT INTO expenses (id, voucher_number, branch_id, category, description, amount, payment_mode, expense_date, recorded_by, created_at)
       VALUES (?, ?, 'BR-01', ?, ?, ?, ?, ?, ?, ?)`
    ).run(uid('EXP'), voucher, category, description, amount, mode, date, req.user.id, nowIST());
    insertCash({ branchId: 'BR-01', date, direction: 'OUTFLOW', category: 'EXPENSE', mode, amount, reference: voucher, description: `${category}: ${description}`, userId: req.user.id });
    insertLedger(
      [
        { head: 'Operating Expenses', type: 'EXPENSE', debit: amount, narration: `${category}: ${description}` },
        { head: 'Cash & Bank', type: 'ASSET', credit: amount, narration: `Voucher ${voucher}` },
      ],
      { branchId: 'BR-01', date, refType: 'EXPENSE', refCode: voucher }
    );
    logAudit(req.user, 'EXPENSE_RECORDED', 'EXPENSE', voucher, `₹${amount} ${category}`);
  });
  res.status(201).json({ ok: true });
});

app.get('/api/ledger', requireRoles(['OWNER']), (_req, res) => {
  const entries = db.prepare('SELECT * FROM accounting_ledger ORDER BY entry_date DESC, created_at DESC LIMIT 1000').all();
  const totals = db
    .prepare(
      `SELECT COALESCE(SUM(debit),0) AS total_debit, COALESCE(SUM(credit),0) AS total_credit,
              COALESCE(SUM(CASE WHEN account_type='INCOME' THEN credit - debit END),0) AS income,
              COALESCE(SUM(CASE WHEN account_type='EXPENSE' THEN debit - credit END),0) AS expenses
       FROM accounting_ledger`
    )
    .get();
  const balances = db
    .prepare('SELECT account_head, account_type, SUM(debit) AS debit, SUM(credit) AS credit FROM accounting_ledger GROUP BY account_head, account_type ORDER BY account_type, account_head')
    .all();
  res.json({ entries, balances, summary: { ...totals, profit: totals.income - totals.expenses } });
});

// =============================================================================
// Reports
// =============================================================================
const OWNER_ONLY_REPORTS = ['income-expense', 'cash-flow'];

app.get('/api/reports/:type', requireRoles(['OWNER', 'ADMIN']), (req, res) => {
  const type = req.params.type;
  if (OWNER_ONLY_REPORTS.includes(type) && req.user.role_code !== 'OWNER') throw new HttpError(403, 'This report is visible to the owner only.');
  const from = isValidDate(req.query.from) ? req.query.from : todayISO().slice(0, 8) + '01';
  const to = isValidDate(req.query.to) ? req.query.to : todayISO();
  const all = (sql, ...p) => db.prepare(sql).all(...p);
  let rows = [];

  switch (type) {
    case 'daily-collection':
      rows = all(
        `SELECT p.payment_date AS date, p.receipt_number AS receipt, c.full_name AS customer, c.area, l.loan_number AS loan,
                p.payment_mode AS mode, p.amount_collected AS amount, s.full_name AS collected_by
         FROM payments p JOIN customers c ON c.id=p.customer_id JOIN loans l ON l.id=p.loan_id LEFT JOIN staff s ON s.id=p.collected_by_staff_id
         WHERE p.status='POSTED' AND p.payment_date BETWEEN ? AND ? ORDER BY p.payment_date DESC, p.collected_at DESC`,
        from, to
      );
      break;
    case 'monthly-collection':
      rows = all(
        `SELECT substr(payment_date,1,7) AS month, COUNT(*) AS receipts,
                SUM(CASE WHEN payment_mode='CASH' THEN amount_collected ELSE 0 END) AS cash,
                SUM(CASE WHEN payment_mode!='CASH' THEN amount_collected ELSE 0 END) AS upi_bank,
                SUM(amount_collected) AS total
         FROM payments WHERE status='POSTED' AND payment_date BETWEEN ? AND ? GROUP BY month ORDER BY month DESC`,
        from, to
      );
      break;
    case 'outstanding':
      rows = all(
        `SELECT c.full_name AS customer, c.mobile, c.area, l.loan_number AS loan, l.total_contractual_amount AS total_repayment,
                l.amount_collected AS paid, l.outstanding_balance AS balance, l.status
         FROM loans l JOIN customers c ON c.id=l.customer_id WHERE l.status IN ('ACTIVE','OVERDUE') ORDER BY l.outstanding_balance DESC`
      );
      break;
    case 'overdue':
      rows = all(
        `SELECT c.full_name AS customer, c.mobile, c.area, l.loan_number AS loan, s.full_name AS collector,
                COUNT(rs.id) AS missed_installments, MIN(rs.due_date) AS oldest_due, SUM(rs.balance_amount) AS overdue_amount
         FROM repayment_schedules rs JOIN loans l ON l.id=rs.loan_id JOIN customers c ON c.id=l.customer_id LEFT JOIN staff s ON s.id=l.assigned_staff_id
         WHERE rs.due_date < ? AND rs.balance_amount > 0 AND l.status IN ('ACTIVE','OVERDUE')
         GROUP BY l.id ORDER BY overdue_amount DESC`,
        todayISO()
      );
      break;
    case 'disbursement':
      rows = all(
        `SELECT l.start_date AS date, l.loan_number AS loan, c.full_name AS customer, l.loan_type AS type, l.principal_amount AS principal,
                l.disclosed_charge_amount AS charges, l.settled_previous_loan_amount AS old_balance_adjusted, l.actual_cash_payout AS cash_given,
                l.apr_percent AS apr
         FROM loans l JOIN customers c ON c.id=l.customer_id WHERE l.start_date BETWEEN ? AND ? ORDER BY l.start_date DESC`,
        from, to
      );
      break;
    case 'renewals':
      rows = all(
        `SELECT r.renewal_date AS date, r.renewal_code AS renewal, c.full_name AS customer, o.loan_number AS old_loan, r.old_loan_paid AS old_paid,
                r.old_loan_settled_balance AS old_balance_adjusted, n.loan_number AS new_loan, r.new_loan_principal AS new_principal,
                r.new_disclosed_charges AS new_charges, r.net_additional_disbursement AS cash_given
         FROM renewals r JOIN customers c ON c.id=r.customer_id JOIN loans o ON o.id=r.old_loan_id JOIN loans n ON n.id=r.new_loan_id
         WHERE r.renewal_date BETWEEN ? AND ? ORDER BY r.renewal_date DESC`,
        from, to
      );
      break;
    case 'staff-performance':
      rows = all(
        `SELECT s.staff_code AS code, s.full_name AS staff, s.assigned_areas AS areas, s.daily_target AS daily_target,
                (SELECT COUNT(*) FROM payments p WHERE p.collected_by_staff_id=s.id AND p.status='POSTED' AND p.payment_date BETWEEN ? AND ?) AS receipts,
                COALESCE((SELECT SUM(amount_collected) FROM payments p WHERE p.collected_by_staff_id=s.id AND p.status='POSTED' AND p.payment_date BETWEEN ? AND ?),0) AS collected
         FROM staff s ORDER BY collected DESC`,
        from, to, from, to
      );
      break;
    case 'cash-book':
      rows = all(
        `SELECT txn_date AS date, txn_code AS entry, category, payment_mode AS mode,
                CASE WHEN direction='INFLOW' THEN amount ELSE 0 END AS money_in,
                CASE WHEN direction='OUTFLOW' THEN amount ELSE 0 END AS money_out, description
         FROM cash_transactions WHERE txn_date BETWEEN ? AND ? ORDER BY txn_date DESC, created_at DESC`,
        from, to
      );
      break;
    case 'cash-flow':
      rows = all(
        `SELECT direction, category, payment_mode AS mode, SUM(amount) AS amount FROM cash_transactions
         WHERE txn_date BETWEEN ? AND ? GROUP BY direction, category, payment_mode ORDER BY direction, category`,
        from, to
      );
      break;
    case 'income-expense':
      rows = all(
        `SELECT entry_date AS date, reference_code AS reference, account_type AS type, account_head AS head,
                CASE WHEN account_type='INCOME' THEN credit - debit ELSE -(debit - credit) END AS amount, narration
         FROM accounting_ledger WHERE account_type IN ('INCOME','EXPENSE') AND entry_date BETWEEN ? AND ? ORDER BY entry_date DESC`,
        from, to
      );
      break;
    case 'reversals':
      rows = all(
        `SELECT p.payment_date AS paid_on, p.receipt_number AS receipt, c.full_name AS customer, p.amount_collected AS amount,
                p.reversed_at, u.full_name AS cancelled_by, p.reversal_reason AS reason
         FROM payments p JOIN customers c ON c.id=p.customer_id LEFT JOIN users u ON u.id=p.reversed_by
         WHERE p.status='REVERSED' AND p.payment_date BETWEEN ? AND ? ORDER BY p.reversed_at DESC`,
        from, to
      );
      break;
    default:
      throw new HttpError(400, 'Unknown report.');
  }
  res.json({ type, from, to, rows });
});

// =============================================================================
// Audit & backup
// =============================================================================
app.get('/api/audit-logs', requireRoles(['OWNER']), (_req, res) => {
  res.json({ logs: db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 300').all() });
});

app.get('/api/system/backup', requireRoles(['OWNER']), (req, res) => {
  const dir = path.join(DATA_DIR, 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `kaviniya_backup_${nowIST().replace(/[: ]/g, '-')}.db`);
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  logAudit(req.user, 'BACKUP_CREATED', 'SYSTEM', path.basename(file), 'Database backup downloaded');
  res.download(file, path.basename(file));
});

// =============================================================================
// Errors, static frontend, start
// =============================================================================
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request.' });
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Something went wrong. Nothing was saved. Please try again.' });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_PATH = path.join(__dirname, '..', 'dist');
app.use(express.static(DIST_PATH));
app.get('*', (_req, res) => res.sendFile(path.join(DIST_PATH, 'index.html')));

const PORT = process.env.PORT || 4000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`[KAVINIYA FINANCE] Running on http://localhost:${PORT}`));
}
