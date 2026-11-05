import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  IndianRupee,
  Users,
  Briefcase,
  RefreshCw,
  Wallet,
  FileSpreadsheet,
  UserCheck,
  Search,
  Plus,
  Smartphone,
  Languages,
  LogOut,
  X,
  UserPlus,
  BookOpen,
  Settings,
  Download,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Lock,
  Trash2,
  Percent,
} from 'lucide-react';
import { formatINR, Lang } from './i18n';
import { ReceiptModal } from './components/ReceiptModal';
import { RenewalEngineView } from './components/RenewalEngineView';
import {
  FinancialReportsView,
  CashBookAndExpensesView,
  AccountingLedgerView,
} from './components/ReportsAndLedgerView';
import { MobileFieldApp } from './components/MobileFieldApp';
import { MonthlyInterestView } from './components/MonthlyInterestView';

type ModuleKey =
  | 'dashboard'
  | 'collections'
  | 'customers'
  | 'loans'
  | 'monthly_loans'
  | 'renewals'
  | 'cashbook'
  | 'ledger'
  | 'reports'
  | 'staff'
  | 'settings';

type ThemeKey = 'emerald' | 'violet' | 'luxury' | 'dark';

const THEMES: { id: ThemeKey; name: string; nameTa: string; dot: string }[] = [
  { id: 'emerald', name: 'Emerald Fintech', nameTa: 'பச்சை (Emerald)', dot: '#10B981' },
  { id: 'violet', name: 'Royal Violet', nameTa: 'வயலட் (Violet)', dot: '#8B5CF6' },
  { id: 'luxury', name: 'Luxury Gold', nameTa: 'கோல்டு (Gold)', dot: '#F59E0B' },
  { id: 'dark', name: 'Dark Mode', nameTa: 'டார்க் (Dark)', dot: '#38BDF8' },
];

