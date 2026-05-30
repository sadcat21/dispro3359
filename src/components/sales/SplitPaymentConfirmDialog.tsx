import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, Circle, FileText, Banknote, Loader2 } from 'lucide-react';
import { formatNumber } from '@/utils/formatters';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PaymentGroup } from '@/utils/splitOrderByPaymentGroup';

export type GroupKind = 'receipt_doc' | 'cash_like' | 'no_invoice';

export interface GroupPaymentResult {
  key: string;
  group: PaymentGroup;
  kind: GroupKind;
  receiptReceived: boolean;
  paidByCash: boolean;
  receiptAmount: number;
  cashAmount: number;
  paidAmount: number;
  remainingDebt: number;
  isFullPayment: boolean;
  isNoPayment: boolean;
  paymentMethod: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  groups: PaymentGroup[];
  /** Stamp amount per group key (added to subtotal before display) */
  stampByKey?: Record<string, number>;
  onConfirmAll: (results: GroupPaymentResult[]) => Promise<void>;
}

interface GroupState {
  mode: 'pending' | 'receipt' | 'cash' | 'no_receipt';
  amount: string;
}

function classifyGroup(g: PaymentGroup): GroupKind {
  if (g.paymentType !== 'with_invoice') return 'no_invoice';
  if (g.invoicePaymentMethod === 'receipt' && g.invoicePaymentSubType === 'doc') return 'receipt_doc';
  if (g.invoicePaymentMethod === 'transfer' || g.invoicePaymentMethod === 'check') return 'receipt_doc';
  // cash, receipt+cash → simple paid-amount flow
  return 'cash_like';
}

const SplitPaymentConfirmDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  customerName,
  groups,
  stampByKey = {},
  onConfirmAll,
}) => {
  const { language, dir } = useLanguage();
  const [states, setStates] = useState<Record<string, GroupState>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const init: Record<string, GroupState> = {};
      groups.forEach((g) => { init[g.key] = { mode: 'pending', amount: '' }; });
      setStates(init);
    }
  }, [open, groups]);

  const totals = useMemo(() => {
    return groups.map((g) => ({
      key: g.key,
      total: g.subtotal + (stampByKey[g.key] || 0),
    }));
  }, [groups, stampByKey]);

  const isGroupReady = (g: PaymentGroup): boolean => {
    const st = states[g.key];
    if (!st) return false;
    const kind = classifyGroup(g);
    if (kind === 'receipt_doc') {
      if (st.mode === 'no_receipt') return true;
      if (st.mode === 'receipt' || st.mode === 'cash') return Number(st.amount) > 0;
      return false;
    }
    // cash_like / no_invoice → require amount (>=0 allowed; we treat empty as not ready)
    return st.amount !== '' && Number(st.amount) >= 0;
  };

  const allReady = groups.length > 0 && groups.every(isGroupReady);

  const setField = (key: string, patch: Partial<GroupState>) =>
    setStates((s) => ({ ...s, [key]: { ...s[key], ...patch } }));

  const handleConfirmAll = async () => {
    if (!allReady) return;
    setSubmitting(true);
    try {
      const results: GroupPaymentResult[] = groups.map((g) => {
        const total = (totals.find((t) => t.key === g.key)?.total) || g.subtotal;
        const st = states[g.key];
        const kind = classifyGroup(g);
        let receiptReceived = false;
        let paidByCash = false;
        let receiptAmount = 0;
        let cashAmount = 0;
        let paidAmount = 0;
        if (kind === 'receipt_doc') {
          if (st.mode === 'receipt') {
            receiptReceived = true;
            receiptAmount = Math.min(Number(st.amount) || 0, total);
            paidAmount = receiptAmount;
          } else if (st.mode === 'cash') {
            paidByCash = true;
            cashAmount = Math.min(Number(st.amount) || 0, total);
            paidAmount = cashAmount;
          } else {
            // no_receipt → full debt
            paidAmount = 0;
          }
        } else {
          const a = Math.min(Number(st.amount) || 0, total);
          paidAmount = a;
          cashAmount = a;
        }
        const remainingDebt = Math.max(0, total - paidAmount);
        const isFullPayment = paidAmount >= total;
        const isNoPayment = paidAmount === 0;
        const pmRaw = g.invoicePaymentMethod || (g.paymentType === 'with_invoice' ? 'receipt' : 'cash');
        const paymentMethod = paidByCash ? 'cash' : pmRaw;
        return {
          key: g.key,
          group: g,
          kind,
          receiptReceived,
          paidByCash,
          receiptAmount,
          cashAmount,
          paidAmount,
          remainingDebt,
          isFullPayment,
          isNoPayment,
          paymentMethod,
        };
      });
      await onConfirmAll(results);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] p-0 gap-0 overflow-hidden" dir={dir}>
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="w-5 h-5 text-primary" />
            تأكيد الدفع متعدد الفواتير
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">{customerName} — {groups.length} مجموعات دفع</p>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(92vh-9rem)] px-3 py-3">
          <div className="space-y-3">
            {groups.map((g) => {
              const ready = isGroupReady(g);
              const st = states[g.key] || { mode: 'pending', amount: '' };
              const total = (totals.find((t) => t.key === g.key)?.total) || g.subtotal;
              const kind = classifyGroup(g);
              return (
                <div key={g.key} className={`rounded-lg border p-3 space-y-2 ${ready ? 'border-green-500/60 bg-green-50/40 dark:bg-green-950/20' : 'border-border'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={g.paymentType === 'with_invoice' ? 'default' : 'secondary'} className="text-[10px]">
                        {g.badge}
                      </Badge>
                      <span className="text-sm font-medium">{g.label}</span>
                    </div>
                    {ready ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    {g.items.map((it: any, idx: number) => (
                      <div key={idx} className="flex justify-between">
                        <span className="truncate me-2">{it.productName || it.name || it.productId}</span>
                        <span>×{it.quantity} = {formatNumber(it.totalPrice, language)} DA</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold text-foreground pt-1">
                      <span>الإجمالي:</span>
                      <span>{formatNumber(total, language)} DA</span>
                    </div>
                  </div>

                  {/* Action area */}
                  {kind === 'receipt_doc' && st.mode === 'pending' && (
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <Button size="sm" className="h-9 text-xs bg-green-600 hover:bg-green-700"
                        onClick={() => setField(g.key, { mode: 'receipt', amount: String(total) })}>
                        <FileText className="w-3.5 h-3.5 me-1" />استلام
                      </Button>
                      {g.invoicePaymentMethod !== 'check' && (
                        <Button size="sm" variant="outline" className="h-9 text-xs"
                          onClick={() => setField(g.key, { mode: 'cash', amount: String(total) })}>
                          <Banknote className="w-3.5 h-3.5 me-1" />كاش
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" className="h-9 text-xs"
                        onClick={() => setField(g.key, { mode: 'no_receipt', amount: '0' })}>
                        دين
                      </Button>
                    </div>
                  )}

                  {kind === 'receipt_doc' && (st.mode === 'receipt' || st.mode === 'cash') && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">{st.mode === 'receipt' ? 'مبلغ المستند' : 'مبلغ الكاش'}</Label>
                      <div className="flex gap-1.5">
                        <Input type="number" className="h-9 text-sm" value={st.amount}
                          onChange={(e) => setField(g.key, { amount: e.target.value })} min="0" />
                        <Button variant="outline" size="sm" className="h-9 text-xs"
                          onClick={() => setField(g.key, { mode: 'pending', amount: '' })}>تغيير</Button>
                      </div>
                    </div>
                  )}

                  {kind === 'receipt_doc' && st.mode === 'no_receipt' && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-destructive font-medium">سيُسجَّل كدين كامل</span>
                      <Button variant="outline" size="sm" className="h-7 text-[11px]"
                        onClick={() => setField(g.key, { mode: 'pending', amount: '' })}>تغيير</Button>
                    </div>
                  )}

                  {kind !== 'receipt_doc' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">المبلغ المدفوع</Label>
                      <div className="flex gap-1.5">
                        <Input type="number" className="h-9 text-sm" value={st.amount}
                          onChange={(e) => setField(g.key, { amount: e.target.value })} min="0"
                          placeholder={String(total)} />
                        <Button variant="outline" size="sm" className="h-9 text-xs"
                          onClick={() => setField(g.key, { amount: String(total) })}>كامل</Button>
                        <Button variant="outline" size="sm" className="h-9 text-xs"
                          onClick={() => setField(g.key, { amount: '0' })}>دين</Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="p-3 border-t">
          <Button className="w-full h-11" disabled={!allReady || submitting} onClick={handleConfirmAll}>
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                <CheckCircle2 className="w-5 h-5 me-2" />
                تأكيد الكل ({groups.filter(isGroupReady).length}/{groups.length})
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SplitPaymentConfirmDialog;
