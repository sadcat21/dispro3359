import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CalendarClock,
  Eye,
  Loader2,
  MapPin,
  Pencil,
  Printer,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { CustomerDebtWithDetails } from '@/types/accounting';
import { OrderWithDetails } from '@/types/database';
import {
  useCollectCustomerDebtGroup,
  useDeleteCustomerDebt,
  useDeleteDebtPayment,
  useEditCustomerDebt,
  useEditDebtPayment,
  useRecordCustomerDebtGroupVisit,
  useUpdateCustomerDebtGroupSchedule,
} from '@/hooks/useCustomerDebts';
import { useDebtPaymentsGroup } from '@/hooks/useDebtPayments';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import QuickDayPicker from '@/components/debts/QuickDayPicker';
import ReceiptDialog from '@/components/printing/ReceiptDialog';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { isAdminRole } from '@/lib/utils';
import { toast } from 'sonner';

type DialogTab = 'collect' | 'visit' | 'history';

interface CollectCustomerDebtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  customerId?: string;
  customerPhone?: string | null;
  debts: CustomerDebtWithDetails[];
  initialTab?: DialogTab;
}

type TimelineKind = 'debt' | 'partial' | 'full' | 'visit' | 'cancelled_debt';

interface TimelineEvent {
  id: string;
  debtId?: string;
  kind: TimelineKind;
  date: string;
  displayDate: string;
  workerName: string;
  paymentMethod: string | null;
  amount: number;
  beforeAmount: number;
  afterAmount: number;
  note: string | null;
  orderId?: string | null;
}

const toNumber = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const formatMoney = (value: number) => `${value.toLocaleString()} DA`;

const formatDateOnly = (value?: string | null, t?: (k: string) => string) => {
  if (!value) return t ? t('debt_collect.no_date') : 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('fr-FR');
};

const paymentMethodLabel = (value?: string | null, t?: (k: string) => string) => {
  const tr = t || ((k: string) => k);
  switch (String(value || '').toLowerCase()) {
    case 'cash':
    case 'versement_cash':
      return tr('debt_collect.method_cash');
    case 'check':
      return tr('debt_collect.method_check');
    case 'transfer':
    case 'virement':
      return tr('debt_collect.method_transfer');
    case 'receipt':
    case 'versement_doc':
      return 'Versement Doc';
    case 'visit':
      return tr('debt_collect.method_visit');
    default:
      return tr('debt_collect.method_debt');
  }
};

const paymentMethodFrench = (value?: string | null) => {
  switch (String(value || '').toLowerCase()) {
    case 'cash':
      return 'ESP';
    case 'check':
      return 'CHQ';
    case 'transfer':
    case 'virement':
      return 'VIR';
    case 'receipt':
    case 'versement_doc':
      return 'V-DOC';
    case 'versement_cash':
      return 'V-CASH';
    default:
      return 'DET';
  }
};

const sectionTitle = (tab: DialogTab, t: (k: string) => string) => {
  if (tab === 'visit') return t('debt_collect.title_visit');
  if (tab === 'history') return t('debt_collect.title_history');
  return t('debt_collect.title_collect');
};

const resolveOriginPaymentMethod = (order?: {
  payment_type?: string | null;
  invoice_payment_method?: string | null;
  document_verification?: any;
} | null) => {
  if (!order) return 'cash';

  const paymentType = String(order.payment_type || '').toLowerCase();
  const invoiceMethod = String(order.invoice_payment_method || '').toLowerCase();
  const paidByCash = Boolean(
    order.document_verification &&
    typeof order.document_verification === 'object' &&
    order.document_verification.paid_by_cash === true,
  );

  if (paymentType !== 'with_invoice') {
    return 'cash';
  }

  if (invoiceMethod === 'check') return 'check';
  if (invoiceMethod === 'transfer' || invoiceMethod === 'virement') return 'transfer';
  if (invoiceMethod === 'receipt' || invoiceMethod === 'versement') {
    return paidByCash ? 'cash' : 'receipt';
  }
  if (invoiceMethod === 'cash') return 'cash';

  return 'cash';
};

