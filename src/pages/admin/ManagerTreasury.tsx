import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTreasurySummary, useManagerTreasury, useManagerHandovers, useCreateHandover, useAddTreasuryEntry, orderAccountingTime, parseAccountingTime } from '@/hooks/useManagerTreasury';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PaymentMethodDetailsDialog from '@/components/treasury/PaymentMethodDetailsDialog';
import StampDetailsDialog from '@/components/treasury/StampDetailsDialog';
import UncollectedDebtsDialog from '@/components/treasury/UncollectedDebtsDialog';
import CollectedDebtsDialog from '@/components/treasury/CollectedDebtsDialog';
import ExpensesDetailsDialog from '@/components/treasury/ExpensesDetailsDialog';
import HandoverItemPickerDialog, { PickedItem } from '@/components/treasury/HandoverItemPickerDialog';
import HandoverPrintView from '@/components/treasury/HandoverPrintView';
import WorkerHeldDialog from '@/components/treasury/WorkerHeldDialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Banknote, CreditCard, Receipt, ArrowUpRight, FilePlus, Send, Coins, TrendingUp, AlertCircle, CheckCircle, AlertTriangle, Info, RefreshCw, Printer, Eye, Pencil, Trash2, Settings, Download, Image, Table2, Wallet } from 'lucide-react';
import { generatePDF } from '@/utils/generatePDF';
import { generateImage } from '@/utils/generateImage';
import { toast } from 'sonner';
import InvoiceOCRScanner from '@/components/treasury/InvoiceOCRScanner';
import { format } from 'date-fns';
import { ar, fr, enUS } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import TreasurySettingsDialog from '@/components/treasury/TreasurySettingsDialog';
import CoinExchangeDialog from '@/components/treasury/CoinExchangeDialog';
import CashConsolidationDialog from '@/components/treasury/CashConsolidationDialog';
import ConsolidationHistoryTab from '@/components/treasury/ConsolidationHistoryTab';
import InvoiceRequestDialog from '@/components/treasury/InvoiceRequestDialog';
import { useTreasuryContacts } from '@/hooks/useTreasuryContacts';
import { isTransferPaidByCash, resolveReceiptBucket } from '@/utils/treasuryDocumentClassification';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsElementHidden } from '@/hooks/useUIOverrides';

