import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, Landmark } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { useActiveStampTiers, calculateStampAmount } from '@/hooks/useStampTiers';
import { isTransferPaidByCash, resolveReceiptBucket } from '@/utils/treasuryDocumentClassification';

export interface PickedItem {
  order_id: string;
  item_id?: string;
  treasury_entry_id?: string | null;
  amount: number;
  customer_name: string;
  store_name?: string;
  is_consolidation?: boolean;
  stamp_amount?: number;
  total_with_stamp?: number;
  created_at?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentMethod: 'check' | 'receipt' | 'receipt_cash' | 'transfer' | 'cash';
  onConfirm: (items: PickedItem[]) => void;
}

const labels: Record<string, string> = {
  check: 'Chèques',
  receipt: 'Versement Doc',
  receipt_cash: 'Versement Cash',
  transfer: 'Virement',
  cash: 'Espèces',
};

const HandoverItemPickerDialog = ({ open, onOpenChange, paymentMethod, onConfirm }: Props) => {
  const { activeBranch } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data: stampTiers } = useActiveStampTiers();

  // Fetch delivered orders with this payment method
  const { data: items, isLoading } = useQuery({
    queryKey: ['handover-picker', paymentMethod, activeBranch?.id],
    enabled: open,
    queryFn: async () => {
      const baseQuery = () => {
        let query = supabase
          .from('orders')
          .select('id, total_amount, partial_amount, payment_status, invoice_payment_method, document_verification, created_at, customer_id, customers!inner(name, store_name), order_items(total_price)')
          .eq('status', 'delivered')
          .eq('payment_type', 'with_invoice');
        if (activeBranch?.id) query = query.eq('branch_id', activeBranch.id);
        return query;
      };

      let orders: any[] = [];
      if (paymentMethod === 'cash') {
        const { data, error } = await baseQuery().in('invoice_payment_method', ['cash', 'receipt', 'transfer']);
        if (error) throw error;
        orders = (data || []).filter((order: any) => {
          return order.invoice_payment_method === 'cash';
        });
      } else {
        const invoiceMethod = paymentMethod === 'receipt_cash' ? 'receipt' : paymentMethod;
        const { data, error } = await baseQuery().eq('invoice_payment_method', invoiceMethod);
        if (error) throw error;
        orders = (data || []).filter((order: any) => {
          if (paymentMethod === 'receipt_cash') {
            return resolveReceiptBucket(order.document_verification) === 'cash';
          }
          if (paymentMethod === 'receipt') {
            return resolveReceiptBucket(order.document_verification) === 'doc';
          }
          if (paymentMethod === 'transfer') {
            return !isTransferPaidByCash(order.document_verification);
          }
          return true;
        });
      }

      let handedQuery = supabase
        .from('handover_items')
        .select('order_id, treasury_entry_id, handover:manager_handovers!inner(branch_id)')
        .eq('payment_method', paymentMethod);
      if (activeBranch?.id) handedQuery = handedQuery.eq('handover.branch_id', activeBranch.id);

      const { data: handedOver, error: handedOverError } = await handedQuery;
      if (handedOverError) throw handedOverError;

      const handedOverIds = new Set((handedOver || []).map((h: any) => h.order_id).filter(Boolean));
      const handedTreasuryIds = new Set((handedOver || []).map((h: any) => h.treasury_entry_id).filter(Boolean));

      const orderItems: PickedItem[] = (orders || [])
        .filter((o: any) => !handedOverIds.has(o.id))
        .map((o: any): PickedItem => {
          let amount = Number(o.total_amount || 0);
          if (o.payment_status === 'partial') amount = Number(o.partial_amount || 0);
          else if (o.payment_status === 'debt') amount = 0;
          const itemsSubtotal = (o.order_items || []).reduce((sum: number, item: any) => sum + Number(item.total_price || 0), 0);
          const stampAmount =
            paymentMethod === 'cash' && stampTiers?.length
              ? calculateStampAmount(itemsSubtotal > 0 ? itemsSubtotal : amount, stampTiers)
              : 0;
          return {
            order_id: o.id,
            item_id: o.id,
            amount,
            stamp_amount: stampAmount,
            total_with_stamp: amount + stampAmount,
            customer_name: (o.customers as any)?.name || '',
            store_name: (o.customers as any)?.store_name || '',
            created_at: o.created_at,
          };
        })
        .filter((o: any) => o.amount > 0);

      const treasuryItems: PickedItem[] = [];
      if (paymentMethod === 'receipt') {
        let treasuryQuery = supabase
          .from('manager_treasury')
          .select('id, amount, customer_name, created_at')
          .eq('source_type', 'cash_consolidation')
          .eq('payment_method', 'bank_receipt');
        if (activeBranch?.id) treasuryQuery = treasuryQuery.eq('branch_id', activeBranch.id);

        const { data: treasuryEntries, error: treasuryError } = await treasuryQuery;
        if (treasuryError) throw treasuryError;

        treasuryItems.push(
          ...(treasuryEntries || [])
            .filter((entry: any) => !handedTreasuryIds.has(entry.id))
            .map((entry: any) => ({
              order_id: '',
              item_id: `treasury_${entry.id}`,
              treasury_entry_id: entry.id,
              amount: Number(entry.amount || 0),
              customer_name: entry.customer_name || 'عميل افتراضي',
              is_consolidation: true,
              created_at: entry.created_at,
            })),
        );
      }

      return [...orderItems, ...treasuryItems].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      );
    },
  });

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!items) return;
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(i => i.item_id || i.order_id)));
    }
  };

  const selectedItems = (items || []).filter(i => selected.has(i.item_id || i.order_id));
  const totalAmount = selectedItems.reduce((s, i) => s + i.amount, 0);
  const totalStampAmount = selectedItems.reduce((s, i) => s + Number(i.stamp_amount || 0), 0);
  const totalWithStamp = totalAmount + totalStampAmount;

  const handleConfirm = () => {
    onConfirm(selectedItems.map(i => ({
      order_id: i.order_id,
      item_id: i.item_id,
      treasury_entry_id: i.treasury_entry_id,
      amount: i.amount,
      customer_name: i.customer_name,
      stamp_amount: i.stamp_amount,
      total_with_stamp: i.total_with_stamp,
      created_at: i.created_at,
    })));
    setSelected(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>اختيار {labels[paymentMethod]} للتسليم</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !items || items.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">لا توجد عناصر غير مسلّمة</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs">
                {selected.size === items.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
              </Button>
              <Badge variant="secondary" className="text-xs">
                {selected.size} / {items.length}
              </Badge>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {items.map(item => (
                <div
                  key={item.item_id || item.order_id}
                  onClick={() => toggle(item.item_id || item.order_id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selected.has(item.item_id || item.order_id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <Checkbox checked={selected.has(item.item_id || item.order_id)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {item.is_consolidation && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500 text-amber-600 shrink-0">
                          <Landmark className="w-3 h-3 mr-0.5" />
                          تجميع
                        </Badge>
                      )}
                      <p className="text-sm font-semibold truncate">
                        {item.store_name ? `${item.store_name} - ${item.customer_name}` : item.customer_name}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                    {paymentMethod === 'cash' && Number(item.stamp_amount || 0) > 0 && (
                      <p dir="ltr" className="mt-0.5 text-[10px] text-amber-600">
                        طابع: {Number(item.stamp_amount || 0).toLocaleString()} د.ج
                        {' · '}
                        الإجمالي: {Number(item.total_with_stamp || item.amount).toLocaleString()} د.ج
                      </p>
                    )}
                  </div>
                  <p dir="ltr" className="text-sm font-bold text-primary whitespace-nowrap">
                    {item.amount.toLocaleString()} د.ج
                  </p>
                </div>
              ))}
            </div>

            {selected.size > 0 && (
              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">المجموع ({selected.size} عنصر)</span>
                  <span className="font-bold text-primary">{totalAmount.toLocaleString()} د.ج</span>
                </div>
                {paymentMethod === 'cash' && totalStampAmount > 0 && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">الطابع</span>
                      <span className="font-bold text-amber-600">{totalStampAmount.toLocaleString()} د.ج</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">الإجمالي مع الطابع</span>
                      <span className="font-bold text-green-600">{totalWithStamp.toLocaleString()} د.ج</span>
                    </div>
                  </>
                )}
                <Button onClick={handleConfirm} className="w-full gap-2">
                  <Check className="w-4 h-4" />
                  تأكيد الاختيار
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default HandoverItemPickerDialog;
