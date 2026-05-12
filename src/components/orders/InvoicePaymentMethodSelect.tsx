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
            className={`@container h-9 px-1 font-bold transition-opacity overflow-hidden ${PAYMENT_COLORS[methodKey]} ${value === methodKey ? 'ring-2 ring-offset-1 ring-blue-400' : ''} ${value !== null && value !== methodKey ? 'opacity-50' : ''}`}
          >
            <span className="block w-full whitespace-nowrap leading-none" style={{ fontSize: 'clamp(8px, 16cqw, 13px)' }}>
              {method.label}
            </span>
          </Button>
        ))}
      </div>
      {value === 'cash' && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-lg p-2 text-xs text-amber-800 dark:text-amber-300 text-center">
          <span className="font-semibold">تنبيه: سيتم احتساب سعر الطابع الجبائي (Timbre) على هذه الطلبية.</span>
        </div>
      )}
    </div>
  );
};

export default InvoicePaymentMethodSelect;