const TreasuryCard = ({ icon, label, total, handed, colorClass, borderClass, onClick, currency, showDetails, badgeText }: {
  icon: React.ReactNode; label: string; total: number; handed: number; colorClass: string; borderClass: string; onClick: () => void; currency: string; showDetails: boolean; badgeText?: { operations: number; clients: number };
}) => {
  const { t } = useLanguage();
  const remaining = Math.max(0, total - handed);
  return (
    <Card className={`${borderClass} cursor-pointer hover:shadow-md transition-shadow`} onClick={onClick}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`flex items-center justify-center w-7 h-7 rounded-full bg-${colorClass}/10 shrink-0`}>{icon}</span>
          <span className={`text-sm font-bold text-${colorClass} truncate`}>{label}</span>
        </div>
        {badgeText && (
          <div className="flex justify-center">
            <div className={`flex items-stretch text-[10px] font-bold rounded-full overflow-hidden border border-${colorClass}/30`}>
              <span className={`px-2 py-0.5 bg-${colorClass}/10 text-${colorClass}`}>{badgeText.operations} عملية</span>
              <span className={`px-2 py-0.5 bg-${colorClass} text-white`}>{badgeText.clients} عميل</span>
            </div>
          </div>
        )}
        <div className="text-center">
          <MoneyValue value={remaining} currency={currency} className={`text-lg font-bold text-${colorClass}`} />
        </div>
        {showDetails && (
          <div className="flex justify-between text-[10px] px-1">
            <span className="text-muted-foreground">
              {t('treasury.total')}: <MoneyValue value={total} currency={currency} />
            </span>
            <span className="text-green-600">
              {t('treasury.handed')}: <MoneyValue value={handed} currency={currency} />
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const MoneyValue = ({ value, currency, className = '' }: { value: number; currency: string; className?: string }) => (
  <bdi dir="ltr" className={`inline-block whitespace-nowrap tabular-nums ${className}`.trim()}>
    {value.toLocaleString(undefined, { maximumFractionDigits: 4 })} {` ${currency}`}
  </bdi>
);

const SignedMoneyValue = ({ value, currency, className = '', signClassName = '' }: { value: number; currency: string; className?: string; signClassName?: string }) => (
  <span dir="ltr" className={`inline-flex items-center gap-1 whitespace-nowrap tabular-nums ${className}`.trim()}>
    <span className={signClassName}>{value >= 0 ? '+' : '-'}</span>
    <bdi dir="ltr">{Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 4 })} {currency}</bdi>
  </span>
);

const ManagerTreasury = () => {
  const { t, language, dir } = useLanguage();
  const { activeBranch, workerId, role } = useAuth();
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const dateRange = { from: dateFrom || null, to: dateTo || null };
  const { data: summary, isLoading: summaryLoading } = useTreasurySummary(dateRange);
  const isInvoiceRequestHidden = useIsElementHidden('button', 'treasury_invoice_request');
  const isSettingsHidden = useIsElementHidden('button', 'treasury_settings');
  const { data: entries } = useManagerTreasury(dateRange);
  const { data: handovers } = useManagerHandovers(dateRange);
  const createHandover = useCreateHandover();
  const addEntry = useAddTreasuryEntry();

  const cur = t('treasury.currency');
  const dateLocale = language === 'ar' ? ar : language === 'fr' ? fr : enUS;
  const paymentMethodLabels: Record<string, { label: string; icon: any }> = {
    cash_invoice1: { label: t('treasury.cash_invoice1'), icon: Banknote },
    cash_invoice2: { label: t('treasury.cash_invoice2'), icon: Coins },
    check: { label: t('treasury.check'), icon: CreditCard },
    bank_receipt_cash: { label: 'Versement Cash', icon: Receipt },
    bank_receipt: { label: 'Versement Doc', icon: Receipt },
    bank_transfer: { label: t('treasury.virement'), icon: ArrowUpRight },
    cash: { label: 'Espèces', icon: Banknote },
    receipt: { label: 'Versement Doc', icon: Receipt },
    transfer: { label: t('treasury.virement'), icon: ArrowUpRight },
  };

  const getItemTypeLabel = (key: string) => {
    const tKey = `treasury.item.${key}`;
    const translated = t(tKey);
    return translated !== tKey ? translated : key;
  };

  // Fetch session discrepancies
  const { data: discrepancies } = useQuery({
    queryKey: ['treasury-discrepancies', activeBranch?.id],
    queryFn: async () => {
      let query = supabase
        .from('accounting_session_items')
        .select('item_type, expected_amount, actual_amount, difference, accounting_sessions!inner(branch_id, status)')
        .neq('difference', 0)
        .not('item_type', 'in', '(coin_amount,expenses)');
      if (activeBranch?.id) query = query.eq('accounting_sessions.branch_id', activeBranch.id);
      const { data } = await query;
      return (data || []).map((d: any) => ({
        item_type: d.item_type,
        expected: Number(d.expected_amount),
        actual: Number(d.actual_amount),
        difference: Number(d.difference),
      }));
    },
  });

  const [addOpen, setAddOpen] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [cashBalanceOpen, setCashBalanceOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('handovers');
  const [showCardDetails, setShowCardDetails] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [stampOpen, setStampOpen] = useState(false);
  const [detailsCategory, setDetailsCategory] = useState<'cash_invoice1' | 'cash_invoice2' | 'check' | 'bank_receipt_cash' | 'bank_receipt' | 'bank_transfer' | null>(null);
  const [uncollectedDebtsOpen, setUncollectedDebtsOpen] = useState(false);
  const [collectedDebtsOpen, setCollectedDebtsOpen] = useState(false);
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [handoversListOpen, setHandoversListOpen] = useState(false);
  const [workerHeldOpen, setWorkerHeldOpen] = useState(false);
  const [addForm, setAddForm] = useState({ payment_method: 'cash_invoice1', amount: '', customer_name: '', invoice_number: '', invoice_date: '', check_number: '', check_bank: '', check_date: '', receipt_number: '', transfer_reference: '', notes: '' });
  const [handoverForm, setHandoverForm] = useState({ cash_invoice1: '', cash_invoice2: '', cash_delivered: '', notes: '', delivery_method: 'direct', intermediary_name: '', bank_transfer_reference: '', received_by: '', bank_account_id: '', receipt_image_url: '' });
  const [pickedChecks, setPickedChecks] = useState<PickedItem[]>([]);
  const [pickedCash, setPickedCash] = useState<PickedItem[]>([]);
  const [pickedReceiptCash, setPickedReceiptCash] = useState<PickedItem[]>([]);
  const [pickedReceipts, setPickedReceipts] = useState<PickedItem[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [coinExchangeOpen, setCoinExchangeOpen] = useState(false);
  const [consolidationOpen, setConsolidationOpen] = useState(false);
  const [gapTransferOpen, setGapTransferOpen] = useState(false);
  const [gapTransferAmount, setGapTransferAmount] = useState('');
  const [gapTransferSaving, setGapTransferSaving] = useState(false);
  const [invoiceRequestOpen, setInvoiceRequestOpen] = useState(false);
  const navigate = useNavigate();
  const { data: contacts } = useTreasuryContacts();
  const { data: bankAccounts } = useQuery({
    queryKey: ['treasury-bank-accounts', activeBranch?.id],
    queryFn: async () => {
      let q = supabase.from('treasury_bank_accounts').select('*').eq('is_active', true).order('bank_name');
      if (activeBranch?.id) q = q.eq('branch_id', activeBranch.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
  const [pickedTransfers, setPickedTransfers] = useState<PickedItem[]>([]);
  const [pickerType, setPickerType] = useState<'check' | 'receipt' | 'receipt_cash' | 'transfer' | 'cash' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [printHandover, setPrintHandover] = useState<string | null>(null);
  const [viewHandover, setViewHandover] = useState<string | null>(null);
  const [editHandover, setEditHandover] = useState<string | null>(null);
  const [editCash1, setEditCash1] = useState(0);
  const [editCash2, setEditCash2] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editItems, setEditItems] = useState<{checks: PickedItem[], receipts: PickedItem[], transfers: PickedItem[]}>({ checks: [], receipts: [], transfers: [] });
  const [editDeliveryMethod, setEditDeliveryMethod] = useState('direct');
  const [editIntermediaryName, setEditIntermediaryName] = useState('');
  const [editReceivedBy, setEditReceivedBy] = useState('');
  const printRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const perManagerId = role === 'branch_admin' && workerId ? workerId : null;
  const { data: remainingCounts } = useQuery({
    queryKey: ['treasury-remaining-counts', activeBranch?.id, perManagerId, dateRange.from, dateRange.to],
    enabled: !!activeBranch?.id,
    queryFn: async () => {
      let handoversQ = supabase
        .from('manager_handovers')
        .select('cash_invoice1, cash_invoice2, checks_amount, receipts_amount, transfers_amount')
        .eq('branch_id', activeBranch!.id);
      if (perManagerId) handoversQ = handoversQ.eq('manager_id', perManagerId);
      if (dateRange.from) handoversQ = handoversQ.gte('handover_date', dateRange.from);
      if (dateRange.to) handoversQ = handoversQ.lte('handover_date', dateRange.to);

      const handedItemsQ = supabase
        .from('handover_items')
        .select('order_id, treasury_entry_id, payment_method, handover:manager_handovers!inner(branch_id, manager_id)')
        .eq('handover.branch_id', activeBranch!.id);
      if (perManagerId) handedItemsQ.eq('handover.manager_id', perManagerId);
      if (dateRange.from) handedItemsQ.gte('handover.handover_date', dateRange.from);
      if (dateRange.to) handedItemsQ.lte('handover.handover_date', dateRange.to);

      let consolidationQ = supabase
        .from('manager_treasury')
        .select('id, amount, customer_name, created_at')
        .eq('source_type', 'cash_consolidation')
        .eq('payment_method', 'bank_receipt')
        .eq('branch_id', activeBranch!.id);
      if (perManagerId) consolidationQ = consolidationQ.eq('manager_id', perManagerId);
      if (dateRange.from) consolidationQ = consolidationQ.gte('created_at', `${dateRange.from}T00:00:00`);
      if (dateRange.to) consolidationQ = consolidationQ.lte('created_at', `${dateRange.to}T23:59:59`);

        let ordersQ = supabase
          .from('orders')
          .select('id, customer_id, assigned_worker_id, branch_id, created_at, delivery_date, total_amount, partial_amount, payment_status, payment_type, invoice_payment_method, document_verification')
          .eq('status', 'delivered');
        // Match PaymentMethodDetailsDialog: in perManager mode the scope is
        // enforced via assigned_worker_id + confirmed session window, so we
        // must NOT filter by orders.branch_id (would drop orders with null
        // branch_id) nor by delivery_date (would drop in-window orders whose
        // delivery falls outside the active range). Otherwise badge counts
        // diverge from the dialog list.
        if (!perManagerId) {
          ordersQ = ordersQ.eq('branch_id', activeBranch!.id);
          if (dateRange.from) ordersQ = ordersQ.gte('delivery_date', dateRange.from);
          if (dateRange.to) ordersQ = ordersQ.lte('delivery_date', dateRange.to);
        }

        const sessionWindowsPromise = perManagerId
          ? supabase
              .from('accounting_sessions')
              .select('worker_id, period_start, period_end')
              .eq('status', 'completed')
              .eq('is_treasury_posted', true)
              .eq('branch_id', activeBranch!.id)
              .not('review_session_id', 'is', null)
              .eq('manager_id', perManagerId)
              .gte('completed_at', dateRange.from ? `${dateRange.from}T00:00:00` : '0001-01-01T00:00:00')
              .lte('completed_at', dateRange.to ? `${dateRange.to}T23:59:59` : '9999-12-31T23:59:59')
          : Promise.resolve({ data: null, error: null } as any);

        const [{ data: handovers, error: handoversError }, { data: handedItems, error: handedItemsError }, { data: orders, error: ordersError }, { data: consolidationEntries, error: consolidationEntriesError }, { data: sessionWindowsRaw, error: sessionWindowsError }] = await Promise.all([
        handoversQ,
        handedItemsQ,
          ordersQ,
        consolidationQ,
          sessionWindowsPromise,
      ]);

      if (handoversError) throw handoversError;
      if (handedItemsError) throw handedItemsError;
      if (ordersError) throw ordersError;
      if (consolidationEntriesError) throw consolidationEntriesError;
        if (sessionWindowsError) throw sessionWindowsError;

      const handedByOrder = new Map<string, Set<string>>();
      const handedTreasuryIds = new Set<string>();
      for (const item of handedItems || []) {
        if (item.treasury_entry_id) handedTreasuryIds.add(String(item.treasury_entry_id));
        if (!item.order_id) continue;
        if (!handedByOrder.has(item.order_id)) handedByOrder.set(item.order_id, new Set());
        handedByOrder.get(item.order_id)!.add(String(item.payment_method || ''));
      }

      const buckets = {
        cash_invoice1: [] as Array<{ id: string; amount: number; customerId: string | null; accountingTime: number }>,
        cash_invoice2: [] as Array<{ id: string; amount: number; customerId: string | null; accountingTime: number }>,
        check: [] as Array<{ id: string; amount: number; customerId: string | null; accountingTime: number }>,
        receipt_cash: [] as Array<{ id: string; amount: number; customerId: string | null; accountingTime: number }>,
        receipt: [] as Array<{ id: string; amount: number; customerId: string | null; accountingTime: number }>,
        transfer: [] as Array<{ id: string; amount: number; customerId: string | null; accountingTime: number }>,
      };

      const sessionWindows = (sessionWindowsRaw || []).map((session: any) => ({
        worker_id: session.worker_id,
        start: parseAccountingTime(session.period_start),
        end: parseAccountingTime(session.period_end),
      }));

      for (const order of orders || []) {
        const orderTs = orderAccountingTime(order);
        if (perManagerId) {
          if (!order.assigned_worker_id) continue;
          const isCovered = sessionWindows.some((window) => window.worker_id === order.assigned_worker_id && orderTs >= window.start && orderTs <= window.end);
          if (!isCovered) continue;
        }
        let amount = Number(order.total_amount || 0);
        if (!perManagerId) {
          if (order.payment_status === 'partial') amount = Number(order.partial_amount || 0);
          else if (order.payment_status === 'debt') amount = 0;
        }
        if (amount <= 0) continue;

        const handedMethods = handedByOrder.get(order.id) || new Set<string>();
        const receiptBucket = resolveReceiptBucket(order.document_verification);
        const transferByCash = isTransferPaidByCash(order.document_verification);

        if (order.payment_type === 'without_invoice') {
          buckets.cash_invoice2.push({ id: order.id, amount, customerId: order.customer_id || null, accountingTime: orderTs });
          continue;
        }

        switch (order.invoice_payment_method) {
          case 'cash':
            if (!handedMethods.has('cash')) buckets.cash_invoice1.push({ id: order.id, amount, customerId: order.customer_id || null, accountingTime: orderTs });
            break;
          case 'check':
            if (!handedMethods.has('check')) buckets.check.push({ id: order.id, amount, customerId: order.customer_id || null, accountingTime: orderTs });
            break;
          case 'receipt':
            if (receiptBucket === 'cash') {
              if (!handedMethods.has('receipt_cash') && !handedMethods.has('cash') && !handedMethods.has('receipt')) {
                buckets.receipt_cash.push({ id: order.id, amount, customerId: order.customer_id || null, accountingTime: orderTs });
                // In perManager mode, versement-cash receipts are also rolled
                // into the Cash Facture 1 bucket (same as the dialog).
                if (perManagerId) {
                  buckets.cash_invoice1.push({ id: order.id, amount, customerId: order.customer_id || null, accountingTime: orderTs });
                }
              }
            } else if (!handedMethods.has('receipt')) {
              buckets.receipt.push({ id: order.id, amount, customerId: order.customer_id || null, accountingTime: orderTs });
            }
            break;
          case 'transfer':
            if (!transferByCash && !handedMethods.has('transfer')) buckets.transfer.push({ id: order.id, amount, customerId: order.customer_id || null, accountingTime: orderTs });
            break;
          default:
            break;
        }
      }

      for (const entry of consolidationEntries || []) {
        if (handedTreasuryIds.has(entry.id)) continue;
        buckets.receipt.push({
          id: `treasury_${entry.id}`,
          amount: Number(entry.amount || 0),
          customerId: entry.customer_name ? `treasury:${entry.customer_name}` : `treasury:${entry.id}`,
          accountingTime: entry.created_at ? new Date(entry.created_at).getTime() : 0,
        });
      }

      const applyAmountFallback = (items: Array<{ id: string; amount: number; customerId: string | null; accountingTime: number }>, handedAmount: number) => {
        let remainingHanded = Math.max(0, handedAmount);
        return items
          .slice()
          .sort((a, b) => a.accountingTime - b.accountingTime || a.id.localeCompare(b.id))
          .flatMap((item) => {
            if (remainingHanded <= 0) return [item];
            if (remainingHanded >= item.amount) {
              remainingHanded -= item.amount;
              return [];
            }
            const rest = item.amount - remainingHanded;
            remainingHanded = 0;
            return rest > 1 ? [{ ...item, amount: rest }] : [];
          });
      };

      const handedCash2 = (handovers || []).reduce((sum, handover: any) => sum + Number(handover.cash_invoice2 || 0), 0);
      const countSummary = (items: Array<{ id: string; amount: number; customerId: string | null }>) => ({
        operations: items.length,
        clients: new Set(items.map((item) => item.customerId).filter(Boolean)).size,
      });

      const cashInvoice1Items = buckets.cash_invoice1;
      const cashInvoice2Items = applyAmountFallback(buckets.cash_invoice2, handedCash2);
      const checkItems = buckets.check;
      const receiptCashItems = buckets.receipt_cash;
      const receiptDocItems = buckets.receipt;
      const transferItems = buckets.transfer;

      // For cash_invoice2 (without_invoice), count ALL delivered orders in range
      // without the per-manager session-window filter, so the badge reflects
      // the true number of operations/customers tied to that bucket.
      const inv2RawOrders = (orders || []).filter((o: any) => o.payment_type === 'without_invoice' && Number(o.total_amount || 0) > 0 && o.payment_status !== 'debt');
      const inv2Summary = {
        operations: inv2RawOrders.length,
        clients: new Set(inv2RawOrders.map((o: any) => o.customer_id).filter(Boolean)).size,
      };

      return {
        cash_invoice1: countSummary(buckets.cash_invoice1),
        cash_invoice2: inv2Summary,
        check: countSummary(buckets.check),
        receipt_cash: countSummary(buckets.receipt_cash),
        receipt: countSummary(buckets.receipt),
        transfer: countSummary(buckets.transfer),
      };
    },
  });

  const openEditHandover = async (h: any) => {
    setEditCash1(Number(h.cash_invoice1 ?? 0));
    setEditCash2(Number(h.cash_invoice2 ?? 0));
    setEditNotes(h.notes || '');
    setEditDeliveryMethod(h.delivery_method || 'direct');
    setEditIntermediaryName(h.intermediary_name || '');
    setEditReceivedBy(h.receiver_name || h.received_by || '');
    setEditHandover(h.id);
    // Load existing handover items
    const { data: items } = await supabase
      .from('handover_items')
      .select('order_id, payment_method, amount, customer_name')
      .eq('handover_id', h.id);
    if (items) {
      setEditItems({
        checks: items.filter(i => i.payment_method === 'check').map(i => ({ order_id: i.order_id || '', amount: Number(i.amount), customer_name: i.customer_name || '' })),
        receipts: items.filter(i => i.payment_method === 'receipt').map(i => ({ order_id: i.order_id || '', amount: Number(i.amount), customer_name: i.customer_name || '' })),
        transfers: items.filter(i => i.payment_method === 'transfer').map(i => ({ order_id: i.order_id || '', amount: Number(i.amount), customer_name: i.customer_name || '' })),
      });
    }
  };

  const saveEditHandover = async () => {
    if (!editHandover) return;
    setEditSaving(true);
    try {
      const h = handovers?.find(ho => ho.id === editHandover);
      if (!h) return;
      const newTotal = editCash1 + editCash2 + Number(h.checks_amount ?? 0) + Number(h.receipts_amount ?? 0) + Number(h.transfers_amount ?? 0);
      const { error } = await supabase
        .from('manager_handovers')
        .update({
          cash_invoice1: editCash1,
          cash_invoice2: editCash2,
          notes: editNotes || null,
          amount: newTotal,
          delivery_method: editDeliveryMethod !== 'direct' ? 'intermediary' : 'direct',
          intermediary_name: editDeliveryMethod !== 'direct' ? editIntermediaryName || null : null,
          received_by: null,
          receiver_name: editReceivedBy || null,
        })
        .eq('id', editHandover);
      if (error) throw error;
      toast.success(t('common.saved'));
      queryClient.invalidateQueries({ queryKey: ['manager-handovers'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
      setEditHandover(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEditSaving(false);
    }
  };

  const deleteHandover = async (id: string) => {
    try {
      await supabase.from('handover_items').delete().eq('handover_id', id);
      const { error } = await supabase.from('manager_handovers').delete().eq('id', id);
      if (error) throw error;
      toast.success(t('common.deleted'));
      queryClient.invalidateQueries({ queryKey: ['manager-handovers'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const syncOldSessions = async () => {
    setSyncing(true);
    try {
      // Get all completed sessions
      let sessQ = supabase.from('accounting_sessions').select('id, branch_id, manager_id').eq('status', 'completed');
      if (activeBranch?.id) sessQ = sessQ.eq('branch_id', activeBranch.id);
      const { data: sessions } = await sessQ;
      if (!sessions?.length) { toast.info(t('treasury.no_sessions_sync')); setSyncing(false); return; }

      // Get existing treasury entries linked to sessions
      const { data: existing } = await supabase.from('manager_treasury').select('session_id').eq('source_type', 'accounting_session');
      const existingSessionIds = new Set((existing || []).map((e: any) => e.session_id));

      const unsynced = sessions.filter(s => !existingSessionIds.has(s.id));
      if (!unsynced.length) { toast.info(t('treasury.all_synced')); setSyncing(false); return; }

      let totalInserted = 0;
      for (const sess of unsynced) {
        const { data: items } = await supabase.from('accounting_session_items').select('item_type, actual_amount').eq('session_id', sess.id);
        if (!items?.length) continue;

        const rows: any[] = [];
        for (const item of items) {
          const amt = Number(item.actual_amount || 0);
          if (amt <= 0) continue;
          let pm: string | null = null;
          if (item.item_type === 'invoice1_espace_cash' || item.item_type === 'invoice1_versement_cash' || item.item_type === 'invoice2_cash' || item.item_type === 'debt_collections_cash') pm = 'cash';
          else if (item.item_type === 'invoice1_check' || item.item_type === 'debt_collections_check') pm = 'check';
          else if (item.item_type === 'invoice1_receipt' || item.item_type === 'debt_collections_receipt') pm = 'bank_receipt';
          else if (item.item_type === 'invoice1_transfer' || item.item_type === 'debt_collections_transfer') pm = 'bank_transfer';
          if (!pm) continue;
          rows.push({ manager_id: sess.manager_id, branch_id: sess.branch_id, session_id: sess.id, source_type: 'accounting_session', payment_method: pm, amount: amt, notes: item.item_type });
        }
        if (rows.length > 0) {
          await supabase.from('manager_treasury').insert(rows);
          totalInserted += rows.length;
        }
      }

      toast.success(`${t('treasury.sync_success')} (${unsynced.length} / ${totalInserted})`);
      queryClient.invalidateQueries({ queryKey: ['manager-treasury'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
    } catch (err: any) {
      toast.error(t('treasury.sync_error') + ': ' + (err.message || ''));
    } finally {
      setSyncing(false);
    }
  };

  const handleAddEntry = async () => {
    if (!addForm.amount || Number(addForm.amount) <= 0) {
      toast.error(t('treasury.enter_valid_amount'));
      return;
    }
    try {
      await addEntry.mutateAsync({
        payment_method: addForm.payment_method.startsWith('cash') ? 'cash' : addForm.payment_method,
        amount: Number(addForm.amount),
        customer_name: addForm.customer_name || undefined,
        invoice_number: addForm.invoice_number || undefined,
        invoice_date: addForm.invoice_date || undefined,
        check_number: addForm.check_number || undefined,
        check_bank: addForm.check_bank || undefined,
        check_date: addForm.check_date || undefined,
        receipt_number: addForm.receipt_number || undefined,
        transfer_reference: addForm.transfer_reference || undefined,
        notes: addForm.notes || undefined,
      });
      toast.success(t('treasury.added_success'));
      setAddOpen(false);
      setAddForm({ payment_method: 'cash_invoice1', amount: '', customer_name: '', invoice_number: '', invoice_date: '', check_number: '', check_bank: '', check_date: '', receipt_number: '', transfer_reference: '', notes: '' });
    } catch {
      toast.error(t('treasury.error'));
    }
  };

  const handleGapTransfer = async (maxGap: number) => {
    const amount = Number(gapTransferAmount);
    if (!amount || amount <= 0 || amount > maxGap) {
      toast.error('أدخل مبلغ صحيح');
      return;
    }
    setGapTransferSaving(true);
    try {
      // Add positive entry to cash_invoice2
      const { error: insertError } = await supabase.from('manager_treasury').insert({
        manager_id: workerId!,
        branch_id: activeBranch?.id || null,
        source_type: 'gap_to_invoice2',
        payment_method: 'cash_invoice2',
        amount: amount,
        notes: `تحويل فرق محاسبي موجب → كاش فاتورة 2 | المبلغ: ${amount}`,
      } as any);
      if (insertError) throw insertError;
      toast.success('تم تحويل الفرق المحاسبي إلى كاش فاتورة 2');
      setGapTransferOpen(false);
      setGapTransferAmount('');
      queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
      queryClient.invalidateQueries({ queryKey: ['manager-treasury'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-remaining-counts'] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGapTransferSaving(false);
    }
  };

  const checksAmount = pickedChecks.reduce((s, i) => s + i.amount, 0);
  const pureCashInvoice1Amount = pickedCash.reduce((s, i) => s + i.amount, 0);
  const pickedCashStampAmount = pickedCash.reduce((s, i) => s + Number(i.stamp_amount || 0), 0);
  const pickedCashInvoice1WithStamp = pickedCash.reduce((s, i) => s + Number(i.total_with_stamp || i.amount || 0), 0);
  const receiptCashAmount = pickedReceiptCash.reduce((s, i) => s + i.amount, 0);
  const invoice1CashAmount = pureCashInvoice1Amount + receiptCashAmount;
  const invoice1CashAmountWithStamp = pickedCashInvoice1WithStamp + receiptCashAmount;
  const receiptsAmount = pickedReceipts.reduce((s, i) => s + i.amount, 0);
  const transfersAmount = pickedTransfers.reduce((s, i) => s + i.amount, 0);
  const deliveredCashAmount = Number(handoverForm.cash_delivered || 0);
  const availableInvoice2CashAmount = Math.max((summary?.cash_invoice2 || 0) - (summary?.cash_invoice2_handed || 0), 0);
  const availableDebtCashAmount = Math.max(summary?.debtCashCollected || 0, 0);
  const extraDeliveredCashAmount = Math.max(0, deliveredCashAmount - invoice1CashAmountWithStamp);
  const invoice2CashAmount = Math.min(availableInvoice2CashAmount, extraDeliveredCashAmount);
  const debtCashHandoverAmount = Math.max(0, extraDeliveredCashAmount - invoice2CashAmount);
  const remainingCashInvoice1Count = remainingCounts?.cash_invoice1?.operations ?? (((summary?.cash_invoice1 || 0) + (summary?.cash_invoice1_stamp || 0) - (summary?.cash_invoice1_handed || 0)) > 1 ? (summary?.cash_invoice1_count || 0) : 0);
  const remainingCashInvoice2Count = remainingCounts?.cash_invoice2?.operations ?? (((summary?.cash_invoice2 || 0) - (summary?.cash_invoice2_handed || 0)) > 1 ? (summary?.cash_invoice2_count || 0) : 0);
  const remainingChecksCount = remainingCounts?.check?.operations ?? (((summary?.check || 0) - (summary?.check_handed || 0)) > 1 ? (summary?.checkCount || 0) : 0);
  const remainingReceiptCashCount = remainingCounts?.receipt_cash?.operations ?? (((summary?.receipt_cash || 0) - (summary?.receipt_cash_handed || 0)) > 1 ? (summary?.receiptCashCount || 0) : 0);
  const remainingReceiptDocCount = remainingCounts?.receipt?.operations ?? (((summary?.bank_receipt || 0) - (summary?.receipt_handed || 0)) > 1 ? (summary?.receiptCount || 0) : 0);
  const remainingTransferCount = remainingCounts?.transfer?.operations ?? (((summary?.bank_transfer || 0) - (summary?.transfer_handed || 0)) > 1 ? (summary?.transferCount || 0) : 0);
  const buildBadgeText = (bucket: { clients: number; operations: number } | undefined, remainingAmount: number) =>
    bucket && bucket.operations > 0 && remainingAmount > 0 ? { operations: bucket.operations, clients: bucket.clients } : undefined;
  const cashInvoice1Badge = buildBadgeText(remainingCounts?.cash_invoice1, Math.max((summary?.cash_invoice1 || 0) + (summary?.cash_invoice1_stamp || 0) - (summary?.cash_invoice1_handed || 0), 0));
  const cashInvoice2Badge = buildBadgeText(remainingCounts?.cash_invoice2, Math.max((summary?.cash_invoice2 || 0) - (summary?.cash_invoice2_handed || 0), 0));
  const checksBadge = buildBadgeText(remainingCounts?.check, Math.max((summary?.check || 0) - (summary?.check_handed || 0), 0));
  const receiptCashBadge = buildBadgeText(remainingCounts?.receipt_cash, Math.max((summary?.receipt_cash || 0) - (summary?.receipt_cash_handed || 0), 0));
  const receiptDocBadge = buildBadgeText(remainingCounts?.receipt, Math.max((summary?.bank_receipt || 0) - (summary?.receipt_handed || 0), 0));
  const transferBadge = buildBadgeText(remainingCounts?.transfer, Math.max((summary?.bank_transfer || 0) - (summary?.transfer_handed || 0), 0));

  const handleHandover = async () => {
    const finalCash1 = invoice1CashAmountWithStamp;
    const finalCash2 = invoice2CashAmount;
    if (deliveredCashAmount < finalCash1) {
      toast.error('الكاش المسلم يجب أن يكون أكبر من أو يساوي كاش فاتورة 1');
      return;
    }
    const total = deliveredCashAmount + checksAmount + receiptsAmount + transfersAmount;
    if (total <= 0) {
      toast.error(t('treasury.enter_at_least_one'));
      return;
    }
    try {
      const { data: handover, error } = await supabase.from('manager_handovers').insert({
        manager_id: workerId!,
        branch_id: activeBranch?.id || null,
        payment_method: 'mixed',
        amount: total,
        cash_invoice1: finalCash1,
        cash_invoice2: finalCash2,
        debt_cash_amount: debtCashHandoverAmount,
        checks_amount: checksAmount,
        check_count: pickedChecks.length,
        receipts_amount: receiptsAmount,
        receipt_count: pickedReceipts.length,
        transfers_amount: transfersAmount,
        transfer_count: pickedTransfers.length,
        notes: handoverForm.notes || null,
        delivery_method: handoverForm.delivery_method !== 'direct' ? 'intermediary' : 'direct',
        intermediary_name: handoverForm.delivery_method !== 'direct' ? handoverForm.intermediary_name || null : null,
        bank_transfer_reference: null,
        bank_account_id: null,
        receipt_image_url: null,
        received_by: null,
        receiver_name: handoverForm.received_by || null,
        unified_cash: false,
      } as any).select('id').single();

      if (error) throw error;

      const allItems = [
        ...pickedCash.map(i => ({ handover_id: handover.id, order_id: i.order_id, payment_method: 'cash', amount: i.amount, customer_name: i.customer_name })),
        ...pickedReceiptCash.map(i => ({ handover_id: handover.id, order_id: i.order_id, payment_method: 'receipt_cash', amount: i.amount, customer_name: i.customer_name })),
        ...pickedChecks.map(i => ({ handover_id: handover.id, order_id: i.order_id, payment_method: 'check', amount: i.amount, customer_name: i.customer_name })),
        ...pickedReceipts.map(i => ({ handover_id: handover.id, order_id: i.order_id || null, treasury_entry_id: i.treasury_entry_id || null, payment_method: 'receipt', amount: i.amount, customer_name: i.customer_name })),
        ...pickedTransfers.map(i => ({ handover_id: handover.id, order_id: i.order_id, payment_method: 'transfer', amount: i.amount, customer_name: i.customer_name })),
      ];
      if (allItems.length > 0) {
        await supabase.from('handover_items').insert(allItems);
      }

      toast.success(t('treasury.handover_success'));
      setHandoverOpen(false);
      setHandoverForm({ cash_invoice1: '', cash_invoice2: '', cash_delivered: '', notes: '', delivery_method: 'direct', intermediary_name: '', bank_transfer_reference: '', received_by: '', bank_account_id: '', receipt_image_url: '' });
      setPickedCash([]);
      setPickedReceiptCash([]);
      setPickedChecks([]);
      setPickedReceipts([]);
      setPickedTransfers([]);
      queryClient.invalidateQueries({ queryKey: ['manager-handovers'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
      queryClient.invalidateQueries({ queryKey: ['handover-picker'] });
    } catch (err: any) {
      toast.error(t('treasury.error') + ': ' + (err.message || ''));
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24" dir={dir}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold">الخزينة</h1>
          {!isSettingsHidden && (
            <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => setSettingsOpen(true)} title="إعدادات" aria-label="إعدادات">
              <Settings className="w-4 h-4" />
            </Button>
          )}
          <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={syncOldSessions} disabled={syncing} title="مزامنة" aria-label="مزامنة">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="fixed bottom-16 left-0 right-0 z-40 px-3 pointer-events-none">
          <div className="mx-auto max-w-md flex items-center justify-center gap-1.5 rounded-full bg-background/95 backdrop-blur border shadow-lg p-1.5 pointer-events-auto" dir={dir}>
            <Button
              size="sm"
              variant="outline"
              className={`h-8 gap-1 rounded-full px-2.5 text-[11px] shrink-0 ${(handovers && handovers.length > 0) ? 'border-destructive text-destructive hover:bg-destructive/10' : 'bg-green-600 hover:bg-green-700 text-white border-green-600'}`}
              onClick={() => setHandoversListOpen(true)}
              title="سجل التسليمات"
              aria-label="سجل التسليمات"
            >
              <Send className="w-4 h-4" /><span>سجل التسليمات</span>
            </Button>
            <Button size="sm" className="h-8 gap-1 rounded-full px-2.5 text-[11px] bg-blue-600 hover:bg-blue-700 text-white border-blue-600" onClick={() => setConsolidationOpen(true)}>
              <Wallet className="w-4 h-4" /><span>تجميع الكاش</span>
            </Button>
            <Button size="sm" className="h-8 gap-1 rounded-full px-2.5 text-[11px] bg-black hover:bg-black/90 text-white border-black" onClick={() => setHandoverOpen(true)}>
              <Send className="w-4 h-4" /><span>تسليم</span>
            </Button>
          </div>
        </div>

        <div className="hidden">
          <Dialog open={handoverOpen} onOpenChange={setHandoverOpen}>
            <DialogContent dir={dir} className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t('treasury.handover_to_upper')}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">💵 {t('treasury.cash')}</p>
                    <Badge variant="outline" className="text-[10px]">حساب تلقائي</Badge>
                  </div>
                  <div>
                    <Label className="text-xs">الكاش المسلم</Label>
                    <Input dir="ltr" className="text-left [direction:ltr]" type="number" placeholder="0" value={handoverForm.cash_delivered} onChange={e => setHandoverForm(f => ({ ...f, cash_delivered: e.target.value }))} />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(() => {
                        const currentCash = Number(handoverForm.cash_delivered || 0);
                        const inv1Val = invoice1CashAmountWithStamp;
                        const inv2Val = availableInvoice2CashAmount;
                        const debtVal = availableDebtCashAmount;
                        const totalVal = inv1Val + inv2Val + debtVal;
                        const allocatedInv2 = Math.min(inv2Val, Math.max(0, currentCash - inv1Val));
                        const allocatedDebt = Math.max(0, currentCash - inv1Val - inv2Val);
                        
                        // Detect which invoices are currently "inserted"
                        const isInv1Inserted = inv1Val > 0 && currentCash >= inv1Val - 1;
                        const isInv2Inserted = allocatedInv2 > 0;
                        const isDebtInserted = debtVal > 0 && allocatedDebt >= debtVal - 1;
                        const isTotalInserted = Math.abs(currentCash - totalVal) < 1;

                        return (
                          <>
                            <Button
                              type="button" size="sm"
                              variant={isInv1Inserted ? "default" : "outline"}
                              className={`h-8 text-[11px] ${isInv1Inserted 
                                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
                                : 'border-green-400 text-green-700 hover:bg-green-50'}`}
                              onClick={() => {
                                if (isInv1Inserted && !isInv2Inserted) {
                                  setHandoverForm(f => ({ ...f, cash_delivered: '0' }));
                                } else if (isTotalInserted) {
                                  // Remove inv1, keep inv2 + debt collections
                                  setHandoverForm(f => ({ ...f, cash_delivered: String(inv2Val + debtVal) }));
                                } else {
                                  setHandoverForm(f => ({ ...f, cash_delivered: String(inv1Val) }));
                                }
                              }}
                            >
                              {isInv1Inserted ? 'إزالة فاتورة 1' : 'فاتورة 1'}
                            </Button>
                            <Button
                              type="button" size="sm"
                              variant={isInv2Inserted ? "default" : "outline"}
                              className={`h-8 text-[11px] ${isInv2Inserted 
                                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
                                : 'border-green-400 text-green-700 hover:bg-green-50'}`}
                              onClick={() => {
                                if (isInv2Inserted && !isInv1Inserted) {
                                  setHandoverForm(f => ({ ...f, cash_delivered: '0' }));
                                } else if (isTotalInserted) {
                                  // Remove inv2, keep inv1 + debt collections
                                  setHandoverForm(f => ({ ...f, cash_delivered: String(inv1Val + debtVal) }));
                                } else {
                                  const base = isInv1Inserted ? inv1Val : 0;
                                  setHandoverForm(f => ({ ...f, cash_delivered: String(base + inv2Val) }));
                                }
                              }}
                            >
                              {isInv2Inserted ? 'إزالة فاتورة 2' : 'فاتورة 2'}
                            </Button>
                            <Button
                              type="button" size="sm"
                              variant={isDebtInserted ? "default" : "outline"}
                              disabled={debtVal <= 0}
                              className={`h-8 text-[11px] ${isDebtInserted 
                                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
                                : 'border-amber-400 text-amber-700 hover:bg-amber-50'}`}
                              onClick={() => {
                                if (isDebtInserted) {
                                  // Remove debt portion, keep inv1 + inv2 part
                                  const base = (isInv1Inserted ? inv1Val : 0) + (isInv2Inserted ? allocatedInv2 : 0);
                                  setHandoverForm(f => ({ ...f, cash_delivered: String(base) }));
                                } else {
                                  const base = (isInv1Inserted ? inv1Val : 0) + (isInv2Inserted ? allocatedInv2 : 0);
                                  setHandoverForm(f => ({ ...f, cash_delivered: String(base + debtVal) }));
                                }
                              }}
                            >
                              {isDebtInserted ? 'إزالة تحصيلات الديون' : 'تحصيلات الديون'}
                            </Button>
                            <Button
                              type="button" size="sm"
                              variant={isTotalInserted ? "default" : "outline"}
                              className={`h-8 text-[11px] ${isTotalInserted 
                                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
                                : 'border-green-400 text-green-700 hover:bg-green-50'}`}
                              onClick={() => {
                                if (isTotalInserted) {
                                  setHandoverForm(f => ({ ...f, cash_delivered: '0' }));
                                } else {
                                  setHandoverForm(f => ({ ...f, cash_delivered: String(totalVal) }));
                                }
                              }}
                            >
                              {isTotalInserted ? 'إزالة المجموع' : 'المجموع'}
                            </Button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
	                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
	                      <p className="text-[11px] text-emerald-700">{t('treasury.cash_invoice1')} + Versement Cash</p>
	                      <MoneyValue value={invoice1CashAmountWithStamp} currency={cur} className="mt-1 text-lg font-bold text-emerald-600" />
	                      {pickedCashStampAmount > 0 && (
	                        <p className="mt-1 text-[11px] text-amber-700">الطابع ضمن Espèces: <MoneyValue value={pickedCashStampAmount} currency={cur} /></p>
	                      )}
	                    </div>
	                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
	                      <p className="text-[11px] text-sky-700">{t('treasury.cash_invoice2')}</p>
	                      <MoneyValue value={availableInvoice2CashAmount} currency={cur} className="mt-1 text-lg font-bold text-sky-600" />
	                      {invoice2CashAmount > 0 && (
	                        <p className="mt-1 text-[11px] text-sky-700">المرسل من فاتورة 2: <MoneyValue value={invoice2CashAmount} currency={cur} /></p>
	                      )}
	                    </div>
	                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
	                      <p className="text-[11px] text-amber-700">تحصيلات الديون النقدية</p>
	                      <MoneyValue value={availableDebtCashAmount} currency={cur} className="mt-1 text-lg font-bold text-amber-600" />
	                      {debtCashHandoverAmount > 0 && (
	                        <p className="mt-1 text-[11px] text-amber-700">المرسل من تحصيلات الديون: <MoneyValue value={debtCashHandoverAmount} currency={cur} /></p>
	                      )}
	                    </div>
                  </div>
                  {deliveredCashAmount > 0 && deliveredCashAmount < invoice1CashAmountWithStamp && (
                    <p className="text-xs font-medium text-destructive">الكاش المسلم أقل من كاش فاتورة 1 المحدد.</p>
                  )}
                </div>
                  <PickerSection label="Espèces" items={pickedCash} onOpen={() => setPickerType('cash')} onRemove={(id) => setPickedCash(p => p.filter(i => (i.item_id || i.order_id) !== id))} currency={cur} />
                <div className="rounded-xl border border-blue-200/70 bg-blue-50/40 p-3">
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-blue-900">المستندات</p>
                    <p className="text-[11px] text-blue-700">الشيكات والتحويلات والمستندات البنكية المسلّمة</p>
                  </div>
                  <PickerSection label={t('treasury.checks')} items={pickedChecks} onOpen={() => setPickerType('check')} onRemove={(id) => setPickedChecks(p => p.filter(i => (i.item_id || i.order_id) !== id))} currency={cur} />
                <div className="rounded-xl border border-purple-200/70 bg-purple-50/50 p-3">
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-purple-900">Versement Doc</p>
                    <p className="text-[11px] text-purple-700">العمليات التي قدّم فيها العميل وصل Versement فعليًا</p>
                  </div>
                  <PickerSection label="Versement Doc" items={pickedReceipts} onOpen={() => setPickerType('receipt')} onRemove={(id) => setPickedReceipts(p => p.filter(i => (i.item_id || i.order_id) !== id))} currency={cur} />
                </div>
                  <PickerSection label={t('treasury.virement')} items={pickedTransfers} onOpen={() => setPickerType('transfer')} onRemove={(id) => setPickedTransfers(p => p.filter(i => (i.item_id || i.order_id) !== id))} currency={cur} />
                </div>
                
                <div className="rounded-xl border border-fuchsia-200/70 bg-fuchsia-50/50 p-3">
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-fuchsia-900">Versement Cash</p>
                    <p className="text-[11px] text-fuchsia-700">العمليات التي دفعها العميل نقدًا رغم أن طريقة الدفع Versement</p>
                  </div>
                  <PickerSection label="Versement Cash" items={pickedReceiptCash} onOpen={() => setPickerType('receipt_cash')} onRemove={(id) => setPickedReceiptCash(p => p.filter(i => (i.item_id || i.order_id) !== id))} currency={cur} />
                </div>
                {(() => {
                  const cashTotal = deliveredCashAmount;
                  const grandTotal = cashTotal + checksAmount + receiptsAmount + transfersAmount;
                  return grandTotal > 0 ? (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t('treasury.total_handover')}</span>
                      <span className="text-sm font-bold text-primary">
                        <MoneyValue value={grandTotal} currency={cur} />
                      </span>
                    </div>
                  </div>
                  ) : null;
                })()}

                {/* Delivery Method Toggle */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm">🚚 {t('treasury.delivery_method') || 'طريقة التسليم'}</Label>
                  <Switch checked={handoverForm.delivery_method !== 'direct'} onCheckedChange={(checked) => setHandoverForm(f => ({ ...f, delivery_method: checked ? 'intermediary' : 'direct', intermediary_name: '', received_by: '' }))} />
                </div>

                {handoverForm.delivery_method !== 'direct' && (
                  <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">{t('treasury.via_intermediary') || 'الوسيط'}</Label>
                        <Select value={handoverForm.intermediary_name} onValueChange={v => setHandoverForm(f => ({ ...f, intermediary_name: v }))}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={t('treasury.select_intermediary') || 'اختر الوسيط'} />
                          </SelectTrigger>
                          <SelectContent>
                            {(contacts || []).filter((c: any) => c.contact_type === 'intermediary').map((c: any) => (
                              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">{t('treasury.receiver') || 'المستلم'}</Label>
                        <Select value={handoverForm.received_by} onValueChange={v => setHandoverForm(f => ({ ...f, received_by: v }))}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={t('treasury.select_receiver') || 'اختر المستلم'} />
                          </SelectTrigger>
                          <SelectContent>
                            {(contacts || []).filter((c: any) => c.contact_type === 'receiver').map((c: any) => (
                              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {(handoverForm.intermediary_name || handoverForm.received_by) && (
                      <p className="text-xs text-muted-foreground text-center border-t pt-2 mt-1">
                        🏢 {t('treasury.branch_manager') || 'مدير الفرع'}
                        {handoverForm.intermediary_name && <> ← 🤝 <span className="font-medium">{handoverForm.intermediary_name}</span></>}
                        {handoverForm.received_by && <> ← 📥 <span className="font-medium">{handoverForm.received_by}</span></>}
                      </p>
                    )}
                  </div>
                )}

                <div><Label>{t('treasury.notes')}</Label><Textarea value={handoverForm.notes} onChange={e => setHandoverForm(f => ({ ...f, notes: e.target.value }))} /></div>
                <Button onClick={handleHandover} disabled={createHandover.isPending} className="w-full">{t('treasury.register_handover')}</Button>
              </div>
            </DialogContent>
          </Dialog>

          {pickerType && (
            <HandoverItemPickerDialog
              open={!!pickerType}
              onOpenChange={(open) => !open && setPickerType(null)}
              paymentMethod={pickerType}
              onConfirm={(items) => {
                if (pickerType === 'cash') setPickedCash(prev => [...prev, ...items]);
                else if (pickerType === 'receipt_cash') setPickedReceiptCash(prev => [...prev, ...items]);
                else if (pickerType === 'check') setPickedChecks(prev => [...prev, ...items]);
                else if (pickerType === 'receipt') setPickedReceipts(prev => [...prev, ...items]);
                else if (pickerType === 'transfer') setPickedTransfers(prev => [...prev, ...items]);
              }}
            />
          )}
        </div>
      </div>

      {/* Total Remaining Treasury */}
      {(() => {
        const cashAvailableBeforeHandover =
          (summary?.cash_invoice1 || 0) +
          (summary?.receipt_cash || 0) + (summary?.cash_invoice2 || 0) +
          (summary?.debtCashCollected || 0) - (summary?.coinExchangeOut || 0)
          - (summary?.totalExpenses || 0);
        const nonCash = (summary?.check || 0) + (summary?.bank_receipt || 0) + (summary?.bank_transfer || 0);
        const nonCashHanded = (summary?.check_handed || 0) + (summary?.receipt_handed || 0) + (summary?.transfer_handed || 0);
        // Note: summary.debtCashCollected is already NET (gross - debt_cash_amount handed),
        // so we MUST NOT subtract handover.debt_cash_amount again here — that would double-count.
        const cashHanded =
          (summary?.cash_invoice1_handed || 0) +
          (summary?.receipt_cash_handed || 0) +
          (summary?.cash_invoice2_handed || 0);
        const physicalRemaining = cashAvailableBeforeHandover - cashHanded;
        const nonCashPending = nonCash - nonCashHanded;
        const overallRemaining = physicalRemaining + nonCashPending;
        return (
          <>
            <Card className="border-2 border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setCashBalanceOpen(true)}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Wallet className="w-6 h-6 text-primary" />
                  <span className="text-sm font-bold text-primary">رصيد الكاش</span>
                </div>
                <MoneyValue value={physicalRemaining} currency={cur} className="text-2xl font-extrabold text-primary" />
              </CardContent>
            </Card>
            <Dialog open={cashBalanceOpen} onOpenChange={setCashBalanceOpen}>
              <DialogContent dir={dir} className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>⚖️ الميزانية</DialogTitle>
                </DialogHeader>
                {(() => {
                  const totalSales = summary?.totalSales || 0;
                  const unpaidAmount = summary?.uncollectedDebts || 0;
                  const debtCashCollected = summary?.debtCashCollected || 0;
                  const totalInTreasury = summary?.total || 0;
                  const handedOver = summary?.handedOver || 0;
                  const totalExpenses = summary?.totalExpenses || 0;
                  const workerHeldAmount = summary?.workerHeldAmount || 0;
                  const coinExchangeOut = summary?.coinExchangeOut || 0;
                  const expectedInTreasury = totalSales - unpaidAmount + debtCashCollected;
                  const netInTreasury = Math.max(0, totalInTreasury - handedOver - totalExpenses);
                  return (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between rounded-lg bg-background p-3 border">
                          <span className="text-xs text-muted-foreground">{t('treasury.total_sales')}</span>
                          <MoneyValue value={totalSales} currency={cur} className="text-sm font-bold" />
                        </div>
                        <button type="button" onClick={() => { setCashBalanceOpen(false); setTimeout(() => setUncollectedDebtsOpen(true), 200); }} className="w-full text-start flex items-center justify-between rounded-lg bg-background p-3 border hover:bg-muted transition-colors">
                          <span className="text-xs text-muted-foreground">{t('treasury.unpaid')}</span>
                          <SignedMoneyValue value={-unpaidAmount} currency={cur} className="text-sm font-bold text-orange-500" />
                        </button>
                        <button type="button" onClick={() => { setCashBalanceOpen(false); setTimeout(() => setCollectedDebtsOpen(true), 200); }} className="w-full text-start flex items-center justify-between rounded-lg bg-background p-3 border hover:bg-muted transition-colors">
                          <span className="text-xs text-muted-foreground">{t('treasury.debt_cash_collected')}</span>
                          <SignedMoneyValue value={debtCashCollected} currency={cur} className="text-sm font-bold text-green-500" />
                        </button>
                        <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 p-3">
                          <span className="text-xs font-medium">{t('treasury.expected_in_treasury')}</span>
                          <MoneyValue value={expectedInTreasury} currency={cur} className="text-sm font-bold text-primary" />
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center">📤 {t('treasury.where_money_went')}</p>
                      <div className="space-y-1.5">
                        <button type="button" onClick={() => { setCashBalanceOpen(false); setTimeout(() => setHandoversListOpen(true), 200); }} className="w-full text-start flex items-center justify-between rounded-lg bg-background p-3 border hover:bg-muted transition-colors">
                          <span className="text-xs text-muted-foreground">المستلم من العمال نقداً (بدون تحصيلات الديون)</span>
                          <MoneyValue value={Math.max(totalInTreasury - debtCashCollected - handedOver, 0)} currency={cur} className="text-sm font-bold" />
                        </button>
                        <div className="flex items-center justify-between rounded-lg bg-background p-3 border">
                          <span className="text-xs text-muted-foreground">{t('treasury.actual_after_handover')}</span>
                          <MoneyValue value={netInTreasury} currency={cur} className="text-sm font-bold" />
                        </div>

                        <div className="flex items-center justify-between rounded-lg bg-background p-3 border">
                          <span className="text-xs text-muted-foreground">{t('treasury.approved_expenses')}</span>
                          <MoneyValue value={totalExpenses} currency={cur} className="text-sm font-bold" />
                        </div>
                        <button type="button" onClick={() => { setCashBalanceOpen(false); setTimeout(() => setWorkerHeldOpen(true), 200); }} className="w-full text-start flex items-center justify-between rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 hover:bg-amber-500/10 transition-colors">
                          <span className="text-xs text-muted-foreground">👷 {t('treasury.worker_held')}</span>
                          <MoneyValue value={workerHeldAmount} currency={cur} className="text-sm font-bold text-amber-600" />
                        </button>
                        <button type="button" onClick={() => { setCashBalanceOpen(false); setTimeout(() => setCoinExchangeOpen(true), 200); }} className="w-full text-start flex items-center justify-between rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 hover:bg-amber-500/10 transition-colors">
                          <span className="text-xs text-muted-foreground">🪙 {t('coin_exchange.title') || 'تحويل عملات'}</span>
                          <MoneyValue value={coinExchangeOut} currency={cur} className="text-sm font-bold text-amber-600" />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </DialogContent>
            </Dialog>
          </>
        );
      })()}



      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <TreasuryCard
          icon={<Banknote className="w-5 h-5 text-green-500" />}
          label={t('treasury.cash_invoice1')}
          total={(summary?.cash_invoice1 || 0) + (summary?.cash_invoice1_stamp || 0)}
          handed={(summary?.cash_invoice1_handed || 0) + (summary?.cash_invoice1_stamp || 0)}
          colorClass="green-500"
          borderClass="border-green-500/30 bg-green-500/5"
          onClick={() => setDetailsCategory('cash_invoice1')}
          currency={cur}
          showDetails={showCardDetails}
          badgeText={cashInvoice1Badge}
        />
        <TreasuryCard
          icon={<Banknote className="w-5 h-5 text-emerald-500" />}
          label={t('treasury.cash_invoice2')}
          total={summary?.cash_invoice2 || 0}
          handed={summary?.cash_invoice2_handed || 0}
          colorClass="emerald-500"
          borderClass="border-emerald-500/30 bg-emerald-500/5"
          onClick={() => setDetailsCategory('cash_invoice2')}
          currency={cur}
          showDetails={showCardDetails}
          badgeText={cashInvoice2Badge}
        />
        <TreasuryCard
          icon={<CreditCard className="w-5 h-5 text-blue-500" />}
          label={t('treasury.checks')}
          total={summary?.check || 0}
          handed={summary?.check_handed || 0}
          colorClass="blue-500"
          borderClass="border-blue-500/30 bg-blue-500/5"
          onClick={() => setDetailsCategory('check')}
          currency={cur}
          showDetails={showCardDetails}
          badgeText={checksBadge}
        />
        <TreasuryCard
          icon={<Receipt className="w-5 h-5 text-purple-500" />}
          label="Versement Cash"
          total={summary?.receipt_cash || 0}
          handed={summary?.receipt_cash_handed || 0}
          colorClass="fuchsia-500"
          borderClass="border-fuchsia-500/30 bg-fuchsia-500/5"
          onClick={() => setDetailsCategory('bank_receipt_cash')}
          currency={cur}
          showDetails={showCardDetails}
          badgeText={receiptCashBadge}
        />
        <TreasuryCard
          icon={<Receipt className="w-5 h-5 text-purple-500" />}
          label="Versement Doc"
          total={summary?.bank_receipt || 0}
          handed={summary?.receipt_handed || 0}
          colorClass="purple-500"
          borderClass="border-purple-500/30 bg-purple-500/5"
          onClick={() => setDetailsCategory('bank_receipt')}
          currency={cur}
          showDetails={showCardDetails}
          badgeText={receiptDocBadge}
        />
        <TreasuryCard
          icon={<ArrowUpRight className="w-5 h-5 text-orange-500" />}
          label={t('treasury.virement')}
          total={summary?.bank_transfer || 0}
          handed={summary?.transfer_handed || 0}
          colorClass="orange-500"
          borderClass="border-orange-500/30 bg-orange-500/5"
          onClick={() => setDetailsCategory('bank_transfer')}
          currency={cur}
          showDetails={showCardDetails}
          badgeText={transferBadge}
        />
        <TreasuryCard
          icon={<Coins className="w-5 h-5 text-rose-500" />}
          label="تحصيلات الديون"
          total={summary?.debtCashCollected || 0}
          handed={0}
          colorClass="rose-500"
          borderClass="border-rose-500/30 bg-rose-500/5"
          onClick={() => setCollectedDebtsOpen(true)}
          currency={cur}
          showDetails={false}
        />
        <TreasuryCard
          icon={<Wallet className="w-5 h-5 text-amber-600" />}
          label="المصاريف"
          total={summary?.totalExpenses || 0}
          handed={0}
          colorClass="amber-600"
          borderClass="border-amber-500/30 bg-amber-500/5"
          onClick={() => setExpensesOpen(true)}
          currency={cur}
          showDetails={false}
        />
      </div>


      {detailsCategory && (
        <PaymentMethodDetailsDialog
          open={!!detailsCategory}
          onOpenChange={(open) => !open && setDetailsCategory(null)}
          category={detailsCategory}
          handedCashInvoice2Amount={summary?.cash_invoice2_handed || 0}
          range={dateRange}
        />
      )}

      <StampDetailsDialog open={stampOpen} onOpenChange={setStampOpen} />
      <UncollectedDebtsDialog open={uncollectedDebtsOpen} onOpenChange={setUncollectedDebtsOpen} />
      <CollectedDebtsDialog open={collectedDebtsOpen} onOpenChange={setCollectedDebtsOpen} range={dateRange} />
      <ExpensesDetailsDialog open={expensesOpen} onOpenChange={setExpensesOpen} range={dateRange} currency={cur} />
      <WorkerHeldDialog open={workerHeldOpen} onOpenChange={setWorkerHeldOpen} range={dateRange} currency={cur} />
      <CashConsolidationDialog open={consolidationOpen} onOpenChange={setConsolidationOpen} summary={summary} />

      <Dialog open={handoversListOpen} onOpenChange={setHandoversListOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>📤 تسليمات العمال للمسؤول</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {(!handovers || handovers.length === 0) ? (
              <p className="text-center text-muted-foreground py-8">{t('treasury.no_handovers')}</p>
            ) : handovers.map(h => (
              <Card key={h.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Send className="w-4 h-4 text-destructive" />
                      <div>
                        <p className="font-bold text-sm">{(h as any).manager?.full_name || '—'}</p>
                        <p className="font-bold">{Number(h.amount).toLocaleString()} {cur}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{format(new Date(h.created_at), 'dd/MM/yyyy', { locale: dateLocale })}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {Number(h.cash_invoice1 ?? 0) > 0 && <p>{t('treasury.cash_f1')}: {Number(h.cash_invoice1).toLocaleString()} {cur}</p>}
                    {Number(h.cash_invoice2 ?? 0) > 0 && <p>{t('treasury.cash_f2')}: {Number(h.cash_invoice2).toLocaleString()} {cur}</p>}
                    {Number(h.checks_amount ?? 0) > 0 && <p>{t('treasury.checks')}: {Number(h.checks_amount).toLocaleString()} {cur}</p>}
                    {Number(h.receipts_amount ?? 0) > 0 && <p>{t('treasury.versement')}: {Number(h.receipts_amount).toLocaleString()} {cur}</p>}
                    {Number(h.transfers_amount ?? 0) > 0 && <p>{t('treasury.virement')}: {Number(h.transfers_amount).toLocaleString()} {cur}</p>}
                  </div>
                  {h.notes && <p className="text-xs text-muted-foreground">{h.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* All treasury sections on one page */}
      <div className="px-3 md:px-4 pb-6 space-y-6" dir={dir}>

              {/* Sales & Debts Summary */}






              <Dialog open={handoversListOpen} onOpenChange={setHandoversListOpen}>
                <DialogContent dir={dir} className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>📤 التسليمات</DialogTitle></DialogHeader>
                  <div className="space-y-2">
                    {(!handovers || handovers.length === 0) ? (
                      <p className="text-center text-muted-foreground py-8">{t('treasury.no_handovers')}</p>
                    ) : handovers.map(h => (
                      <Card key={h.id}>
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Send className="w-4 h-4 text-destructive" />
                              <p className="font-bold">{Number(h.amount).toLocaleString()} {cur}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setTimeout(() => setViewHandover(h.id), 200); }}><Eye className="w-3.5 h-3.5" /></Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setTimeout(() => openEditHandover(h), 200); }}><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setTimeout(() => setPrintHandover(h.id), 200); }}><Printer className="w-3.5 h-3.5" /></Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (confirm(t('common.confirm_delete'))) deleteHandover(h.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                              <p className="text-xs text-muted-foreground">{format(new Date(h.created_at), 'dd/MM/yyyy', { locale: dateLocale })}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {Number(h.cash_invoice1 ?? 0) > 0 && <p>{t('treasury.cash_f1')}: {Number(h.cash_invoice1).toLocaleString()} {cur}</p>}
                            {Number(h.cash_invoice2 ?? 0) > 0 && <p>{t('treasury.cash_f2')}: {Number(h.cash_invoice2).toLocaleString()} {cur}</p>}
                            {Number(h.checks_amount ?? 0) > 0 && <p>{t('treasury.checks')}: {Number(h.checks_amount).toLocaleString()} {cur}</p>}
                            {Number(h.receipts_amount ?? 0) > 0 && <p>{t('treasury.versement')}: {Number(h.receipts_amount).toLocaleString()} {cur}</p>}
                            {Number(h.transfers_amount ?? 0) > 0 && <p>{t('treasury.virement')}: {Number(h.transfers_amount).toLocaleString()} {cur}</p>}
                          </div>
                          {h.notes && <p className="text-xs text-muted-foreground">{h.notes}</p>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>


      </div>


      {/* Print Handover Dialog */}
      {printHandover && (() => {
        const h = handovers?.find(ho => ho.id === printHandover);
        if (!h) return null;
        return (
          <Dialog open={!!printHandover} onOpenChange={(open) => !open && setPrintHandover(null)}>
            <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="ltr">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>طباعة التسليم</span>
                  <Button size="sm" onClick={() => {
                    const printContent = printRef.current;
                    if (!printContent) return;
                    const w = window.open('', '_blank');
                    if (!w) return;
                    w.document.write(`<html><head><title>Bordereau</title><style>
                      @page { size: A4 portrait; margin: 15mm; }
                      body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 20px; direction: ltr; }
                      table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                      th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; }
                      th { background: #f0f0f0; }
                      .text-right { text-align: right; }
                      .text-center { text-align: center; }
                      .font-bold { font-weight: bold; }
                      .underline { text-decoration: underline; }
                      h1, h2, h3 { margin: 4px 0; }
                      .border-2 { border: 2px solid #000; padding: 12px; margin-bottom: 16px; }
                      .mb-4 { margin-bottom: 16px; }
                      .mt-6 { margin-top: 24px; }
                      .mt-10 { margin-top: 40px; }
                      .mb-1 { margin-bottom: 4px; }
                      .mb-2 { margin-bottom: 8px; }
                      .p-3 { padding: 12px; }
                      .text-sm { font-size: 12px; }
                      .text-base { font-size: 14px; }
                      .text-lg { font-size: 16px; }
                      .text-xs { font-size: 11px; }
                      @media print { body { margin: 0; padding: 15px; } }
                    </style></head><body>${printContent.innerHTML}</body></html>`);
                    w.document.close();
                    w.print();
                  }}>
                    <Printer className="w-4 h-4 mx-1" /> طباعة
                  </Button>
                  <Button size="sm" variant="outline" onClick={async () => {
                    if (!printRef.current) return;
                    try {
                      await generatePDF(printRef.current, `bordereau_${h.handover_date}.pdf`);
                      toast.success('تم حفظ الملف بنجاح');
                    } catch { toast.error('فشل في حفظ الملف'); }
                  }}>
                    <Download className="w-4 h-4 mx-1" /> PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={async () => {
                    if (!printRef.current) return;
                    try {
                      await generateImage(printRef.current, `bordereau_${h.handover_date}.png`);
                      toast.success('تم حفظ الصورة بنجاح');
                    } catch { toast.error('فشل في حفظ الصورة'); }
                  }}>
                    <Image className="w-4 h-4 mx-1" /> صورة
                  </Button>
                </DialogTitle>
              </DialogHeader>
              <div ref={printRef}>
                <HandoverPrintView
                  handoverId={h.id}
                  handoverDate={h.handover_date}
                  cashInvoice1={Number(h.cash_invoice1)}
                  cashInvoice2={Number(h.cash_invoice2)}
                  checksAmount={Number(h.checks_amount)}
                  receiptsAmount={Number(h.receipts_amount)}
                  transfersAmount={Number(h.transfers_amount)}
                  totalAmount={Number(h.amount)}
                  branchName={activeBranch?.name}
                  branchWilaya={activeBranch?.wilaya}
                  deliveryMethod={(h as any).delivery_method}
                  intermediaryName={(h as any).intermediary_name}
                  bankTransferReference={(h as any).bank_transfer_reference}
                  receivedBy={(h as any).receiver_name || (h as any).received_by}
                  unifiedCash={(h as any).unified_cash ?? true}
                />
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* View Handover Dialog */}
      {viewHandover && (() => {
        const h = handovers?.find(ho => ho.id === viewHandover);
        if (!h) return null;
        return (
          <Dialog open={!!viewHandover} onOpenChange={(open) => !open && setViewHandover(null)}>
            <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="ltr">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{t('treasury.handover_details')}</span>
                  <Button size="sm" variant="outline" onClick={() => {
                    const printContent = viewRef.current;
                    if (!printContent) return;
                    const w = window.open('', '_blank');
                    if (!w) return;
                    w.document.write(`<html><head><style>body{font-family:sans-serif;direction:ltr;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:4px 8px;text-align:left}@media print{body{padding:0}}</style></head><body>${printContent.innerHTML}</body></html>`);
                    w.document.close();
                    w.print();
                  }}>
                    <Printer className="w-4 h-4 mx-1" /> طباعة
                  </Button>
                  <Button size="sm" variant="outline" onClick={async () => {
                    if (!viewRef.current) return;
                    try {
                      await generatePDF(viewRef.current, `bordereau_${h.handover_date}.pdf`);
                      toast.success('تم حفظ الملف بنجاح');
                    } catch { toast.error('فشل في حفظ الملف'); }
                  }}>
                    <Download className="w-4 h-4 mx-1" /> PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={async () => {
                    if (!viewRef.current) return;
                    try {
                      await generateImage(viewRef.current, `bordereau_${h.handover_date}.png`);
                      toast.success('تم حفظ الصورة بنجاح');
                    } catch { toast.error('فشل في حفظ الصورة'); }
                  }}>
                    <Image className="w-4 h-4 mx-1" /> صورة
                  </Button>
                </DialogTitle>
              </DialogHeader>
              <div ref={viewRef}>
                <HandoverPrintView
                  handoverId={h.id}
                  handoverDate={h.handover_date}
                  cashInvoice1={Number(h.cash_invoice1)}
                  cashInvoice2={Number(h.cash_invoice2)}
                  checksAmount={Number(h.checks_amount)}
                  receiptsAmount={Number(h.receipts_amount)}
                  transfersAmount={Number(h.transfers_amount)}
                  totalAmount={Number(h.amount)}
                  branchName={activeBranch?.name}
                  branchWilaya={activeBranch?.wilaya}
                  deliveryMethod={(h as any).delivery_method}
                  intermediaryName={(h as any).intermediary_name}
                  bankTransferReference={(h as any).bank_transfer_reference}
                  receivedBy={(h as any).receiver_name || (h as any).received_by}
                  unifiedCash={(h as any).unified_cash ?? true}
                />
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Edit Handover Dialog */}
      {editHandover && (() => {
        const h = handovers?.find(ho => ho.id === editHandover);
        if (!h) return null;
        const editChecksTotal = editItems.checks.reduce((s, i) => s + i.amount, 0);
        const editReceiptsTotal = editItems.receipts.reduce((s, i) => s + i.amount, 0);
        const editTransfersTotal = editItems.transfers.reduce((s, i) => s + i.amount, 0);
        const editGrandTotal = editCash1 + editCash2 + editChecksTotal + editReceiptsTotal + editTransfersTotal;
        return (
          <Dialog open={!!editHandover} onOpenChange={(open) => !open && setEditHandover(null)}>
            <DialogContent dir={dir} className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('treasury.edit_handover')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Cash section - styled like create dialog */}
                <div className="p-3 rounded-lg bg-muted/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">💵 {t('treasury.cash')}</p>
                    <Badge variant="outline" className="text-[10px]">حساب تلقائي</Badge>
                  </div>
                  <div>
                    <Label className="text-xs">الكاش المسلم</Label>
                    <Input
                      dir="ltr"
                      className="text-left [direction:ltr]"
                      type="number"
                      placeholder="0"
                      value={editCash1 + editCash2}
                      onChange={(e) => {
                        const total = Math.max(0, Number(e.target.value) || 0);
                        const maxInv1 = Number(h.cash_invoice1 ?? 0);
                        const newInv1 = Math.min(total, maxInv1);
                        setEditCash1(newInv1);
                        setEditCash2(Math.max(0, total - newInv1));
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-[11px] text-emerald-700">{t('treasury.cash_invoice1')} + Versement Cash</p>
                      <MoneyValue value={editCash1} currency={cur} className="mt-1 text-lg font-bold text-emerald-600" />
                    </div>
                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                      <p className="text-[11px] text-sky-700">{t('treasury.cash_invoice2')}</p>
                      <MoneyValue value={editCash2} currency={cur} className="mt-1 text-lg font-bold text-sky-600" />
                    </div>
                  </div>
                </div>

                {/* Checks - read only */}
                {editItems.checks.length > 0 && (
                  <div className="rounded-xl border border-blue-200/70 bg-blue-50/40 p-3 space-y-2">
                    <div>
                      <p className="text-sm font-semibold text-blue-900">📝 {t('treasury.checks')} ({editItems.checks.length})</p>
                      <p className="text-[11px] text-blue-700">الشيكات المسلّمة</p>
                    </div>
                    {editItems.checks.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-background rounded-md px-2 py-1.5 border">
                        <span className="truncate flex-1">{item.customer_name}</span>
                        <MoneyValue value={item.amount} currency={cur} className="font-bold" />
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs pt-1 border-t">
                      <span className="text-muted-foreground">{t('common.total')}</span>
                      <MoneyValue value={editChecksTotal} currency={cur} className="font-bold" />
                    </div>
                  </div>
                )}

                {/* Receipts (Versement Doc) - read only */}
                {editItems.receipts.length > 0 && (
                  <div className="rounded-xl border border-purple-200/70 bg-purple-50/50 p-3 space-y-2">
                    <div>
                      <p className="text-sm font-semibold text-purple-900">🧾 Versement Doc ({editItems.receipts.length})</p>
                      <p className="text-[11px] text-purple-700">العمليات التي قدّم فيها العميل وصل Versement فعليًا</p>
                    </div>
                    {editItems.receipts.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-background rounded-md px-2 py-1.5 border">
                        <span className="truncate flex-1">{item.customer_name}</span>
                        <MoneyValue value={item.amount} currency={cur} className="font-bold" />
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs pt-1 border-t">
                      <span className="text-muted-foreground">{t('common.total')}</span>
                      <MoneyValue value={editReceiptsTotal} currency={cur} className="font-bold" />
                    </div>
                  </div>
                )}

                {/* Transfers - read only */}
                {editItems.transfers.length > 0 && (
                  <div className="rounded-xl border border-fuchsia-200/70 bg-fuchsia-50/50 p-3 space-y-2">
                    <div>
                      <p className="text-sm font-semibold text-fuchsia-900">🏦 {t('treasury.virement')} ({editItems.transfers.length})</p>
                      <p className="text-[11px] text-fuchsia-700">التحويلات البنكية المسلّمة</p>
                    </div>
                    {editItems.transfers.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-background rounded-md px-2 py-1.5 border">
                        <span className="truncate flex-1">{item.customer_name}</span>
                        <MoneyValue value={item.amount} currency={cur} className="font-bold" />
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs pt-1 border-t">
                      <span className="text-muted-foreground">{t('common.total')}</span>
                      <MoneyValue value={editTransfersTotal} currency={cur} className="font-bold" />
                    </div>
                  </div>
                )}

                {/* Total */}
                {editGrandTotal > 0 && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t('treasury.total_handover')}</span>
                      <span className="text-sm font-bold text-primary">
                        <MoneyValue value={editGrandTotal} currency={cur} />
                      </span>
                    </div>
                  </div>
                )}

                {/* Delivery Method */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm">🚚 {t('treasury.delivery_method') || 'طريقة التسليم'}</Label>
                  <Switch checked={editDeliveryMethod !== 'direct'} onCheckedChange={(checked) => { setEditDeliveryMethod(checked ? 'intermediary' : 'direct'); if (!checked) { setEditIntermediaryName(''); } }} />
                </div>
                {editDeliveryMethod !== 'direct' && (
                  <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">{t('treasury.via_intermediary') || 'الوسيط'}</Label>
                        <Select value={editIntermediaryName} onValueChange={v => setEditIntermediaryName(v)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={t('treasury.select_intermediary') || 'اختر الوسيط'} />
                          </SelectTrigger>
                          <SelectContent>
                            {(contacts || []).filter((c: any) => c.contact_type === 'intermediary').map((c: any) => (
                              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">{t('treasury.receiver') || 'المستلم'}</Label>
                        <Select value={editReceivedBy} onValueChange={v => setEditReceivedBy(v)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={t('treasury.select_receiver') || 'اختر المستلم'} />
                          </SelectTrigger>
                          <SelectContent>
                            {(contacts || []).filter((c: any) => c.contact_type === 'receiver').map((c: any) => (
                              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {(editIntermediaryName || editReceivedBy) && (
                      <p className="text-xs text-muted-foreground text-center border-t pt-2 mt-1">
                        🏢 {t('treasury.branch_manager') || 'مدير الفرع'}
                        {editIntermediaryName && <> ← 🤝 <span className="font-medium">{editIntermediaryName}</span></>}
                        {editReceivedBy && <> ← 📥 <span className="font-medium">{editReceivedBy}</span></>}
                      </p>
                    )}
                  </div>
                )}

                <div><Label>{t('treasury.notes')}</Label><Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} /></div>
                <Button className="w-full" onClick={saveEditHandover} disabled={editSaving}>
                  {editSaving ? t('common.saving') : t('common.save')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
      <TreasurySettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <CoinExchangeDialog open={coinExchangeOpen} onOpenChange={setCoinExchangeOpen} />
      <InvoiceRequestDialog open={invoiceRequestOpen} onOpenChange={setInvoiceRequestOpen} />
    </div>
  );
};

// Helper component for picker sections in handover dialog
const PickerSection = ({ label, items, onOpen, onRemove, currency }: {
  label: string;
  items: PickedItem[];
  onOpen: () => void;
  onRemove: (itemId: string) => void;
  currency: string;
}) => {
  const { t } = useLanguage();
  const total = items.reduce((s, i) => s + i.amount, 0);
  return (
    <div className="p-3 rounded-lg bg-muted/50 space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-medium text-sm">{label}</p>
        <Button variant="outline" size="sm" className="text-xs h-7" onClick={(e) => { e.preventDefault(); onOpen(); }}>
          {t('treasury.select')}
        </Button>
      </div>
      {items.length > 0 ? (
        <div className="space-y-1">
          {items.map(item => (
            <div key={item.item_id || item.order_id || item.treasury_entry_id || item.customer_name} className="flex items-center justify-between text-xs bg-background rounded-md px-2 py-1.5 border">
              <span className="truncate flex-1">{item.customer_name}</span>
              <MoneyValue value={item.amount} currency={currency} className="font-bold mx-2" />
              <button onClick={(e) => { e.preventDefault(); onRemove(item.item_id || item.order_id); }} className="text-destructive hover:text-destructive/80 text-xs">✕</button>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs pt-1 border-t">
            <span className="text-muted-foreground">{items.length} {t('treasury.items')}</span>
            <MoneyValue value={total} currency={currency} className="font-bold" />
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">{t('treasury.no_items_selected')}</p>
      )}
    </div>
  );
};

export default ManagerTreasury;