const buildTimeline = (
  debts: CustomerDebtWithDetails[],
  orderStatusById: Map<string, string>,
  payments: Array<{
    id: string;
    debt_id: string;
    amount: number;
    payment_method?: string | null;
    notes?: string | null;
    collected_at?: string | null;
    created_at?: string | null;
    worker?: { full_name?: string | null } | null;
  }>,
  t?: (k: string) => string,
) => {
  const rawEvents: Array<Omit<TimelineEvent, 'beforeAmount' | 'afterAmount' | 'displayDate'>> = [];

  debts.forEach((debt) => {
    const linkedOrderStatus = debt.order_id ? orderStatusById.get(debt.order_id) : null;
    const isCancelled = linkedOrderStatus ? linkedOrderStatus === 'cancelled' : (debt.status as string) === 'cancelled';
    rawEvents.push({
      id: `debt-${debt.id}`,
      debtId: debt.id,
      kind: isCancelled ? 'cancelled_debt' : 'debt',
      date: debt.created_at,
      workerName: debt.worker?.full_name || debt.worker?.username || '-',
      paymentMethod: 'debt',
      amount: toNumber(debt.total_amount),
      note: debt.notes || null,
      orderId: debt.order_id,
    });
  });

  payments.forEach((payment) => {
    const amount = toNumber(payment.amount);
    const date = payment.collected_at || payment.created_at || new Date().toISOString();
    rawEvents.push({
      id: `payment-${payment.id}`,
      debtId: payment.debt_id,
      kind: amount <= 0 ? 'visit' : 'partial',
      date,
      workerName: payment.worker?.full_name || '-',
      paymentMethod: payment.payment_method || null,
      amount,
      note: payment.notes || null,
      orderId: null,
    });
  });

  const ascending = rawEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let balance = 0;
  const withBalances: TimelineEvent[] = ascending.map((event) => {
    const beforeAmount = balance;
    let afterAmount = balance;
    let kind = event.kind;

    if (event.kind === 'debt') {
      afterAmount = beforeAmount + event.amount;
    } else if (event.kind === 'cancelled_debt') {
      afterAmount = beforeAmount;
    } else if (event.kind === 'visit') {
      afterAmount = beforeAmount;
    } else {
      afterAmount = Math.max(0, beforeAmount - event.amount);
      kind = afterAmount <= 0 ? 'full' : 'partial';
    }

    balance = afterAmount;

    return {
      ...event,
      kind,
      beforeAmount,
      afterAmount,
      displayDate: formatDateOnly(event.date, t),
    };
  });

  return withBalances.reverse();
};

