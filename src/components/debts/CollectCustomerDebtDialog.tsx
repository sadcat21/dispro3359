import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CalendarClock,
  Loader2,
  MapPin,
  Lock,
  Printer,
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

type TimelinePayment = {
  id: string;
  debt_id: string;
  amount: number;
  payment_method?: string | null;
  notes?: string | null;
  collected_at?: string | null;
  created_at?: string | null;
  worker?: { full_name?: string | null } | null;
};

interface TimelineEvent {
  id: string;
  debtId?: string;
  kind: TimelineKind;
  date: string;
  displayDate: string;
  workerName: string;
  workerId?: string | null;
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

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || '');
  }
  return '';
};

const formatMoney = (value: number) => `${value.toLocaleString()} DA`;

const formatDateOnly = (value?: string | null, t?: (k: string) => string) => {
  if (!value) return t ? t('debt_collect.no_date') : 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const d = date.toLocaleDateString('fr-FR');
  const tm = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${d} ${tm}`;
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
  document_verification?: unknown;
} | null) => {
  if (!order) return 'cash';

  const paymentType = String(order.payment_type || '').toLowerCase();
  const invoiceMethod = String(order.invoice_payment_method || '').toLowerCase();
  const documentVerification = order.document_verification;
  const paidByCash = Boolean(
    documentVerification &&
    typeof documentVerification === 'object' &&
    'paid_by_cash' in documentVerification &&
    documentVerification.paid_by_cash === true,
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
    worker_id?: string | null;
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
      workerId: debt.worker_id || null,
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
      workerId: payment.worker_id || null,
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

  // Worker permissions are tied to accounting sessions: once a worker has a completed
  // accounting session covering a payment's collected_at, that payment becomes frozen
  // for the worker. Admin / branch manager / assistant manager can still bypass.
  const canBypassAccountingLock = isAdmin || role === 'admin_assistant';
  const paymentWorkerIds = useMemo(
    () => Array.from(new Set(payments.map((p) => p.worker_id).filter(Boolean) as string[])),
    [payments],
  );
  const { data: completedSessions = [] } = useQuery({
    queryKey: ['debt-payments-locking-sessions', paymentWorkerIds],
    queryFn: async () => {
      if (!paymentWorkerIds.length) return [];
      const { data, error } = await supabase
        .from('accounting_sessions')
        .select('worker_id, period_start, period_end, completed_at, status')
        .in('worker_id', paymentWorkerIds)
        .not('completed_at', 'is', null);
      if (error) throw error;
      return data || [];
    },
    enabled: open && paymentWorkerIds.length > 0,
  });
  // Payments accounted for in a completed session — shown as a stamp to everyone.
  const accountedPaymentIds = useMemo(() => {
    const set = new Set<string>();
    payments.forEach((p) => {
      const ts = new Date(p.collected_at || p.created_at || 0).getTime();
      if (!ts) return;
      const found = completedSessions.some((s: any) => {
        if (s.worker_id !== p.worker_id) return false;
        const start = s.period_start ? new Date(s.period_start).getTime() : -Infinity;
        const end = s.period_end ? new Date(s.period_end).getTime() : Infinity;
        return ts >= start && ts <= end;
      });
      if (found) set.add(p.id);
    });
    return set;
  }, [payments, completedSessions]);
  // Locked = accounted AND user cannot bypass — blocks edit/delete.
  const lockedPaymentIds = useMemo(
    () => (canBypassAccountingLock ? new Set<string>() : accountedPaymentIds),
    [canBypassAccountingLock, accountedPaymentIds],
  );

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
          assigned_worker:workers!orders_assigned_worker_id_fkey(id, full_name, username)
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

  const openDebtOrderDetails = async (item: TimelineEvent) => {
    const linkedDebt = item.debtId ? debtsById.get(item.debtId) : undefined;
    let linkedOrderId = item.orderId || linkedDebt?.order_id || null;

    if (!linkedOrderId && item.debtId) {
      const { data, error } = await supabase
        .from('customer_debts')
        .select('id, order_id, customer_id, worker_id, branch_id, total_amount, paid_amount, remaining_amount, created_at')
        .eq('id', item.debtId)
        .maybeSingle();

      if (error) {
        toast.error(error.message || t('debt_collect.no_order_linked'));
        return;
      }

      linkedOrderId = data?.order_id || null;

      if (!linkedOrderId && data?.customer_id) {
        const debtCreatedAt = new Date(data.created_at || item.date);
        const startDate = new Date(debtCreatedAt.getTime() - 1000 * 60 * 60 * 24 * 3).toISOString();
        const endDate = new Date(debtCreatedAt.getTime() + 1000 * 60 * 60 * 24).toISOString();
        const { data: candidateOrders, error: orderSearchError } = await supabase
          .from('orders')
          .select('id, total_amount, partial_amount, payment_status, created_at, updated_at, customer_id, created_by, assigned_worker_id, branch_id')
          .eq('customer_id', data.customer_id)
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .order('created_at', { ascending: false })
          .limit(25);

        if (orderSearchError) {
          toast.error(orderSearchError.message || t('debt_collect.no_order_linked'));
          return;
        }

        const debtAmount = toNumber(data.total_amount);
        const debtTime = debtCreatedAt.getTime();
        const scoredOrders = (candidateOrders || [])
          .map((order) => {
            const totalAmount = toNumber(order.total_amount);
            const partialAmount = toNumber(order.partial_amount);
            const remainingFromOrder = Math.max(0, totalAmount - partialAmount);
            const orderTime = new Date(order.created_at || order.updated_at || item.date).getTime();
            const hoursDiff = Number.isFinite(orderTime) ? Math.abs(debtTime - orderTime) / (1000 * 60 * 60) : 999;
            let score = 0;

            if (Math.abs(remainingFromOrder - debtAmount) <= 1) score += 12;
            if (Math.abs(totalAmount - debtAmount) <= 1) score += 8;
            if (order.assigned_worker_id === data.worker_id || order.created_by === data.worker_id) score += 5;
            if (data.branch_id && order.branch_id === data.branch_id) score += 3;
            if (hoursDiff <= 2) score += 5;
            else if (hoursDiff <= 24) score += 3;
            else if (hoursDiff <= 72) score += 1;

            return { orderId: order.id, score };
          })
          .sort((a, b) => b.score - a.score);

        linkedOrderId = scoredOrders[0]?.score >= 8 ? scoredOrders[0].orderId : null;
      }
    }

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

  const timeline = useMemo(() => buildTimeline(debts, debtOrderStatusById, payments as TimelinePayment[], t), [debtOrderStatusById, debts, payments, t]);
  const filteredTimeline = useMemo(
    () => timeline.filter((item) => showVisitsInTimeline || item.kind !== 'visit'),
    [timeline, showVisitsInTimeline],
  );
  const visitsCount = useMemo(() => timeline.filter((i) => i.kind === 'visit').length, [timeline]);
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
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || t('debt_collect.collect_failed'));
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
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || t('debt_collect.visit_failed'));
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
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || t('debt_collect.schedule_failed'));
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
          className="max-w-[96vw] sm:max-w-xl p-0 overflow-hidden"
        >
          <DialogTitle className="sr-only">{sectionTitle(activeTab, t)}</DialogTitle>


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
                  <div className="flex items-center justify-between gap-2 rounded-2xl border bg-white px-3 py-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-full shrink-0"
                      onClick={() => setShowHistoryReceipt(true)}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>

                    <div className="flex-1 min-w-0 mx-2 rounded-xl border bg-slate-50 px-3 py-1.5 text-center">
                      <div className="text-xs font-bold text-slate-700 truncate">{customerName}</div>
                      <div className="text-sm font-black text-destructive tabular-nums" dir="ltr">
                        {formatMoney(totalRemaining)}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant={showVisitsInTimeline ? 'default' : 'outline'}
                      size="sm"
                      className="relative rounded-full h-9 px-3 text-xs gap-1 shrink-0"
                      onClick={() => setShowVisitsInTimeline((v) => !v)}
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {t('debt_collect.show_visits')}
                      {visitsCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold inline-flex items-center justify-center shadow">
                          {visitsCount}
                        </span>
                      )}
                    </Button>
                  </div>

                  {paymentsLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : timelineSections.length === 0 ? (
                    <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">
                      {t('debt_collect.no_movements')}
                    </div>
                  ) : (
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
                          const isPayment = item.kind === 'partial' || item.kind === 'full';
                          const underlyingId = item.id.startsWith('debt-')
                            ? item.id.slice(5)
                            : item.id.startsWith('payment-')
                              ? item.id.slice(8)
                              : null;
                          const isAccounted = isPayment && underlyingId ? accountedPaymentIds.has(underlyingId) : false;
                          const isLocked = isPayment && underlyingId ? lockedPaymentIds.has(underlyingId) : false;
                          const handleClick = () => {
                            if (isPayment && underlyingId) {
                              if (isLocked) {
                                toast.error('تم إغلاق هذا التحصيل بعد المحاسبة مع المسؤول');
                                return;
                              }
                              setEditTarget({ kind: 'payment', id: underlyingId, currentAmount: item.amount });
                              setEditAmountInput(String(item.amount));
                            } else if (isDebt || isCancelledDebt) {
                              void openDebtOrderDetails(item);
                            }
                          };
                          const clickable = isPayment || isDebt || isCancelledDebt;
                          return (
                            <button
                              type="button"
                              key={item.id}
                              onClick={handleClick}
                              className={`relative flex items-center gap-3 px-4 py-3 text-sm w-full text-right ${
                                (sIdx + iIdx) % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                              } border-b last:border-b-0 ${clickable ? 'hover:bg-slate-100 cursor-pointer' : 'cursor-default'}`}
                            >
                              <span className={`absolute inset-y-0 right-0 w-1 ${tone.bar}`} />
                              <Icon className={`h-4 w-4 shrink-0 ${tone.text}`} />
                              <span className={`font-black tabular-nums ${tone.text}`} dir="ltr">
                                {formatMoney(item.amount)}
                              </span>
                              <Badge variant="outline" className="rounded-full text-[10px] font-semibold">
                                {item.workerName}
                              </Badge>
                              {!isVisit && (
                                <Badge variant="secondary" className="rounded-full text-[10px] font-semibold">
                                  {paymentMethodLabel(item.paymentMethod, t)}
                                </Badge>
                              )}
                              {isVisit && (
                                <Badge className="rounded-full text-[10px] font-semibold gap-1 bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100">
                                  <MapPin className="h-3 w-3" />
                                  زيارة بدون تحصيل
                                </Badge>
                              )}
                              {isAccounted && (
                                <span
                                  className="inline-flex items-center gap-1 rounded-md border-2 border-emerald-600 bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 -rotate-6 shadow-sm"
                                  title="تمت محاسبة هذا التحصيل مع المسؤول"
                                >
                                  <Lock className="h-3 w-3" />
                                  محاسَب
                                </span>
                              )}
                              <span className="ml-auto text-xs font-semibold text-indigo-600 tabular-nums" dir="ltr">
                                {item.displayDate}
                              </span>
                            </button>
                          );
                        })
                      )}
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
         hideModifyAction
       />

      {/* Edit amount dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span>{editTarget?.kind === 'debt' ? t('debt_collect.edit_debt_amount') : t('debt_collect.edit_collection_amount')}</span>
              {customerName ? <span className="text-sm font-semibold text-slate-500">— {customerName}</span> : null}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>{t('debt_collect.current_amount')}</Label>
            <Input
              type="number"
              value={Number(editTarget?.currentAmount || 0)}
              readOnly
              disabled
            />
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
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button
              className="flex-1"
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
                } catch (err: unknown) {
                  toast.error(getErrorMessage(err) || t('debt_collect.edit_failed'));
                }
              }}
            >
              {(editDebtMutation.isPending || editPaymentMutation.isPending) ? t('debt_collect.saving') : t('debt_collect.save')}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                if (!editTarget) return;
                setDeleteTarget({
                  kind: editTarget.kind,
                  id: editTarget.id,
                  label: customerName || '',
                });
                setEditTarget(null);
              }}
            >
              {t('debt_collect.delete')}
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
                } catch (err: unknown) {
                  toast.error(getErrorMessage(err) || t('debt_collect.cancel_failed'));
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