export function App() {
  const [lang, setLang] = useState<Lang>('ta');
  const [theme, setTheme] = useState<ThemeKey>(
    () => (localStorage.getItem('kaviniya_theme') as ThemeKey) || 'emerald'
  );
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [mobilePreview, setMobilePreview] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('kaviniya_theme', theme);
  }, [theme]);

  // Real Session Auth State
  const [token, setToken] = useState<string>(() => localStorage.getItem('kaviniya_token') || '');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const showToast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Core Data
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [collectionItems, setCollectionItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loanProducts, setLoanProducts] = useState<any[]>([]);
  const [renewals, setRenewals] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>({});
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Active Modals
  const [activeReceipt, setActiveReceipt] = useState<any>(null);
  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<any>(null);
  const [selectedLoanDetails, setSelectedLoanDetails] = useState<any>(null);
  const [renewalPreselectedLoanId, setRenewalPreselectedLoanId] = useState<string>('');

  // Search & Inline Collection State
  const [collectionSearch, setCollectionSearch] = useState('');
  const [collectionFilter, setCollectionFilter] = useState<'ALL' | 'OVERDUE' | 'PENDING_TODAY'>('ALL');
  const [inlineAmounts, setInlineAmounts] = useState<Record<string, number>>({});
  const [inlineModes, setInlineModes] = useState<Record<string, string>>({});
  const [inlineIdemKeys, setInlineIdemKeys] = useState<Record<string, string>>({});
  const [collectingLoanId, setCollectingLoanId] = useState<string | null>(null);
  const [missedModal, setMissedModal] = useState<{
    loan_id: string;
    customer_name: string;
    loan_number: string;
    reason: string;
  } | null>(null);

  // Customer Create / Edit Modal
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState({
    full_name: '',
    mobile: '',
    area: '',
    address: '',
    assigned_staff_id: '',
    id_proof_type: 'Aadhaar',
    id_proof_number: '',
    status: 'ACTIVE',
  });

  // New Loan Modal
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
  const [newLoanForm, setNewLoanForm] = useState({
    customer_id: '',
    product_id: 'PRD-100D',
    principal_amount: 10000,
    upfront_charge_amount: 1500,
    addon_interest_amount: 0,
    total_installments: 100,
    disbursement_mode: 'CASH',
    assigned_staff_id: '',
  });
  const [loanPreview, setLoanPreview] = useState<any>(null);

  // Staff Create & Password Reset Modals
  const [showNewStaffModal, setShowNewStaffModal] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    full_name: '',
    phone: '',
    assigned_areas: '',
    daily_target: 5000,
    username: '',
    password: '',
  });
  const [resetStaffModal, setResetStaffModal] = useState<{
    id: string;
    full_name: string;
    username: string;
    password: string;
  } | null>(null);

  // Change Password Form in Settings
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });

  const authHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Cloud-Token': localStorage.getItem('kf_cloud_token') || '',
    }),
    [token]
  );

  // Verify existing session token on mount
  useEffect(() => {
    if (!token) {
      setAuthChecking(false);
      return;
    }
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('Invalid session');
        const d = await r.json();
        setCurrentUser(d.user);
        if (d.user?.role_code === 'COLLECTION_STAFF' && window.innerWidth < 768) {
          setMobilePreview(true);
        }
      })
      .catch(() => {
        localStorage.removeItem('kaviniya_token');
        setToken('');
        setCurrentUser(null);
      })
      .finally(() => setAuthChecking(false));
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('kaviniya_token', data.token);
      setToken(data.token);
      setCurrentUser(data.user);
      setLoginPassword('');
      if (data.user.role_code === 'COLLECTION_STAFF') {
        setActiveModule('collections');
      }
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() });
    } catch (_) {}
    localStorage.removeItem('kaviniya_token');
    setToken('');
    setCurrentUser(null);
  };

  const loadAllData = useCallback(async () => {
    if (!token || !currentUser) return;
    const headers = { Authorization: `Bearer ${token}` };
    const isStaff = currentUser.role_code === 'COLLECTION_STAFF';

    try {
      const [dashRes, colRes, custRes, loansRes, prodRes, setRes] = await Promise.all([
        fetch('/api/dashboard', { headers }),
        fetch(`/api/collections/today?search=${encodeURIComponent(collectionSearch)}`, { headers }),
        fetch(`/api/customers?search=${encodeURIComponent(customerSearch)}`, { headers }),
        fetch('/api/loans', { headers }),
        fetch('/api/loan-products', { headers }),
        fetch('/api/settings', { headers }),
      ]);

      if (dashRes.ok) setDashboardData(await dashRes.json());
      if (colRes.ok) setCollectionItems((await colRes.json()).items || []);
      if (custRes.ok) setCustomers((await custRes.json()).customers || []);
      if (loansRes.ok) setLoans((await loansRes.json()).loans || []);
      if (prodRes.ok) setLoanProducts((await prodRes.json()).products || []);
      if (setRes.ok) setCompanySettings((await setRes.json()).settings || {});

      if (!isStaff) {
        const [renRes, stfRes] = await Promise.all([
          fetch('/api/renewals', { headers }),
          fetch('/api/staff', { headers }),
        ]);
        if (renRes.ok) setRenewals((await renRes.json()).renewals || []);
        if (stfRes.ok) setStaffList((await stfRes.json()).staff || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    }
  }, [token, currentUser, collectionSearch, customerSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAllData();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadAllData]);

  useEffect(() => {
    if (activeModule === 'settings' && currentUser?.role_code === 'OWNER' && token) {
      fetch('/api/audit-logs', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setAuditLogs(d.logs || []))
        .catch(() => {});
    }
  }, [activeModule, currentUser, token]);

  useEffect(() => {
    if (!newLoanForm.customer_id && customers.length > 0) {
      setNewLoanForm((prev) => ({
        ...prev,
        customer_id: customers[0].id,
        assigned_staff_id: customers[0].assigned_staff_id || '',
      }));
    }
  }, [customers, newLoanForm.customer_id]);

  // Live Loan Preview
  useEffect(() => {
    if (!token) return;
    fetch('/api/loans/preview', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(newLoanForm),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.preview) setLoanPreview(d.preview);
      })
      .catch(() => {});
  }, [newLoanForm, token, authHeaders]);

  const getOrCreateIdemKey = (loanId: string) => {
    if (inlineIdemKeys[loanId]) return inlineIdemKeys[loanId];
    const k = `PAY-${loanId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setInlineIdemKeys((prev) => ({ ...prev, [loanId]: k }));
    return k;
  };

  const handleCollectPayment = async (loanId: string, amount: number, mode: string) => {
    setCollectingLoanId(loanId);
    const idemKey = getOrCreateIdemKey(loanId);
    try {
      const res = await fetch('/api/collections/pay', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          loan_id: loanId,
          amount_collected: Math.round(Number(amount)),
          payment_mode: mode,
          idempotency_key: idemKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Payment failed', 'err');
        return;
      }
      // Clear idempotency key only after confirmed success so a retry reuses the same key
      setInlineIdemKeys((prev) => {
        const next = { ...prev };
        delete next[loanId];
        return next;
      });
      setActiveReceipt(data.payment);
      showToast(`வசூல் பதிவானது: ${data.payment.receipt_number}`);
      await loadAllData();
    } finally {
      setCollectingLoanId(null);
    }
  };

  const handleMarkMissed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!missedModal) return;
    const res = await fetch('/api/collections/missed', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        loan_id: missedModal.loan_id,
        reason: missedModal.reason,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to record missed payment', 'err');
      return;
    }
    showToast(`${missedModal.customer_name} — இன்று கட்டவில்லை எனப் பதிவானது`);
    setMissedModal(null);
    await loadAllData();
  };

  const handleReversePayment = async (paymentId: string, reason: string) => {
    const res = await fetch(`/api/payments/${paymentId}/reverse`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to cancel receipt', 'err');
      return;
    }
    showToast('ரசீது ரத்து செய்யப்பட்டு கணக்கு நேர்செய்யப்பட்டது.');
    await loadAllData();
  };

  const handleOpenReceiptByNumber = async (receiptNumber: string) => {
    const res = await fetch(`/api/receipts/${receiptNumber}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setActiveReceipt(data.receipt);
    }
  };

  const handleOpenCustomerProfile = async (customerId: string) => {
    const res = await fetch(`/api/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setSelectedCustomerProfile(await res.json());
    }
  };

  const openNewCustomerModal = () => {
    setEditingCustomerId(null);
    setCustomerForm({
      full_name: '',
      mobile: '',
      area: '',
      address: '',
      assigned_staff_id: '',
      id_proof_type: 'Aadhaar',
      id_proof_number: '',
      status: 'ACTIVE',
    });
    setShowCustomerModal(true);
  };

  const openEditCustomerModal = (c: any) => {
    setEditingCustomerId(c.id);
    setCustomerForm({
      full_name: c.full_name || '',
      mobile: c.mobile || '',
      area: c.area || '',
      address: c.address || '',
      assigned_staff_id: c.assigned_staff_id || '',
      id_proof_type: c.id_proof_type || 'Aadhaar',
      id_proof_number: c.id_proof_number || '',
      status: c.status || 'ACTIVE',
    });
    setShowCustomerModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingCustomerId ? `/api/customers/${editingCustomerId}` : '/api/customers';
    const method = editingCustomerId ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify({
        ...customerForm,
        assigned_staff_id: customerForm.assigned_staff_id || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to save customer', 'err');
      return;
    }
    setShowCustomerModal(false);
    showToast(editingCustomerId ? 'வாடிக்கையாளர் விவரம் புதுப்பிக்கப்பட்டது' : 'புதிய வாடிக்கையாளர் சேர்க்கப்பட்டார்');
    await loadAllData();
    if (!editingCustomerId && data.customer?.id) {
      setNewLoanForm((prev) => ({
        ...prev,
        customer_id: data.customer.id,
        assigned_staff_id: data.customer.assigned_staff_id || '',
      }));
    }
  };

  const handleOpenLoanDetails = async (loanId: string) => {
    const res = await fetch(`/api/loans/${loanId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setSelectedLoanDetails(await res.json());
    }
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoanForm.customer_id) {
      showToast('முதலில் வாடிக்கையாளரைத் தேர்ந்தெடுக்கவும்', 'err');
      return;
    }
    const res = await fetch('/api/loans', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        ...newLoanForm,
        assigned_staff_id: newLoanForm.assigned_staff_id || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to create loan', 'err');
      return;
    }
    setShowNewLoanModal(false);
    showToast(`புதிய கடன் (${data.loan.loan_number}) வழங்கப்பட்டது!`);
    await loadAllData();
  };

  const handleDeleteLoan = async (loan: any) => {
    if (
      !window.confirm(
        `${loan.customer_name} — ${loan.loan_number} (${formatINR(loan.principal_amount)}) கடன் பதிவை நிரந்தரமாக நீக்க விரும்புகிறீர்களா?`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/loans/${loan.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to delete loan', 'err');
      return;
    }
    showToast(`${loan.loan_number} கடன் பதிவு நீக்கப்பட்டது!`);
    await loadAllData();
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(newStaffForm),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to add staff', 'err');
      return;
    }
    setShowNewStaffModal(false);
    setNewStaffForm({
      full_name: '',
      phone: '',
      assigned_areas: '',
      daily_target: 5000,
      username: '',
      password: '',
    });
    showToast('வசூல் பணியாளர் சேர்க்கப்பட்டார்');
    await loadAllData();
  };

  const handleResetStaffPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetStaffModal) return;
    const res = await fetch(`/api/staff/${resetStaffModal.id}/reset-password`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        username: resetStaffModal.username,
        password: resetStaffModal.password,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to reset password', 'err');
      return;
    }
    showToast(`${resetStaffModal.full_name} கடவுச்சொல் மாற்றப்பட்டது!`);
    setResetStaffModal(null);
    await loadAllData();
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(companySettings),
    });
    if (res.ok) {
      showToast('நிறுவன அமைப்புகள் சேமிக்கப்பட்டன');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(pwForm),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Password change failed', 'err');
      return;
    }
    setPwForm({ currentPassword: '', newPassword: '' });
    showToast('கடவுச்சொல் வெற்றிகரமாக மாற்றப்பட்டது');
  };

  const handleDownloadBackup = async () => {
    const res = await fetch('/api/system/backup', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      showToast('Backup failed', 'err');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kaviniya_backup_${new Date().toISOString().slice(0, 10)}.db`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA] text-sm text-slate-600">
        Loading KAVINIYA FINANCE...
      </div>
    );
  }

  // ===========================================================================
  // DEDICATED LOGIN SCREEN (Modern Fintech Portal + Live Theme Switcher)
  // ===========================================================================
  if (!token || !currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center kf-sidebar p-4">
        {/* Live Theme Switcher Pill Bar */}
        <div className="mb-5 bg-black/30 backdrop-blur-md border border-white/15 rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-lg">
          <span className="text-[11px] font-semibold text-white/70 px-2">Theme:</span>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                theme === t.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: t.dot }}
              />
              <span>{t.name}</span>
            </button>
          ))}
        </div>

        <div className="w-full max-w-md bg-white border border-[#D5DCE4] rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-[#14283F] text-white px-7 py-6 border-b border-white/10">
            <div className="flex items-center gap-3.5">
              <div
                className="w-11 h-11 font-extrabold text-lg flex items-center justify-center rounded-xl shadow-md text-slate-950"
                style={{ backgroundColor: 'var(--kf-badge-gold)' }}
              >
                KF
              </div>
              <div>
                <h1 className="text-lg font-extrabold tracking-wide text-white">KAVINIYA FINANCE</h1>
                <p className="text-xs text-white/80 mt-0.5">
                  கவினியா பைனான்ஸ் • Smart Daily Finance ERP
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleLogin} className="p-7 space-y-4 text-sm">
            {loginError && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                பயனர் பெயர் / Username
              </label>
              <input
                type="text"
                required
                autoFocus
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="owner அல்லது staff username"
                className="w-full px-4 py-2.5 border border-[#D5DCE4] rounded-xl focus:outline-none focus:border-[#244B70]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  கடவுச்சொல் / Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="text-xs font-semibold text-[#244B70] hover:underline"
                >
                  {showLoginPassword ? 'மறை (Hide)' : 'கடவுச்சொல் பார் (Show)'}
                </button>
              </div>
              <input
                type={showLoginPassword ? 'text' : 'password'}
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-2.5 border border-[#D5DCE4] rounded-xl focus:outline-none focus:border-[#244B70]"
              />
            </div>

            <button
              type="submit"
              disabled={loginBusy}
              className="w-full py-3 bg-[#244B70] hover:bg-[#14283F] text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <Lock className="w-4 h-4" />
              {loginBusy ? 'Signing in...' : 'உள்நுழைக (Sign In)'}
            </button>

            <div className="pt-3 border-t border-[#E8EDF2] text-xs text-slate-500 flex items-center justify-between">
              <span>
                Owner Login: <strong className="font-mono text-[#14283F]">owner</strong> /{' '}
                <strong className="font-mono text-[#14283F]">Owner@123</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setLoginUsername('owner');
                  setLoginPassword('Owner@123');
                }}
                className="text-[#244B70] font-bold hover:underline"
              >
                Fill Default
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (mobilePreview) {
    return (
      <>
        <MobileFieldApp
          collectionItems={collectionItems}
          recentTransactions={dashboardData?.recentTransactions || []}
          currentUser={currentUser}
          lang={lang}
          onCollectPayment={handleCollectPayment}
          onOpenReceipt={handleOpenReceiptByNumber}
          onExitMobilePreview={() => setMobilePreview(false)}
        />
        {activeReceipt && (
          <ReceiptModal
            receipt={activeReceipt}
            settings={companySettings}
            canReverse={currentUser?.role_code !== 'COLLECTION_STAFF'}
            lang={lang}
            onReversePayment={handleReversePayment}
            onClose={() => setActiveReceipt(null)}
          />
        )}
      </>
    );
  }

  const kpis = dashboardData?.kpis || {};
  const isStaffRole = currentUser?.role_code === 'COLLECTION_STAFF';
  const isOwnerRole = currentUser?.role_code === 'OWNER';

  const menuItems = [
    {
      id: 'dashboard',
      label: lang === 'ta' ? 'முகப்பு (Dashboard)' : 'Dashboard',
      icon: LayoutDashboard,
      allowed: true,
    },
    {
      id: 'collections',
      label: lang === 'ta' ? 'தினசரி வசூல் (Collection)' : 'Daily Collection',
      icon: IndianRupee,
      allowed: true,
    },
    {
      id: 'customers',
      label: lang === 'ta' ? 'வாடிக்கையாளர்கள் (Customers)' : 'Customers',
      icon: Users,
      allowed: true,
    },
    {
      id: 'loans',
      label: lang === 'ta' ? 'தினசரி கடன்கள் (Daily Loans)' : 'Daily Loans',
      icon: Briefcase,
      allowed: true,
    },
    {
      id: 'monthly_loans',
      label: lang === 'ta' ? 'மாத வட்டி கணக்கு (Monthly)' : 'Monthly Interest',
      icon: Percent,
      allowed: !isStaffRole,
    },
    {
      id: 'renewals',
      label: lang === 'ta' ? 'கடன் புதுப்பித்தல் (Renewal)' : 'Loan Renewal',
      icon: RefreshCw,
      allowed: !isStaffRole,
    },
    {
      id: 'cashbook',
      label: lang === 'ta' ? 'வரவு செலவு (Cash Book)' : 'Cash Book & Expenses',
      icon: Wallet,
      allowed: !isStaffRole,
    },
    {
      id: 'ledger',
      label: lang === 'ta' ? 'பொதுப் பேரேடு (Ledger)' : 'General Ledger',
      icon: BookOpen,
      allowed: isOwnerRole,
    },
    {
      id: 'reports',
      label: lang === 'ta' ? 'அறிக்கைகள் (Reports)' : 'Financial Reports',
      icon: FileSpreadsheet,
      allowed: !isStaffRole,
    },
    {
      id: 'staff',
      label: lang === 'ta' ? 'பணியாளர்கள் (Staff)' : 'Collection Staff',
      icon: UserCheck,
      allowed: !isStaffRole,
    },
    {
      id: 'settings',
      label: lang === 'ta' ? 'அமைப்புகள் (Settings)' : 'Settings & Backup',
      icon: Settings,
      allowed: isOwnerRole,
    },
  ].filter((m) => m.allowed);

  return (
    <div className="min-h-screen flex bg-[#F7F8FA] text-[#14283F]">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-md shadow-lg border text-sm font-semibold flex items-center gap-2 ${
            toast.type === 'err'
              ? 'bg-red-50 border-red-300 text-red-800'
              : 'bg-[#14283F] border-[#B78727] text-white'
          }`}
        >
          {toast.type === 'err' ? (
            <AlertCircle className="w-4 h-4 text-red-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#188A78]" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* =====================================================================
          MODERN FINTECH SIDEBAR
      ===================================================================== */}
      <aside className="w-68 kf-sidebar text-white flex flex-col justify-between shrink-0 hidden lg:flex select-none shadow-xl">
        <div>
          <div className="px-6 py-5 border-b border-white/10">
            <div className="flex items-center gap-3.5">
              <div
                className="w-10 h-10 font-extrabold text-base flex items-center justify-center rounded-xl text-slate-950 shadow-md"
                style={{ backgroundColor: 'var(--kf-badge-gold)' }}
              >
                KF
              </div>
              <div>
                <div className="text-base font-extrabold tracking-wide text-white">
                  {companySettings.company_name || 'KAVINIYA FINANCE'}
                </div>
                <div className="text-xs text-white/75 mt-0.5">
                  {companySettings.company_name_ta || 'கவினியா பைனான்ஸ்'}
                </div>
              </div>
            </div>
          </div>

          <nav className="p-3.5 space-y-1.5 mt-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveModule(item.id as ModuleKey)}
                  style={
                    active
                      ? {
                          backgroundColor: 'var(--kf-sidebar-active-bg)',
                          borderColor: 'var(--kf-sidebar-active)',
                        }
                      : undefined
                  }
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-xl transition-all border-l-4 ${
                    active
                      ? 'text-white font-bold shadow-sm'
                      : 'border-transparent text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon
                    className="w-4 h-4 shrink-0"
                    style={active ? { color: 'var(--kf-sidebar-active)' } : undefined}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 m-3 rounded-xl border border-white/10 bg-black/25 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-white">{currentUser?.full_name}</div>
            <div className="text-[11px] font-mono text-white/70">{currentUser?.role_code}</div>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-red-600 text-white rounded-lg flex items-center gap-1 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            வெளியேறு
          </button>
        </div>
      </aside>

      {/* =====================================================================
          MAIN WORKSPACE
      ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-[#D5DCE4] px-5 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <select
              value={activeModule}
              onChange={(e) => setActiveModule(e.target.value as ModuleKey)}
              className="lg:hidden px-3 py-2 text-sm font-bold bg-[#244B70] text-white rounded-lg"
            >
              {menuItems.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <h1 className="text-lg font-extrabold text-[#14283F] hidden sm:block">
              {menuItems.find((m) => m.id === activeModule)?.label}
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            {/* 1-Click Live Theme Switcher */}
            <div className="hidden md:flex items-center gap-1 bg-[#F7F8FA] border border-[#D5DCE4] rounded-full p-1">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  title={t.name}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    theme === t.id
                      ? 'bg-[#244B70] text-white shadow-sm'
                      : 'text-[#14283F] hover:bg-black/5'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/40"
                    style={{ backgroundColor: t.dot }}
                  />
                  <span className="hidden xl:inline">{lang === 'ta' ? t.nameTa : t.name}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={async () => {
                showToast(lang === 'ta' ? 'கிளவுடில் சேமிக்கப்படுகிறது...' : 'Syncing to Cloud Vault...');
                let savedKey = localStorage.getItem('kf_cloud_token') || '';
                let res = await fetch('/api/system/cloud-sync', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                    'X-Cloud-Token': savedKey,
                  },
                  body: JSON.stringify({ token: savedKey }),
                });
                let d = await res.json().catch(() => ({}));
                if (res.ok && d.cloud && !d.cloud.hasToken) {
                  const entered = window.prompt(
                    lang === 'ta'
                      ? 'கிளவுட் ஆட்டோ-சேவ் ஆக்டிவேட் செய்ய உங்கள் GitHub Token-ஐ ஒருமுறை உள்ளிடவும்:'
                      : 'Enter your GitHub Token once to activate Cloud Auto-Save:'
                  );
                  if (entered && entered.trim()) {
                    savedKey = entered.trim();
                    localStorage.setItem('kf_cloud_token', savedKey);
                    res = await fetch('/api/system/cloud-sync', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                        'X-Cloud-Token': savedKey,
                      },
                      body: JSON.stringify({ token: savedKey }),
                    });
                    d = await res.json().catch(() => ({}));
                  }
                }
                if (res.ok && d.cloud?.status === 'SYNCED') {
                  showToast(lang === 'ta' ? '☁️ கிளவுடில் அனைத்து தகவல்களும் பாதுகாப்பாக சேமிக்கப்பட்டது!' : '☁️ Saved to Cloud Vault!');
                } else {
                  showToast(d.cloud?.error || 'Cloud sync completed');
                }
              }}
              title="Automatic Cloud Vault Persistence Active (Click to sync now)"
              className="px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">{lang === 'ta' ? '☁️ ஆட்டோ-சேவ் (Cloud)' : '☁️ Cloud Saved'}</span>
            </button>

            <button
              onClick={() => setLang(lang === 'ta' ? 'en' : 'ta')}
              className="px-3.5 py-2 text-xs font-bold text-[#14283F] bg-[#F7F8FA] hover:bg-[#E8EDF2] border border-[#D5DCE4] rounded-xl flex items-center gap-1.5"
            >
              <Languages className="w-4 h-4 text-[#244B70]" />
              <span>{lang === 'ta' ? 'English' : 'தமிழ்'}</span>
            </button>

            <button
              onClick={() => setMobilePreview(true)}
              className="px-3.5 py-2 text-xs font-bold text-white bg-[#188A78] hover:opacity-90 rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline">
                {lang === 'ta' ? 'மொபைல் ஆப்' : 'Mobile View'}
              </span>
            </button>

            <button
              onClick={handleLogout}
              className="lg:hidden px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="p-5 lg:p-8 flex-1 max-w-7xl w-full mx-auto space-y-6">
          {/* =================================================================
              1. DASHBOARD (முகப்பு)
          ================================================================= */}
          {activeModule === 'dashboard' && (
            <div className="space-y-6">
              <div className="kf-card p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F7F8FA] text-[#244B70] border border-[#D5DCE4] mb-1.5">
                    ● LIVE ERP • IST {dashboardData?.today || ''}
                  </span>
                  <h2 className="text-xl font-extrabold text-[#14283F]">
                    {lang === 'ta' ? 'வணக்கம்! இன்றைய நிதி நிலை சுருக்கம்' : 'Executive Finance Overview'}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {!isStaffRole && (
                    <>
                      <button
                        onClick={openNewCustomerModal}
                        className="px-4 py-2.5 text-sm font-bold text-[#14283F] bg-[#F7F8FA] border border-[#D5DCE4] hover:opacity-90 rounded-xl flex items-center gap-2"
                      >
                        <UserPlus className="w-4 h-4 text-[#244B70]" />
                        {lang === 'ta' ? '+ வாடிக்கையாளர் சேர்க்க' : '+ Add Customer'}
                      </button>
                      <button
                        onClick={() => {
                          if (customers.length === 0) openNewCustomerModal();
                          else setShowNewLoanModal(true);
                        }}
                        className="px-4 py-2.5 text-sm font-bold text-white bg-[#244B70] hover:bg-[#14283F] rounded-xl shadow-sm flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        {lang === 'ta' ? '+ புதிய கடன் கொடுக்க' : '+ Give New Loan'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setActiveModule('collections')}
                    className="px-4 py-2.5 text-sm font-bold text-white bg-[#188A78] hover:opacity-95 rounded-xl shadow-sm flex items-center gap-2"
                  >
                    <IndianRupee className="w-4 h-4" />
                    {lang === 'ta' ? 'இன்றைய வசூல் போட' : 'Enter Collection'}
                  </button>
                </div>
              </div>

              {/* Trending Modern Fintech KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="kf-card p-5 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {lang === 'ta' ? 'இன்றைய வசூல்' : "Today's Collection"}
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-[#F7F8FA] border border-[#D5DCE4] flex items-center justify-center text-[#188A78]">
                      <IndianRupee className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 font-mono tabular-nums text-2xl font-extrabold text-[#188A78]">
                    {formatINR(kpis.todaysCollection)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5 flex items-center justify-between">
                    <span>{lang === 'ta' ? 'மாத வசூல்:' : 'This Month:'}</span>
                    <span className="font-mono font-bold text-[#14283F]">
                      {formatINR(kpis.monthlyCollection)}
                    </span>
                  </div>
                </div>

                <div className="kf-card p-5 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {lang === 'ta' ? 'வர வேண்டிய நிலுவை' : 'Pending Balance'}
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-[#F7F8FA] border border-[#D5DCE4] flex items-center justify-center text-[#244B70]">
                      <Briefcase className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 font-mono tabular-nums text-2xl font-extrabold text-[#244B70]">
                    {formatINR(kpis.outstanding)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5 flex items-center justify-between">
                    <span>{lang === 'ta' ? 'வழங்கிய ரொக்கம்:' : 'Cash Disbursed:'}</span>
                    <span className="font-mono font-bold text-[#14283F]">
                      {formatINR(kpis.totalCashDisbursed)}
                    </span>
                  </div>
                </div>

                <div className="kf-card p-5 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {lang === 'ta' ? 'வாடிக்கையாளர் & கடன்' : 'Customers & Loans'}
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-[#F7F8FA] border border-[#D5DCE4] flex items-center justify-center text-[#244B70]">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 font-mono tabular-nums text-2xl font-extrabold text-[#14283F]">
                    {kpis.activeCustomers || 0} <span className="text-sm font-normal text-slate-400">/</span>{' '}
                    {kpis.activeLoans || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5 flex items-center justify-between">
                    <span>{lang === 'ta' ? 'தவணை தவறியவை:' : 'Overdue:'}</span>
                    <span className="font-mono font-bold text-red-600">
                      {kpis.overdueCount || 0} ({formatINR(kpis.overdueAmount)})
                    </span>
                  </div>
                </div>

                {!isStaffRole && (
                  <div className="bg-[#14283F] text-white rounded-2xl p-5 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ color: 'var(--kf-badge-gold)' }}
                      >
                        {lang === 'ta' ? 'கையிருப்பு ரொக்கம்' : 'Physical Cash'}
                      </div>
                      <Wallet className="w-4 h-4 text-white/80" />
                    </div>
                    <div className="mt-3 font-mono tabular-nums text-2xl font-extrabold text-white">
                      {formatINR(kpis.cashInHand)}
                    </div>
                    <div className="text-xs text-white/80 mt-1.5 flex items-center justify-between">
                      <span>{lang === 'ta' ? 'வங்கி / UPI இருப்பு:' : 'Bank / UPI:'}</span>
                      <span className="font-mono font-bold text-white">
                        {formatINR(kpis.bankBalance)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {customers.length === 0 ? (
                <div className="bg-white border border-[#D5DCE4] rounded-md p-10 text-center">
                  <h3 className="text-lg font-bold text-[#14283F]">
                    {lang === 'ta'
                      ? 'உங்கள் கணக்குப் பதிவேடு சுத்தமாகத் தயாராக உள்ளது!'
                      : 'Your Finance Workspace is Clean and Ready!'}
                  </h3>
                  <p className="text-sm text-slate-600 max-w-lg mx-auto mt-2">
                    {lang === 'ta'
                      ? 'இதில் எந்த மாதிரி (Sample) தகவல்களும் சேர்க்கப்படவில்லை. உங்கள் சொந்த வாடிக்கையாளர்களைச் சேர்த்து கடன் கணக்கைத் தொடங்க கீழே உள்ள பட்டனை அழுத்தவும்.'
                      : 'No sample data has been pre-filled. Click below to register your first customer and create a loan.'}
                  </p>
                  {!isStaffRole && (
                    <div className="mt-5 flex justify-center gap-3">
                      <button
                        onClick={openNewCustomerModal}
                        className="px-5 py-2.5 text-sm font-semibold text-white bg-[#244B70] hover:bg-[#14283F] rounded-md flex items-center gap-2"
                      >
                        <UserPlus className="w-4 h-4" />
                        {lang === 'ta' ? '1. முதல் வாடிக்கையாளரைச் சேர்க்கவும்' : '1. Add Your First Customer'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-[#D5DCE4] rounded-md overflow-hidden">
                  <div className="px-5 py-4 bg-[#F7F8FA] border-b border-[#D5DCE4] flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#14283F]">
                      {lang === 'ta' ? 'சமீபத்திய வசூல் ரசீதுகள் (Recent Collections)' : 'Recent Collection Receipts'}
                    </h3>
                    <button
                      onClick={() => setActiveModule('collections')}
                      className="text-sm font-semibold text-[#244B70] hover:underline"
                    >
                      {lang === 'ta' ? 'தினசரி வசூல் பக்கம் செல்ல →' : 'Go to Daily Collection →'}
                    </button>
                  </div>
                  {(dashboardData?.recentTransactions || []).length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      {lang === 'ta' ? 'இன்னும் வசூல் எதுவும் பதிவாகவில்லை.' : 'No payments collected yet.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-[#F7F8FA] border-b border-[#D5DCE4] text-xs text-slate-600">
                            <th className="py-3 px-4 text-left">ரசீது எண் / Receipt</th>
                            <th className="py-3 px-4 text-left">தேதி / Date</th>
                            <th className="py-3 px-4 text-left">வாடிக்கையாளர் / Customer</th>
                            <th className="py-3 px-4 text-left">முறை / Mode</th>
                            <th className="py-3 px-4 text-right">வசூல் தொகை / Paid</th>
                            <th className="py-3 px-4 text-right">மீதி பாக்கி / Balance</th>
                            <th className="py-3 px-4 text-right">ரசீது / ரத்து</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E8EDF2]">
                          {(dashboardData?.recentTransactions || []).map((tx: any) => (
                            <tr
                              key={tx.id}
                              className={tx.status === 'REVERSED' ? 'bg-red-50/40 line-through text-slate-400' : 'hover:bg-[#F7F8FA]'}
                            >
                              <td className="py-3 px-4 font-mono font-semibold text-[#244B70]">
                                {tx.receipt_number}
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-600">{tx.payment_date}</td>
                              <td className="py-3 px-4 font-semibold text-[#14283F]">{tx.customer_name}</td>
                              <td className="py-3 px-4 font-mono text-xs">{tx.payment_mode}</td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-[#188A78]">
                                {formatINR(tx.amount_collected)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-700">
                                {formatINR(tx.balance_after_payment)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => handleOpenReceiptByNumber(tx.receipt_number)}
                                  className="px-3 py-1 text-xs font-semibold text-[#244B70] bg-[#EDF2F7] hover:bg-[#244B70] hover:text-white rounded"
                                >
                                  {tx.status === 'REVERSED' ? 'ரத்தானது' : 'ரசீது / ரத்து'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              2. DAILY COLLECTION (தினசரி வசூல்)
          ================================================================= */}
          {activeModule === 'collections' && (
            <div className="space-y-5">
              <div className="bg-white border border-[#D5DCE4] rounded-md p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-[#14283F]">
                      {lang === 'ta' ? 'தினசரி வசூல் & நிலுவை நிர்வாகம் (Daily Collection & Arrears)' : 'Daily Collection & Arrears'}
                    </h2>
                    <p className="text-sm text-slate-600">
                      {lang === 'ta'
                        ? 'வாடிக்கையாளர் பணம் கொடுத்தால் "வசூல் செய்" அழுத்தவும். இன்று கட்டவில்லை என்றால் "கட்டவில்லை" பட்டனை அழுத்தி காரணத்தைப் பதிவு செய்யவும்.'
                        : 'Click Collect to issue a receipt, or click Missed Today if the customer did not pay.'}
                    </p>
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={collectionSearch}
                      onChange={(e) => setCollectionSearch(e.target.value)}
                      placeholder={
                        lang === 'ta' ? 'பெயர் அல்லது போன் நம்பர் தேடுக...' : 'Search name or phone...'
                      }
                      className="pl-10 pr-4 py-2 text-sm border border-[#D5DCE4] rounded-md w-72 focus:outline-none focus:border-[#244B70]"
                    />
                  </div>
                </div>

                {/* Filter Pills for Missed / Arrears */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E8EDF2]">
                  <button
                    type="button"
                    onClick={() => setCollectionFilter('ALL')}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md border ${
                      collectionFilter === 'ALL'
                        ? 'bg-[#14283F] text-white border-[#14283F]'
                        : 'bg-[#F7F8FA] text-slate-700 border-[#D5DCE4]'
                    }`}
                  >
                    அனைத்தும் ({collectionItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectionFilter('OVERDUE')}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md border ${
                      collectionFilter === 'OVERDUE'
                        ? 'bg-red-700 text-white border-red-700'
                        : 'bg-red-50 text-red-800 border-red-200'
                    }`}
                  >
                    தவணை தவறியவர்கள் / பழைய பாக்கி (
                    {collectionItems.filter((i) => i.arrears > 0 || i.missed_days > 0 || i.missed_today_reason).length}
                    )
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectionFilter('PENDING_TODAY')}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md border ${
                      collectionFilter === 'PENDING_TODAY'
                        ? 'bg-[#244B70] text-white border-[#244B70]'
                        : 'bg-[#F7F8FA] text-slate-700 border-[#D5DCE4]'
                    }`}
                  >
                    இன்று இன்னும் கட்டாதவர்கள் ({collectionItems.filter((i) => i.collected_today === 0).length})
                  </button>
                </div>
              </div>

              <div className="bg-white border border-[#D5DCE4] rounded-md overflow-hidden">
                {collectionItems.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <p className="text-base font-semibold text-slate-700">
                      {lang === 'ta'
                        ? 'வசூல் செய்ய நடப்புக் கடன் கணக்குகள் எதுவும் இல்லை.'
                        : 'No active loans found for collection.'}
                    </p>
                    {!isStaffRole && (
                      <button
                        onClick={() => {
                          if (customers.length === 0) openNewCustomerModal();
                          else setShowNewLoanModal(true);
                        }}
                        className="px-4 py-2 text-sm font-semibold text-white bg-[#244B70] rounded-md"
                      >
                        {lang === 'ta' ? '+ புதிய கடன் உருவாக்கவும்' : '+ Create a Loan First'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-[#F7F8FA] border-b border-[#D5DCE4] text-xs text-slate-600">
                          <th className="py-3.5 px-4 text-left">வாடிக்கையாளர் / Customer</th>
                          <th className="py-3.5 px-4 text-left">கடன் & தவணை விவரம்</th>
                          <th className="py-3.5 px-4 text-right">மொத்த பாக்கி</th>
                          <th className="py-3.5 px-4 text-right">இன்று வர வேண்டியது (பாக்கியுடன்)</th>
                          <th className="py-3.5 px-4 text-left">முறை / Mode</th>
                          <th className="py-3.5 px-4 text-right">வசூல் தொகை (₹)</th>
                          <th className="py-3.5 px-4 text-right">செயல் / Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8EDF2]">
                        {collectionItems
                          .filter((item) => {
                            if (collectionFilter === 'OVERDUE') {
                              return item.arrears > 0 || item.missed_days > 0 || !!item.missed_today_reason;
                            }
                            if (collectionFilter === 'PENDING_TODAY') {
                              return item.collected_today === 0;
                            }
                            return true;
                          })
                          .map((item) => {
                            const entryVal =
                              inlineAmounts[item.loan_id] !== undefined
                                ? inlineAmounts[item.loan_id]
                                : item.due_now > 0
                                  ? item.due_now
                                  : item.daily_installment;
                            const modeVal = inlineModes[item.loan_id] || 'CASH';

                            return (
                              <tr key={item.loan_id} className="hover:bg-[#F7F8FA]">
                                <td className="py-3.5 px-4">
                                  <div className="font-bold text-[#14283F]">{item.customer_name}</div>
                                  <div className="text-xs text-slate-500">
                                    {item.area} • {item.customer_mobile}
                                  </div>
                                  {item.missed_today_reason && (
                                    <div className="mt-1 inline-block px-2 py-0.5 text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200 rounded">
                                      இன்று கட்டவில்லை: {item.missed_today_reason}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 font-mono">
                                  <div className="font-semibold text-[#244B70]">{item.loan_number}</div>
                                  <div className="text-xs text-slate-500">
                                    {item.paid_installments}/{item.total_installments} தவணைகள் முடிந்தது
                                  </div>
                                  {item.missed_days > 0 && (
                                    <div className="mt-1 inline-block px-2 py-0.5 text-xs font-bold bg-red-50 text-red-700 border border-red-200 rounded">
                                      {item.missed_days} நாள் தவணை பாக்கி
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono font-bold text-[#14283F]">
                                  {formatINR(item.outstanding_balance)}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono">
                                  <div className="font-bold text-[#244B70]">
                                    {formatINR(item.due_now || item.daily_installment)}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    தினசரி: {formatINR(item.daily_installment)}
                                  </div>
                                  {item.arrears > 0 && (
                                    <div className="text-xs font-bold text-red-700">
                                      + பழைய பாக்கி: {formatINR(item.arrears)}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4">
                                  <select
                                    value={modeVal}
                                    onChange={(e) =>
                                      setInlineModes((prev) => ({
                                        ...prev,
                                        [item.loan_id]: e.target.value,
                                      }))
                                    }
                                    className="px-2.5 py-1.5 text-xs font-semibold border border-[#D5DCE4] rounded bg-white"
                                  >
                                    <option value="CASH">Cash (ரொக்கம்)</option>
                                    <option value="UPI">UPI / GPay</option>
                                    <option value="BANK_TRANSFER">Bank</option>
                                  </select>
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <input
                                    type="number"
                                    min={1}
                                    max={item.outstanding_balance}
                                    value={entryVal}
                                    onChange={(e) =>
                                      setInlineAmounts((prev) => ({
                                        ...prev,
                                        [item.loan_id]: Number(e.target.value),
                                      }))
                                    }
                                    className="w-28 px-3 py-1.5 text-right font-mono font-bold border border-[#D5DCE4] rounded"
                                  />
                                  {item.due_now > item.daily_installment && (
                                    <div className="flex justify-end gap-1 mt-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setInlineAmounts((prev) => ({
                                            ...prev,
                                            [item.loan_id]: item.daily_installment,
                                          }))
                                        }
                                        className="px-1.5 py-0.5 text-[11px] font-semibold bg-[#F7F8FA] border border-[#D5DCE4] rounded text-slate-700"
                                      >
                                        1 நாள் ({formatINR(item.daily_installment)})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setInlineAmounts((prev) => ({
                                            ...prev,
                                            [item.loan_id]: item.due_now,
                                          }))
                                        }
                                        className="px-1.5 py-0.5 text-[11px] font-semibold bg-red-50 border border-red-200 rounded text-red-800"
                                      >
                                        மொத்த பாக்கி ({formatINR(item.due_now)})
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <div className="inline-flex flex-wrap justify-end items-center gap-2">
                                    {item.collected_today > 0 && item.last_receipt_today && (
                                      <button
                                        onClick={() =>
                                          handleOpenReceiptByNumber(item.last_receipt_today)
                                        }
                                        className="px-2.5 py-1.5 text-xs font-semibold text-[#188A78] bg-[#EBF7F5] border border-[#188A78]/30 rounded"
                                      >
                                        இன்று: {formatINR(item.collected_today)} (ரசீது)
                                      </button>
                                    )}
                                    <button
                                      disabled={collectingLoanId === item.loan_id}
                                      onClick={() =>
                                        handleCollectPayment(item.loan_id, Number(entryVal), modeVal)
                                      }
                                      className="px-3.5 py-2 text-xs font-semibold text-white bg-[#188A78] hover:bg-[#136F60] rounded shadow-sm"
                                    >
                                      {collectingLoanId === item.loan_id
                                        ? 'Saving...'
                                        : `வசூல் செய் ${formatINR(entryVal)}`}
                                    </button>
                                    {item.collected_today === 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setMissedModal({
                                            loan_id: item.loan_id,
                                            customer_name: item.customer_name,
                                            loan_number: item.loan_number,
                                            reason:
                                              item.missed_today_reason ||
                                              'நாளை சேர்த்து தருவதாகச் சொன்னார்',
                                          })
                                        }
                                        className="px-2.5 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded"
                                      >
                                        கட்டவில்லை
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
              3. CUSTOMERS (வாடிக்கையாளர்கள்)
          ================================================================= */}
          {activeModule === 'customers' && (
            <div className="space-y-5">
              <div className="bg-white border border-[#D5DCE4] rounded-md p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-[#14283F]">
                    {lang === 'ta' ? 'வாடிக்கையாளர்கள் பட்டியல் (Customers)' : 'Customers Directory'}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {lang === 'ta'
                      ? 'வாடிக்கையாளரைச் சேர்க்க, திருத்த, பணியாளர் ஒதுக்க மற்றும் புதிய கடன் வழங்க.'
                      : 'Register, edit, assign collection staff, and issue loans.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder={lang === 'ta' ? 'பெயர் / போன் நம்பர் தேடுக...' : 'Search customer...'}
                    className="px-3.5 py-2 text-sm border border-[#D5DCE4] rounded-md w-64"
                  />
                  {!isStaffRole && (
                    <button
                      onClick={openNewCustomerModal}
                      className="px-4 py-2 text-sm font-semibold text-white bg-[#244B70] hover:bg-[#14283F] rounded-md flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      {lang === 'ta' ? '+ புதிய வாடிக்கையாளர்' : '+ Add Customer'}
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white border border-[#D5DCE4] rounded-md overflow-hidden">
                {customers.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <p className="text-base font-semibold text-slate-700">
                      {lang === 'ta'
                        ? 'இன்னும் வாடிக்கையாளர்கள் யாரும் சேர்க்கப்படவில்லை.'
                        : 'No customers added yet.'}
                    </p>
                    {!isStaffRole && (
                      <button
                        onClick={openNewCustomerModal}
                        className="px-4 py-2 text-sm font-semibold text-white bg-[#244B70] rounded-md"
                      >
                        {lang === 'ta' ? '+ முதல் வாடிக்கையாளரைச் சேர்க்கவும்' : '+ Add First Customer'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-[#F7F8FA] border-b border-[#D5DCE4] text-xs text-slate-600">
                          <th className="py-3.5 px-4 text-left">எண் / ID</th>
                          <th className="py-3.5 px-4 text-left">பெயர் / Name</th>
                          <th className="py-3.5 px-4 text-left">மொபைல் / Mobile</th>
                          <th className="py-3.5 px-4 text-left">பகுதி / Area</th>
                          <th className="py-3.5 px-4 text-left">பணியாளர் / Staff</th>
                          <th className="py-3.5 px-4 text-right">கடன் பாக்கி</th>
                          <th className="py-3.5 px-4 text-right">செயல்கள் / Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8EDF2]">
                        {customers.map((c) => (
                          <tr key={c.id} className="hover:bg-[#F7F8FA]">
                            <td className="py-3.5 px-4 font-mono font-bold text-[#244B70]">
                              {c.customer_code}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-[#14283F]">{c.full_name}</div>
                              {c.status !== 'ACTIVE' && (
                                <span className="text-[11px] font-mono px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded">
                                  {c.status}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono">{c.mobile}</td>
                            <td className="py-3.5 px-4 text-slate-700">{c.area}</td>
                            <td className="py-3.5 px-4 text-slate-600">
                              {c.staff_name || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-[#14283F]">
                              {formatINR(c.total_outstanding)}
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-2">
                              {!isStaffRole && c.status === 'ACTIVE' && (
                                <button
                                  onClick={() => {
                                    setNewLoanForm((prev) => ({
                                      ...prev,
                                      customer_id: c.id,
                                      assigned_staff_id: c.assigned_staff_id || '',
                                    }));
                                    setShowNewLoanModal(true);
                                  }}
                                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#188A78] hover:bg-[#136F60] rounded"
                                >
                                  + கடன் கொடு
                                </button>
                              )}
                              {!isStaffRole && (
                                <button
                                  onClick={() => openEditCustomerModal(c)}
                                  className="px-2.5 py-1.5 text-xs font-semibold text-[#244B70] bg-[#EDF2F7] hover:bg-[#244B70] hover:text-white rounded inline-flex items-center gap-1"
                                >
                                  <Edit3 className="w-3 h-3" /> திருத்து
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenCustomerProfile(c.id)}
                                className="px-3 py-1.5 text-xs font-semibold text-[#14283F] bg-[#F7F8FA] border border-[#D5DCE4] hover:bg-[#E8EDF2] rounded"
                              >
                                வரலாறு
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
              4. LOANS (கடன்கள்)
          ================================================================= */}
          {activeModule === 'loans' && (
            <div className="space-y-5">
              <div className="bg-white border border-[#D5DCE4] rounded-md p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-[#14283F]">
                    {lang === 'ta' ? 'வழங்கிய கடன்கள் பட்டியல் (Loans)' : 'Active & Past Loans'}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {lang === 'ta'
                      ? 'அசல் தொகை, வட்டி பிடித்தம், கையில் கொடுத்த தொகை, APR % மற்றும் பாக்கி விவரங்கள்.'
                      : 'View loan principal, upfront deduction, net cash disbursed, APR %, and remaining balance.'}
                  </p>
                </div>
                {!isStaffRole && (
                  <button
                    onClick={() => {
                      if (customers.length === 0) openNewCustomerModal();
                      else setShowNewLoanModal(true);
                    }}
                    className="px-4 py-2.5 text-sm font-semibold text-white bg-[#244B70] hover:bg-[#14283F] rounded-md flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {lang === 'ta' ? '+ புதிய கடன் கொடுக்க' : '+ Give New Loan'}
                  </button>
                )}
              </div>

              <div className="bg-white border border-[#D5DCE4] rounded-md overflow-hidden">
                {loans.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <p className="text-base font-semibold text-slate-700">
                      {lang === 'ta' ? 'இன்னும் கடன்கள் எதுவும் வழங்கப்படவில்லை.' : 'No loans created yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-[#F7F8FA] border-b border-[#D5DCE4] text-xs text-slate-600">
                          <th className="py-3.5 px-4 text-left">கடன் எண் / Loan No</th>
                          <th className="py-3.5 px-4 text-left">வாடிக்கையாளர் / Customer</th>
                          <th className="py-3.5 px-4 text-right">கடன் தொகை</th>
                          <th className="py-3.5 px-4 text-right">பிடித்தம்</th>
                          <th className="py-3.5 px-4 text-right">கையில் கொடுத்தது</th>
                          <th className="py-3.5 px-4 text-right">தினசரி தவணை</th>
                          <th className="py-3.5 px-4 text-right">கட்டியது</th>
                          <th className="py-3.5 px-4 text-right">மீதி பாக்கி</th>
                          <th className="py-3.5 px-4 text-right">செயல் / Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8EDF2]">
                        {loans.map((l) => (
                          <tr key={l.id} className="hover:bg-[#F7F8FA]">
                            <td className="py-3.5 px-4 font-mono font-bold text-[#244B70]">
                              {l.loan_number}
                              {l.loan_type === 'RENEWAL' && (
                                <span className="ml-2 px-1.5 py-0.5 text-[11px] bg-[#FBF6EB] text-[#B78727] border border-[#E6D09C] rounded">
                                  Renewal
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-[#14283F]">{l.customer_name}</div>
                              <div className="text-xs text-slate-500">
                                {l.staff_name ? `Staff: ${l.staff_name}` : l.customer_area}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-semibold">
                              {formatINR(l.principal_amount)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                              {formatINR(l.disclosed_charge_amount)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#14283F]">
                              {formatINR(l.actual_cash_payout)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono">
                              {formatINR(l.daily_installment)} × {l.total_installments}d
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#188A78]">
                              {formatINR(l.amount_collected)} ({l.paid_installments}d)
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-[#14283F]">
                              {formatINR(l.outstanding_balance)}
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-2">
                              {(l.status === 'ACTIVE' || l.status === 'OVERDUE') && !isStaffRole && (
                                <button
                                  onClick={() => {
                                    setRenewalPreselectedLoanId(l.id);
                                    setActiveModule('renewals');
                                  }}
                                  className="px-3 py-1.5 text-xs font-semibold text-[#14283F] bg-[#FBF6EB] border border-[#E6D09C] hover:bg-[#f3e5c0] rounded"
                                >
                                  புதுப்பித்தல் (Renew)
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenLoanDetails(l.id)}
                                className="px-3 py-1.5 text-xs font-semibold text-[#244B70] bg-[#EDF2F7] rounded"
                              >
                                தவணை அட்டவணை
                              </button>
                              {!isStaffRole && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLoan(l)}
                                  className="px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded inline-flex items-center gap-1"
                                  title="தவறான கடன் பதிவை நீக்கு"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  நீக்கு
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
              4B. MONTHLY INTEREST LOANS (மாத வட்டி கணக்கு)
          ================================================================= */}
          {activeModule === 'monthly_loans' && (
            <MonthlyInterestView
              token={token}
              lang={lang}
              onRefreshGlobal={loadAllData}
              showToast={showToast}
            />
          )}

          {/* =================================================================
              5. LOAN RENEWAL ENGINE (கடன் புதுப்பித்தல்)
          ================================================================= */}
          {activeModule === 'renewals' && (
            <RenewalEngineView
              loans={loans}
              renewals={renewals}
              token={token}
              lang={lang}
              preselectedLoanId={renewalPreselectedLoanId}
              onRenewalCompleted={loadAllData}
            />
          )}

          {/* =================================================================
              6. CASH BOOK & EXPENSES (வரவு செலவு கணக்கு)
          ================================================================= */}
          {activeModule === 'cashbook' && (
            <CashBookAndExpensesView
              token={token}
              currentUser={currentUser}
              lang={lang}
              onRefresh={loadAllData}
            />
          )}

          {/* =================================================================
              7. GENERAL LEDGER (பொதுப் பேரேடு)
          ================================================================= */}
          {activeModule === 'ledger' && <AccountingLedgerView token={token} />}

          {/* =================================================================
              8. FINANCIAL REPORTS (அறிக்கைகள்)
          ================================================================= */}
          {activeModule === 'reports' && (
            <FinancialReportsView
              token={token}
              currentUser={currentUser}
              lang={lang}
            />
          )}

          {/* =================================================================
              9. STAFF (பணியாளர்கள்)
          ================================================================= */}
          {activeModule === 'staff' && (
            <div className="space-y-5">
              <div className="bg-white border border-[#D5DCE4] rounded-md p-5 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#14283F]">
                    {lang === 'ta' ? 'வசூல் பணியாளர்கள் (Collection Staff)' : 'Collection Staff'}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {lang === 'ta'
                      ? 'வசூல் பணியாளர்களைச் சேர்த்து வாடிக்கையாளர்களுக்கு ஒதுக்கலாம்.'
                      : 'Add field collection staff and assign them to customers and loans.'}
                  </p>
                </div>
                <button
                  onClick={() => setShowNewStaffModal(true)}
                  className="px-4 py-2.5 text-sm font-semibold text-white bg-[#244B70] hover:bg-[#14283F] rounded-md flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {lang === 'ta' ? '+ பணியாளர் சேர்க்க' : '+ Add Staff'}
                </button>
              </div>

              <div className="bg-white border border-[#D5DCE4] rounded-md overflow-hidden">
                {staffList.length === 0 ? (
                  <div className="p-12 text-center text-sm text-slate-500">
                    {lang === 'ta'
                      ? 'இன்னும் பணியாளர்கள் யாரும் சேர்க்கப்படவில்லை.'
                      : 'No staff members added yet.'}
                  </div>
                ) : (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#F7F8FA] border-b border-[#D5DCE4] text-xs text-slate-600">
                        <th className="py-3.5 px-4 text-left">பணியாளர் எண்</th>
                        <th className="py-3.5 px-4 text-left">பெயர் / Name</th>
                        <th className="py-3.5 px-4 text-left">Login Username</th>
                        <th className="py-3.5 px-4 text-left">மொபைல் / Phone</th>
                        <th className="py-3.5 px-4 text-left">வசூல் பகுதி / Areas</th>
                        <th className="py-3.5 px-4 text-right">வாடிக்கையாளர்கள்</th>
                        <th className="py-3.5 px-4 text-right">இன்றைய வசூல்</th>
                        <th className="py-3.5 px-4 text-right">மாத வசூல்</th>
                        <th className="py-3.5 px-4 text-right">கடவுச்சொல் / Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8EDF2]">
                      {staffList.map((s) => (
                        <tr key={s.id} className="hover:bg-[#F7F8FA]">
                          <td className="py-3.5 px-4 font-mono font-bold text-[#244B70]">{s.staff_code}</td>
                          <td className="py-3.5 px-4 font-bold text-[#14283F]">{s.full_name}</td>
                          <td className="py-3.5 px-4 font-mono font-semibold text-[#14283F]">{s.username}</td>
                          <td className="py-3.5 px-4 font-mono">{s.phone}</td>
                          <td className="py-3.5 px-4 text-slate-700">{s.assigned_areas}</td>
                          <td className="py-3.5 px-4 text-right font-mono">{s.customers_count || 0}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-[#188A78]">
                            {formatINR(s.today_collection)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-semibold">
                            {formatINR(s.month_collection)}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setResetStaffModal({
                                  id: s.id,
                                  full_name: s.full_name,
                                  username: s.username || '',
                                  password: '',
                                })
                              }
                              className="px-3 py-1.5 text-xs font-semibold text-[#244B70] bg-[#F7F8FA] hover:bg-[#E8EDF2] border border-[#D5DCE4] rounded"
                            >
                              கடவுச்சொல் மாற்று
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
              10. SETTINGS, BACKUP & AUDIT LOGS (அமைப்புகள்)
          ================================================================= */}
          {activeModule === 'settings' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Company & Receipt Header Settings */}
                <form
                  onSubmit={handleSaveSettings}
                  className="bg-white border border-[#D5DCE4] rounded-md p-6 space-y-4 text-sm"
                >
                  <h3 className="text-base font-bold text-[#14283F] border-b border-[#E8EDF2] pb-3">
                    நிறுவன விவரம் & ரசீது அமைப்புகள் (Company & Receipt Settings)
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Company Name (English)
                      </label>
                      <input
                        type="text"
                        value={companySettings.company_name || ''}
                        onChange={(e) =>
                          setCompanySettings({ ...companySettings, company_name: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-[#D5DCE4] rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        நிறுவனப் பெயர் (Tamil)
                      </label>
                      <input
                        type="text"
                        value={companySettings.company_name_ta || ''}
                        onChange={(e) =>
                          setCompanySettings({ ...companySettings, company_name_ta: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-[#D5DCE4] rounded"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        பதிவு எண் / Licence No (Optional)
                      </label>
                      <input
                        type="text"
                        value={companySettings.registration_no || ''}
                        onChange={(e) =>
                          setCompanySettings({ ...companySettings, registration_no: e.target.value })
                        }
                        placeholder="Leave blank if not applicable"
                        className="w-full px-3 py-2 border border-[#D5DCE4] rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        தொலைபேசி / Phone
                      </label>
                      <input
                        type="text"
                        value={companySettings.phone || ''}
                        onChange={(e) =>
                          setCompanySettings({ ...companySettings, phone: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-[#D5DCE4] rounded font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      முகவரி / Office Address
                    </label>
                    <input
                      type="text"
                      value={companySettings.address || ''}
                      onChange={(e) =>
                        setCompanySettings({ ...companySettings, address: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-[#D5DCE4] rounded"
                    />
                  </div>
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={companySettings.skip_sundays === '1'}
                      onChange={(e) =>
                        setCompanySettings({
                          ...companySettings,
                          skip_sundays: e.target.checked ? '1' : '0',
                        })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700">
                      ஞாயிற்றுக்கிழமைகளில் தவணை விடுமுறை (Skip Sundays in new loan schedules)
                    </span>
                  </label>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#244B70] hover:bg-[#14283F] text-white font-semibold rounded-md"
                  >
                    அமைப்புகளைச் சேமி (Save Settings)
                  </button>
                </form>

                {/* Change Password & Database Backup */}
                <div className="space-y-6">
                  <form
                    onSubmit={handleChangePassword}
                    className="bg-white border border-[#D5DCE4] rounded-md p-6 space-y-4 text-sm"
                  >
                    <h3 className="text-base font-bold text-[#14283F] border-b border-[#E8EDF2] pb-3">
                      கடவுச்சொல் மாற்றம் (Change Your Password)
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          தற்போதைய கடவுச்சொல்
                        </label>
                        <input
                          type="password"
                          required
                          value={pwForm.currentPassword}
                          onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                          className="w-full px-3 py-2 border border-[#D5DCE4] rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          புதிய கடவுச்சொல் (Min 8 chars)
                        </label>
                        <input
                          type="password"
                          required
                          minLength={8}
                          value={pwForm.newPassword}
                          onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                          className="w-full px-3 py-2 border border-[#D5DCE4] rounded"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#14283F] text-white font-semibold rounded-md"
                    >
                      Update Password
                    </button>
                  </form>

                  <div className="bg-white border border-[#D5DCE4] rounded-md p-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-[#14283F]">
                        Database Backup (.db)
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        உங்கள் முழு டேட்டாபேஸ் கோப்பையும் பாதுகாப்பாகப் பதிவிறக்கம் செய்யவும்.
                      </p>
                    </div>
                    <button
                      onClick={handleDownloadBackup}
                      className="px-4 py-2.5 bg-[#188A78] hover:bg-[#136F60] text-white text-sm font-semibold rounded-md flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download Backup
                    </button>
                  </div>
                </div>
              </div>

              {/* Audit Logs */}
              <div className="bg-white border border-[#D5DCE4] rounded-md overflow-hidden">
                <div className="px-5 py-3.5 bg-[#F7F8FA] border-b border-[#D5DCE4] font-bold text-sm text-[#14283F]">
                  செயல்பாட்டுப் பதிவேடு (System Audit Logs)
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#F7F8FA] border-b border-[#D5DCE4] text-xs text-slate-600">
                        <th className="py-2.5 px-4 text-left">நேரம் / Time</th>
                        <th className="py-2.5 px-4 text-left">பயனர் / User</th>
                        <th className="py-2.5 px-4 text-left">செயல் / Action</th>
                        <th className="py-2.5 px-4 text-left">விவரம் / Summary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8EDF2]">
                      {auditLogs.map((l: any) => (
                        <tr key={l.id}>
                          <td className="py-2 px-4 font-mono text-xs text-slate-500">{l.created_at}</td>
                          <td className="py-2 px-4 font-semibold">{l.user_name}</td>
                          <td className="py-2 px-4 font-mono text-xs text-[#244B70]">{l.action}</td>
                          <td className="py-2 px-4 text-slate-600">{l.summary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =====================================================================
          MODALS
      ===================================================================== */}

      {activeReceipt && (
        <ReceiptModal
          receipt={activeReceipt}
          settings={companySettings}
          canReverse={!isStaffRole}
          lang={lang}
          onReversePayment={handleReversePayment}
          onClose={() => setActiveReceipt(null)}
        />
      )}

      {/* Add / Edit Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E1D2F]/60 p-4">
          <form
            onSubmit={handleSaveCustomer}
            className="w-full max-w-md bg-white border border-[#D5DCE4] rounded-md shadow-2xl overflow-hidden"
          >
            <div className="bg-[#14283F] text-white px-5 py-4 flex items-center justify-between">
              <span className="text-sm font-bold">
                {editingCustomerId
                  ? 'வாடிக்கையாளர் விவரம் திருத்து (Edit Customer)'
                  : 'புதிய வாடிக்கையாளர் சேர்க்க (Add Customer)'}
              </span>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  வாடிக்கையாளர் பெயர் / Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerForm.full_name}
                  onChange={(e) => setCustomerForm({ ...customerForm, full_name: e.target.value })}
                  className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    மொபைல் எண் (10 digits) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="9840123456"
                    value={customerForm.mobile}
                    onChange={(e) => setCustomerForm({ ...customerForm, mobile: e.target.value })}
                    className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ஊர் / பகுதி (Area) *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerForm.area}
                    onChange={(e) => setCustomerForm({ ...customerForm, area: e.target.value })}
                    className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  முகவரி / கடை பெயர் (Address)
                </label>
                <input
                  type="text"
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  வசூல் பணியாளர் (Assign Collection Staff)
                </label>
                <select
                  value={customerForm.assigned_staff_id}
                  onChange={(e) =>
                    setCustomerForm({ ...customerForm, assigned_staff_id: e.target.value })
                  }
                  className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-md bg-white"
                >
                  <option value="">— நேரடி ஆபீஸ் கணக்கு (Unassigned) —</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.staff_code} — {s.assigned_areas})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ID Proof Type
                  </label>
                  <select
                    value={customerForm.id_proof_type}
                    onChange={(e) =>
                      setCustomerForm({ ...customerForm, id_proof_type: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#D5DCE4] rounded-md bg-white"
                  >
                    <option value="Aadhaar">Aadhaar (Last 4 digits)</option>
                    <option value="PAN">PAN Card</option>
                    <option value="Voter ID">Voter ID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ID Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Last 4 digits"
                    value={customerForm.id_proof_number}
                    onChange={(e) =>
                      setCustomerForm({ ...customerForm, id_proof_number: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#D5DCE4] rounded-md font-mono"
                  />
                </div>
              </div>
              {editingCustomerId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    நிலை / Status
                  </label>
                  <select
                    value={customerForm.status}
                    onChange={(e) => setCustomerForm({ ...customerForm, status: e.target.value })}
                    className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-md bg-white"
                  >
                    <option value="ACTIVE">ACTIVE (செயலில்)</option>
                    <option value="WATCHLIST">WATCHLIST (கவனிக்க)</option>
                    <option value="INACTIVE">INACTIVE (நிறுத்தப்பட்டது — வரலாறு பாதுகாக்கப்படும்)</option>
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E8EDF2]">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  ரத்து
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#244B70] hover:bg-[#14283F] rounded-md"
                >
                  சேமி (Save)
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Give New Loan Modal */}
      {showNewLoanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E1D2F]/60 p-4">
          <form
            onSubmit={handleCreateLoan}
            className="w-full max-w-lg bg-white border border-[#D5DCE4] rounded-md shadow-2xl overflow-hidden"
          >
            <div className="bg-[#14283F] text-white px-5 py-4 flex items-center justify-between">
              <span className="text-sm font-bold">
                {lang === 'ta' ? 'புதிய கடன் வழங்க (Give New Loan)' : 'Create New Daily Loan'}
              </span>
              <button
                type="button"
                onClick={() => setShowNewLoanModal(false)}
                className="text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    வாடிக்கையாளர் / Customer *
                  </label>
                  <select
                    value={newLoanForm.customer_id}
                    onChange={(e) => {
                      const c = customers.find((x) => x.id === e.target.value);
                      setNewLoanForm({
                        ...newLoanForm,
                        customer_id: e.target.value,
                        assigned_staff_id: c?.assigned_staff_id || '',
                      });
                    }}
                    className="w-full px-3 py-2 border border-[#D5DCE4] rounded-md bg-white font-semibold text-[#14283F]"
                  >
                    {customers
                      .filter((c) => c.status !== 'INACTIVE')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name} ({c.area})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    கடன் திட்டம் / Product Template
                  </label>
                  <select
                    value={newLoanForm.product_id}
                    onChange={(e) => {
                      const prod = loanProducts.find((p) => p.id === e.target.value);
                      if (prod) {
                        const P = Number(prod.default_principal);
                        const upfront = Math.round((P * Number(prod.upfront_charge_percent)) / 100);
                        setNewLoanForm({
                          ...newLoanForm,
                          product_id: prod.id,
                          principal_amount: P,
                          upfront_charge_amount: upfront,
                          total_installments: prod.tenure_days,
                        });
                      }
                    }}
                    className="w-full px-3 py-2 border border-[#D5DCE4] rounded-md bg-white"
                  >
                    {loanProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {lang === 'ta' ? p.name_ta : p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    கடன் தொகை (₹)
                  </label>
                  <input
                    type="number"
                    min={500}
                    step={500}
                    value={newLoanForm.principal_amount}
                    onChange={(e) =>
                      setNewLoanForm({ ...newLoanForm, principal_amount: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-[#D5DCE4] rounded-md font-mono font-bold text-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    வட்டி / பிடித்தம் (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={newLoanForm.upfront_charge_amount}
                    onChange={(e) =>
                      setNewLoanForm({
                        ...newLoanForm,
                        upfront_charge_amount: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-[#D5DCE4] rounded-md font-mono font-bold text-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    மொத்த நாட்கள்
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={newLoanForm.total_installments}
                    onChange={(e) =>
                      setNewLoanForm({ ...newLoanForm, total_installments: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-[#D5DCE4] rounded-md font-mono font-bold text-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    பட்டுவாடா முறை (Disbursement Mode)
                  </label>
                  <select
                    value={newLoanForm.disbursement_mode}
                    onChange={(e) =>
                      setNewLoanForm({ ...newLoanForm, disbursement_mode: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#D5DCE4] rounded-md bg-white"
                  >
                    <option value="CASH">Cash (ரொக்கம்)</option>
                    <option value="UPI">UPI / GPay</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    வசூல் பணியாளர் (Assigned Staff)
                  </label>
                  <select
                    value={newLoanForm.assigned_staff_id}
                    onChange={(e) =>
                      setNewLoanForm({ ...newLoanForm, assigned_staff_id: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#D5DCE4] rounded-md bg-white"
                  >
                    <option value="">— நேரடி ஆபீஸ் (Unassigned) —</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.staff_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loanPreview && (
                <div className="bg-[#F7F8FA] border border-[#D5DCE4] rounded-md p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">மொத்த கடன் தொகை (Principal):</span>
                    <span className="font-mono font-bold">{formatINR(loanPreview.principalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-amber-800">
                    <span>(-) வட்டி / பிடித்தம் (Upfront Deduction):</span>
                    <span className="font-mono font-semibold">
                      - {formatINR(loanPreview.totalDisclosedCharges)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#D5DCE4] text-base font-bold text-[#188A78]">
                    <span>கையில் கொடுக்கும் தொகை (Cash to Give Hand):</span>
                    <span className="font-mono text-lg">{formatINR(loanPreview.actualCashPayout)}</span>
                  </div>
                  <div className="flex justify-between pt-1 text-xs font-semibold text-[#244B70]">
                    <span>தினசரி தவணை (Daily Installment):</span>
                    <span className="font-mono">
                      {formatINR(loanPreview.dailyInstallment)} × {loanPreview.totalInstallments} நாட்கள்
                      {loanPreview.lastInstallment !== loanPreview.dailyInstallment
                        ? ` (கடைசி தவணை: ${formatINR(loanPreview.lastInstallment)})`
                        : ''}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Effective Annual Rate (APR - KFS Disclosure):</span>
                    <span className="font-mono font-semibold">{loanPreview.apr}% p.a.</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E8EDF2]">
                <button
                  type="button"
                  onClick={() => setShowNewLoanModal(false)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  ரத்து
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-[#244B70] hover:bg-[#14283F] rounded-md"
                >
                  கடன் வழங்க உறுதி செய் ({formatINR(loanPreview?.actualCashPayout)})
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Customer History Modal */}
      {selectedCustomerProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E1D2F]/60 p-4">
          <div className="w-full max-w-3xl bg-white border border-[#D5DCE4] rounded-md shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="bg-[#14283F] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">
                  {selectedCustomerProfile.customer.full_name} ({selectedCustomerProfile.customer.customer_code})
                </h3>
                <p className="text-xs text-slate-300">
                  {selectedCustomerProfile.customer.mobile} • {selectedCustomerProfile.customer.area}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomerProfile(null)}
                className="text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-5 text-sm">
              <div>
                <h4 className="font-bold text-[#14283F] mb-2">கடன் கணக்குகள் (Loans)</h4>
                {selectedCustomerProfile.loans.length === 0 ? (
                  <p className="text-slate-500">கடன்கள் எதுவும் இல்லை.</p>
                ) : (
                  <table className="w-full text-sm border border-[#D5DCE4]">
                    <thead>
                      <tr className="bg-[#F7F8FA] border-b border-[#D5DCE4] text-xs text-slate-600">
                        <th className="py-2 px-3 text-left">கடன் எண்</th>
                        <th className="py-2 px-3 text-right">கடன் தொகை</th>
                        <th className="py-2 px-3 text-right">கட்டியது</th>
                        <th className="py-2 px-3 text-right">பாக்கி</th>
                        <th className="py-2 px-3 text-center">நிலை</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8EDF2]">
                      {selectedCustomerProfile.loans.map((l: any) => (
                        <tr key={l.id}>
                          <td className="py-2 px-3 font-mono font-bold text-[#244B70]">{l.loan_number}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatINR(l.principal_amount)}</td>
                          <td className="py-2 px-3 text-right font-mono text-[#188A78]">
                            {formatINR(l.amount_collected)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {formatINR(l.outstanding_balance)}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-xs">{l.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div>
                <h4 className="font-bold text-[#14283F] mb-2">வசூல் ரசீதுகள் (Payments)</h4>
                {selectedCustomerProfile.payments.length === 0 ? (
                  <p className="text-slate-500">வசூல் பதிவுகள் எதுவும் இல்லை.</p>
                ) : (
                  <table className="w-full text-sm border border-[#D5DCE4]">
                    <thead>
                      <tr className="bg-[#F7F8FA] border-b border-[#D5DCE4] text-xs text-slate-600">
                        <th className="py-2 px-3 text-left">ரசீது</th>
                        <th className="py-2 px-3 text-left">தேதி</th>
                        <th className="py-2 px-3 text-right">தொகை</th>
                        <th className="py-2 px-3 text-center">நிலை</th>
                        <th className="py-2 px-3 text-right">பார்வை</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8EDF2]">
                      {selectedCustomerProfile.payments.map((p: any) => (
                        <tr key={p.id} className={p.status === 'REVERSED' ? 'line-through text-slate-400' : ''}>
                          <td className="py-2 px-3 font-mono font-semibold text-[#244B70]">{p.receipt_number}</td>
                          <td className="py-2 px-3 font-mono">{p.payment_date}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-[#188A78]">
                            {formatINR(p.amount_collected)}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-xs">{p.status}</td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => handleOpenReceiptByNumber(p.receipt_number)}
                              className="text-xs font-semibold text-[#244B70] underline"
                            >
                              ரசீது / ரத்து
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loan Schedule Modal */}
      {selectedLoanDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E1D2F]/60 p-4">
          <div className="w-full max-w-3xl bg-white border border-[#D5DCE4] rounded-md shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="bg-[#14283F] text-white px-5 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold">
                {selectedLoanDetails.loan.customer_name} — {selectedLoanDetails.loan.loan_number} தவணை அட்டவணை (APR: {selectedLoanDetails.loan.apr_percent}%)
              </h3>
              <button
                onClick={() => setSelectedLoanDetails(null)}
                className="text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <table className="w-full text-sm border border-[#D5DCE4]">
                <thead>
                  <tr className="bg-[#F7F8FA] border-b border-[#D5DCE4] text-xs text-slate-600">
                    <th className="py-2 px-3 text-left">தவணை எண்</th>
                    <th className="py-2 px-3 text-left">தேதி</th>
                    <th className="py-2 px-3 text-right">தவணைத் தொகை</th>
                    <th className="py-2 px-3 text-right">கட்டியது</th>
                    <th className="py-2 px-3 text-center">நிலை</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EDF2] font-mono">
                  {selectedLoanDetails.schedules.map((s: any) => (
                    <tr key={s.id}>
                      <td className="py-2 px-3">#{s.installment_no}</td>
                      <td className="py-2 px-3">{s.due_date}</td>
                      <td className="py-2 px-3 text-right">{formatINR(s.scheduled_amount)}</td>
                      <td className="py-2 px-3 text-right text-[#188A78] font-bold">
                        {formatINR(s.paid_amount)}
                      </td>
                      <td className="py-2 px-3 text-center text-xs">{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showNewStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E1D2F]/60 p-4">
          <form
            onSubmit={handleCreateStaff}
            className="w-full max-w-md bg-white border border-[#D5DCE4] rounded-md shadow-2xl overflow-hidden"
          >
            <div className="bg-[#14283F] text-white px-5 py-4 flex items-center justify-between">
              <span className="text-sm font-bold">புதிய வசூல் பணியாளர் சேர்க்க (Add Staff)</span>
              <button
                type="button"
                onClick={() => setShowNewStaffModal(false)}
                className="text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">பெயர் / Name *</label>
                <input
                  type="text"
                  required
                  value={newStaffForm.full_name}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, full_name: e.target.value })}
                  className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">மொபைல் எண் (10 digits) *</label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={newStaffForm.phone}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                  className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-md font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">வசூல் பகுதி / Route Areas *</label>
                <input
                  type="text"
                  required
                  value={newStaffForm.assigned_areas}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, assigned_areas: e.target.value })}
                  className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Login Username *</label>
                  <input
                    type="text"
                    required
                    value={newStaffForm.username}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, username: e.target.value })}
                    className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password (Min 4 chars) *</label>
                  <input
                    type="text"
                    required
                    minLength={4}
                    autoComplete="off"
                    placeholder="e.g. 123456"
                    value={newStaffForm.password}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                    className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-md font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E8EDF2]">
                <button
                  type="button"
                  onClick={() => setShowNewStaffModal(false)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  ரத்து
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#244B70] rounded-md"
                >
                  சேமி (Save)
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Reset Staff Password Modal */}
      {resetStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E1D2F]/60 p-4">
          <form
            onSubmit={handleResetStaffPassword}
            className="w-full max-w-sm bg-white border border-[#D5DCE4] rounded-md shadow-2xl overflow-hidden"
          >
            <div className="bg-[#14283F] text-white px-5 py-4 flex items-center justify-between">
              <span className="text-sm font-bold">
                {resetStaffModal.full_name} — கடவுச்சொல் மாற்றம்
              </span>
              <button
                type="button"
                onClick={() => setResetStaffModal(null)}
                className="text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  பயனர் பெயர் / Login Username *
                </label>
                <input
                  type="text"
                  required
                  value={resetStaffModal.username}
                  onChange={(e) =>
                    setResetStaffModal({ ...resetStaffModal, username: e.target.value })
                  }
                  className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-md font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  புதிய கடவுச்சொல் / New Password (Min 4 chars) *
                </label>
                <input
                  type="text"
                  required
                  minLength={4}
                  autoFocus
                  placeholder="புதிய கடவுச்சொல்லை உள்ளிடவும்"
                  value={resetStaffModal.password}
                  onChange={(e) =>
                    setResetStaffModal({ ...resetStaffModal, password: e.target.value })
                  }
                  className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-md font-mono font-bold"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E8EDF2]">
                <button
                  type="button"
                  onClick={() => setResetStaffModal(null)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  ரத்து
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#244B70] rounded-md"
                >
                  கடவுச்சொல் மாற்று
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Missed Collection Modal */}
      {missedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E1D2F]/60 p-4">
          <form
            onSubmit={handleMarkMissed}
            className="w-full max-w-md bg-white border border-[#D5DCE4] rounded-md shadow-2xl overflow-hidden"
          >
            <div className="bg-red-800 text-white px-5 py-4 flex items-center justify-between">
              <span className="text-sm font-bold">
                இன்று தவணை கட்டவில்லை — {missedModal.customer_name} ({missedModal.loan_number})
              </span>
              <button
                type="button"
                onClick={() => setMissedModal(null)}
                className="text-red-200 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <p className="text-xs text-slate-600">
                இந்த வாடிக்கையாளரின் இன்றைய தவணை <strong>பழைய பாக்கியில் (Arrears / Overdue)</strong> சேர்க்கப்பட்டு, நாளை இரண்டு நாள் தவணையாகக் காட்டப்படும்.
              </p>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  காரணத்தைத் தேர்ந்தெடுக்கவும் / Reason *
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    'நாளை சேர்த்து தருவதாகச் சொன்னார் (Promised Tomorrow)',
                    'கடை பூட்டியிருந்தது (Shop Closed)',
                    'பணம் இல்லை / வெளியூர் சென்றார் (No Cash / Out of Town)',
                  ].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setMissedModal({ ...missedModal, reason: r })}
                      className={`text-left px-3 py-2 text-xs font-semibold rounded border ${
                        missedModal.reason === r
                          ? 'bg-red-50 border-red-400 text-red-900'
                          : 'bg-[#F7F8FA] border-[#D5DCE4] text-slate-700'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  value={missedModal.reason}
                  onChange={(e) => setMissedModal({ ...missedModal, reason: e.target.value })}
                  placeholder="வேறு காரணம் இருந்தால் எழுதவும்..."
                  className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-md mt-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E8EDF2]">
                <button
                  type="button"
                  onClick={() => setMissedModal(null)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  ரத்து
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-md"
                >
                  இன்று கட்டவில்லை எனப் பதிவு செய்
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
