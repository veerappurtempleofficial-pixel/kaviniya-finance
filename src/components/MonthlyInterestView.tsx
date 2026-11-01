import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  IndianRupee,
  CheckCircle2,
  Trash2,
  Calendar,
  Percent,
  X,
  History,
} from 'lucide-react';
import { formatINR, Lang } from '../i18n';

interface MonthlyInterestViewProps {
  token: string;
  lang: Lang;
  onRefreshGlobal: () => void;
  showToast: (text: string, type?: 'ok' | 'err') => void;
}

export const MonthlyInterestView: React.FC<MonthlyInterestViewProps> = ({
  token,
  lang,
  onRefreshGlobal,
  showToast,
}) => {
  const [loans, setLoans] = useState<any[]>([]);
  const [today, setToday] = useState<string>(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'CLOSED' | 'ALL'>('ACTIVE');

  // New Monthly Loan Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualInterestEdited, setManualInterestEdited] = useState(false);
  const [addForm, setAddForm] = useState({
    customer_name: '',
    mobile: '',
    area: '',
    notes: '',
    principal_amount: 50000,
    interest_percent: 3,
    monthly_interest_amount: 1500,
    start_date: new Date().toISOString().slice(0, 10),
    disbursement_mode: 'CASH',
  });

  // Record Monthly Interest / Part Principal Modal
  const [payModal, setPayModal] = useState<any | null>(null);
  const [payForm, setPayForm] = useState({
    payment_type: 'INTEREST',
    amount_paid: 0,
    payment_date: new Date().toISOString().slice(0, 10),
    payment_mode: 'CASH',
    notes: '',
  });

  // Close / Settle Loan with Discount Modal
  const [closeModal, setCloseModal] = useState<any | null>(null);
  const [closeForm, setCloseForm] = useState({
    total_due: 0,
    settlement_amount: 0,
    discount_amount: 0,
    closed_date: new Date().toISOString().slice(0, 10),
    payment_mode: 'CASH',
    notes: '',
  });

  // Payment History Modal
  const [historyLoan, setHistoryLoan] = useState<any | null>(null);

  const loadMonthlyLoans = useCallback(async () => {
    const res = await fetch('/api/monthly-loans', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setLoans(data.loans || []);
      if (data.today) setToday(data.today);
    }
  }, [token]);

  useEffect(() => {
    loadMonthlyLoans();
  }, [loadMonthlyLoans]);

  // Auto-calculate monthly interest when principal or percent changes unless manually overridden
  const handlePrincipalOrPercentChange = (principal: number, percent: number) => {
    const autoAmt = Math.round((principal * percent) / 100);
    setAddForm((prev) => ({
      ...prev,
      principal_amount: principal,
      interest_percent: percent,
      monthly_interest_amount: manualInterestEdited ? prev.monthly_interest_amount : autoAmt,
    }));
  };

  const handleCreateMonthlyLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/monthly-loans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(addForm),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to create monthly loan', 'err');
      return;
    }
    setShowAddModal(false);
    setManualInterestEdited(false);
    setAddForm({
      customer_name: '',
      mobile: '',
      area: '',
      notes: '',
      principal_amount: 50000,
      interest_percent: 3,
      monthly_interest_amount: 1500,
      start_date: today,
      disbursement_mode: 'CASH',
    });
    showToast(`மாத வட்டி கடன் (${data.loan.loan_code}) சேர்க்கப்பட்டது!`);
    await loadMonthlyLoans();
    onRefreshGlobal();
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModal) return;
    const res = await fetch(`/api/monthly-loans/${payModal.id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payForm),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Payment failed', 'err');
      return;
    }
    setPayModal(null);
    showToast('வட்டி / அசல் வரவு வெற்றிகரமாகப் பதிவானது!');
    await loadMonthlyLoans();
    onRefreshGlobal();
  };

  const handleCloseLoanWithDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeModal) return;
    const res = await fetch(`/api/monthly-loans/${closeModal.id}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(closeForm),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to close loan', 'err');
      return;
    }
    setCloseModal(null);
    showToast(`${closeModal.customer_name} கணக்கு முழுமையாக முடிக்கப்பட்டது!`);
    await loadMonthlyLoans();
    onRefreshGlobal();
  };

  const handleDeleteMonthlyLoan = async (loan: any) => {
    if (
      !window.confirm(
        `${loan.customer_name} (${loan.loan_code} - ${formatINR(loan.principal_amount)}) மாத வட்டி கணக்கை நிரந்தரமாக நீக்க விரும்புகிறீர்களா?`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/monthly-loans/${loan.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json();
      showToast(data.error || 'Delete failed', 'err');
      return;
    }
    showToast(`${loan.loan_code} கணக்கு நீக்கப்பட்டது`);
    await loadMonthlyLoans();
    onRefreshGlobal();
  };

  const activeLoans = loans.filter((l) => l.status === 'ACTIVE');
  const totalPrincipalOut = activeLoans.reduce((s, l) => s + l.principal_balance, 0);
  const totalMonthlyInterestExpected = activeLoans.reduce((s, l) => s + l.monthly_interest_amount, 0);
  const totalPendingInterestNow = activeLoans.reduce((s, l) => s + l.pending_interest, 0);
  const totalInterestCollectedAll = loans.reduce((s, l) => s + l.interest_paid_total, 0);

  const filteredLoans = loans.filter((l) => {
    if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        l.customer_name.toLowerCase().includes(q) ||
        l.mobile.includes(q) ||
        l.loan_code.toLowerCase().includes(q) ||
        (l.area || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Live preview inside Add Modal for past dates
  const previewStartMs = new Date(`${addForm.start_date}T00:00:00Z`).getTime();
  const previewEndMs = new Date(`${today}T00:00:00Z`).getTime();
  const previewDays = Math.max(0, Math.round((previewEndMs - previewStartMs) / 86400000));
  const previewMonths = Math.floor(previewDays / 30);
  const previewExtraDays = previewDays % 30;
  const previewAccruedInterest = Math.round(
    (Math.max(30, previewDays) / 30) * Number(addForm.monthly_interest_amount || 0)
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="kf-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-[#14283F]">
            {lang === 'ta'
              ? 'மாத வட்டி கணக்குப் பதிவேடு (Monthly Interest Loans)'
              : 'Monthly Interest Loans'}
          </h2>
          <p className="text-sm text-slate-600">
            {lang === 'ta'
              ? 'கடன் கொடுத்த தேதி, வட்டி சதவீதம் (%), இதுவரை வந்த வட்டி பாக்கி மற்றும் தள்ளுபடியுடன் கணக்கு முடித்தல்.'
              : 'Track monthly interest loans by start date, interest %, accrued interest till today, and close with discount.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setManualInterestEdited(false);
            setAddForm((prev) => ({ ...prev, start_date: today }));
            setShowAddModal(true);
          }}
          className="px-4 py-2.5 text-sm font-bold text-white bg-[#244B70] hover:bg-[#14283F] rounded-xl shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {lang === 'ta' ? '+ புதிய மாத வட்டி கடன் சேர்க்க' : '+ Add Monthly Interest Loan'}
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kf-card p-5">
          <div className="text-xs font-bold uppercase text-slate-500">
            வெளியில் உள்ள மொத்த அசல் (Active Principal)
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-[#244B70]">
            {formatINR(totalPrincipalOut)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            நடப்புக் கணக்குகள்: <strong>{activeLoans.length}</strong>
          </div>
        </div>

        <div className="kf-card p-5">
          <div className="text-xs font-bold uppercase text-slate-500">
            மாதாந்திர வட்டி வருமானம் (Per Month)
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-[#188A78]">
            {formatINR(totalMonthlyInterestExpected)}
          </div>
          <div className="text-xs text-slate-500 mt-1">ஒவ்வொரு மாதமும் வர வேண்டிய வட்டி</div>
        </div>

        <div className="kf-card p-5">
          <div className="text-xs font-bold uppercase text-red-700">
            இன்று வரை வர வேண்டிய வட்டி பாக்கி
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-red-600">
            {formatINR(totalPendingInterestNow)}
          </div>
          <div className="text-xs text-slate-500 mt-1">கடன் கொடுத்த தேதியில் இருந்து கணக்கிட்டது</div>
        </div>

        <div className="kf-card p-5">
          <div className="text-xs font-bold uppercase text-slate-500">
            இதுவரை வசூலான மொத்த வட்டி
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-[#14283F]">
            {formatINR(totalInterestCollectedAll)}
          </div>
          <div className="text-xs text-slate-500 mt-1">முடிந்த கணக்குகள்: {loans.length - activeLoans.length}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="kf-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {[
            { id: 'ACTIVE', label: `நடப்பில் உள்ளவை (${activeLoans.length})` },
            { id: 'CLOSED', label: `முடிந்த கணக்குகள் (${loans.length - activeLoans.length})` },
            { id: 'ALL', label: `அனைத்தும் (${loans.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border ${
                statusFilter === tab.id
                  ? 'bg-[#244B70] text-white border-[#244B70]'
                  : 'bg-[#F7F8FA] text-[#14283F] border-[#D5DCE4]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="பெயர் அல்லது போன் நம்பர் தேடுக..."
            className="pl-9 pr-4 py-2 text-xs border border-[#D5DCE4] rounded-xl w-64"
          />
        </div>
      </div>

      {/* Monthly Loans Table */}
      <div className="kf-card overflow-hidden">
        {filteredLoans.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-base font-bold text-[#14283F]">
              மாத வட்டி கணக்குகள் எதுவும் இல்லை.
            </p>
            <p className="text-xs text-slate-500">
              புதிய மாத வட்டி கடன் சேர்க்க மேலே உள்ள "+ புதிய மாத வட்டி கடன் சேர்க்க" பட்டனை அழுத்தவும்.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#F7F8FA] border-b border-[#D5DCE4] text-xs text-slate-600">
                  <th className="py-3.5 px-4 text-left">வாடிக்கையாளர் / Customer</th>
                  <th className="py-3.5 px-4 text-left">கொடுத்த தேதி & காலம்</th>
                  <th className="py-3.5 px-4 text-right">அசல் பாக்கி</th>
                  <th className="py-3.5 px-4 text-right">மாத வட்டி (% / ₹)</th>
                  <th className="py-3.5 px-4 text-right">இதுவரை வட்டி / கட்டியது</th>
                  <th className="py-3.5 px-4 text-right">இப்போது வட்டி பாக்கி</th>
                  <th className="py-3.5 px-4 text-right">இன்று முடிக்க மொத்தம்</th>
                  <th className="py-3.5 px-4 text-right">செயல் / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EDF2]">
                {filteredLoans.map((l) => (
                  <tr key={l.id} className="hover:bg-[#F7F8FA]">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#244B70]">
                          {l.loan_code}
                        </span>
                        <span className="font-bold text-[#14283F]">{l.customer_name}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {l.mobile} {l.area ? `• ${l.area}` : ''}
                      </div>
                      {l.notes && <div className="text-[11px] text-slate-500 mt-0.5">{l.notes}</div>}
                    </td>

                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-[#14283F]">{l.start_date}</div>
                      <div className="text-xs text-slate-500">
                        {l.full_months > 0 ? `${l.full_months} மாதம் ` : ''}
                        {l.extra_days} நாட்கள் ({l.elapsed_days}d)
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono">
                      <div className="font-extrabold text-[#14283F]">
                        {formatINR(l.principal_balance)}
                      </div>
                      {l.principal_paid > 0 && (
                        <div className="text-[11px] text-slate-500">
                          மொத்த அசல்: {formatINR(l.principal_amount)}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono">
                      <div className="font-bold text-[#244B70]">
                        {formatINR(l.monthly_interest_amount)}/மாதம்
                      </div>
                      <div className="text-xs text-slate-500">{l.interest_percent}% வட்டி</div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono">
                      <div className="text-xs text-slate-600">
                        மொத்த வட்டி: <strong>{formatINR(l.total_interest_accrued)}</strong>
                      </div>
                      <div className="text-xs font-bold text-[#188A78]">
                        கட்டியது: {formatINR(l.interest_paid_total)}
                      </div>
                      {l.discount_amount > 0 && (
                        <div className="text-[11px] text-amber-700">
                          தள்ளுபடி: {formatINR(l.discount_amount)}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono">
                      {l.status === 'CLOSED' ? (
                        <span className="px-2 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-700 rounded">
                          CLOSED ({l.closed_date})
                        </span>
                      ) : (
                        <span className="font-extrabold text-red-600 text-base">
                          {formatINR(l.pending_interest)}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono">
                      {l.status === 'CLOSED' ? (
                        <div className="text-xs text-slate-500">
                          முடித்த தொகை: <strong>{formatINR(l.closed_settlement_amount)}</strong>
                        </div>
                      ) : (
                        <div className="font-extrabold text-base text-[#14283F]">
                          {formatINR(l.total_to_close_today)}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex flex-wrap justify-end items-center gap-1.5">
                        {l.status === 'ACTIVE' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setPayModal(l);
                                setPayForm({
                                  payment_type: 'INTEREST',
                                  amount_paid:
                                    l.pending_interest > 0
                                      ? l.pending_interest
                                      : l.monthly_interest_amount,
                                  payment_date: today,
                                  payment_mode: 'CASH',
                                  notes: '',
                                });
                              }}
                              className="px-2.5 py-1.5 text-xs font-bold text-white bg-[#188A78] hover:opacity-90 rounded-lg"
                            >
                              + வட்டி வரவு
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setCloseModal(l);
                                setCloseForm({
                                  total_due: l.total_to_close_today,
                                  settlement_amount: l.total_to_close_today,
                                  discount_amount: 0,
                                  closed_date: today,
                                  payment_mode: 'CASH',
                                  notes: '',
                                });
                              }}
                              className="px-2.5 py-1.5 text-xs font-bold text-white bg-[#244B70] hover:opacity-90 rounded-lg"
                            >
                              ✓ கணக்கு முடி
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => setHistoryLoan(l)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-[#14283F] bg-[#F7F8FA] border border-[#D5DCE4] rounded-lg flex items-center gap-1"
                        >
                          <History className="w-3.5 h-3.5" />
                          ({(l.payments || []).length})
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteMonthlyLoan(l)}
                          title="Delete Wrong Entry"
                          className="p-1.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =====================================================================
          MODAL 1: ADD NEW MONTHLY INTEREST LOAN
      ===================================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleCreateMonthlyLoan}
            className="w-full max-w-lg bg-white border border-[#D5DCE4] rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="bg-[#14283F] text-white px-5 py-4 flex items-center justify-between">
              <span className="text-sm font-bold">
                புதிய மாத வட்டி கடன் சேர்க்க (Add Monthly Interest Loan)
              </span>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    வாடிக்கையாளர் பெயர் / Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={addForm.customer_name}
                    onChange={(e) => setAddForm({ ...addForm, customer_name: e.target.value })}
                    placeholder="பெயர் உள்ளிடவும்"
                    className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    மொபைல் எண் (10 digits) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={addForm.mobile}
                    onChange={(e) => setAddForm({ ...addForm, mobile: e.target.value })}
                    placeholder="9840123456"
                    className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ஊர் / முகவரி (Area)
                  </label>
                  <input
                    type="text"
                    value={addForm.area}
                    onChange={(e) => setAddForm({ ...addForm, area: e.target.value })}
                    placeholder="மணப்பாறை / வீரப்பூர்"
                    className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    கடன் கொடுத்த தேதி (Start Date) *
                  </label>
                  <input
                    type="date"
                    required
                    value={addForm.start_date}
                    onChange={(e) => setAddForm({ ...addForm, start_date: e.target.value })}
                    className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    அசல் தொகை (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={500}
                    step={500}
                    value={addForm.principal_amount}
                    onChange={(e) =>
                      handlePrincipalOrPercentChange(
                        Number(e.target.value),
                        Number(addForm.interest_percent)
                      )
                    }
                    className="w-full px-3 py-2 border border-[#D5DCE4] rounded-xl font-mono font-bold text-base"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    மாத வட்டி (%) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={50}
                    step={0.25}
                    value={addForm.interest_percent}
                    onChange={(e) => {
                      setManualInterestEdited(false);
                      handlePrincipalOrPercentChange(
                        Number(addForm.principal_amount),
                        Number(e.target.value)
                      );
                    }}
                    className="w-full px-3 py-2 border border-[#D5DCE4] rounded-xl font-mono font-bold text-base"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    மாத வட்டி (₹) (Editable) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={addForm.monthly_interest_amount}
                    onChange={(e) => {
                      setManualInterestEdited(true);
                      const amt = Number(e.target.value);
                      const pct =
                        addForm.principal_amount > 0
                          ? Number(((amt * 100) / addForm.principal_amount).toFixed(2))
                          : addForm.interest_percent;
                      setAddForm({
                        ...addForm,
                        monthly_interest_amount: amt,
                        interest_percent: pct,
                      });
                    }}
                    className="w-full px-3 py-2 border border-[#D5DCE4] rounded-xl font-mono font-bold text-base text-[#188A78]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    பணம் கொடுத்த முறை (Mode)
                  </label>
                  <select
                    value={addForm.disbursement_mode}
                    onChange={(e) => setAddForm({ ...addForm, disbursement_mode: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D5DCE4] rounded-xl bg-white"
                  >
                    <option value="CASH">Cash (ரொக்கம்)</option>
                    <option value="UPI">UPI / GPay</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    குறிப்பு / பத்திரம் விவரம் (Notes)
                  </label>
                  <input
                    type="text"
                    value={addForm.notes}
                    onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                    placeholder="உதாரணம்: புரோநோட்டு / காசோலை"
                    className="w-full px-3 py-2 border border-[#D5DCE4] rounded-xl"
                  />
                </div>
              </div>

              {/* Live Accrued Calculation Preview */}
              <div className="bg-[#F7F8FA] border border-[#D5DCE4] rounded-xl p-4 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">கடன் கொடுத்த தேதி முதல் இன்று வரை:</span>
                  <span className="font-mono font-bold text-[#14283F]">
                    {previewMonths > 0 ? `${previewMonths} மாதம் ` : ''}
                    {previewExtraDays} நாட்கள் ({previewDays} நாட்கள்)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">மாத வட்டி ({addForm.interest_percent}%):</span>
                  <span className="font-mono font-bold text-[#188A78]">
                    {formatINR(addForm.monthly_interest_amount)} / மாதம்
                  </span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-[#D5DCE4] text-sm font-bold">
                  <span className="text-[#14283F]">இன்று வரை மொத்த வட்டி:</span>
                  <span className="font-mono text-red-600">{formatINR(previewAccruedInterest)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-[#244B70]">
                  <span>இன்று கணக்கை முடிக்க மொத்தம் தர வேண்டியது:</span>
                  <span className="font-mono">
                    {formatINR(Number(addForm.principal_amount) + previewAccruedInterest)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E8EDF2]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  ரத்து
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-bold text-white bg-[#244B70] hover:bg-[#14283F] rounded-xl"
                >
                  மாத வட்டி கணக்கைச் சேமி
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: RECORD MONTHLY INTEREST OR PARTIAL PRINCIPAL PAYMENT
      ===================================================================== */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleRecordPayment}
            className="w-full max-w-md bg-white border border-[#D5DCE4] rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="bg-[#14283F] text-white px-5 py-4 flex items-center justify-between">
              <span className="text-sm font-bold">
                வட்டி / அசல் வரவு — {payModal.customer_name} ({payModal.loan_code})
              </span>
              <button
                type="button"
                onClick={() => setPayModal(null)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPayForm({
                      ...payForm,
                      payment_type: 'INTEREST',
                      amount_paid:
                        payModal.pending_interest > 0
                          ? payModal.pending_interest
                          : payModal.monthly_interest_amount,
                    })
                  }
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs border ${
                    payForm.payment_type === 'INTEREST'
                      ? 'bg-[#188A78] text-white border-[#188A78]'
                      : 'bg-[#F7F8FA] text-[#14283F] border-[#D5DCE4]'
                  }`}
                >
                  மாத வட்டி வரவு (Interest)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPayForm({
                      ...payForm,
                      payment_type: 'PRINCIPAL',
                      amount_paid: payModal.principal_balance,
                    })
                  }
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs border ${
                    payForm.payment_type === 'PRINCIPAL'
                      ? 'bg-[#244B70] text-white border-[#244B70]'
                      : 'bg-[#F7F8FA] text-[#14283F] border-[#D5DCE4]'
                  }`}
                >
                  அசல் வரவு (Principal Part)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    வசூல் தொகை (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={payForm.amount_paid}
                    onChange={(e) => setPayForm({ ...payForm, amount_paid: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-xl font-mono font-bold text-base"
                  />
                  <div className="flex gap-1.5 mt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setPayForm({ ...payForm, amount_paid: payModal.monthly_interest_amount })
                      }
                      className="px-2 py-0.5 text-[11px] font-semibold bg-[#F7F8FA] border border-[#D5DCE4] rounded"
                    >
                      1 மாதம் ({formatINR(payModal.monthly_interest_amount)})
                    </button>
                    {payModal.pending_interest > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPayForm({ ...payForm, amount_paid: payModal.pending_interest })
                        }
                        className="px-2 py-0.5 text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 rounded"
                      >
                        பாக்கி ({formatINR(payModal.pending_interest)})
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    தேதி / Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={payForm.payment_date}
                    onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })}
                    className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">முறை / Mode</label>
                  <select
                    value={payForm.payment_mode}
                    onChange={(e) => setPayForm({ ...payForm, payment_mode: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D5DCE4] rounded-xl bg-white"
                  >
                    <option value="CASH">Cash (ரொக்கம்)</option>
                    <option value="UPI">UPI / GPay</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">குறிப்பு</label>
                  <input
                    type="text"
                    value={payForm.notes}
                    onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                    placeholder="Optional note"
                    className="w-full px-3 py-2 border border-[#D5DCE4] rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E8EDF2]">
                <button
                  type="button"
                  onClick={() => setPayModal(null)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  ரத்து
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold text-white bg-[#188A78] rounded-xl"
                >
                  வரவு வை ({formatINR(payForm.amount_paid)})
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: CLOSE MONTHLY LOAN WITH DISCOUNT (தள்ளுபடியுடன் கணக்கு முடித்தல்)
      ===================================================================== */}
      {closeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleCloseLoanWithDiscount}
            className="w-full max-w-md bg-white border border-[#D5DCE4] rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="bg-[#14283F] text-white px-5 py-4 flex items-center justify-between">
              <span className="text-sm font-bold">
                மொத்தமாகப் பணம் வாங்கி கணக்கு முடித்தல் — {closeModal.customer_name}
              </span>
              <button
                type="button"
                onClick={() => setCloseModal(null)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              <div className="bg-[#F7F8FA] border border-[#D5DCE4] rounded-xl p-4 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">அசல் பாக்கி (Principal Balance):</span>
                  <span className="font-mono font-bold text-[#14283F]">
                    {formatINR(closeModal.principal_balance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    இன்று வரை வட்டி பாக்கி ({closeModal.elapsed_days} நாட்கள்):
                  </span>
                  <span className="font-mono font-bold text-red-600">
                    + {formatINR(closeModal.pending_interest)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#D5DCE4] text-sm font-extrabold text-[#14283F]">
                  <span>மொத்தம் தர வேண்டிய தொகை (Total Payable):</span>
                  <span className="font-mono">{formatINR(closeModal.total_to_close_today)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#188A78] mb-1">
                    வாங்கிய மொத்த தொகை (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={closeForm.settlement_amount}
                    onChange={(e) => {
                      const settled = Number(e.target.value);
                      const disc = Math.max(0, closeModal.total_to_close_today - settled);
                      setCloseForm({
                        ...closeForm,
                        settlement_amount: settled,
                        discount_amount: disc,
                      });
                    }}
                    className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-xl font-mono font-extrabold text-base text-[#188A78]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-700 mb-1">
                    தள்ளுபடி / Discount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={closeForm.discount_amount}
                    onChange={(e) => {
                      const disc = Number(e.target.value);
                      const settled = Math.max(0, closeModal.total_to_close_today - disc);
                      setCloseForm({
                        ...closeForm,
                        discount_amount: disc,
                        settlement_amount: settled,
                      });
                    }}
                    className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-xl font-mono font-bold text-base text-amber-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    முடித்த தேதி / Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={closeForm.closed_date}
                    onChange={(e) => setCloseForm({ ...closeForm, closed_date: e.target.value })}
                    className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">முறை / Mode</label>
                  <select
                    value={closeForm.payment_mode}
                    onChange={(e) => setCloseForm({ ...closeForm, payment_mode: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D5DCE4] rounded-xl bg-white"
                  >
                    <option value="CASH">Cash (ரொக்கம்)</option>
                    <option value="UPI">UPI / GPay</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  குறிப்பு (Notes)
                </label>
                <input
                  type="text"
                  value={closeForm.notes}
                  onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })}
                  placeholder="உதாரணம்: வட்டியில் ₹500 தள்ளுபடி செய்து கணக்கு முடிக்கப்பட்டது"
                  className="w-full px-3.5 py-2 border border-[#D5DCE4] rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E8EDF2]">
                <button
                  type="button"
                  onClick={() => setCloseModal(null)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  ரத்து
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-bold text-white bg-[#244B70] rounded-xl"
                >
                  ✓ கணக்கை முழுமையாக முடி ({formatINR(closeForm.settlement_amount)})
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: PAYMENT HISTORY
      ===================================================================== */}
      {historyLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl bg-white border border-[#D5DCE4] rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-[#14283F] text-white px-5 py-4 flex items-center justify-between">
              <span className="text-sm font-bold">
                {historyLoan.customer_name} ({historyLoan.loan_code}) — வரவு வரலாறு
              </span>
              <button
                type="button"
                onClick={() => setHistoryLoan(null)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 max-h-[70vh] overflow-y-auto">
              {(historyLoan.payments || []).length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">
                  இன்னும் வட்டி அல்லது அசல் வரவு எதுவும் பதிவாகவில்லை.
                </p>
              ) : (
                <table className="w-full text-sm border border-[#D5DCE4]">
                  <thead>
                    <tr className="bg-[#F7F8FA] border-b border-[#D5DCE4] text-xs text-slate-600">
                      <th className="py-2 px-3 text-left">ரசீது</th>
                      <th className="py-2 px-3 text-left">தேதி</th>
                      <th className="py-2 px-3 text-left">வகை</th>
                      <th className="py-2 px-3 text-right">தொகை</th>
                      <th className="py-2 px-3 text-right">தள்ளுபடி</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EDF2] font-mono">
                    {historyLoan.payments.map((p: any) => (
                      <tr key={p.id}>
                        <td className="py-2 px-3 font-bold text-[#244B70]">{p.receipt_no}</td>
                        <td className="py-2 px-3">{p.payment_date}</td>
                        <td className="py-2 px-3 text-xs">{p.payment_type}</td>
                        <td className="py-2 px-3 text-right font-bold text-[#188A78]">
                          {formatINR(p.amount_paid)}
                        </td>
                        <td className="py-2 px-3 text-right text-amber-700">
                          {p.discount_given > 0 ? formatINR(p.discount_given) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
