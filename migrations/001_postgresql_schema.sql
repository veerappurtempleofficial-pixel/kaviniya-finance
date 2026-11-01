-- =============================================================================
-- KAVINIYA FINANCE — Enterprise Daily Finance Management ERP
-- Production PostgreSQL DDL Schema (Migration 001)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS branches (
  id VARCHAR(36) PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  name_ta VARCHAR(120) NOT NULL,
  city VARCHAR(80) NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(25) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(36) PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL, -- OWNER, ADMIN, COLLECTION_STAFF
  name VARCHAR(80) NOT NULL,
  permissions_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(60) UNIQUE NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  full_name_ta VARCHAR(120),
  email VARCHAR(120) UNIQUE NOT NULL,
  phone VARCHAR(25) NOT NULL,
  password_hash TEXT NOT NULL,
  role_code VARCHAR(30) NOT NULL REFERENCES roles(code),
  branch_id VARCHAR(36) REFERENCES branches(id),
  staff_id VARCHAR(36),
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff (
  id VARCHAR(36) PRIMARY KEY,
  staff_code VARCHAR(30) UNIQUE NOT NULL,
  user_id VARCHAR(36) UNIQUE REFERENCES users(id),
  full_name VARCHAR(120) NOT NULL,
  full_name_ta VARCHAR(120),
  phone VARCHAR(25) NOT NULL,
  branch_id VARCHAR(36) NOT NULL REFERENCES branches(id),
  assigned_areas TEXT NOT NULL,
  daily_target NUMERIC(12, 2) NOT NULL DEFAULT 10000.00,
  attendance_status VARCHAR(30) NOT NULL DEFAULT 'PRESENT',
  joining_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(36) PRIMARY KEY,
  customer_code VARCHAR(30) UNIQUE NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  full_name_ta VARCHAR(120),
  business_name VARCHAR(140),
  mobile VARCHAR(20) NOT NULL,
  alt_mobile VARCHAR(20),
  address TEXT NOT NULL,
  area VARCHAR(80) NOT NULL,
  branch_id VARCHAR(36) NOT NULL REFERENCES branches(id),
  assigned_staff_id VARCHAR(36) REFERENCES staff(id),
  photo_url TEXT,
  id_proof_type VARCHAR(50) NOT NULL,
  id_proof_number VARCHAR(60) NOT NULL,
  registration_date DATE NOT NULL,
  notes TEXT,
  status VARCHAR(25) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, WATCHLIST
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_area ON customers(area);
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);
CREATE INDEX IF NOT EXISTS idx_customers_staff ON customers(assigned_staff_id);

CREATE TABLE IF NOT EXISTS loan_products (
  id VARCHAR(36) PRIMARY KEY,
  product_code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  name_ta VARCHAR(120) NOT NULL,
  default_principal NUMERIC(12, 2) NOT NULL,
  upfront_charge_percent NUMERIC(5, 2) NOT NULL,
  addon_interest_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  tenure_days INTEGER NOT NULL,
  collection_frequency VARCHAR(20) NOT NULL DEFAULT 'DAILY',
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS loans (
  id VARCHAR(36) PRIMARY KEY,
  loan_number VARCHAR(40) UNIQUE NOT NULL,
  customer_id VARCHAR(36) NOT NULL REFERENCES customers(id),
  branch_id VARCHAR(36) NOT NULL REFERENCES branches(id),
  product_id VARCHAR(36) REFERENCES loan_products(id),
  assigned_staff_id VARCHAR(36) REFERENCES staff(id),
  principal_amount NUMERIC(12, 2) NOT NULL,
  disclosed_charge_amount NUMERIC(12, 2) NOT NULL,
  net_disbursed_amount NUMERIC(12, 2) NOT NULL,
  settled_previous_loan_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  actual_cash_payout NUMERIC(12, 2) NOT NULL,
  total_contractual_amount NUMERIC(12, 2) NOT NULL,
  daily_installment NUMERIC(12, 2) NOT NULL,
  total_installments INTEGER NOT NULL,
  paid_installments INTEGER NOT NULL DEFAULT 0,
  amount_collected NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  outstanding_balance NUMERIC(12, 2) NOT NULL,
  start_date DATE NOT NULL,
  maturity_date DATE NOT NULL,
  disbursement_mode VARCHAR(30) NOT NULL DEFAULT 'CASH',
  agreement_reference VARCHAR(60) NOT NULL,
  parent_loan_id VARCHAR(36) REFERENCES loans(id),
  renewed_to_loan_id VARCHAR(36),
  loan_type VARCHAR(25) NOT NULL DEFAULT 'NEW', -- NEW, RENEWAL
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, RENEWED_CLOSED, OVERDUE
  created_by VARCHAR(36) REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loans_customer ON loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);

CREATE TABLE IF NOT EXISTS repayment_schedules (
  id VARCHAR(36) PRIMARY KEY,
  loan_id VARCHAR(36) NOT NULL REFERENCES loans(id),
  installment_no INTEGER NOT NULL,
  due_date DATE NOT NULL,
  scheduled_amount NUMERIC(12, 2) NOT NULL,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  balance_amount NUMERIC(12, 2) NOT NULL,
  status VARCHAR(25) NOT NULL DEFAULT 'PENDING', -- PAID, PARTIAL, PENDING, OVERDUE, SETTLED_ON_RENEWAL
  paid_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(loan_id, installment_no)
);

CREATE INDEX IF NOT EXISTS idx_schedule_loan_due ON repayment_schedules(loan_id, due_date);

CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(36) PRIMARY KEY,
  transaction_id VARCHAR(50) UNIQUE NOT NULL,
  idempotency_key VARCHAR(80) UNIQUE NOT NULL,
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  loan_id VARCHAR(36) NOT NULL REFERENCES loans(id),
  customer_id VARCHAR(36) NOT NULL REFERENCES customers(id),
  branch_id VARCHAR(36) NOT NULL REFERENCES branches(id),
  collected_by_staff_id VARCHAR(36) REFERENCES staff(id),
  recorded_by_user_id VARCHAR(36) REFERENCES users(id),
  payment_date DATE NOT NULL,
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  amount_due_today NUMERIC(12, 2) NOT NULL,
  amount_collected NUMERIC(12, 2) NOT NULL,
  principal_component NUMERIC(12, 2) NOT NULL,
  income_component NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_type VARCHAR(30) NOT NULL, -- REGULAR, PARTIAL, ADVANCE, ARREARS_RECOVERY
  payment_mode VARCHAR(30) NOT NULL, -- CASH, UPI, BANK_TRANSFER
  balance_after_payment NUMERIC(12, 2) NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS receipts (
  id VARCHAR(36) PRIMARY KEY,
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  payment_id VARCHAR(36) UNIQUE NOT NULL REFERENCES payments(id),
  customer_id VARCHAR(36) NOT NULL REFERENCES customers(id),
  loan_id VARCHAR(36) NOT NULL REFERENCES loans(id),
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  printed_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS loan_settlements (
  id VARCHAR(36) PRIMARY KEY,
  settlement_code VARCHAR(40) UNIQUE NOT NULL,
  old_loan_id VARCHAR(36) NOT NULL REFERENCES loans(id),
  new_loan_id VARCHAR(36) REFERENCES loans(id),
  customer_id VARCHAR(36) NOT NULL REFERENCES customers(id),
  settlement_type VARCHAR(35) NOT NULL, -- RENEWAL_NETTING, CASH_FORECLOSURE
  unpaid_scheduled_balance NUMERIC(12, 2) NOT NULL,
  settled_amount NUMERIC(12, 2) NOT NULL,
  waiver_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  settled_date DATE NOT NULL,
  approved_by VARCHAR(36) REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS renewals (
  id VARCHAR(36) PRIMARY KEY,
  renewal_code VARCHAR(40) UNIQUE NOT NULL,
  customer_id VARCHAR(36) NOT NULL REFERENCES customers(id),
  old_loan_id VARCHAR(36) NOT NULL REFERENCES loans(id),
  new_loan_id VARCHAR(36) NOT NULL REFERENCES loans(id),
  settlement_id VARCHAR(36) NOT NULL REFERENCES loan_settlements(id),
  old_loan_principal NUMERIC(12, 2) NOT NULL,
  old_loan_paid NUMERIC(12, 2) NOT NULL,
  old_loan_settled_balance NUMERIC(12, 2) NOT NULL,
  new_loan_principal NUMERIC(12, 2) NOT NULL,
  new_disclosed_charges NUMERIC(12, 2) NOT NULL,
  net_additional_disbursement NUMERIC(12, 2) NOT NULL,
  customer_consent_verified BOOLEAN NOT NULL DEFAULT TRUE,
  consent_reference VARCHAR(80) NOT NULL,
  renewal_date DATE NOT NULL,
  approved_by_user_id VARCHAR(36) NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(36) PRIMARY KEY,
  voucher_number VARCHAR(40) UNIQUE NOT NULL,
  branch_id VARCHAR(36) NOT NULL REFERENCES branches(id),
  category VARCHAR(60) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  payment_mode VARCHAR(30) NOT NULL,
  expense_date DATE NOT NULL,
  recorded_by VARCHAR(36) REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cash_transactions (
  id VARCHAR(36) PRIMARY KEY,
  txn_code VARCHAR(40) UNIQUE NOT NULL,
  branch_id VARCHAR(36) NOT NULL REFERENCES branches(id),
  txn_date DATE NOT NULL,
  direction VARCHAR(15) NOT NULL, -- INFLOW, OUTFLOW
  category VARCHAR(50) NOT NULL, -- CAPITAL_INFUSION, LOAN_DISBURSEMENT, RENEWAL_NET_PAYOUT, DAILY_COLLECTION, OPERATING_EXPENSE
  payment_mode VARCHAR(30) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  reference_id VARCHAR(60),
  description TEXT NOT NULL,
  recorded_by VARCHAR(36) REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounting_ledger (
  id VARCHAR(36) PRIMARY KEY,
  entry_code VARCHAR(40) UNIQUE NOT NULL,
  entry_date DATE NOT NULL,
  branch_id VARCHAR(36) NOT NULL REFERENCES branches(id),
  account_head VARCHAR(80) NOT NULL,
  account_type VARCHAR(30) NOT NULL, -- ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
  debit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  credit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  reference_type VARCHAR(40) NOT NULL, -- LOAN_ORIGINATION, COLLECTION, LOAN_RENEWAL, EXPENSE, CAPITAL
  reference_code VARCHAR(60) NOT NULL,
  narration TEXT NOT NULL,
  is_non_cash_settlement BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  user_name VARCHAR(120) NOT NULL,
  role_code VARCHAR(30) NOT NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(60) NOT NULL,
  summary TEXT NOT NULL,
  metadata_json TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(60) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
