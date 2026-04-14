import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowDown, Banknote, Coins, Receipt, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CashConsolidationSources } from '@/utils/treasuryCashConsolidation';
import { formatAmountWithMaxFraction, roundToMaxFraction, toInputAmountValue } from '@/utils/amountFormatting';

interface CashConsolidationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  saving?: boolean;
  editableSources?: boolean;
  lockedSources?: Partial<Record<keyof CashConsolidationSources, boolean>>;
  initialCustomerName: string;
  initialInvoiceTotal: number;
  initialSources: CashConsolidationSources;
  sourceLimits?: CashConsolidationSources;
  versementCashWarningAmount?: number;
  onSubmit: (payload: {
    customerName: string;
    invoiceTotal: number;
    sources: CashConsolidationSources;
  }) => void | Promise<void>;
}

const MoneyValue = ({ value, className = '' }: { value: number; className?: string }) => (
  <bdi dir="ltr" className={`inline-block whitespace-nowrap tabular-nums ${className}`.trim()}>
    {formatAmountWithMaxFraction(value)} DA
  </bdi>
);

const toPositiveNumber = (value: string) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? roundToMaxFraction(Math.max(parsed, 0)) : 0;
};

const sanitizeAmountInput = (value: string, maximumFractionDigits = 4) => {
  if (value === '') return '';

  const normalizedValue = value.replace(',', '.').replace(/[^\d.]/g, '');
  const [integerPart = '', ...decimalParts] = normalizedValue.split('.');
  const decimalPart = decimalParts.join('').slice(0, maximumFractionDigits);
  const hasDecimal = normalizedValue.includes('.');
  const safeIntegerPart = integerPart || '0';

  if (!hasDecimal) {
    return safeIntegerPart;
  }

  return decimalPart.length > 0
    ? `${safeIntegerPart}.${decimalPart}`
    : `${safeIntegerPart}.`;
};

