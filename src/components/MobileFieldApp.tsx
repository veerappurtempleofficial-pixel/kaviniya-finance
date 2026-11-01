import React, { useState } from 'react';
import {
  Search,
  CheckCircle2,
  Receipt,
  MapPin,
  Phone,
  TrendingUp,
  UserCheck,
  Monitor,
} from 'lucide-react';
import { formatINR, Lang } from '../i18n';

interface MobileFieldAppProps {
  collectionItems: any[];
  recentTransactions: any[];
  currentUser: any;
  lang: Lang;
  onCollectPayment: (loanId: string, amount: number, mode: string) => Promise<void>;
  onOpenReceipt: (receiptNo: string) => void;
  onExitMobilePreview: () => void;
}

export const MobileFieldApp: React.FC<MobileFieldAppProps> = ({
  collectionItems,
  recentTransactions,
  currentUser,
  lang,
  onCollectPayment,
  onOpenReceipt,
  onExitMobilePreview,
}) => {
  const [tab, setTab] = useState<'route' | 'receipts' | 'summary'>('route');
  const [search, setSearch] = useState('');
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [activeLoanEntry, setActiveLoanEntry] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('CASH');
  const [busyLoanId, setBusyLoanId] = useState<string | null>(null);

  const areas = ['ALL', ...Array.from(new Set(collectionItems.map((i) => i.area)))];

  const filteredItems = collectionItems.filter((item) => {
    if (selectedArea !== 'ALL' && item.area !== selectedArea) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.customer_name?.toLowerCase().includes(q) ||
      item.customer_code?.toLowerCase().includes(q) ||
      item.customer_mobile?.includes(q) ||
      item.loan_number?.toLowerCase().includes(q)
    );
  });

  const totalCollectedToday = collectionItems.reduce(
    (a, r) => a + (r.collected_today || 0),
    0
  );

  const handleConfirmPay = async (item: any, amt: number, mode: string) => {
    setBusyLoanId(item.loan_id);
    try {
      await onCollectPayment(item.loan_id, amt, mode);
      setActiveLoanEntry(null);
    } finally {
      setBusyLoanId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#E8EDF2] flex flex-col items-center justify-start py-0 md:py-6">
      <div className="w-full max-w-[430px] min-h-screen md:min-h-[800px] bg-[#F7F8FA] md:border-2 md:border-[#14283F] md:rounded-lg shadow-2xl flex flex-col justify-between overflow-hidden">
        <div>
          <div className="bg-[#14283F] text-white px-4 py-3.5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-[#B78727] text-[#14283F] font-bold text-xs flex items-center justify-center rounded">
                  KF
                </span>
                <span className="font-bold text-sm">
                  {lang === 'ta' ? 'கவினியா பைனான்ஸ்' : 'KAVINIYA FIELD'}
                </span>
              </div>
              <div className="text-xs text-slate-300 mt-0.5 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-[#188A78]" />
                {currentUser?.full_name}
              </div>
            </div>
            {currentUser?.role_code !== 'COLLECTION_STAFF' && (
              <button
                onClick={onExitMobilePreview}
                className="px-3 py-1.5 text-xs font-semibold bg-[#244B70] text-white rounded flex items-center gap-1"
              >
                <Monitor className="w-3.5 h-3.5" />
                Desktop
              </button>
            )}
          </div>

          <div className="bg-[#244B70] text-white px-4 py-3 flex items-center justify-between text-xs">
            <div>
              <div className="text-slate-300">இன்றைய மொத்த வசூல்</div>
              <div className="font-mono font-bold text-base mt-0.5">
                {formatINR(totalCollectedToday)}
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs font-mono font-bold bg-[#188A78] text-white rounded">
              {collectionItems.filter((i) => i.collected_today > 0).length} / {collectionItems.length} கணக்குகள்
            </span>
          </div>

          {tab === 'route' && (
            <div className="p-3.5 space-y-3 pb-24">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="பெயர், போன் நம்பர் தேடுக..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#D5DCE4] rounded"
                />
              </div>

              {areas.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {areas.map((area) => (
                    <button
                      key={area}
                      onClick={() => setSelectedArea(area)}
                      className={`px-3 py-1 text-xs font-semibold rounded shrink-0 border ${
                        selectedArea === area
                          ? 'bg-[#14283F] text-white border-[#14283F]'
                          : 'bg-white text-slate-700 border-[#D5DCE4]'
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                {filteredItems.map((item) => {
                  const isExpanded = activeLoanEntry === item.loan_id;
                  return (
                    <div
                      key={item.loan_id}
                      className="bg-white border border-[#D5DCE4] rounded-md p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> {item.area} • {item.loan_number}
                          </div>
                          <h4 className="font-bold text-base text-[#14283F] mt-0.5">
                            {item.customer_name}
                          </h4>
                          <div className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" /> {item.customer_mobile}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500">தினசரி தவணை</div>
                          <div className="font-mono text-base font-bold text-[#14283F]">
                            {formatINR(item.daily_installment)}
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            பாக்கி: {formatINR(item.outstanding_balance)}
                          </div>
                        </div>
                      </div>

                      {item.collected_today > 0 && (
                        <div className="flex items-center justify-between pt-2 border-t border-[#E8EDF2]">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#188A78]">
                            <CheckCircle2 className="w-4 h-4" />
                            இன்று வசூலானது: {formatINR(item.collected_today)}
                          </span>
                          {item.last_receipt_today && (
                            <button
                              onClick={() => onOpenReceipt(item.last_receipt_today)}
                              className="px-2.5 py-1 text-xs font-semibold text-[#244B70] border border-[#244B70]/40 rounded"
                            >
                              ரசீது ({item.last_receipt_today})
                            </button>
                          )}
                        </div>
                      )}

                      {!isExpanded ? (
                        <button
                          onClick={() => {
                            setActiveLoanEntry(item.loan_id);
                            setCustomAmount(String(item.daily_installment));
                            setPaymentMode('CASH');
                          }}
                          className="w-full py-2.5 px-4 bg-[#188A78] text-white font-bold text-sm rounded shadow-sm"
                        >
                          வசூல் பதிவு செய் (Collect Payment)
                        </button>
                      ) : (
                        <div className="space-y-3 bg-[#F7F8FA] p-3 border border-[#D5DCE4] rounded">
                          <div className="grid grid-cols-3 gap-1.5">
                            {['CASH', 'UPI', 'BANK_TRANSFER'].map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setPaymentMode(m)}
                                className={`py-1.5 text-xs font-mono font-bold rounded border ${
                                  paymentMode === m
                                    ? 'bg-[#14283F] text-white border-[#14283F]'
                                    : 'bg-white text-slate-700 border-[#D5DCE4]'
                                }`}
                              >
                                {m === 'BANK_TRANSFER' ? 'BANK' : m}
                              </button>
                            ))}
                          </div>
                          <input
                            type="number"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            className="w-full px-3 py-2 text-base font-mono font-bold border border-[#D5DCE4] rounded"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveLoanEntry(null)}
                              className="w-1/3 py-2 text-xs font-semibold text-slate-600 bg-white border border-[#D5DCE4] rounded"
                            >
                              ரத்து
                            </button>
                            <button
                              type="button"
                              disabled={busyLoanId === item.loan_id}
                              onClick={() =>
                                handleConfirmPay(item, Number(customAmount), paymentMode)
                              }
                              className="w-2/3 py-2 text-xs font-bold text-white bg-[#188A78] rounded"
                            >
                              {busyLoanId === item.loan_id
                                ? 'Saving...'
                                : `உறுதி செய் ${formatINR(Number(customAmount))}`}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'receipts' && (
            <div className="p-3.5 space-y-2.5 pb-24">
              {recentTransactions.map((t) => (
                <div
                  key={t.id}
                  className="bg-white border border-[#D5DCE4] rounded p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-sm text-[#14283F]">{t.customer_name}</div>
                    <div className="text-xs font-mono text-slate-500">
                      {t.receipt_number} • {t.payment_date} • {t.payment_mode}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-sm text-[#188A78]">
                      {formatINR(t.amount_collected)}
                    </div>
                    <button
                      onClick={() => onOpenReceipt(t.receipt_number)}
                      className="text-xs font-semibold text-[#244B70] underline"
                    >
                      ரசீது பார்
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'summary' && (
            <div className="p-4 space-y-3 pb-24">
              <div className="bg-white border border-[#D5DCE4] rounded p-4 space-y-3">
                <h3 className="text-sm font-bold text-[#14283F]">இன்றைய வசூல் சுருக்கம்</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-[#F7F8FA] border border-[#E8EDF2] rounded">
                    <div className="text-xs text-slate-500">மொத்த கணக்குகள்</div>
                    <div className="font-mono font-bold text-lg text-[#14283F] mt-0.5">
                      {collectionItems.length}
                    </div>
                  </div>
                  <div className="p-3 bg-[#EBF7F5] border border-[#188A78]/30 rounded">
                    <div className="text-xs text-[#188A78]">இன்றைய வசூல்</div>
                    <div className="font-mono font-bold text-lg text-[#188A78] mt-0.5">
                      {formatINR(totalCollectedToday)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-[#D5DCE4] grid grid-cols-3 py-2 text-center">
          <button
            onClick={() => setTab('route')}
            className={`flex flex-col items-center gap-1 py-1 text-xs font-semibold ${
              tab === 'route' ? 'text-[#244B70]' : 'text-slate-500'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>வசூல் பட்டியல்</span>
          </button>
          <button
            onClick={() => setTab('receipts')}
            className={`flex flex-col items-center gap-1 py-1 text-xs font-semibold ${
              tab === 'receipts' ? 'text-[#244B70]' : 'text-slate-500'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>ரசீதுகள்</span>
          </button>
          <button
            onClick={() => setTab('summary')}
            className={`flex flex-col items-center gap-1 py-1 text-xs font-semibold ${
              tab === 'summary' ? 'text-[#244B70]' : 'text-slate-500'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>சுருக்கம்</span>
          </button>
        </div>
      </div>
    </div>
  );
};
