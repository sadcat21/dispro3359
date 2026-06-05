import React, { useMemo } from 'react';
import { Banknote, CreditCard, FileText, Receipt, Wallet } from 'lucide-react';

interface PaymentLike {
  amount: number | string;
  payment_method?: string | null;
}

interface Props {
  payments: PaymentLike[];
  title?: string;
  compact?: boolean;
  showZero?: boolean;
}

const METHOD_META: Record<string, { label: string; icon: any; color: string }> = {
  cash: { label: 'كاش (Espèces)', icon: Banknote, color: 'text-emerald-600' },
  check: { label: 'Chèque', icon: FileText, color: 'text-blue-600' },
  transfer: { label: 'Virement', icon: CreditCard, color: 'text-indigo-600' },
  receipt: { label: 'Versement', icon: Receipt, color: 'text-orange-600' },
  espace_cash: { label: 'إسباس كاش', icon: Wallet, color: 'text-teal-600' },
  versement_cash: { label: 'Versement (cache)', icon: Receipt, color: 'text-amber-600' },
};

const fmt = (n: number) => {
  const r = Math.round(n * 100) / 100;
  return r.toLocaleString();
};

const PaymentMethodBreakdown: React.FC<Props> = ({ payments, title = 'تفصيل المسدّد حسب طريقة الدفع', compact, showZero = false }) => {
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    payments.forEach((p) => {
      const amount = Number(p.amount || 0);
      if (!amount) return;
      const key = (p.payment_method || 'cash').toLowerCase();
      map.set(key, (map.get(key) || 0) + amount);
    });
    if (showZero) {
      ['cash', 'check', 'transfer', 'receipt'].forEach((k) => {
        if (!map.has(k)) map.set(k, 0);
      });
    }
    return Array.from(map.entries())
      .map(([method, total]) => ({ method, total }))
      .sort((a, b) => b.total - a.total);
  }, [payments, showZero]);

  if (!totals.length) return null;
  const grand = totals.reduce((s, t) => s + t.total, 0);

  return (
    <div className={`rounded-xl border border-border/60 bg-muted/20 overflow-hidden ${compact ? 'text-xs' : 'text-sm'}`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60 bg-muted/40">
        <span className="font-medium text-muted-foreground">{title}</span>
        <span className="font-bold tabular-nums">{fmt(grand)} DA</span>
      </div>
      <div className="divide-y divide-border/40">
        {totals.map(({ method, total }) => {
          const meta = METHOD_META[method] || { label: method, icon: Banknote, color: 'text-muted-foreground' };
          const Icon = meta.icon;
          return (
            <div key={method} className="flex items-center justify-between px-3 py-1.5">
              <span className="flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                <span>{meta.label}</span>
              </span>
              <span className={`font-bold tabular-nums ${total > 0 ? '' : 'text-muted-foreground'}`} dir="ltr">
                {fmt(total)} DA
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PaymentMethodBreakdown;