const CashConsolidationFormDialog = ({
  open,
  onOpenChange,
  title,
  submitLabel,
  saving = false,
  editableSources = false,
  lockedSources,
  initialCustomerName,
  initialInvoiceTotal,
  initialSources,
  sourceLimits,
  versementCashWarningAmount = 0,
  onSubmit,
}: CashConsolidationFormDialogProps) => {
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [invoiceTotal, setInvoiceTotal] = useState(toInputAmountValue(initialInvoiceTotal || 0));
  const [cashInvoice1, setCashInvoice1] = useState(toInputAmountValue(initialSources.cashInvoice1 || 0));
  const [stamp, setStamp] = useState(toInputAmountValue(initialSources.stamp || 0));

  useEffect(() => {
    if (!open) return;
    setCustomerName(initialCustomerName);
    setInvoiceTotal(toInputAmountValue(initialInvoiceTotal || 0));
    setCashInvoice1(toInputAmountValue(initialSources.cashInvoice1 || 0));
    setStamp(toInputAmountValue(initialSources.stamp || 0));
  }, [open, initialCustomerName, initialInvoiceTotal, initialSources.cashInvoice1, initialSources.stamp]);

  const limits = sourceLimits ?? initialSources;
  const cashInvoice1Value = toPositiveNumber(cashInvoice1);
  const stampValue = toPositiveNumber(stamp);
  const enteredInvoiceTotal = toPositiveNumber(invoiceTotal);

  const baseSum = roundToMaxFraction(cashInvoice1Value + stampValue);
  const maxCashInvoice2 = Math.max(sourceLimits?.cashInvoice2 ?? initialSources.cashInvoice2 ?? 0, 0);
  const cashInvoice2Value = roundToMaxFraction(Math.min(Math.max(enteredInvoiceTotal - baseSum, 0), maxCashInvoice2));
  const finalTotal = roundToMaxFraction(baseSum + cashInvoice2Value);
  const exceedsInvoice2Limit = enteredInvoiceTotal > baseSum + maxCashInvoice2;
  const canSubmit = customerName.trim().length > 0 && finalTotal > 0 && enteredInvoiceTotal >= baseSum && !exceedsInvoice2Limit;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      customerName: customerName.trim(),
      invoiceTotal: finalTotal,
      sources: {
        cashInvoice1: cashInvoice1Value,
        stamp: stampValue,
        receiptCash: 0,
        cashInvoice2: cashInvoice2Value,
      },
    });
  };

  const renderSourceAmount = (
    value: string,
    onChange: (value: string) => void,
    fallbackValue: number,
    className: string,
    locked = false,
  ) => {
    if (!editableSources || locked) {
      return <MoneyValue value={fallbackValue} className={className} />;
    }

    return (
      <div className="space-y-1 text-left" dir="ltr">
        <Input
          type="number"
          min={0}
          step="0.0001"
          value={value}
          onChange={(event) => onChange(sanitizeAmountInput(event.target.value))}
          className={`text-left font-bold ${className}`}
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-600" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">المبالغ المصدرية</p>

          {versementCashWarningAmount > 0 && (
            <div className="rounded-xl border-2 border-orange-400 bg-orange-50 dark:bg-orange-900/20 p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <div className="text-xs text-orange-800 dark:text-orange-300 space-y-1">
                <p className="font-bold">⚠️ يوجد رصيد Versement Cash: <MoneyValue value={versementCashWarningAmount} className="font-bold text-orange-700" /></p>
                <p>لا يتم احتسابه في التجميع. يرجى تنفيذ التحويلات اللازمة أولاً من صفحة Versement Cash:</p>
                <ul className="list-disc mr-4 space-y-0.5">
                  <li>تحويل إلى <strong>Versement Doc</strong> — إذا كانت الفاتورة جاهزة للمبيعة المرتبطة</li>
                  <li>تحويل إلى <strong>فاتورة 2</strong> — إذا كانت الفاتورة غير جاهزة بعد</li>
                </ul>
              </div>
            </div>
          )}

            <div className="rounded-xl border border-green-200 bg-green-50/50 dark:bg-green-900/10 p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-green-600" />
                <div>
                  <span className="text-sm">كاش فاتورة 1</span>
                  {editableSources && <p className="text-[10px] text-muted-foreground mt-0.5">المتاح: {formatAmountWithMaxFraction(limits.cashInvoice1)} DA</p>}
                </div>
              </div>
              {renderSourceAmount(cashInvoice1, setCashInvoice1, cashInvoice1Value, 'text-green-700', lockedSources?.cashInvoice1 === true)}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-600" />
                <div>
                  <span className="text-sm">الطابع</span>
                  {editableSources && <p className="text-[10px] text-muted-foreground mt-0.5">المتاح: {formatAmountWithMaxFraction(limits.stamp)} DA</p>}
                </div>
              </div>
              {renderSourceAmount(stamp, setStamp, stampValue, 'text-amber-700')}
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10 p-3">
              <div className="flex items-center justify-between mb-2 gap-3">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm">كاش فاتورة 2</span>
                  <Badge variant="outline" className="text-[9px]">تلقائي</Badge>
                </div>
                <MoneyValue value={cashInvoice2Value} className="font-bold text-emerald-700" />
              </div>
              <p className="text-[10px] text-muted-foreground">
                المتاح: <MoneyValue value={maxCashInvoice2} />
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowDown className="w-6 h-6 text-purple-500" />
          </div>

          <div className="rounded-xl border-2 border-purple-300 bg-purple-50/50 dark:bg-purple-900/10 p-4">
            <div className="flex items-center justify-between mb-3 gap-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-bold text-purple-800">Versement Doc</span>
              </div>
              <MoneyValue value={finalTotal} className="text-lg font-bold text-purple-700" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">اسم العميل الافتراضي *</Label>
                <Input
                  placeholder="أدخل اسم العميل"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">مبلغ الفاتورة *</Label>
                <Input
                  dir="ltr"
                  type="number"
                  min={baseSum}
                  step="0.0001"
                  value={invoiceTotal}
                  onChange={(event) => setInvoiceTotal(sanitizeAmountInput(event.target.value))}
                  className="mt-1 text-left"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  الحد الأدنى: <MoneyValue value={baseSum} />
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  الحد الأعلى: <MoneyValue value={baseSum + maxCashInvoice2} />
                </p>
                {exceedsInvoice2Limit && (
                  <p className="text-[10px] text-destructive mt-1">المبلغ أكبر من الحد المتاح بعد احتساب كاش فاتورة 2.</p>
                )}
              </div>
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={saving || !canSubmit} className="w-full">
            {saving ? 'جاري الحفظ...' : submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CashConsolidationFormDialog;
