import React, { useState } from 'react';
import { Printer, Share2, X, CheckCircle2, RotateCcw, AlertTriangle, Smartphone } from 'lucide-react';
import { formatINR, Lang } from '../i18n';

interface ReceiptModalProps {
  receipt: any;
  settings?: any;
  canReverse?: boolean;
  lang: Lang;
  onReversePayment?: (paymentId: string, reason: string) => Promise<void>;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  receipt,
  settings = {},
  canReverse = false,
  lang,
  onReversePayment,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'THERMAL_58MM' | 'STANDARD'>('THERMAL_58MM');
  const [showReverseBox, setShowReverseBox] = useState(false);
  const [reverseReason, setReverseReason] = useState('');
  const [reversing, setReversing] = useState(false);

  if (!receipt) return null;

  const isReversed = receipt.status === 'REVERSED';
  const companyName = settings.company_name || 'KAVINIYA FINANCE';
  const companyNameTa = settings.company_name_ta || 'கவினியா பைனான்ஸ்';
  const collectorName = receipt.staff_name || receipt.recorded_by_name || 'Office';

  // Dedicated 58mm (2-inch) / 80mm Thermal Printer Slip Print
  const handleThermalPrint = (paperWidthMm: 58 | 80 = 58) => {
    const contentWidth = paperWidthMm === 58 ? '48mm' : '72mm';
    const w = window.open('', '_blank', 'width=360,height=620');
    if (!w) {
      window.print();
      return;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${receipt.receipt_number}</title>
  <style>
    @page {
      size: ${paperWidthMm}mm auto;
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      color: #000 !important;
      font-family: 'Noto Sans Tamil', 'Courier New', monospace, sans-serif;
    }
    body {
      width: ${contentWidth};
      margin: 0 auto;
      padding: 2mm 1mm 6mm 1mm;
      font-size: 11px;
      line-height: 1.35;
      background: #fff;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 700; }
    .title { font-size: 14px; font-weight: 800; letter-spacing: 0.3px; }
    .subtitle { font-size: 12px; font-weight: 700; margin-top: 1px; }
    .dash {
      border-top: 1px dashed #000;
      margin: 5px 0;
    }
    .double-dash {
      border-top: 2px solid #000;
      margin: 5px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
      gap: 4px;
    }
    .big-paid {
      font-size: 15px;
      font-weight: 800;
      padding: 3px 0;
    }
  </style>
</head>
<body>
  <div class="center">
    <div class="title">${companyName}</div>
    <div class="subtitle">${companyNameTa}</div>
    ${settings.address ? `<div style="font-size:10px;">${settings.address}</div>` : ''}
    ${settings.phone ? `<div style="font-size:10px;">Ph: ${settings.phone}</div>` : ''}
    <div class="double-dash"></div>
    <div class="bold">${isReversed ? '*** ரத்து செய்யப்பட்ட ரசீது ***' : 'வசூல் ரசீது / RECEIPT'}</div>
  </div>
  <div class="dash"></div>
  <div class="row"><span>ரசீது எண்:</span><span class="bold">${receipt.receipt_number}</span></div>
  <div class="row"><span>தேதி:</span><span>${receipt.payment_date}</span></div>
  <div class="row"><span>நேரம்:</span><span>${String(receipt.collected_at || '').slice(11, 16)}</span></div>
  <div class="dash"></div>
  <div class="row"><span>பெயர்:</span><span class="bold">${receipt.customer_name}</span></div>
  <div class="row"><span>வா.எண்:</span><span>${receipt.customer_code || ''} (${receipt.area || ''})</span></div>
  <div class="row"><span>கடன் எண்:</span><span class="bold">${receipt.loan_number}</span></div>
  <div class="dash"></div>
  <div class="row"><span>தினசரி தவணை:</span><span>${formatINR(receipt.daily_installment)}</span></div>
  <div class="row big-paid"><span>இன்று கட்டியது:</span><span>${formatINR(receipt.amount_collected)}</span></div>
  <div class="row"><span>செலுத்திய முறை:</span><span class="bold">${receipt.payment_mode}</span></div>
  <div class="dash"></div>
  <div class="row bold" style="font-size:12px;"><span>மீதி பாக்கி (Bal):</span><span>${formatINR(receipt.balance_after_payment)}</span></div>
  ${
    receipt.total_installments
      ? `<div class="row"><span>முடிந்த தவணைகள்:</span><span>${receipt.paid_installments || 0} / ${receipt.total_installments}</span></div>`
      : ''
  }
  <div class="dash"></div>
  <div class="row" style="font-size:10px;"><span>வசூலித்தவர்:</span><span>${collectorName}</span></div>
  <div class="center" style="margin-top:8px;font-size:10px;">நன்றி! / Thank You!</div>
  <script>
    window.onload = function() {
      window.focus();
      window.print();
      setTimeout(function() { window.close(); }, 400);
    };
  </script>
</body>
</html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const buildShareText = () =>
    [
      `*${companyName} (${companyNameTa})*`,
      isReversed ? `*CANCELLED RECEIPT / ரத்து செய்யப்பட்ட ரசீது*` : `*வசூல் ரசீது / Payment Receipt*`,
      `----------------------------`,
      `ரசீது எண்: *${receipt.receipt_number}*`,
      `தேதி: ${receipt.payment_date}`,
      `பெயர்: *${receipt.customer_name}* (${receipt.customer_code || ''})`,
      `கடன் எண்: ${receipt.loan_number}`,
      `இன்று கட்டியது: *${formatINR(receipt.amount_collected)}* (${receipt.payment_mode})`,
      `மீதி பாக்கி: *${formatINR(receipt.balance_after_payment)}*`,
      `வசூலித்தவர்: ${collectorName}`,
      `----------------------------`,
      `நன்றி!`,
    ].join('\n');

  const handleShareText = () => {
    navigator.clipboard?.writeText(buildShareText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppDirect = () => {
    const mobile = String(receipt.customer_mobile || '').replace(/\D/g, '').slice(-10);
    const encoded = encodeURIComponent(buildShareText());
    const url = mobile.length === 10 ? `https://wa.me/91${mobile}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleConfirmReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onReversePayment || reverseReason.trim().length < 3) return;
    setReversing(true);
    try {
      await onReversePayment(receipt.id, reverseReason.trim());
      onClose();
    } finally {
      setReversing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E1D2F]/60 p-4">
      <div className="w-full max-w-lg bg-white border border-[#D5DCE4] rounded-md shadow-xl overflow-hidden">
        {/* Top Bar */}
        <div className="bg-[#14283F] text-white px-5 py-3.5 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#188A78]" />
            <span className="text-sm font-bold">
              {lang === 'ta' ? 'வசூல் ரசீது & சிறிய பிரிண்டர் (Thermal Print)' : 'Payment Receipt & Thermal Print'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'THERMAL_58MM' ? 'STANDARD' : 'THERMAL_58MM')}
              className="px-2.5 py-1 text-xs font-semibold bg-white/10 hover:bg-white/20 rounded text-[#E6D09C]"
            >
              {viewMode === 'THERMAL_58MM' ? 'சாதாரண வடிவம் (A4 View)' : 'சிறிய பிரிண்டர் வடிவம் (58mm Slip)'}
            </button>
            <button onClick={onClose} className="text-slate-300 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Receipt Body */}
        <div className="p-5 bg-[#F7F8FA] max-h-[72vh] overflow-y-auto">
          {viewMode === 'THERMAL_58MM' ? (
            /* 2-Inch (58mm) Handheld Thermal Slip Preview */
            <div className="w-[270px] mx-auto bg-white border border-slate-300 shadow-md px-4 py-4 font-mono text-xs text-black leading-relaxed">
              <div className="text-center border-b-2 border-black pb-2 mb-2">
                <div className="text-sm font-extrabold tracking-wide">{companyName}</div>
                <div className="text-xs font-bold">{companyNameTa}</div>
                {settings.address && <div className="text-[11px]">{settings.address}</div>}
                {settings.phone && <div className="text-[11px]">Ph: {settings.phone}</div>}
                <div className="mt-1 font-bold text-[11px]">
                  {isReversed ? '*** ரத்து செய்யப்பட்ட ரசீது ***' : 'வசூல் ரசீது / RECEIPT'}
                </div>
              </div>

              <div className="border-b border-dashed border-black pb-2 mb-2 space-y-0.5">
                <div className="flex justify-between">
                  <span>ரசீது எண்:</span>
                  <span className="font-bold">{receipt.receipt_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>தேதி:</span>
                  <span>{receipt.payment_date}</span>
                </div>
                <div className="flex justify-between">
                  <span>வாடிக்கையாளர்:</span>
                  <span className="font-bold text-right">{receipt.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>கடன் எண்:</span>
                  <span className="font-bold">{receipt.loan_number}</span>
                </div>
              </div>

              <div className="border-b border-dashed border-black pb-2 mb-2 space-y-1">
                <div className="flex justify-between">
                  <span>தினசரி தவணை:</span>
                  <span>{formatINR(receipt.daily_installment)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold py-0.5">
                  <span>இன்று கட்டியது:</span>
                  <span>{formatINR(receipt.amount_collected)}</span>
                </div>
                <div className="flex justify-between">
                  <span>முறை (Mode):</span>
                  <span className="font-bold">{receipt.payment_mode}</span>
                </div>
              </div>

              <div className="border-b border-dashed border-black pb-2 mb-2 space-y-0.5">
                <div className="flex justify-between font-extrabold text-xs">
                  <span>மீதி பாக்கி (Bal):</span>
                  <span>{formatINR(receipt.balance_after_payment)}</span>
                </div>
                {receipt.total_installments ? (
                  <div className="flex justify-between text-[11px]">
                    <span>முடிந்த தவணை:</span>
                    <span>
                      {receipt.paid_installments || 0} / {receipt.total_installments}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="text-[11px] flex justify-between">
                <span>வசூலித்தவர்:</span>
                <span className="font-bold">{collectorName}</span>
              </div>
              <div className="text-center text-[11px] mt-2 font-semibold">நன்றி! / Thank You!</div>
            </div>
          ) : (
            /* Standard Receipt View */
            <div className="bg-white border border-[#D5DCE4] rounded p-5 text-[#14283F]">
              <div className="border-b-2 border-[#14283F] pb-3 mb-3 flex justify-between items-start">
                <div>
                  <h2 className="text-base font-bold text-[#14283F]">{companyName}</h2>
                  <p className="text-xs font-medium text-[#244B70]">{companyNameTa}</p>
                </div>
                <div className="text-right font-mono">
                  <div className="text-sm font-bold">{receipt.receipt_number}</div>
                  <div className="text-xs text-slate-500">{receipt.payment_date}</div>
                </div>
              </div>
              <table className="w-full text-sm border-collapse border border-[#D5DCE4]">
                <tbody>
                  <tr className="border-b border-[#E8EDF2]">
                    <td className="py-2 px-3 text-slate-600">வாடிக்கையாளர்</td>
                    <td className="py-2 px-3 text-right font-bold">{receipt.customer_name}</td>
                  </tr>
                  <tr className="border-b border-[#E8EDF2]">
                    <td className="py-2 px-3 text-slate-600">கடன் எண்</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">{receipt.loan_number}</td>
                  </tr>
                  <tr className="border-b border-[#E8EDF2] bg-[#EBF7F5]/60">
                    <td className="py-2 px-3 font-bold">இன்று கட்டியது (Paid)</td>
                    <td className="py-2 px-3 text-right font-mono text-base font-bold text-[#188A78]">
                      {formatINR(receipt.amount_collected)} ({receipt.payment_mode})
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold">மீதி பாக்கி (Balance)</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">
                      {formatINR(receipt.balance_after_payment)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {isReversed && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
              <strong>Cancelled Reason:</strong> {receipt.reversal_reason} ({receipt.reversed_at})
            </div>
          )}

          {/* Payment Reversal Box for Owner/Admin */}
          {canReverse && !isReversed && showReverseBox && (
            <form
              onSubmit={handleConfirmReverse}
              className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded space-y-2.5 no-print"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-red-800">
                <AlertTriangle className="w-4 h-4" />
                தவறான வசூல் பதிவை ரத்து செய் (Cancel Wrong Payment)
              </div>
              <input
                type="text"
                required
                minLength={3}
                placeholder="ரத்து செய்வதற்கான காரணம் (e.g. Entered ₹1000 instead of ₹100)..."
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-red-300 rounded"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReverseBox(false)}
                  className="px-3 py-1.5 text-xs text-slate-600"
                >
                  வேண்டாம்
                </button>
                <button
                  type="submit"
                  disabled={reversing || reverseReason.trim().length < 3}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 rounded"
                >
                  {reversing ? 'Cancelling...' : 'உறுதியாக ரத்து செய்'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Bottom Action Buttons */}
        <div className="bg-white border-t border-[#D5DCE4] px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 no-print">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleWhatsAppDirect}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#188A78] hover:bg-[#136F60] rounded"
            >
              <Smartphone className="w-3.5 h-3.5" />
              WhatsApp அனுப்பு
            </button>
            <button
              type="button"
              onClick={handleShareText}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-[#14283F] bg-[#F7F8FA] border border-[#D5DCE4] rounded hover:bg-[#E8EDF2]"
            >
              <Share2 className="w-3.5 h-3.5 text-[#244B70]" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
            {canReverse && !isReversed && !showReverseBox && (
              <button
                type="button"
                onClick={() => setShowReverseBox(true)}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                ரத்து
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleThermalPrint(58)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#244B70] hover:bg-[#14283F] rounded shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              2" சிறிய பிரிண்டர் (58mm Print)
            </button>
            <button
              type="button"
              onClick={() => handleThermalPrint(80)}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-[#14283F] bg-[#F7F8FA] border border-[#D5DCE4] hover:bg-[#E8EDF2] rounded"
            >
              3" (80mm)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
