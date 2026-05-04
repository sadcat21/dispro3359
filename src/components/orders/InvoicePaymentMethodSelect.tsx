import React from 'react';
import { Button } from '@/components/ui/button';
import { Stamp } from 'lucide-react';
import { InvoicePaymentMethod, INVOICE_PAYMENT_METHODS } from '@/types/stamp';

interface InvoicePaymentMethodSelectProps {
  value: InvoicePaymentMethod | null;
  onChange: (value: InvoicePaymentMethod) => void;
  disabled?: boolean;
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
}) => {
  const methods = Object.entries(INVOICE_PAYMENT_METHODS) as [InvoicePaymentMethod, typeof INVOICE_PAYMENT_METHODS[InvoicePaymentMethod]][];

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
            className={`h-9 px-1 text-xs font-bold transition-opacity ${PAYMENT_COLORS[methodKey]} ${value === methodKey ? 'ring-2 ring-offset-1 ring-blue-400' : ''} ${value !== null && value !== methodKey ? 'opacity-50' : ''}`}
          >
            {method.label}
            {method.hasStamp && <Stamp className="w-3 h-3 mr-0.5" />}
          </Button>
        ))}
      </div>
      {value === 'cash' && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-lg p-2 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
          <Stamp className="w-3.5 h-3.5 shrink-0" />
          <span className="font-semibold">تنبيه: سيتم احتساب سعر الطابع الجبائي (Timbre) على هذه الطلبية.</span>
        </div>
      )}
    </div>
  );
};

export default InvoicePaymentMethodSelect;
