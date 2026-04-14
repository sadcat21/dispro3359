import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveStampTiers, calculateStampAmount } from '@/hooks/useStampTiers';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AlertCircle, ArrowUpRight, Banknote, Coins, CreditCard, Pencil, Receipt, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { resolveReceiptBucket } from '@/utils/treasuryDocumentClassification';
import TreasuryConsolidationEditDialog from '@/components/treasury/TreasuryConsolidationEditDialog';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { OrderWithDetails } from '@/types/database';
import { formatAmountWithMaxFraction } from '@/utils/amountFormatting';

type PaymentCategory =
  | 'cash_invoice1'
  | 'cash_invoice2'
  | 'check'
  | 'bank_receipt_cash'
  | 'bank_receipt'
  | 'bank_transfer';

const categoryConfig: Record<PaymentCategory, { label: string; icon: any; colorClass: string }> = {
  cash_invoice1: { label: 'Espèces Facture 1', icon: Banknote, colorClass: 'text-green-500' },
  cash_invoice2: { label: 'Espèces Facture 2', icon: Banknote, colorClass: 'text-emerald-500' },
  check: { label: 'Chèques', icon: CreditCard, colorClass: 'text-blue-500' },
  bank_receipt_cash: { label: 'Versement Cash', icon: Receipt, colorClass: 'text-fuchsia-500' },
  bank_receipt: { label: 'Versement Doc', icon: Receipt, colorClass: 'text-purple-500' },
  bank_transfer: { label: 'Virement', icon: ArrowUpRight, colorClass: 'text-orange-500' },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: PaymentCategory;
  handedCashInvoice2Amount?: number;
}

interface ProcessedOrder {
  id: string;
  total_amount: number;
  items_subtotal: number;
  stamp_amount: number;
  stamp_percentage: number;
  created_at: string;
  is_debt: boolean;
  debt_amount: number;
  can_move_to_receipt_cash?: boolean;
}

interface CustomerGroup {
  customer_id: string;
  customer_name: string;
  store_name: string | null;
  orders: ProcessedOrder[];
  total: number;
  totalStamp: number;
  totalDebt: number;
}

const MoneyValue = ({ value, className = '' }: { value: number; className?: string }) => (
  <bdi dir="ltr" className={`inline-block whitespace-nowrap tabular-nums ${className}`.trim()}>
    {formatAmountWithMaxFraction(value)} DA
  </bdi>
);

