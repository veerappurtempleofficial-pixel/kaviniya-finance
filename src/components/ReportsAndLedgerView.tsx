import React, { useState, useEffect } from 'react';
import { Download, Printer, PlusCircle, Wallet, BookOpen } from 'lucide-react';
import { formatINR, Lang } from '../i18n';

const REPORT_TYPES = [
  { id: 'daily-collection', label: 'Daily Collection Report (தினசரி வசூல் அறிக்கை)', ownerOnly: false },
  { id: 'monthly-collection', label: 'Monthly Collection Report (மாதாந்திர வசூல் அறிக்கை)', ownerOnly: false },
  { id: 'outstanding', label: 'Customer Pending Balance (வாடிக்கையாளர் நிலுவை அறிக்கை)', ownerOnly: false },
  { id: 'overdue', label: 'Overdue Accounts Report (தவணை தவறியவர்கள் அறிக்கை)', ownerOnly: false },
  { id: 'disbursement', label: 'Loan Disbursement Report (வழங்கிய கடன்கள் அறிக்கை)', ownerOnly: false },
  { id: 'renewals', label: 'Loan Renewal Report (கடன் புதுப்பித்தல் அறிக்கை)', ownerOnly: false },
  { id: 'staff-performance', label: 'Staff Collection Report (பணியாளர் வசூல் அறிக்கை)', ownerOnly: false },
  { id: 'cash-book', label: 'Cash Book (ரொக்கப் புத்தகம் - வரவு செலவு)', ownerOnly: false },
  { id: 'reversals', label: 'Cancelled Receipts Report (ரத்து செய்யப்பட்ட ரசீதுகள்)', ownerOnly: false },
  { id: 'income-expense', label: 'Profit & Expense Statement (வருவாய் & செலவு கணக்கு)', ownerOnly: true },
  { id: 'cash-flow', label: 'Cash Flow Statement (ரொக்க ஓட்ட அறிக்கை)', ownerOnly: true },
];

