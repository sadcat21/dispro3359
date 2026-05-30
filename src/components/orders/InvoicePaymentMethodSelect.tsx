import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Banknote, FileText } from 'lucide-react';
import { InvoicePaymentMethod, INVOICE_PAYMENT_METHODS } from '@/types/stamp';

export type InvoicePaymentSubType = 'cash' | 'doc';

interface InvoicePaymentMethodSelectProps {
  value: InvoicePaymentMethod | null;
  onChange: (value: InvoicePaymentMethod) => void;
  disabled?: boolean;
  /** Optional: receive the mandatory Cash/Doc sub-choice when value is receipt/check/transfer */
  subType?: InvoicePaymentSubType | null;
  onSubTypeChange?: (sub: InvoicePaymentSubType) => void;
}

const PAYMENT_COLORS: Record<InvoicePaymentMethod, string> = {
  receipt: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600',
  check: 'bg-red-600 hover:bg-red-700 text-white border-red-600',
  cash: 'bg-green-600 hover:bg-green-700 text-white border-green-600',
  transfer: 'bg-orange-600 hover:bg-orange-700 text-white border-orange-600',
};

const InvoicePaymentMethodSelect: React.FC<InvoicePaymentMethodSelectProps> = ({
  value,
  onChange,
  disabled = false,
  subType: subTypeProp,
  onSubTypeChange,
}) => {
  const methods = Object.entries(INVOICE_PAYMENT_METHODS) as [InvoicePaymentMethod, typeof INVOICE_PAYMENT_METHODS[InvoicePaymentMethod]][];

  const [internalSub, setInternalSub] = useState<InvoicePaymentSubType | null>(subTypeProp ?? null);
  const sub = subTypeProp !== undefined ? subTypeProp : internalSub;

  // Reset sub-choice whenever the parent method changes (mandatory re-pick)
  useEffect(() => {
    setInternalSub(null);
  }, [value]);

  // نوع الاستلام (Cash/Doc) يظهر فقط مع Virement (transfer)
  const requiresSub = value === 'transfer';

  const handleSub = (s: InvoicePaymentSubType) => {
    setInternalSub(s);
    onSubTypeChange?.(s);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1.5">
        {methods.map(([methodKey, method]) => (
          <Button
            key={methodKey}
            type="button"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(methodKey)}
            className={`@container h-9 px-1 font-bold transition-opacity overflow-hidden ${PAYMENT_COLORS[methodKey]} ${value === methodKey ? 'ring-2 ring-offset-1 ring-blue-400' : ''} ${value !== null && value !== methodKey ? 'opacity-50' : ''}`}
          >
            <span className="block w-full whitespace-nowrap leading-none" style={{ fontSize: 'clamp(8px, 16cqw, 13px)' }}>
              {method.label}
            </span>
          </Button>
        ))}
      </div>

      {requiresSub && (
        <div className={`rounded-lg border p-2 space-y-1.5 ${sub ? 'border-slate-200 bg-slate-50 dark:bg-slate-900/30' : 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              نوع الاستلام <span className="text-red-600">*</span>
            </span>
            {!sub && (
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                إلزامي
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={() => handleSub('cash')}
              className={`h-8 text-xs font-bold ${sub === 'cash' ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-offset-1 ring-emerald-400' : 'bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300'} ${sub && sub !== 'cash' ? 'opacity-50' : ''}`}
            >
              <Banknote className="w-3.5 h-3.5 me-1" />
              Cash
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={() => handleSub('doc')}
              className={`h-8 text-xs font-bold ${sub === 'doc' ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-2 ring-offset-1 ring-indigo-400' : 'bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300'} ${sub && sub !== 'doc' ? 'opacity-50' : ''}`}
            >
              <FileText className="w-3.5 h-3.5 me-1" />
              Doc
            </Button>
          </div>
        </div>
      )}

      {value === 'cash' && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-lg p-2 text-xs text-amber-800 dark:text-amber-300 text-center">
          <span className="font-semibold">سيتم احتساب الطابع الجبائي (Timbre).</span>
        </div>
      )}
    </div>
  );
};

export default InvoicePaymentMethodSelect;