const PaymentMethodDetailsDialog = ({ open, onOpenChange, category, handedCashInvoice2Amount: handedCashInvoice2AmountProp = 0 }: Props) => {
  const { workerId, activeBranch } = useAuth();
  const queryClient = useQueryClient();
  const config = categoryConfig[category];
  const Icon = config.icon;
  const isCashInvoice1 = category === 'cash_invoice1';
  const isCashInvoice2 = category === 'cash_invoice2';
  const isReceiptCash = category === 'bank_receipt_cash';
  const isBankReceipt = category === 'bank_receipt';
  const { data: stampTiers } = useActiveStampTiers();

  // Consolidation edit state
  const [editConsolId, setEditConsolId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderData, setSelectedOrderData] = useState<OrderWithDetails | null>(null);

  const openOrderDetails = async (orderId: string) => {
    setSelectedOrderId(orderId);
    const { data } = await supabase
      .from('orders')
      .select('*, customer:customers(*), order_items(*, product:products(*))')
      .eq('id', orderId)
      .single();
    if (data) {
      setSelectedOrderData({
        ...data,
        items: data.order_items?.map((item: any) => ({ ...item, product: item.product })),
      } as any);
    }
  };
  const { data: handedCashInvoice2AmountFromQuery = 0 } = useQuery({
    queryKey: ['treasury-handed-cash-invoice2', activeBranch?.id],
    enabled: open && isCashInvoice2,
    queryFn: async () => {
      let query = supabase.from('manager_handovers').select('cash_invoice2');
      if (activeBranch?.id) query = query.eq('branch_id', activeBranch.id);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).reduce((sum: number, handover: any) => sum + Number(handover.cash_invoice2 || 0), 0);
    },
  });
  const handedCashInvoice2Amount = handedCashInvoice2AmountProp || handedCashInvoice2AmountFromQuery;

  const { data: customerGroups, isLoading } = useQuery({
    queryKey: ['treasury-details', category, activeBranch?.id, stampTiers?.length, handedCashInvoice2Amount],
    enabled: open && (isCashInvoice1 ? !!stampTiers : true),
    queryFn: async () => {
      let handedQuery = supabase
        .from('handover_items')
        .select('order_id, payment_method, handover:manager_handovers!inner(branch_id)');
      if (activeBranch?.id) handedQuery = handedQuery.eq('handover.branch_id', activeBranch.id);
      const { data: handedItems, error: handedError } = await handedQuery;
      if (handedError) throw handedError;

      const handedByOrder = new Map<string, Set<string>>();
      for (const item of handedItems || []) {
        if (!item.order_id) continue;
        if (!handedByOrder.has(item.order_id)) {
          handedByOrder.set(item.order_id, new Set());
        }
        handedByOrder.get(item.order_id)!.add(String(item.payment_method || ''));
      }

      let query = supabase
        .from('orders')
        .select(
          'id, total_amount, payment_status, partial_amount, payment_type, invoice_payment_method, created_at, customer_id, document_verification, customer:customers(name, store_name), order_items(total_price)',
        )
        .eq('status', 'delivered')
        .order('created_at', { ascending: false });

      if (activeBranch?.id) query = query.eq('branch_id', activeBranch.id);

      switch (category) {
        case 'cash_invoice1':
          query = query.eq('payment_type', 'with_invoice').eq('invoice_payment_method', 'cash');
          break;
        case 'cash_invoice2':
          query = query.eq('payment_type', 'without_invoice');
          break;
        case 'check':
          query = query.eq('payment_type', 'with_invoice').eq('invoice_payment_method', 'check');
          break;
        case 'bank_receipt_cash':
        case 'bank_receipt':
          query = query.eq('payment_type', 'with_invoice').eq('invoice_payment_method', 'receipt');
          break;
        case 'bank_transfer':
          query = query.eq('payment_type', 'with_invoice').eq('invoice_payment_method', 'transfer');
          break;
      }

      const { data, error } = await query;
      if (error) throw error;

      const processedOrders: any[] = [];

      (data || []).forEach((o: any) => {
        const receiptBucket = resolveReceiptBucket(o.document_verification);
        const verification =
          o.document_verification && typeof o.document_verification === 'object' && !Array.isArray(o.document_verification)
            ? (o.document_verification as Record<string, any>)
            : {};
        const handedMethods = handedByOrder.get(o.id) || new Set<string>();

        const isHandedForCategory =
          (category === 'cash_invoice1' && handedMethods.has('cash')) ||
          (category === 'check' && handedMethods.has('check')) ||
          (category === 'bank_receipt' && handedMethods.has('receipt')) ||
          (category === 'bank_transfer' && handedMethods.has('transfer')) ||
          (category === 'bank_receipt_cash' &&
            (handedMethods.has('receipt_cash') || handedMethods.has('cash') || handedMethods.has('receipt')));

        if (isHandedForCategory) return;
        if (category === 'bank_receipt_cash' && receiptBucket !== 'cash') return;
        if (category === 'bank_receipt' && receiptBucket !== 'doc') return;

        const customerId = o.customer_id;
        const customer = o.customer as any;
        const totalAmount = Number(o.total_amount || 0);
        const itemsSubtotal = (o.order_items || []).reduce((s: number, i: any) => s + Number(i.total_price || 0), 0);

        let debtAmount = 0;
        const isDebt = o.payment_status === 'debt';
        if (o.payment_status === 'partial') {
          debtAmount = totalAmount - Number(o.partial_amount || 0);
        } else if (isDebt) {
          debtAmount = totalAmount;
        }

        let displayAmount = totalAmount;
        if (isCashInvoice2) {
          if (o.payment_status === 'partial') {
            displayAmount = Number(o.partial_amount || 0);
          } else if (isDebt) {
            displayAmount = 0;
          }
        } else if (!isCashInvoice1 && !isCashInvoice2) {
          if (o.payment_status === 'partial') {
            displayAmount = Number(o.partial_amount || 0);
          } else if (isDebt) {
            displayAmount = 0;
          }
        }

        if (!isCashInvoice1 && displayAmount <= 0) return;

        let stampAmount = 0;
        let stampPercentage = 0;
        if (isCashInvoice1 && stampTiers?.length && totalAmount > 0) {
          const baseAmount = itemsSubtotal > 0 ? itemsSubtotal : totalAmount;
          stampAmount = calculateStampAmount(baseAmount, stampTiers);
          const activeTiers = stampTiers.filter((tier) => tier.is_active);
          const matchedTier = activeTiers.find(
            (tier) => baseAmount >= tier.min_amount && (tier.max_amount === null || baseAmount <= tier.max_amount),
          );
          if (matchedTier) stampPercentage = matchedTier.percentage;
        }

        const processedOrder: ProcessedOrder = {
          id: o.id,
          total_amount: displayAmount,
          items_subtotal: itemsSubtotal,
          stamp_amount: stampAmount,
          stamp_percentage: stampPercentage,
          created_at: o.created_at,
          is_debt: isCashInvoice2 ? false : isDebt || o.payment_status === 'partial',
          debt_amount: isCashInvoice2 ? 0 : debtAmount,
          can_move_to_receipt_cash: verification.manager_receipt_bucket === 'doc',
        };

        processedOrders.push({
          customer_id: customerId,
          customer_name: customer?.name || 'عميل غير معروف',
          store_name: customer?.store_name || null,
          order: processedOrder,
        });
      });

      let normalizedOrders = processedOrders;
      if (isCashInvoice2) {
        let remainingHanded = handedCashInvoice2Amount;
        normalizedOrders = processedOrders
          .sort((a, b) => new Date(a.order.created_at).getTime() - new Date(b.order.created_at).getTime())
          .flatMap((entry) => {
            if (remainingHanded <= 0) return [entry];
            const orderAmount = Number(entry.order.total_amount || 0);
            if (remainingHanded >= orderAmount) {
              remainingHanded -= orderAmount;
              return [];
            }
            const adjustedOrder = {
              ...entry.order,
              total_amount: Math.max(0, orderAmount - remainingHanded),
            };
            remainingHanded = 0;
            return adjustedOrder.total_amount > 0 ? [{ ...entry, order: adjustedOrder }] : [];
          });
      }

      const groupMap = new Map<string, CustomerGroup>();

      normalizedOrders.forEach((entry) => {
        const customerId = entry.customer_id;
        const customerName = entry.customer_name;
        const storeName = entry.store_name;
        const processedOrder = entry.order as ProcessedOrder;

        if (!groupMap.has(customerId)) {
          groupMap.set(customerId, {
            customer_id: customerId,
            customer_name: customerName,
            store_name: storeName,
            orders: [],
            total: 0,
            totalStamp: 0,
            totalDebt: 0,
          });
        }

        const group = groupMap.get(customerId)!;
        group.orders.push(processedOrder);
        group.total += Number(processedOrder.total_amount || 0);
        group.totalStamp += Number(processedOrder.stamp_amount || 0);
        group.totalDebt += Number(processedOrder.debt_amount || 0);
      });

      // For bank_receipt (Versement Doc), also include cash consolidation entries
      if (category === 'bank_receipt') {
        let consolQuery = supabase
          .from('manager_treasury')
          .select('id, amount, customer_name, created_at, notes')
          .eq('source_type', 'cash_consolidation')
          .eq('payment_method', 'bank_receipt');
        if (activeBranch?.id) consolQuery = consolQuery.eq('branch_id', activeBranch.id);
        const { data: consolEntries } = await consolQuery;

        for (const entry of consolEntries || []) {
          const consolId = `consol_${entry.id}`;
          if (!groupMap.has(consolId)) {
            groupMap.set(consolId, {
              customer_id: consolId,
              customer_name: entry.customer_name || 'تجميع كاش',
              store_name: '💰 مصدر: تجميع كاش',
              orders: [{
                id: entry.id,
                total_amount: Number(entry.amount || 0),
                items_subtotal: 0,
                stamp_amount: 0,
                stamp_percentage: 0,
                created_at: entry.created_at,
                is_debt: false,
                debt_amount: 0,
              }],
              total: Number(entry.amount || 0),
              totalStamp: 0,
              totalDebt: 0,
            });
          }
        }
      }

      return Array.from(groupMap.values()).sort((a, b) => b.total - a.total);
    },
  });

  // Query to track which order groups have been converted to invoice2
  const { data: invoice2ConvertedOrderIds = new Set<string>() } = useQuery({
    queryKey: ['receipt-cash-to-invoice2', activeBranch?.id],
    enabled: open && isReceiptCash,
    queryFn: async () => {
      let q = supabase
        .from('manager_treasury')
        .select('notes')
        .eq('source_type', 'receipt_cash_to_invoice2')
        .eq('payment_method', 'cash_invoice2');
      if (activeBranch?.id) q = q.eq('branch_id', activeBranch.id);
      const { data } = await q;
      const ids = new Set<string>();
      for (const entry of data || []) {
        // Extract order IDs from notes
        const match = entry.notes?.match(/order_ids:(.+)/);
        if (match) match[1].split(',').forEach((id: string) => ids.add(id.trim()));
      }
      return ids;
    },
  });

  const moveGroupToReceiptDoc = async (group: CustomerGroup) => {
    try {
      const orderIds = group.orders.map((order) => order.id);
      if (orderIds.length === 0) return;

      const { data: orders, error: fetchError } = await supabase
        .from('orders')
        .select('id, document_verification')
        .in('id', orderIds);
      if (fetchError) throw fetchError;

      for (const order of orders || []) {
        const verification =
          order.document_verification && typeof order.document_verification === 'object' && !Array.isArray(order.document_verification)
            ? { ...(order.document_verification as Record<string, any>) }
            : {};

        verification.manager_receipt_bucket = 'doc';
        verification.paid_by_cash = false;

        const { error } = await supabase
          .from('orders')
          .update({
            document_status: 'received',
            document_verification: verification,
          })
          .eq('id', order.id);

        if (error) throw error;
      }

      toast.success('تم تحويل العميل إلى Versement Doc');
      queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-details'] });
      queryClient.invalidateQueries({ queryKey: ['handover-picker'] });
    } catch (error: any) {
      toast.error(error?.message || 'تعذر تحويل العميل إلى Versement Doc');
    }
  };

  const moveGroupToInvoice2 = async (group: CustomerGroup) => {
    try {
      const amount = group.total;
      if (amount <= 0) return;
      const orderIds = group.orders.map((o) => o.id);

      const entries = [
        {
          manager_id: workerId!,
          branch_id: activeBranch?.id || null,
          source_type: 'receipt_cash_to_invoice2',
          payment_method: 'cash_invoice2',
          amount: amount,
          customer_name: group.customer_name,
          notes: `تحويل من Versement Cash إلى فاتورة 2 | ${group.customer_name} | order_ids:${orderIds.join(',')}`,
        },
        {
          manager_id: workerId!,
          branch_id: activeBranch?.id || null,
          source_type: 'receipt_cash_to_invoice2_debit',
          payment_method: 'receipt_cash',
          amount: -amount,
          customer_name: group.customer_name,
          notes: `خصم تحويل إلى فاتورة 2 | ${group.customer_name} | order_ids:${orderIds.join(',')}`,
        },
      ];

      const { error } = await supabase.from('manager_treasury').insert(entries);
      if (error) throw error;

      toast.success('تم تحويل المبلغ إلى فاتورة 2');
      queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-details'] });
      queryClient.invalidateQueries({ queryKey: ['receipt-cash-to-invoice2'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-remaining-counts'] });
    } catch (error: any) {
      toast.error(error?.message || 'تعذر التحويل');
    }
  };

  const moveGroupToReceiptCash = async (group: CustomerGroup) => {
    try {
      const orderIds = group.orders.map((order) => order.id);
      if (orderIds.length === 0) return;

      const { data: orders, error: fetchError } = await supabase
        .from('orders')
        .select('id, document_verification')
        .in('id', orderIds);
      if (fetchError) throw fetchError;

      for (const order of orders || []) {
        const verification =
          order.document_verification && typeof order.document_verification === 'object' && !Array.isArray(order.document_verification)
            ? { ...(order.document_verification as Record<string, any>) }
            : {};

        verification.manager_receipt_bucket = 'cash';
        verification.paid_by_cash = true;
        verification.receipt_received = false;

        const { error } = await supabase
          .from('orders')
          .update({
            document_status: 'none',
            document_verification: verification,
          })
          .eq('id', order.id);

        if (error) throw error;
      }

      toast.success('تمت إعادة العميل إلى Versement Cash');
      queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-details'] });
      queryClient.invalidateQueries({ queryKey: ['handover-picker'] });
    } catch (error: any) {
      toast.error(error?.message || 'تعذر الإرجاع إلى Versement Cash');
    }
  };

  const recoverGroupFromInvoice2 = async (group: CustomerGroup) => {
    try {
      const orderIds = group.orders.map((o) => o.id);
      // Delete the treasury entries for this conversion
      const { error } = await supabase
        .from('manager_treasury')
        .delete()
        .in('source_type', ['receipt_cash_to_invoice2', 'receipt_cash_to_invoice2_debit'])
        .like('notes', `%order_ids:${orderIds.join(',')}%`);
      if (error) throw error;

      toast.success('تم استرجاع المبلغ من فاتورة 2');
      queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-details'] });
      queryClient.invalidateQueries({ queryKey: ['receipt-cash-to-invoice2'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-remaining-counts'] });
    } catch (error: any) {
      toast.error(error?.message || 'تعذر الاسترجاع');
    }
  };

  const invalidateConsolQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
    queryClient.invalidateQueries({ queryKey: ['treasury-details'] });
    queryClient.invalidateQueries({ queryKey: ['treasury-remaining-counts'] });
    queryClient.invalidateQueries({ queryKey: ['consolidation-history'] });
    queryClient.invalidateQueries({ queryKey: ['manager-treasury'] });
  };

  const handleDeleteConsol = async (consolEntryId: string) => {
    if (!confirm('هل تريد إلغاء هذا التجميع؟ سيتم استرجاع المبالغ إلى مصادرها الأصلية.')) return;
    try {
      // Find related debit entries
      const { data: mainEntry } = await supabase
        .from('manager_treasury')
        .select('customer_name, created_at')
        .eq('id', consolEntryId)
        .single();
      if (!mainEntry) throw new Error('لم يتم العثور على التجميع');

      const posTime = new Date(mainEntry.created_at).getTime();
      let debitQuery = supabase
        .from('manager_treasury')
        .select('id, created_at, customer_name')
        .eq('source_type', 'cash_consolidation_debit');
      if (activeBranch?.id) debitQuery = debitQuery.eq('branch_id', activeBranch.id);
      const { data: debits } = await debitQuery;

      const relatedDebitIds = (debits || [])
        .filter((d: any) => d.customer_name === mainEntry.customer_name && Math.abs(new Date(d.created_at).getTime() - posTime) < 10000)
        .map((d: any) => d.id);

      const allIds = [consolEntryId, ...relatedDebitIds];
      const { error } = await supabase.from('manager_treasury').delete().in('id', allIds);
      if (error) throw error;

      toast.success('تم إلغاء التجميع بنجاح');
      invalidateConsolQueries();
    } catch (err: any) {
      toast.error('خطأ: ' + (err.message || ''));
    }
  };

  // handleSaveConsolEdit removed — now handled by TreasuryConsolidationEditDialog

  const grandTotal = (customerGroups || []).reduce((sum, group) => sum + group.total, 0);
  const grandStamp = isCashInvoice1 ? (customerGroups || []).reduce((sum, group) => sum + group.totalStamp, 0) : 0;
  const grandDebt = (customerGroups || []).reduce((sum, group) => sum + group.totalDebt, 0);
  const totalOrders = (customerGroups || []).reduce((sum, group) => sum + group.orders.length, 0);
  const invoice1GrandTotal = isCashInvoice1 ? grandTotal + grandStamp : grandTotal;
  const cashInvoice2Remaining = isCashInvoice2 ? grandTotal : 0;
  const cashInvoice2Handed = isCashInvoice2 ? handedCashInvoice2Amount : 0;
  const cashInvoice2Overall = isCashInvoice2 ? cashInvoice2Remaining + cashInvoice2Handed : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.colorClass}`} />
            {config.label}
            <Badge variant="secondary" className="mr-auto">
              {totalOrders} عملية - {customerGroups?.length || 0} عميل
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {isCashInvoice2 && (
          <div className="mb-2 space-y-2">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">المتبقي</p>
              <MoneyValue value={cashInvoice2Remaining} className={`text-xl font-bold ${config.colorClass}`} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-muted bg-background p-2 text-center">
                <p className="text-[10px] text-muted-foreground">الإجمالي</p>
                <MoneyValue value={cashInvoice2Overall} className="text-sm font-bold text-foreground" />
              </div>
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-2 text-center">
                <p className="text-[10px] text-muted-foreground">مسلّم</p>
                <MoneyValue value={cashInvoice2Handed} className="text-sm font-bold text-green-600" />
              </div>
            </div>
          </div>
        )}

        {!isCashInvoice2 && <div className="mb-2 rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-xs text-muted-foreground">الإجمالي</p>
          <p className={`text-xl font-bold ${config.colorClass}`}>{formatAmountWithMaxFraction(invoice1GrandTotal)} د.ج</p>
        </div>}

        {isCashInvoice1 && (
          <>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-2 text-center">
                <p className="text-[10px] text-muted-foreground">قيمة المشتريات</p>
                <p className="text-sm font-bold text-green-600">{formatAmountWithMaxFraction(grandTotal)} د.ج</p>
              </div>
              {grandStamp > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-center">
                  <div className="mb-0.5 flex items-center justify-center gap-1">
                    <Coins className="h-3 w-3 text-amber-600" />
                    <p className="text-[10px] font-medium text-amber-700">قيمة الطابع</p>
                  </div>
                  <p className="text-sm font-bold text-amber-600">{formatAmountWithMaxFraction(grandStamp)} د.ج</p>
                </div>
              )}
            </div>
            {grandDebt > 0 && (
              <div className="mb-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center">
                <div className="mb-1 flex items-center justify-center gap-1">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <p className="text-xs font-medium text-destructive">ديون غير محصلة (مستعارة من Facture 2)</p>
                </div>
                <p className="text-lg font-bold text-destructive">{formatAmountWithMaxFraction(grandDebt)} د.ج</p>
              </div>
            )}
          </>
        )}

        {!isCashInvoice1 && !isCashInvoice2 && grandDebt > 0 && (
          <div className="mb-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center">
            <p className="text-xs font-medium text-destructive">ديون غير محصلة</p>
            <p className="text-lg font-bold text-destructive">{formatAmountWithMaxFraction(grandDebt)} د.ج</p>
          </div>
        )}

        {isLoading ? (
          <p className="py-8 text-center text-muted-foreground">جاري التحميل...</p>
        ) : !customerGroups || customerGroups.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">لا توجد عمليات</p>
        ) : (
          <div className="space-y-3">
            {customerGroups.map((group) => {
              const isConsolidated = group.customer_id.startsWith('consol_');
              const canMoveToReceiptCash = isBankReceipt && !isConsolidated && group.orders.some((order) => order.can_move_to_receipt_cash);
              return (
              <Card
                key={group.customer_id}
                className={`cursor-pointer transition-shadow hover:shadow-md ${isConsolidated ? 'border-2 border-amber-400 bg-amber-50/30 dark:bg-amber-900/10' : ''}`}
                onClick={() => {
                  if (isConsolidated) {
                    setEditConsolId(group.customer_id.replace('consol_', ''));
                  } else if (group.orders.length === 1) {
                    openOrderDetails(group.orders[0].id);
                  }
                }}
              >
                <CardContent className="p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold">{group.customer_name}</p>
                        {isConsolidated && <Badge className="bg-amber-500 text-white text-[9px]">💰 تجميع كاش</Badge>}
                      </div>
                      {group.store_name && <p className="text-xs text-muted-foreground">{group.store_name}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {isConsolidated && (
                        <>
                           <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setEditConsolId(group.customer_id.replace('consol_', '')); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteConsol(group.customer_id.replace('consol_', '')); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      <div className="text-left">
                        <p className={`font-bold ${config.colorClass}`}>{formatAmountWithMaxFraction(group.total)} د.ج</p>
                        {group.orders.length > 1 && (
                          <Badge variant="outline" className="mt-1 text-[10px]">
                            {group.orders.length} عمليات
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {canMoveToReceiptCash && (
                    <div className="mb-2 flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-fuchsia-400 text-xs text-fuchsia-700 hover:bg-fuchsia-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveGroupToReceiptCash(group);
                        }}
                      >
                        <Undo2 className="ml-1 h-3.5 w-3.5" />
                        إرجاع إلى Versement Cash
                      </Button>
                    </div>
                  )}

                  {isReceiptCash && (
                    <div className="mb-2 flex flex-wrap gap-2 justify-end">
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); moveGroupToReceiptDoc(group); }}>
                        تحويل إلى Versement Doc
                      </Button>
                      {(() => {
                        const orderIds = group.orders.map((o) => o.id);
                        const isConverted = orderIds.length > 0 && orderIds.every((id) => invoice2ConvertedOrderIds.has(id));
                        return isConverted ? (
                            <Button size="sm" variant="outline" className="h-8 text-xs border-amber-400 text-amber-700 hover:bg-amber-50" onClick={(e) => { e.stopPropagation(); recoverGroupFromInvoice2(group); }}>
                            <Undo2 className="w-3.5 h-3.5 ml-1" />
                            استرجاع من فاتورة 2
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-8 text-xs border-emerald-400 text-emerald-700 hover:bg-emerald-50" onClick={(e) => { e.stopPropagation(); moveGroupToInvoice2(group); }}>
                            تحويل إلى فاتورة 2
                          </Button>
                        );
                      })()}
                    </div>
                  )}

                  {group.orders.length > 1 && (
                    <div className="space-y-1.5 border-t pt-2">
                      {group.orders.map((order) => (
                         <div key={order.id} className="flex items-center justify-between rounded bg-muted/30 p-2 text-xs cursor-pointer hover:bg-muted/60 transition-colors" onClick={(e) => { e.stopPropagation(); openOrderDetails(order.id); }}>
                          <div>
                            <p className="text-muted-foreground">
                              {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}
                            </p>
                            {order.debt_amount > 0 && <p className="text-[10px] text-destructive">دين: {formatAmountWithMaxFraction(order.debt_amount)} د.ج</p>}
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{formatAmountWithMaxFraction(order.total_amount)} د.ج</p>
                            {isCashInvoice1 && order.stamp_amount > 0 && (
                              <p className="text-[10px] text-amber-600">
                                طابع ({formatAmountWithMaxFraction(order.stamp_percentage)}%): {formatAmountWithMaxFraction(order.stamp_amount)} د.ج
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {group.orders.length === 1 && (
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <p className="text-muted-foreground">
                          {format(new Date(group.orders[0].created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}
                        </p>
                        {group.orders[0].debt_amount > 0 && (
                          <p className="text-[10px] text-destructive">دين: {formatAmountWithMaxFraction(group.orders[0].debt_amount)} د.ج</p>
                        )}
                      </div>
                      <div className="text-left">
                        {isCashInvoice1 && group.orders[0].stamp_amount > 0 && (
                          <p className="flex items-center gap-1 text-amber-600">
                            <Coins className="h-3 w-3" />
                            طابع ({formatAmountWithMaxFraction(group.orders[0].stamp_percentage)}%): {formatAmountWithMaxFraction(group.orders[0].stamp_amount)} د.ج
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}

        <TreasuryConsolidationEditDialog
          open={!!editConsolId}
          onOpenChange={(v) => !v && setEditConsolId(null)}
          consolidationId={editConsolId}
        />
        <OrderDetailsDialog
          open={!!selectedOrderData}
          onOpenChange={(v) => { if (!v) { setSelectedOrderData(null); setSelectedOrderId(null); } }}
          order={selectedOrderData}
          hideModifyAction={isBankReceipt}
        />
      </DialogContent>
    </Dialog>
  );
};

export default PaymentMethodDetailsDialog;
