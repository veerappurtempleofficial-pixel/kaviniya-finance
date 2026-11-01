# KAVINIYA FINANCE (கவினியா பைனான்ஸ்)
## Enterprise Daily Finance Management ERP

Production-oriented daily loan collection, loan renewal, and double-entry financial management platform with bilingual **English** and **Tamil (`தமிழ்`)** localization.

---

## 1. Architecture & Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS (`#14283F` Deep Navy, `#244B70` Professional Blue, `#F7F8FA` Warm White, `#188A78` Restrained Teal, `#B78727` Muted Gold, `Inter` & `Noto Sans Tamil` with `tabular-nums` alignment).
- **Backend API**: Node.js + Express REST API (`server/index.js`) with Role-Based Access Control (`OWNER`, `ADMIN`, `COLLECTION_STAFF`), scrypt password hashing, idempotency protection, and atomic SQL transactions.
- **Relational Database**:
  - **Local Zero-Config Persistence**: Built-in `node:sqlite` (`data/kaviniya_finance.db`) with `PRAGMA foreign_keys = ON` and WAL mode.
  - **Production PostgreSQL DDL**: Full PostgreSQL schema migration included at `migrations/001_postgresql_schema.sql`.

---

## 2. Quick Start Instructions

```powershell
cd C:\Users\Tendulkar\.gemini\antigravity\scratch\kaviniya-finance

# 1. Install dependencies
npm.cmd install

# 2. Run automated accounting & ERP verification tests
npm.cmd test

# 3. Start full-stack ERP (Backend API on :4000 + Vite Frontend on :5173)
npm.cmd run dev
```

### Demo Operator Credentials (or use the 1-Click Role Switcher in the Top Bar)
| Role | Username | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **OWNER** | `owner` | `Owner@123` | Full ERP, P&L, General Ledger, Renewals, Settings, DB Backup |
| **ADMIN** | `admin` | `Admin@123` | Customers, Loans, Collections, Renewals, Operational Reports |
| **COLLECTION STAFF** | `murugan` | `Staff@123` | Assigned Route Customers, Daily Collection Entry, Receipts |

---

## 3. Pre-Production Legal, Financial, Security & Operational Checklist

1. **RBI & Tamil Nadu Money Lenders Act Verification**: Validate all loan product interest rates, upfront fee disclosures, and Key Fact Statements (KFS) with qualified legal counsel against applicable RBI Fair Practices Code and State Money Lenders Act provisions before live lending.
2. **KYC & DPDP Act Data Protection**: Store only masked Aadhaar numbers (`XXXX-XXXX-1234`) or legally permitted OVDs, encrypt backups at rest, and enforce TLS 1.3 in production.
3. **Chartered Accountant (CA) Ledger Sign-Off**: Review fee recognition timing and renewal netting entries with your statutory auditor.