export const FinancialReportsView: React.FC<{
  token: string;
  currentUser: any;
  lang: Lang;
}> = ({ token, currentUser }) => {
  const today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  const [selectedReport, setSelectedReport] = useState('daily-collection');
  const [fromDate, setFromDate] = useState(`${today.slice(0, 4)}-01-01`);
  const [toDate, setToDate] = useState(today);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const visibleReports = REPORT_TYPES.filter(
    (r) => !r.ownerOnly || currentUser?.role_code === 'OWNER'
  );

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/${selectedReport}?from=${fromDate}&to=${toDate}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setReportData(d))
      .catch(() => setReportData(null))
      .finally(() => setLoading(false));
  }, [selectedReport, fromDate, toDate, token]);

  const handleExportCSV = () => {
    const rows = reportData?.rows || [];
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.map((h) => `"${h.toUpperCase()}"`).join(','),
      ...rows.map((row: any) =>
        headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ];
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KAVINIYA_${selectedReport}_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rows = reportData?.rows || [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#D5DCE4] rounded-md p-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              அறிக்கை வகை / Select Report
            </label>
            <select
              value={selectedReport}
              onChange={(e) => setSelectedReport(e.target.value)}
              className="px-3.5 py-2.5 text-sm font-semibold text-[#14283F] border border-[#D5DCE4] rounded-md bg-white min-w-[300px]"
            >
              {visibleReports.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">முதல் / From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 text-sm border border-[#D5DCE4] rounded-md font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">வரை / To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 text-sm border border-[#D5DCE4] rounded-md font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2.5 text-sm font-medium text-[#14283F] bg-[#F7F8FA] border border-[#D5DCE4] hover:bg-[#E8EDF2] rounded-md flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={rows.length === 0}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-[#188A78] hover:bg-[#136F60] disabled:opacity-50 rounded-md flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Excel / CSV பதிவிறக்கம்
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#D5DCE4] rounded-md overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading report...</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            இந்த அறிக்கையில் இன்னும் பதிவுகள் எதுவும் இல்லை. (No records found for this period.)
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#F7F8FA] border-b border-[#D5DCE4] text-xs uppercase text-slate-600">
                  {columns.map((col) => (
                    <th
                      key={col}
                      className={`py-3 px-4 ${
                        typeof rows[0][col] === 'number' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EDF2]">
                {rows.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-[#F7F8FA]">
                    {columns.map((col) => {
                      const val = row[col];
                      const isNum = typeof val === 'number';
                      const isCountCol =
                        col.includes('count') || col.includes('installment') || col === 'receipts' || col === 'apr';
                      return (
                        <td
                          key={col}
                          className={`py-3 px-4 ${
                            isNum
                              ? 'text-right font-mono tabular-nums font-semibold text-[#14283F]'
                              : 'text-slate-700'
                          }`}
                        >
                          {isNum
                            ? col === 'apr'
                              ? `${val}%`
                              : isCountCol
                              ? val
                              : formatINR(val)
                            : String(val ?? '—')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const CashBookAndExpensesView: React.FC<{
  token: string;
  currentUser: any;
  lang: Lang;
  onRefresh: () => void;
}> = ({ token, currentUser, onRefresh }) => {
  const [data, setData] = useState<any>(null);
  const [capitalAmount, setCapitalAmount] = useState('');
  const [capitalMode, setCapitalMode] = useState('CASH');
  const [capitalNote, setCapitalNote] = useState('முதல் தொகை (Opening Capital)');
  const [category, setCategory] = useState('ஆபீஸ் வாடகை & கரண்ட் பில் (Office Rent)');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseMode, setExpenseMode] = useState('CASH');
  const [submitting, setSubmitting] = useState(false);

  const loadCashbook = () => {
    fetch('/api/cashbook', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setData(d));
  };

  useEffect(() => {
    loadCashbook();
  }, [token]);

  const handleAddCapital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capitalAmount) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/cashbook/capital', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Number(capitalAmount),
          payment_mode: capitalMode,
          description: capitalNote,
        }),
      });
      if (res.ok) {
        setCapitalAmount('');
        loadCashbook();
        onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category,
          description,
          amount: Number(amount),
          payment_mode: expenseMode,
        }),
      });
      if (res.ok) {
        setDescription('');
        setAmount('');
        loadCashbook();
        onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const summary = data?.summary || {};

  return (
    <div className="space-y-6">
      {/* Separate Cash in Hand vs Bank/UPI Balance */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#14283F] text-white rounded-md p-5">
          <div className="text-xs font-semibold text-[#E6D09C]">
            கையிருப்பு ரொக்கம் (Physical Cash in Hand)
          </div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-bold text-white">
            {formatINR(summary.cashInHand)}
          </div>
          <div className="text-xs text-slate-300 mt-1">
            வரவு: {formatINR(summary.cash_in)} • செலவு: {formatINR(summary.cash_out)}
          </div>
        </div>
        <div className="bg-white border border-[#D5DCE4] rounded-md p-5">
          <div className="text-xs font-semibold text-slate-500">
            வங்கி & UPI இருப்பு (Bank & UPI Balance)
          </div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#244B70]">
            {formatINR(summary.bankBalance)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            வரவு: {formatINR(summary.bank_in)} • பட்டுவாடா: {formatINR(summary.bank_out)}
          </div>
        </div>
        <div className="bg-white border border-[#D5DCE4] rounded-md p-5">
          <div className="text-xs font-semibold text-slate-500">மொத்த வரவு (Total Inflow)</div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#188A78]">
            {formatINR((summary.cash_in || 0) + (summary.bank_in || 0))}
          </div>
        </div>
        <div className="bg-white border border-[#D5DCE4] rounded-md p-5">
          <div className="text-xs font-semibold text-slate-500">மொத்த வெளியேற்றம் (Total Outflow)</div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-bold text-red-700">
            {formatINR((summary.cash_out || 0) + (summary.bank_out || 0))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {currentUser?.role_code === 'OWNER' && (
          <form
            onSubmit={handleAddCapital}
            className="bg-white border border-[#D5DCE4] rounded-md p-5 space-y-4"
          >
            <h3 className="text-base font-bold text-[#14283F] flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#188A78]" />
              முதல் தொகை / கையிருப்பு பணம் சேர்க்க (Add Capital)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">தொகை (₹)</label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="100000"
                  value={capitalAmount}
                  onChange={(e) => setCapitalAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D5DCE4] rounded-md font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">முறை / Mode</label>
                <select
                  value={capitalMode}
                  onChange={(e) => setCapitalMode(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D5DCE4] rounded-md bg-white"
                >
                  <option value="CASH">Cash (ரொக்கம்)</option>
                  <option value="BANK_TRANSFER">Bank Account</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">விவரம் / Note</label>
                <input
                  type="text"
                  value={capitalNote}
                  onChange={(e) => setCapitalNote(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D5DCE4] rounded-md"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2.5 bg-[#188A78] hover:bg-[#136F60] text-white text-sm font-semibold rounded-md"
            >
              + கையிருப்பு கணக்கில் சேர் (Add Capital)
            </button>
          </form>
        )}

        <form
          onSubmit={handleAddExpense}
          className="bg-white border border-[#D5DCE4] rounded-md p-5 space-y-4"
        >
          <h3 className="text-base font-bold text-[#14283F] flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-[#244B70]" />
            ஆபீஸ் செலவு பதிவு (Record Office Expense)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">செலவுத் தலைப்பு</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D5DCE4] rounded-md bg-white"
              >
                <option>ஆபீஸ் வாடகை & கரண்ட் பில் (Office Rent)</option>
                <option>பெட்ரோல் & பயண செலவு (Petrol Allowance)</option>
                <option>பணியாளர் சம்பளம் / போனஸ் (Staff Salary)</option>
                <option>இதர செலவுகள் (Other Expense)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">செலவுத் தொகை (₹)</label>
              <input
                type="number"
                required
                min={1}
                placeholder="500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D5DCE4] rounded-md font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">முறை / Mode</label>
              <select
                value={expenseMode}
                onChange={(e) => setExpenseMode(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D5DCE4] rounded-md bg-white"
              >
                <option value="CASH">Cash (ரொக்கம்)</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank</option>
              </select>
            </div>
          </div>
          <div>
            <input
              type="text"
              required
              placeholder="செலவு விவரம் (Description)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-[#D5DCE4] rounded-md"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2.5 bg-[#244B70] hover:bg-[#14283F] text-white text-sm font-semibold rounded-md"
          >
            செலவு பதிவு செய் (Save Expense)
          </button>
        </form>
      </div>

      <div className="bg-white border border-[#D5DCE4] rounded-md overflow-hidden">
        <div className="px-5 py-3.5 bg-[#F7F8FA] border-b border-[#D5DCE4] font-bold text-sm text-[#14283F]">
          ரொக்கப் புத்தகம் — வரவு செலவு பட்டியல் (Cash Book Entries)
        </div>
        {(data?.transactions || []).length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            இன்னும் வரவு செலவு கணக்குகள் எதுவும் பதிவாகவில்லை.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#F7F8FA] border-b border-[#D5DCE4] text-xs text-slate-600">
                  <th className="py-3 px-4 text-left">தேதி / Date</th>
                  <th className="py-3 px-4 text-left">வகை / Type</th>
                  <th className="py-3 px-4 text-left">முறை / Mode</th>
                  <th className="py-3 px-4 text-left">விவரம் / Description</th>
                  <th className="py-3 px-4 text-right">வரவு / In (₹)</th>
                  <th className="py-3 px-4 text-right">பட்டுவாடா / Out (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EDF2]">
                {(data?.transactions || []).map((t: any) => (
                  <tr key={t.id} className="hover:bg-[#F7F8FA]">
                    <td className="py-3 px-4 font-mono text-slate-600">{t.txn_date}</td>
                    <td className="py-3 px-4 font-medium text-[#14283F]">{t.category}</td>
                    <td className="py-3 px-4 font-mono text-xs">{t.payment_mode}</td>
                    <td className="py-3 px-4 text-slate-600">{t.description}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#188A78]">
                      {t.direction === 'INFLOW' ? formatINR(t.amount) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-red-700">
                      {t.direction === 'OUTFLOW' ? formatINR(t.amount) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const AccountingLedgerView: React.FC<{ token: string }> = ({ token }) => {
  const [ledger, setLedger] = useState<any>(null);

  useEffect(() => {
    fetch('/api/ledger', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setLedger(d));
  }, [token]);

  const summary = ledger?.summary || {};
  const entries = ledger?.entries || [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#D5DCE4] rounded-md p-5">
          <div className="text-xs font-semibold text-slate-500">
            வட்டி மற்றும் கட்டண வருவாய் (Recognized Fee & Interest Income)
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-[#244B70]">
            {formatINR(summary.income)}
          </div>
        </div>
        <div className="bg-white border border-[#D5DCE4] rounded-md p-5">
          <div className="text-xs font-semibold text-slate-500">ஆபீஸ் செலவுகள் (Expenses)</div>
          <div className="mt-1 font-mono text-2xl font-bold text-red-700">
            {formatINR(summary.expenses)}
          </div>
        </div>
        <div className="bg-[#14283F] text-white rounded-md p-5">
          <div className="text-xs font-semibold text-[#E6D09C]">நிகர லாபம் (Net Profit)</div>
          <div className="mt-1 font-mono text-2xl font-bold text-white">
            {formatINR(summary.profit)}
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#D5DCE4] rounded-md overflow-hidden">
        <div className="px-5 py-3.5 bg-[#F7F8FA] border-b border-[#D5DCE4] font-bold text-sm text-[#14283F] flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#244B70]" />
          பொதுப் பேரேடு (Double-Entry General Ledger)
        </div>
        {entries.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No ledger entries yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#F7F8FA] border-b border-[#D5DCE4] text-xs text-slate-600">
                  <th className="py-3 px-4 text-left">தேதி / Date</th>
                  <th className="py-3 px-4 text-left">Ref</th>
                  <th className="py-3 px-4 text-left">Account Head</th>
                  <th className="py-3 px-4 text-left">விவரம் / Narration</th>
                  <th className="py-3 px-4 text-right">பற்று / Debit (₹)</th>
                  <th className="py-3 px-4 text-right">வரவு / Credit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EDF2]">
                {entries.map((e: any) => (
                  <tr key={e.id} className="hover:bg-[#F7F8FA]">
                    <td className="py-2.5 px-4 font-mono text-slate-600">{e.entry_date}</td>
                    <td className="py-2.5 px-4 font-mono font-semibold">{e.reference_code}</td>
                    <td className="py-2.5 px-4 font-semibold text-[#14283F]">{e.account_head}</td>
                    <td className="py-2.5 px-4 text-slate-600">{e.narration}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold">
                      {e.debit > 0 ? formatINR(e.debit) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-[#244B70]">
                      {e.credit > 0 ? formatINR(e.credit) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