const CollectCustomerDebtDialog: React.FC<CollectCustomerDebtDialogProps> = ({
  open,
  onOpenChange,
  customerName,
  customerId,
  customerPhone,
  debts,
  initialTab = 'collect',
}) => {
  const { workerId, user, role } = useAuth();
  const { t } = useLanguage();
  const isAdmin = isAdminRole(role);
  const collectMutation = useCollectCustomerDebtGroup();
  const visitMutation = useRecordCustomerDebtGroupVisit();
  const scheduleMutation = useUpdateCustomerDebtGroupSchedule();
  const editDebtMutation = useEditCustomerDebt();
  const deleteDebtMutation = useDeleteCustomerDebt();
  const editPaymentMutation = useEditDebtPayment();
  const deletePaymentMutation = useDeleteDebtPayment();
  const [activeTab, setActiveTab] = useState<DialogTab>(initialTab);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [visitType, setVisitType] = useState<'in_person' | 'phone'>('in_person');
  const [visitNextDueDate, setVisitNextDueDate] = useState('');
  const [collectionType, setCollectionType] = useState<'none' | 'daily' | 'weekly'>('none');
  const [collectionAmount, setCollectionAmount] = useState('');
  const [collectionDays, setCollectionDays] = useState<string[]>([]);
  const [showVisitsInTimeline, setShowVisitsInTimeline] = useState(false);
  const [historyViewMode, setHistoryViewMode] = useState<'cards' | 'list'>('cards');
  const [showHistoryReceipt, setShowHistoryReceipt] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Edit/cancel state for timeline items
  const [editTarget, setEditTarget] = useState<{
    kind: 'debt' | 'payment';
    id: string;
    currentAmount: number;
  } | null>(null);
  const [editAmountInput, setEditAmountInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'debt' | 'payment';
    id: string;
    label: string;
  } | null>(null);

  const debtIds = useMemo(() => debts.map((debt) => debt.id), [debts]);
  const debtsById = useMemo(() => new Map(debts.map((debt) => [debt.id, debt])), [debts]);
  const orderIds = useMemo(
    () => debts.map((debt) => debt.order_id).filter(Boolean) as string[],
    [debts],
  );
  const { data: payments = [], isLoading: paymentsLoading } = useDebtPaymentsGroup(debtIds);

  const { data: debtOrders = [] } = useQuery({
    queryKey: ['collect-customer-debt-origin-orders', orderIds],
    queryFn: async () => {
      if (!orderIds.length) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, payment_type, invoice_payment_method, document_verification')
        .in('id', orderIds);

      if (error) throw error;
      return data || [];
    },
    enabled: open && orderIds.length > 0,
  });

  const { data: selectedOrder, isLoading: orderLoading } = useQuery({
    queryKey: ['collect-customer-debt-order-details', selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) return null;
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(*),
          created_by_worker:workers!orders_created_by_fkey(id, full_name, username),
          assigned_worker:workers!orders_assigned_to_fkey(id, full_name, username)
        `)
        .eq('id', selectedOrderId)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as OrderWithDetails | null;
    },
    enabled: !!selectedOrderId,
  });

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, open]);

  useEffect(() => {
    if (!open) return;
    const firstDebt = debts[0];
    setCollectionType((firstDebt?.collection_type as 'none' | 'daily' | 'weekly') || 'none');
    setCollectionAmount(firstDebt?.collection_amount ? String(firstDebt.collection_amount) : '');
    setCollectionDays(firstDebt?.collection_days || []);
    setShowVisitsInTimeline(false);
  }, [open, debts]);

  useEffect(() => {
    if (!open) return;

    const orderMap = new Map(debtOrders.map((order) => [order.id, order]));
    const activeDebts = debts.filter((debt) => toNumber(debt.remaining_amount) > 0);
    const candidateDebts = activeDebts.length > 0 ? activeDebts : debts;
    const resolvedMethods = candidateDebts
      .map((debt) => {
        const sourceOrder = debt.order_id ? orderMap.get(debt.order_id) : null;
        return resolveOriginPaymentMethod(sourceOrder);
      })
      .filter(Boolean);

    const preferredMethod =
      resolvedMethods.find((method) => method === 'receipt') ||
      resolvedMethods.find((method) => method === 'check') ||
      resolvedMethods.find((method) => method === 'transfer') ||
      resolvedMethods[0] ||
      'cash';

    setPaymentMethod(preferredMethod);
  }, [open, debtOrders, debts]);

  const openDebtOrderDetails = (item: TimelineEvent) => {
    const linkedDebt = item.debtId ? debtsById.get(item.debtId) : undefined;
    const linkedOrderId = item.orderId || linkedDebt?.order_id || null;

    if (!linkedOrderId) {
      toast.error(t('debt_collect.no_order_linked'));
      return;
    }

    setSelectedOrderId(linkedOrderId);
  };

  const totalDebt = useMemo(
    () => debts.reduce((sum, debt) => sum + toNumber(debt.total_amount), 0),
    [debts],
  );
  const totalRemaining = useMemo(
    () => debts.reduce((sum, debt) => sum + toNumber(debt.remaining_amount), 0),
    [debts],
  );
  const totalPaid = Math.max(0, totalDebt - totalRemaining);
  const numericAmount = Math.max(0, toNumber(amount));
  const debtOrderStatusById = useMemo(
    () => new Map(debtOrders.map((order) => [order.id, String((order as { status?: string }).status || '')])),
    [debtOrders],
  );
  const printableDebts = useMemo(
    () => debts.filter((debt) => {
      const linkedOrderStatus = debt.order_id ? debtOrderStatusById.get(debt.order_id) : null;
      return linkedOrderStatus !== 'cancelled';
    }),
    [debtOrderStatusById, debts],
  );
  const printableDebtTotal = useMemo(
    () => printableDebts.reduce((sum, debt) => sum + toNumber(debt.total_amount), 0),
    [printableDebts],
  );
  const printableRemainingTotal = useMemo(
    () => printableDebts.reduce((sum, debt) => sum + toNumber(debt.remaining_amount), 0),
    [printableDebts],
  );
  const printablePaidTotal = Math.max(0, printableDebtTotal - printableRemainingTotal);

  const timeline = useMemo(() => buildTimeline(debts, debtOrderStatusById, payments as any, t), [debtOrderStatusById, debts, payments, t]);
  const filteredTimeline = useMemo(
    () => timeline.filter((item) => showVisitsInTimeline || item.kind !== 'visit'),
    [timeline, showVisitsInTimeline],
  );
  const timelineSections = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    filteredTimeline.forEach((item) => {
      const key = item.displayDate;
      const existing = map.get(key) || [];
      existing.push(item);
      map.set(key, existing);
    });
    return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
  }, [filteredTimeline]);

  const handleCollect = async () => {
    if (!workerId) {
      toast.error(t('debt_collect.worker_not_identified'));
      return;
    }

    if (numericAmount <= 0) {
      toast.error(t('debt_collect.invalid_amount'));
      return;
    }

    try {
      await collectMutation.mutateAsync({
        debts,
        amount: numericAmount,
        workerId,
        paymentMethod,
        notes: notes || undefined,
        nextDueDate: nextDueDate || undefined,
      });
      toast.success(t('debt_collect.collected_success'));
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || t('debt_collect.collect_failed'));
    }
  };

  const handleVisit = async () => {
    if (!workerId) {
      toast.error(t('debt_collect.worker_not_identified'));
      return;
    }

    try {
      await visitMutation.mutateAsync({
        debts,
        workerId,
        notes: visitNotes || undefined,
        nextDueDate: visitNextDueDate || undefined,
        visitType,
      });
      toast.success(t('debt_collect.visit_recorded'));
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || t('debt_collect.visit_failed'));
    }
  };

  const handleSaveSchedule = async () => {
    try {
      await scheduleMutation.mutateAsync({
        debtIds,
        collectionType,
        collectionAmount: collectionAmount ? toNumber(collectionAmount) : null,
        collectionDays,
      });
      toast.success(t('debt_collect.schedule_updated'));
    } catch (error: any) {
      toast.error(error?.message || t('debt_collect.schedule_failed'));
    }
  };

  const historyReceiptData = useMemo(() => ({
    receiptType: 'debt_payment' as const,
    debtId: customerId || debtIds[0] || null,
    customerId: customerId || debts[0]?.customer_id || '',
    customerName,
    customerPhone: customerPhone || null,
    workerId: workerId || '',
    workerName: user?.full_name || '',
    workerPhone: null,
    branchId: debts[0]?.branch_id || null,
    items: [],
    totalAmount: printableDebtTotal,
    paidAmount: 0,
    remainingAmount: printableRemainingTotal,
    debtTotalAmount: printableDebtTotal,
    debtPaidBefore: printablePaidTotal,
    paymentMethod: null,
    notes: null,
    collectorName: user?.full_name || '',
    receiptTitleOverride: 'ETAT DES DETTES',
    hidePaymentDetails: true,
    debtMovementEntries: filteredTimeline
      .filter((item) => item.kind !== 'visit' && item.kind !== 'cancelled_debt')
      .map((item) => ({
        kind: item.kind as 'debt' | 'full' | 'partial' | 'visit',
        date: item.displayDate,
        workerName: item.workerName,
        paymentMethod: item.kind === 'debt' ? 'debt' : item.paymentMethod,
        beforeAmount: item.beforeAmount,
        afterAmount: item.afterAmount,
        amount: item.amount,
        note: item.note,
      })),
  }), [customerId, customerName, customerPhone, debtIds, debts, filteredTimeline, printableDebtTotal, printablePaidTotal, printableRemainingTotal, user?.full_name, workerId]);

  const renderSchedule = () => (
    <div className="rounded-2xl border border-red-200 bg-red-50/40 p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <CalendarClock className="h-4 w-4 text-red-500" />
        {t('debt_collect.schedule_title')}
      </div>

      <Select value={collectionType} onValueChange={(value) => setCollectionType(value as 'none' | 'daily' | 'weekly')}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t('debt_collect.no_schedule')}</SelectItem>
          <SelectItem value="daily">{t('debt_collect.daily')}</SelectItem>
          <SelectItem value="weekly">{t('debt_collect.weekly')}</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="number"
        min="0"
        value={collectionAmount}
        onChange={(e) => setCollectionAmount(e.target.value)}
        placeholder={t('debt_collect.periodic_amount')}
      />

      {collectionType === 'weekly' && (
        <QuickDayPicker
          onSelectDate={() => undefined}
          multiSelect
          selectedDays={collectionDays}
          onSelectDays={setCollectionDays}
        />
      )}

      <Button
        type="button"
        className="w-full"
        variant="outline"
        onClick={handleSaveSchedule}
        disabled={scheduleMutation.isPending}
      >
        {scheduleMutation.isPending ? t('debt_collect.saving') : t('debt_collect.save_schedule')}
      </Button>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          dir="rtl"
          className="max-w-[96vw] sm:max-w-xl p-0 overflow-hidden [&>button]:hidden"
        >
          <DialogTitle className="sr-only">{sectionTitle(activeTab, t)}</DialogTitle>

          <div className="relative border-b border-red-100 bg-white px-5 pb-4 pt-5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute left-3 top-3 h-10 w-10 rounded-full border border-slate-200 bg-white text-slate-500"
              onClick={() => onOpenChange(false)}
            >
              ×
            </Button>

            <div className="pr-10 text-right">
              <p className="text-lg font-black text-slate-900">{customerName}</p>
              <p className="mt-1 text-sm text-slate-500">{sectionTitle(activeTab, t)}</p>
              <p className="mt-2 text-3xl font-black text-destructive" dir="ltr">
                {formatMoney(totalRemaining)}
              </p>
            </div>
          </div>

          <ScrollArea className="max-h-[78vh]">
            <div className="space-y-4 p-4">
              {activeTab === 'collect' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border bg-white p-4 text-center">
                      <div className="text-xs text-slate-500">{t('debt_collect.total_debt')}</div>
                      <div className="mt-2 text-xl font-black" dir="ltr">{formatMoney(totalDebt)}</div>
                    </div>
                    <div className="rounded-2xl border bg-white p-4 text-center">
                      <div className="text-xs text-slate-500">{t('debt_collect.remaining_after')}</div>
                      <div className="mt-2 text-xl font-black text-emerald-600" dir="ltr">
                        {formatMoney(Math.max(0, totalRemaining - numericAmount))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border bg-white p-4">
                    <div className="space-y-2">
                      <Label>{t('debt_collect.collected_amount')}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        dir="ltr"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant="outline" onClick={() => setAmount(String(totalRemaining))}>
                        {t('debt_collect.full_payment')}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setAmount(String(Math.round(totalRemaining / 2)))}>
                        {t('debt_collect.half_payment')}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>{t('debt_collect.payment_method')}</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">{t('debt_collect.method_cash')}</SelectItem>
                          <SelectItem value="check">{t('debt_collect.method_check')}</SelectItem>
                          <SelectItem value="receipt">Versement Doc</SelectItem>
                          <SelectItem value="transfer">{t('debt_collect.method_transfer')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">
                        {t('debt_collect.original_method')}: {paymentMethodLabel(paymentMethod, t)}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>{t('debt_collect.next_collect_date')}</Label>
                      <Input
                        type="date"
                        value={nextDueDate}
                        onChange={(e) => setNextDueDate(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t('debt_collect.notes')}</Label>
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>

                    <Button className="w-full" onClick={handleCollect} disabled={collectMutation.isPending}>
                      {collectMutation.isPending ? t('debt_collect.confirming') : t('debt_collect.confirm_collection')}
                    </Button>
                  </div>

                  {renderSchedule()}
                </>
              )}

              {activeTab === 'visit' && (
                <>
                  <div className="space-y-3 rounded-2xl border bg-white p-4">
                    <div className="space-y-2">
                      <Label>{t('debt_collect.visit_type')}</Label>
                      <Select value={visitType} onValueChange={(value) => setVisitType(value as 'in_person' | 'phone')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_person">{t('debt_collect.visit_in_person')}</SelectItem>
                          <SelectItem value="phone">{t('debt_collect.visit_phone')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{t('debt_collect.next_collect_date')}</Label>
                      <Input
                        type="date"
                        value={visitNextDueDate}
                        onChange={(e) => setVisitNextDueDate(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t('debt_collect.visit_notes')}</Label>
                      <Textarea value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)} />
                    </div>

                    <Button className="w-full" onClick={handleVisit} disabled={visitMutation.isPending}>
                      {visitMutation.isPending ? t('debt_collect.recording') : t('debt_collect.record_visit')}
                    </Button>
                  </div>

                  {renderSchedule()}
                </>
              )}

              {activeTab === 'history' && (
                <>
                  <div className="flex items-center justify-between rounded-2xl border bg-white px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-full"
                        onClick={() => setShowHistoryReceipt(true)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <div className="text-right">
                        <div className="text-sm font-bold">{t('debt_collect.movement')}</div>
                        <div className="text-xs text-slate-500">{t('debt_collect.date_only')}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="inline-flex rounded-full border bg-slate-50 p-0.5">
                        <button
                          type="button"
                          onClick={() => setHistoryViewMode('cards')}
                          className={`px-3 py-1 text-xs font-bold rounded-full transition ${historyViewMode === 'cards' ? 'bg-primary text-primary-foreground shadow' : 'text-slate-600'}`}
                        >
                          {t('debt_collect.view_cards') || 'تفاصيل'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryViewMode('list')}
                          className={`px-3 py-1 text-xs font-bold rounded-full transition ${historyViewMode === 'list' ? 'bg-primary text-primary-foreground shadow' : 'text-slate-600'}`}
                        >
                          {t('debt_collect.view_list') || 'قائمة'}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="show-visits" className="text-sm">{t('debt_collect.show_visits')}</Label>
                        <Switch
                          id="show-visits"
                          checked={showVisitsInTimeline}
                          onCheckedChange={setShowVisitsInTimeline}
                        />
                      </div>
                    </div>
                  </div>

                  {paymentsLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : timelineSections.length === 0 ? (
                    <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">
                      {t('debt_collect.no_movements')}
                    </div>
                  ) : historyViewMode === 'list' ? (
                    <div className="rounded-2xl border bg-white overflow-hidden">
                      {timelineSections.flatMap((section, sIdx) =>
                        section.items.map((item, iIdx) => {
                          const isDebt = item.kind === 'debt';
                          const isCancelledDebt = item.kind === 'cancelled_debt';
                          const isVisit = item.kind === 'visit';
                          const tone = isVisit
                            ? { bar: 'bg-slate-300', text: 'text-slate-700', Icon: MapPin }
                            : isCancelledDebt
                              ? { bar: 'bg-slate-300', text: 'text-slate-400 line-through', Icon: ArrowDownCircle }
                              : isDebt
                                ? { bar: 'bg-destructive', text: 'text-destructive', Icon: ArrowDownCircle }
                                : { bar: 'bg-emerald-500', text: 'text-emerald-700', Icon: ArrowUpCircle };
                          const Icon = tone.Icon;
                          return (
                            <div
                              key={item.id}
                              className={`relative flex items-center gap-3 px-4 py-3 text-sm ${
                                (sIdx + iIdx) % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                              } border-b last:border-b-0`}
                            >
                              <span className={`absolute inset-y-0 right-0 w-1 ${tone.bar}`} />
                              <Icon className={`h-4 w-4 shrink-0 ${tone.text}`} />
                              <span className={`font-black tabular-nums ${tone.text}`} dir="ltr">
                                {formatMoney(item.amount)}
                              </span>
                              <Badge variant="outline" className="rounded-full text-[10px] font-semibold">
                                {item.workerName}
                              </Badge>
                              <span className="ml-auto text-xs text-slate-500 tabular-nums" dir="ltr">
                                {item.displayDate}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {timelineSections.map((section) => (
                        <div key={section.date} className="space-y-3">
                          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-xs font-bold text-slate-600">
                            {section.date}
                          </div>

                          {section.items.map((item) => {
                            const isDebt = item.kind === 'debt';
                            const isCancelledDebt = item.kind === 'cancelled_debt';
                            const isVisit = item.kind === 'visit';
                            const linkedDebt = item.debtId ? debtsById.get(item.debtId) : undefined;
                            const canOpenOrder = (isDebt || isCancelledDebt) && !!(item.orderId || linkedDebt?.order_id);

                            const itemKind: 'debt' | 'payment' | null =
                              isDebt ? 'debt' : (item.kind === 'partial' || item.kind === 'full') ? 'payment' : null;
                            const underlyingId = item.id.startsWith('debt-')
                              ? item.id.slice(5)
                              : item.id.startsWith('payment-')
                                ? item.id.slice(8)
                                : null;
                            const canModify = isAdmin && itemKind && underlyingId && !isCancelledDebt;

                            return (
                              <div key={item.id} className="relative">
                                <button
                                  type="button"
                                  disabled={!canOpenOrder}
                                  onClick={() => canOpenOrder && openDebtOrderDetails(item)}
                                  className={`w-full rounded-2xl border p-4 text-right transition ${
                                    isVisit
                                      ? 'border-slate-200 bg-white'
                                      : isCancelledDebt
                                        ? 'border-slate-300 bg-slate-100/60 opacity-60'
                                      : isDebt
                                        ? 'border-red-200 bg-red-50/40'
                                        : 'border-emerald-200 bg-emerald-50/40'
                                  } ${canOpenOrder ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center justify-end gap-2">
                                        <span className={`text-base font-black ${
                                          isVisit ? 'text-slate-700' : isCancelledDebt ? 'text-slate-400 line-through' : isDebt ? 'text-destructive' : 'text-emerald-700'
                                        }`}>
                                          {isVisit
                                            ? t('debt_collect.visit_no_collect')
                                            : isCancelledDebt
                                              ? t('debt_collect.new_debt')
                                            : item.kind === 'full'
                                              ? t('debt_collect.full_collect')
                                              : item.kind === 'partial'
                                                ? t('debt_collect.partial_collect')
                                                : t('debt_collect.new_debt')}
                                        </span>
                                        {isCancelledDebt && (
                                          <Badge variant="destructive" className="rounded-full text-[10px]">
                                            {t('debt_collect.cancelled_order')}
                                          </Badge>
                                        )}
                                        <Badge variant="outline" className="rounded-full">
                                          {item.workerName}
                                        </Badge>
                                      </div>

                                      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                                        <div className="rounded-xl bg-white/80 px-3 py-2">
                                          <div className="text-[11px] text-slate-500">{t('debt_collect.value')}</div>
                                          <div className={`mt-1 text-sm font-black ${
                                            isVisit ? 'text-slate-700' : isDebt ? 'text-destructive' : 'text-emerald-700'
                                          }`} dir="ltr">
                                            {formatMoney(item.amount)}
                                          </div>
                                        </div>
                                        <div className="rounded-xl bg-white/80 px-3 py-2">
                                          <div className="text-[11px] text-slate-500">{t('debt_collect.new_debt_amount')}</div>
                                          <div className="mt-1 text-sm font-black text-slate-900" dir="ltr">
                                            {formatMoney(item.afterAmount)}
                                          </div>
                                        </div>
                                        <div className="rounded-xl bg-white/80 px-3 py-2">
                                          <div className="text-[11px] text-slate-500">{t('debt_collect.method')}</div>
                                          <div className="mt-1 text-sm font-black text-slate-900">
                                            {paymentMethodLabel(item.paymentMethod, t)}
                                          </div>
                                        </div>
                                      </div>

                                      {item.note ? (
                                        <div className="mt-3 text-xs text-slate-500">
                                          {isCancelledDebt ? null : item.note}
                                        </div>
                                      ) : null}

                                      {canOpenOrder ? (
                                        <div className="mt-3 inline-flex items-center gap-1 text-xs text-primary">
                                          <Eye className="h-3.5 w-3.5" />
                                          {t('debt_collect.click_open_order')}
                                        </div>
                                      ) : null}
                                    </div>

                                    <div className="shrink-0 text-left">
                                      <div className="flex items-center gap-1 text-xs text-slate-500" dir="ltr">
                                        {isVisit ? <MapPin className="h-3.5 w-3.5" /> : isDebt ? <ArrowDownCircle className="h-3.5 w-3.5" /> : <ArrowUpCircle className="h-3.5 w-3.5" />}
                                        {item.displayDate}
                                      </div>
                                    </div>
                                  </div>
                                </button>

                                {canModify && (
                                  <div className="absolute top-2 left-2 flex gap-1 z-10">
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 rounded-full bg-white/90 shadow-sm hover:bg-white"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditTarget({
                                          kind: itemKind!,
                                          id: underlyingId!,
                                          currentAmount: item.amount,
                                        });
                                        setEditAmountInput(String(item.amount));
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5 text-slate-600" />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 rounded-full bg-white/90 shadow-sm hover:bg-destructive/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteTarget({
                                          kind: itemKind!,
                                          id: underlyingId!,
                                          label: itemKind === 'debt' ? t('debt_collect.label_debt') : t('debt_collect.label_collection'),
                                        });
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <ReceiptDialog
        open={showHistoryReceipt}
        onOpenChange={setShowHistoryReceipt}
        receiptData={historyReceiptData}
      />

      <OrderDetailsDialog
        open={!!selectedOrderId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedOrderId(null);
        }}
        order={orderLoading ? null : selectedOrder || null}
      />

      {/* Edit amount dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editTarget?.kind === 'debt' ? t('debt_collect.edit_debt_amount') : t('debt_collect.edit_collection_amount')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>{t('debt_collect.new_amount')}</Label>
            <Input
              type="number"
              min="0"
              value={editAmountInput}
              onChange={(e) => setEditAmountInput(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              {t('debt_collect.balance_auto_update')}
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)}>{t('debt_collect.cancel')}</Button>
            <Button
              disabled={editDebtMutation.isPending || editPaymentMutation.isPending}
              onClick={async () => {
                if (!editTarget) return;
                const newAmount = Number(editAmountInput || 0);
                if (newAmount < 0 || !Number.isFinite(newAmount)) {
                  toast.error(t('debt_collect.invalid_amount_short'));
                  return;
                }
                try {
                  if (editTarget.kind === 'debt') {
                    await editDebtMutation.mutateAsync({
                      debtId: editTarget.id,
                      total_amount: newAmount,
                    });
                  } else {
                    await editPaymentMutation.mutateAsync({
                      paymentId: editTarget.id,
                      newAmount,
                    });
                  }
                  toast.success(t('debt_collect.edited_success'));
                  setEditTarget(null);
                } catch (err: any) {
                  toast.error(err?.message || t('debt_collect.edit_failed'));
                }
              }}
            >
              {(editDebtMutation.isPending || editPaymentMutation.isPending) ? t('debt_collect.saving') : t('debt_collect.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('debt_collect.cancel_label')} {deleteTarget?.label}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('debt_collect.confirm_cancel_q')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('debt_collect.go_back')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  if (deleteTarget.kind === 'debt') {
                    await deleteDebtMutation.mutateAsync(deleteTarget.id);
                  } else {
                    await deletePaymentMutation.mutateAsync(deleteTarget.id);
                  }
                  toast.success(t('debt_collect.cancelled_success'));
                  setDeleteTarget(null);
                } catch (err: any) {
                  toast.error(err?.message || t('debt_collect.cancel_failed'));
                }
              }}
            >
              {t('debt_collect.confirm_cancel')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>

  );
};

export default CollectCustomerDebtDialog;
