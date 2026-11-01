import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { formatINR, Lang } from '../i18n';

interface RenewalEngineViewProps {
  loans: any[];
  renewals: any[];
  token: string;
  lang: Lang;
  preselectedLoanId?: string;
  onRenewalCompleted: () => void;
}

export const RenewalEngineView: React.FC<RenewalEngineViewProps> = ({
  loans,
  renewals,
  token,
  lang,
  preselectedLoanId,
  onRenewalCompleted,
}) => {
  const activeLoans = loans.filter((l) => l.status === 'ACTIVE' || l.status === 'OVERDUE');
  const [selectedLoanId, setSelectedLoanId] = useState<string>(
    preselectedLoanId || activeLoans[0]?.id || ''
  );
  const [newPrincipal, setNewPrincipal] = useState<number>(10000);
  const [newUpfrontCharge, setNewUpfrontCharge] = useState<number>(1500);
  const [newTenureDays, setNewTenureDays] = useState<number>(100);
  const [disbursementMode, setDisbursementMode] = useState<string>('CASH');
  // Unchecked by default so customer consent is explicitly confirmed
  const [consentVerified, setConsentVerified] = useState<boolean>(false);
  const [consentReference, setConsentReference] = useState<string>('');
  const [preview, setPreview] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<any>(null);

  useEffect(() => {
    if (preselectedLoanId) {
      setSelectedLoanId(preselectedLoanId);
    } else if (!selectedLoanId && activeLoans.length > 0) {
      setSelectedLoanId(activeLoans[0].id);
    }
  }, [preselectedLoanId, activeLoans, selectedLoanId]);

  useEffect(() => {
    if (!selectedLoanId) {
      setPreview(null);
      return;
    }
    fetch('/api/renewals/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        old_loan_id: selectedLoanId,
        principal_amount: newPrincipal,
        upfront_charge_amount: newUpfrontCharge,
        total_installments: newTenureDays,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.preview) setPreview(d.preview);
      })
      .catch(() => {});
  }, [selectedLoanId, newPrincipal, newUpfrontCharge, newTenureDays, token]);

  const handleExecuteRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessData(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/renewals/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          old_loan_id: selectedLoanId,
          principal_amount: newPrincipal,
          upfront_charge_amount: newUpfrontCharge,
          total_installments: newTenureDays,
          disbursement_mode: disbursementMode,
          customer_consent_verified: consentVerified,
          consent_reference: consentReference.trim() || `AGR-${new Date().toISOString().slice(0, 10)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Renewal failed.');
      setSuccessData(data);
      setConsentVerified(false);
      onRenewalCompleted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (activeLoans.length === 0 && renewals.length === 0) {
    return (
      <div className="bg-white border border-[#D5DCE4] rounded-md p-10 text-center max-w-xl mx-auto my-6">
        <RefreshCw className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-[#14283F]">
          {lang === 'ta' ? 'புதுப்பிக்க நடப்புக் கடன்கள் எதுவும் இல்லை' : 'No Active Loans to Renew Yet'}
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          {lang === 'ta'
            ? 'முதலில் வாடிக்கையாளருக்கு கடன் வழங்கிய பிறகு, இங்கே பழைய கடனை நேர்செய்து புதிய கடன் (Renewal) வழங்கலாம்.'
            : 'Once you create an active loan for a customer, you can refinance or renew their loan here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-md flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successData && (
        <div className="p-5 bg-[#EBF7F5] border border-[#188A78] text-[#14283F] rounded-md">
          <div className="flex items-center gap-2 font-bold text-base text-[#188A78] mb-1">
            <CheckCircle2 className="w-5 h-5" />
            {lang === 'ta' ? 'கடன் புதுப்பித்தல் வெற்றிகரமாக முடிந்தது!' : 'Loan Renewed Successfully!'}
          </div>
          <p className="text-sm text-slate-700">
            பழைய கடன் ({successData.oldLoanNumber}) நேர்செய்யப்பட்டு, புதிய கடன் ({successData.newLoanNumber}) தொடங்கப்பட்டது. வாடிக்கையாளருக்கு கையில் கொடுக்க வேண்டிய தொகை:{' '}
            <strong className="font-mono text-[#188A78]">
              {formatINR(successData.preview?.netCashToCustomer)}
            </strong>
          </p>
        </div>
      )}

      {activeLoans.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleExecuteRenewal}
            className="bg-white border border-[#D5DCE4] rounded-md p-6 space-y-4"
          >
            <h3 className="text-base font-bold text-[#14283F] border-b border-[#E8EDF2] pb-3">
              {lang === 'ta' ? '1. கடன் புதுப்பித்தல் விவரம் (Loan Renewal)' : '1. Select Loan & Enter Renewal Terms'}
            </h3>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                {lang === 'ta' ? 'வாடிக்கையாளர் / பழைய கடன் கணக்கு' : 'Select Active Loan'}
              </label>
              <select
                value={selectedLoanId}
                onChange={(e) => setSelectedLoanId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D5DCE4] rounded-md bg-white font-medium text-[#14283F]"
              >
                {activeLoans.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.customer_name} ({l.loan_number}) — பாக்கி: {formatINR(l.outstanding_balance)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  {lang === 'ta' ? 'புதிய கடன் தொகை (₹)' : 'New Loan Amount (₹)'}
                </label>
                <input
                  type="number"
                  min={500}
                  step={500}
                  value={newPrincipal}
                  onChange={(e) => setNewPrincipal(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-base border border-[#D5DCE4] rounded-md font-mono font-bold text-[#14283F]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  {lang === 'ta' ? 'புதிய வட்டி / பிடித்தம் (₹)' : 'New Upfront Deduction (₹)'}
                </label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={newUpfrontCharge}
                  onChange={(e) => setNewUpfrontCharge(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-base border border-[#D5DCE4] rounded-md font-mono font-bold text-[#14283F]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  {lang === 'ta' ? 'தவணை நாட்கள் (Days)' : 'Total Days'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={newTenureDays}
                  onChange={(e) => setNewTenureDays(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D5DCE4] rounded-md font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  {lang === 'ta' ? 'பணம் கொடுக்கும் முறை' : 'Payout Mode'}
                </label>
                <select
                  value={disbursementMode}
                  onChange={(e) => setDisbursementMode(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D5DCE4] rounded-md bg-white"
                >
                  <option value="CASH">Cash (ரொக்கம்)</option>
                  <option value="UPI">UPI / GPay</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                {lang === 'ta' ? 'ஒப்பந்த எண் / கையொப்பக் குறிப்பு (Agreement Ref) *' : 'Signed Agreement Reference *'}
              </label>
              <input
                type="text"
                required
                minLength={3}
                placeholder="e.g. AGR-RENEW-01"
                value={consentReference}
                onChange={(e) => setConsentReference(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-[#D5DCE4] rounded-md font-mono"
              />
            </div>

            <label className="flex items-start gap-2.5 p-3 bg-[#FBF6EB] border border-[#E6D09C] rounded-md cursor-pointer">
              <input
                type="checkbox"
                checked={consentVerified}
                onChange={(e) => setConsentVerified(e.target.checked)}
                className="w-4 h-4 mt-0.5"
              />
              <span className="text-xs text-[#14283F] leading-relaxed">
                {lang === 'ta'
                  ? 'வாடிக்கையாளர் ஒப்புதலுடன் பழைய கடன் நிலுவையை கழித்து புதுப்பிக்கிறேன் என்பதை உறுதி செய்கிறேன்.'
                  : 'I confirm that the customer has consented to settle the old loan balance and execute this new loan contract.'}
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting || !consentVerified || !preview || preview.netCashToCustomer < 0}
              className="w-full py-3 px-4 bg-[#244B70] hover:bg-[#14283F] disabled:opacity-50 text-white font-semibold text-sm rounded-md transition-colors"
            >
              {submitting
                ? 'Processing...'
                : lang === 'ta'
                ? 'கடன் புதுப்பித்தலை உறுதி செய் (Confirm Renewal)'
                : 'Confirm & Renew Loan'}
            </button>
          </form>

          {preview && (
            <div className="bg-white border border-[#D5DCE4] rounded-md p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#E8EDF2] pb-3">
                  <h3 className="text-base font-bold text-[#14283F]">
                    {lang === 'ta' ? '2. கணக்கு விவரம் (Renewal Calculation)' : '2. Settlement Breakdown'}
                  </h3>
                  <span className="text-xs font-mono px-2 py-0.5 bg-[#FBF6EB] text-[#B78727] border border-[#E6D09C] rounded">
                    Effective APR: {preview.apr}% p.a.
                  </span>
                </div>

                <div className="mt-4 p-4 bg-[#F7F8FA] border border-[#E8EDF2] rounded-md space-y-2 text-sm">
                  <div className="font-bold text-[#14283F] mb-1">
                    {lang === 'ta' ? 'பழைய கடன் நிலை' : 'Old Loan Status'} ({preview.oldLoanNumber})
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">பழைய கடன் தொகை:</span>
                    <span className="font-mono font-semibold">{formatINR(preview.oldPrincipal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      இதுவரை கட்டிய தொகை ({preview.oldPaidInstallments}/{preview.oldTotalInstallments} நாட்கள்):
                    </span>
                    <span className="font-mono font-semibold text-[#188A78]">
                      {formatINR(preview.oldAmountPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#D5DCE4] font-bold">
                    <span className="text-amber-900">பழைய கடனில் கட்ட வேண்டிய பாக்கி:</span>
                    <span className="font-mono text-amber-800">{formatINR(preview.oldUnpaidBalance)}</span>
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-[#E8EDF2]">
                    <span className="font-medium text-slate-700">புதிய கடன் தொகை (New Loan)</span>
                    <span className="font-mono font-bold text-base text-[#14283F]">
                      {formatINR(preview.newPrincipal)}
                    </span>
                  </div>

                  <div className="flex justify-between py-2 border-b border-[#E8EDF2] text-amber-800">
                    <span>(-) பழைய கடன் பாக்கி கழிவு (Old Balance Settled)</span>
                    <span className="font-mono font-semibold">- {formatINR(preview.oldUnpaidBalance)}</span>
                  </div>

                  <div className="flex justify-between py-2 border-b border-[#E8EDF2] text-slate-700">
                    <span>(-) புதிய வட்டி / பிடித்தம் (New Deduction)</span>
                    <span className="font-mono font-semibold">- {formatINR(preview.newUpfrontCharge)}</span>
                  </div>

                  <div className="p-4 bg-[#EBF7F5] border-2 border-[#188A78] rounded-md flex items-center justify-between mt-3">
                    <div>
                      <div className="font-bold text-[#14283F] text-base">
                        {lang === 'ta'
                          ? 'வாடிக்கையாளருக்கு கையில் கொடுக்கும் தொகை'
                          : 'Net Cash to Give Customer'}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        தினசரி தவணை: {formatINR(preview.newDailyInstallment)} × {preview.newDays} நாட்கள்
                      </div>
                    </div>
                    <div className="font-mono tabular-nums text-2xl font-bold text-[#188A78]">
                      {formatINR(preview.netCashToCustomer)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {renewals.length > 0 && (
        <div className="bg-white border border-[#D5DCE4] rounded-md overflow-hidden">
          <div className="px-5 py-3.5 bg-[#F7F8FA] border-b border-[#D5DCE4] font-bold text-sm text-[#14283F]">
            {lang === 'ta' ? 'புதுப்பிக்கப்பட்ட கடன்கள் வரலாறு (Renewal History)' : 'Completed Loan Renewals'}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#F7F8FA] border-b border-[#D5DCE4] text-xs text-slate-600">
                  <th className="py-3 px-4 text-left">தேதி / Date</th>
                  <th className="py-3 px-4 text-left">வாடிக்கையாளர் / Customer</th>
                  <th className="py-3 px-4 text-left">பழைய கடன் → புதிய கடன்</th>
                  <th className="py-3 px-4 text-right">கழிக்கப்பட்ட பாக்கி</th>
                  <th className="py-3 px-4 text-right">புதிய கடன்</th>
                  <th className="py-3 px-4 text-right">கையில் கொடுத்தது</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EDF2]">
                {renewals.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F7F8FA]">
                    <td className="py-3 px-4 font-mono text-slate-600">{r.renewal_date}</td>
                    <td className="py-3 px-4 font-semibold text-[#14283F]">{r.customer_name}</td>
                    <td className="py-3 px-4 font-mono">
                      {r.old_loan_number} <ArrowRight className="inline w-3.5 h-3.5 mx-1" />{' '}
                      <strong className="text-[#244B70]">{r.new_loan_number}</strong>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-800">
                      {formatINR(r.old_loan_settled_balance)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">
                      {formatINR(r.new_loan_principal)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#188A78]">
                      {formatINR(r.net_additional_disbursement)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
