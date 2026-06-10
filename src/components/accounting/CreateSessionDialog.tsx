import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Loader2, Calculator, Receipt, Banknote, CreditCard, ArrowDownCircle, ArrowUpCircle, Wallet, TrendingDown, Coins, AlertTriangle, Package, ShoppingBag, RefreshCw, Gift, Tag, HandCoins, FileText, ClipboardList, Truck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionCalculations, SessionCalculations } from '@/hooks/useSessionCalculations';
import { useCreateSession, useUpdateFullSession, AccountingSession, AccountingSessionItem } from '@/hooks/useAccountingSessions';
import { useCreateWorkerDebt } from '@/hooks/useWorkerDebts';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import ProductStockSummary from './ProductStockSummary';
import SalesDetailsSummary from './SalesDetailsSummary';
import PromoTrackingSummary from './PromoTrackingSummary';
import PricingGroupsSummary from './PricingGroupsSummary';

import StockDiscrepancySection from './StockDiscrepancySection';
import DebtCollectionsSummary from './DebtCollectionsSummary';
import DocumentCollectionsSummary from './DocumentCollectionsSummary';
import ExceptionalActionsSummary from './ExceptionalActionsSummary';
import PendingRequestsSummary from './PendingRequestsSummary';
import WorkerHandoverSummary from './WorkerHandoverSummary';
import ExpensesDetailsSummary from './ExpensesDetailsSummary';
import { usePendingDiscrepancies } from '@/hooks/useStockDiscrepancies';
import TruckReviewSection from './TruckReviewSection';
import { WorkerTruckStockList } from '@/components/stock/WorkerTruckStockList';
import TruckUnloadDialog from './TruckUnloadDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useWorkerAccountingProfile, ACCOUNTING_PROFILE_LABELS_AR } from '@/utils/workerAccountingProfile';
import { Badge } from '@/components/ui/badge';


interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedWorkerId?: string;
  workerName?: string;
  editSession?: AccountingSession | null;
}

const fmt = (n: number) => n.toLocaleString();

const VerifyButton: React.FC<{ verified: boolean; onClick: () => void; label?: string }> = ({ verified, onClick, label = 'تحقق من التفاصيل' }) => (
  <label
    className={`mt-2 flex items-center justify-end gap-2 cursor-pointer select-none rounded-lg border px-3 py-2 transition-colors ${
      verified ? 'bg-emerald-50 border-emerald-300' : 'bg-background border-border hover:bg-muted/40'
    }`}
  >
    <span className={`text-[11px] font-semibold ${verified ? 'text-emerald-700' : 'text-muted-foreground'}`}>
      {verified ? 'تم التحقق' : label}
    </span>
    <span
      onClick={(e) => { e.preventDefault(); onClick(); }}
      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
        verified ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-background border-muted-foreground/40'
      }`}
    >
      {verified && <span className="text-[12px] leading-none">✓</span>}
    </span>
  </label>
);

const flattenChildren = (children: React.ReactNode): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  React.Children.forEach(children, (child) => {
    if (child == null || child === false || child === true) return;
    if (React.isValidElement(child) && child.type === React.Fragment) {
      out.push(...flattenChildren((child.props as any).children));
    } else {
      out.push(child);
    }
  });
  return out;
};

const isSectionEl = (el: React.ReactNode): el is React.ReactElement => {
  if (!React.isValidElement(el)) return false;
  const props = el.props as any;
  return props && (props.step !== undefined || props.sectionKey !== undefined);
};

export const SwipeStack: React.FC<{
  enabled: boolean;
  children: React.ReactNode;
  onActiveSectionChange?: (key: string | null) => void;
  initialIndex?: number;
}> = ({ enabled, children, onActiveSectionChange, initialIndex = 0 }) => {
  const all = flattenChildren(children);
  const sections = all.filter(isSectionEl);
  const others = all.filter((c) => !isSectionEl(c));
  const [index, setIndex] = React.useState(initialIndex);
  const startX = React.useRef<number | null>(null);
  React.useEffect(() => { if (index >= sections.length) setIndex(0); }, [sections.length, index]);
  const safeIndex = sections.length ? ((index % sections.length) + sections.length) % sections.length : 0;
  const activeKey = sections[safeIndex] && (sections[safeIndex] as any).props?.sectionKey;
  React.useEffect(() => {
    if (enabled && onActiveSectionChange) onActiveSectionChange(activeKey ?? null);
  }, [enabled, activeKey, onActiveSectionChange]);
  if (!enabled) return <div className="space-y-3">{children}</div>;
  const go = (delta: number) => { if (!sections.length) return; setIndex((safeIndex + delta + sections.length) % sections.length); };
  return (
    <div
      className="relative"
      onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (startX.current == null) return;
        const dx = e.changedTouches[0].clientX - startX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        startX.current = null;
      }}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 mb-2 bg-background/95 backdrop-blur py-1.5 rounded-lg border px-2">
        <button type="button" onClick={() => go(-1)} className="px-3 py-1 rounded-md hover:bg-muted text-lg shrink-0">‹</button>
        <div className="flex-1 min-w-0 flex items-center justify-center gap-2">
          {(sections[safeIndex] as any)?.props?.title && (
            <span className="text-sm font-bold truncate">{(sections[safeIndex] as any).props.title}</span>
          )}
          <span className="text-[10px] text-muted-foreground font-semibold shrink-0">{safeIndex + 1} / {sections.length}</span>
        </div>
        <button type="button" onClick={() => go(1)} className="px-3 py-1 rounded-md hover:bg-muted text-lg shrink-0">›</button>
      </div>
      {sections.map((child, i) => (
        <div key={i} style={{ display: i === safeIndex ? 'block' : 'none' }}>
          {i === safeIndex && React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement<any>, { forceOpen: true, hideHeader: true })
            : child}
        </div>
      ))}
      {others.length > 0 && <div className="space-y-3 mt-3">{others}</div>}
    </div>
  );
};

const CreateSessionDialog: React.FC<CreateSessionDialogProps> = ({ open, onOpenChange, preselectedWorkerId, workerName, editSession }) => {
  const { t, dir } = useLanguage();
  const { activeBranch, workerId: currentWorkerId } = useAuth();
  const createSession = useCreateSession();
  const updateSession = useUpdateFullSession();
  const createWorkerDebt = useCreateWorkerDebt();
  const [registerDeficit, setRegisterDeficit] = useState(false);
  const [viewByProduct, setViewByProduct] = useState(false);
  const [swipeMode, setSwipeMode] = useState(false);
  const [registerDeficitTreasury, setRegisterDeficitTreasury] = useState(false);
  const [registerSurplus, setRegisterSurplus] = useState(false);
  const nowLocal = () => {
    const now = new Date();
    const algeriaOffset = 1 * 60;
    const localMs = now.getTime() + (algeriaOffset + now.getTimezoneOffset()) * 60000;
    const d = new Date(localMs);
    return format(d, "yyyy-MM-dd'T'HH:mm");
  };
  const todayStart = () => format(new Date(), "yyyy-MM-dd") + 'T00:00';
  const [periodStart, setPeriodStart] = useState(todayStart());
  const [periodEnd, setPeriodEnd] = useState(nowLocal());
  const [sessionNotes, setSessionNotes] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [coinAmount, setCoinAmount] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const isEditMode = !!editSession;
  const selectedWorkerId = editSession?.worker_id || preselectedWorkerId || '';
  const { data: profileData } = useWorkerAccountingProfile(selectedWorkerId || null);
  const accountingProfile = profileData?.profile || 'full_with_stock';
  const isFinancialOnly = accountingProfile === 'financial_only';


  useEffect(() => {
    if (open) {
      if (editSession) {
        // Convert UTC timestamps from DB to Algeria local datetime-local strings,
        // so downstream queries (which append +01:00) produce the correct UTC window.
        const toAlgeriaLocal = (raw: string): string => {
          const d = new Date(raw);
          if (Number.isNaN(d.getTime())) return raw.slice(0, 16);
          const algeriaMs = d.getTime() + (60 + d.getTimezoneOffset()) * 60000;
          return format(new Date(algeriaMs), "yyyy-MM-dd'T'HH:mm");
        };
        const ps = toAlgeriaLocal(editSession.period_start);
        const pe = toAlgeriaLocal(editSession.period_end);
        setPeriodStart(ps);
        setPeriodEnd(pe);
        setSessionNotes(editSession.notes || '');
        const cashItem = editSession.items?.find(i => i.item_type === 'physical_cash');
        const coinItem = editSession.items?.find(i => i.item_type === 'coin_amount');
        setActualCash(cashItem ? String(Number(cashItem.actual_amount)) : '');
        setCoinAmount(coinItem ? String(Number(coinItem.actual_amount)) : '');
        // Auto-refresh collected-documents data when re-opening edit dialog,
        // so "مستندات مستلمة أثناء التوصيل" syncs with the session period
        // without needing a manual refresh click.
        queryClient.invalidateQueries({ queryKey: ['session-document-collections'] });
        queryClient.invalidateQueries({ queryKey: ['session-stamped-invoices'] });
        queryClient.invalidateQueries({ queryKey: ['manager-decision-drafts', editSession.worker_id] });
        queryClient.invalidateQueries({ queryKey: ['pending-documents'] });
      } else {
        const fetchLastSession = async () => {
          if (!selectedWorkerId) return;
          const { data } = await supabase
            .from('accounting_sessions')
            .select('completed_at, period_end')
            .eq('worker_id', selectedWorkerId)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(1);
          
          if (data && data.length > 0) {
            const ca = data[0].completed_at ? new Date(data[0].completed_at) : null;
            const pe = data[0].period_end ? new Date(data[0].period_end) : null;
            let refDate: Date | null = null;
            if (ca && pe && !isNaN(ca.getTime()) && !isNaN(pe.getTime())) {
              refDate = ca.getTime() > pe.getTime() ? ca : pe;
            } else {
              refDate = (ca && !isNaN(ca.getTime())) ? ca : (pe && !isNaN(pe.getTime())) ? pe : null;
            }

            // Also look for any delivered order for this worker whose updated_at
            // pre-dates refDate but was never covered by an existing session window.
            // Without this, "held" orders that slipped through past sessions would
            // never appear in any future session.
            const { data: allSessions } = await supabase
              .from('accounting_sessions')
              .select('period_start, period_end')
              .eq('worker_id', selectedWorkerId)
              .eq('status', 'completed');
            const windows = (allSessions || [])
              .map((s: any) => ({ start: new Date(s.period_start).getTime(), end: new Date(s.period_end).getTime() }))
              .filter((w) => !isNaN(w.start) && !isNaN(w.end));
            const { data: deliveredOrders } = await supabase
              .from('orders')
              .select('updated_at')
              .eq('assigned_worker_id', selectedWorkerId)
              .eq('status', 'delivered')
              .order('updated_at', { ascending: true })
              .limit(500);
            let earliestUncovered: Date | null = null;
            for (const o of deliveredOrders || []) {
              const t = o.updated_at ? new Date(o.updated_at) : null;
              if (!t || isNaN(t.getTime())) continue;
              const ms = t.getTime();
              const covered = windows.some((w) => ms >= w.start && ms <= w.end);
              if (!covered) { earliestUncovered = t; break; }
            }
            if (earliestUncovered && (!refDate || earliestUncovered.getTime() < refDate.getTime())) {
              refDate = earliestUncovered;
            }

            if (refDate) {
              const algeriaOffset = 1 * 60;
              const localMs = refDate.getTime() + (algeriaOffset + refDate.getTimezoneOffset()) * 60000;
              const localDate = new Date(localMs);
              setPeriodStart(format(localDate, "yyyy-MM-dd'T'HH:mm"));
            } else {
              setPeriodStart(todayStart());
            }

          } else {
            // No prior completed session: fall back to the earliest unsettled delivery
            // so we capture all outstanding liability instead of only today.
            const { data: oldestMv } = await supabase
              .from('stock_movements')
              .select('created_at')
              .eq('worker_id', selectedWorkerId)
              .eq('movement_type', 'delivery')
              .eq('status', 'approved')
              .order('created_at', { ascending: true })
              .limit(1);
            if (oldestMv && oldestMv.length > 0 && oldestMv[0].created_at) {
              const d = new Date(oldestMv[0].created_at);
              const algeriaOffset = 1 * 60;
              const localMs = d.getTime() + (algeriaOffset + d.getTimezoneOffset()) * 60000;
              setPeriodStart(format(new Date(localMs), "yyyy-MM-dd'T'HH:mm"));
            } else {
              setPeriodStart(todayStart());
            }
          }
        };
        fetchLastSession();
        setPeriodEnd(nowLocal());
        setSessionNotes('');
        setActualCash('');
        setCoinAmount('');
      }
      setRegisterDeficit(false);
      setRegisterDeficitTreasury(false);
      setRegisterSurplus(false);
      setIsSubmitting(false);
      setShowConfirmation(false);
      setReceivedDocs({});
    }
  }, [open, editSession, selectedWorkerId]);

  // Auto-update periodEnd removed - user controls manually via refresh button

  // In edit mode, use the original DB timestamps (with timezone) to avoid
  // misinterpreting UTC-stored values as local Algeria time, which would shift
  // the window by one hour and pull in items outside the saved session.
  const editPeriodStartRaw = editSession?.period_start || null;
  const editPeriodEndRaw = editSession?.period_end || null;
  const calcParams = selectedWorkerId && periodStart && periodEnd
    ? {
        workerId: selectedWorkerId,
        branchId: activeBranch?.id,
        periodStart: isEditMode && editPeriodStartRaw ? editPeriodStartRaw : periodStart,
        periodEnd: isEditMode && editPeriodEndRaw ? editPeriodEndRaw : periodEnd,
        // Do not auto-extend the saved period_end via completed_at; user must refresh explicitly.
        completedAt: null,
      }
    : null;

  const { data: calc, isLoading: calcLoading, error: calcError } = useSessionCalculations(calcParams, { refetchInterval: autoRefresh ? 600000 : false });
  const { data: pendingDiscrepancies = [] } = usePendingDiscrepancies(selectedWorkerId || null);

  // Check for loading/unloading sessions after last review
  const { data: postReviewInfo } = useQuery({
    queryKey: ['post-review-sessions', selectedWorkerId],
    queryFn: async () => {
      const { data: lastReview } = await supabase
        .from('loading_sessions')
        .select('id, created_at')
        .eq('worker_id', selectedWorkerId!)
        .eq('status', 'review')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (!lastReview) return { count: 0 };
      const { count } = await supabase
        .from('loading_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('worker_id', selectedWorkerId!)
        .neq('status', 'review')
        .gt('created_at', lastReview.created_at);
      return { count: count || 0 };
    },
    enabled: !!selectedWorkerId,
  });

  // Do not auto-fill actual cash amount — let the worker enter it manually.

  const cashDifference = calc ? Number(actualCash || 0) - calc.physicalCash : 0;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showUnloadDialog, setShowUnloadDialog] = useState(false);
  const [receivedDocs, setReceivedDocs] = useState<Record<string, boolean>>({});
  const [docItems, setDocItems] = useState<{ docIds: string[]; stampIds: string[]; receivedStampIds: string[] }>({ docIds: [], stampIds: [], receivedStampIds: [] });
  const hasUndecidedDocuments = docItems.docIds.some((id) => typeof receivedDocs[`doc_${id}`] !== 'boolean');
  const receivedStampSet = new Set(docItems.receivedStampIds);
  // Outstanding stamped invoices = stamps with no decision yet.
  // Both true (received) and false (not received) are considered processed.
  const pendingStampedCount = docItems.stampIds.filter((id) => {
    const draft = receivedDocs[`stamp_${id}`];
    if (draft === true) return false;
    if (draft === false) return false;
    return !receivedStampSet.has(id);
  }).length;
  const hasOutstandingCollections = hasUndecidedDocuments || pendingStampedCount > 0;
  const [isUnfreezing, setIsUnfreezing] = useState(false);
  const [verifications, setVerifications] = useState<{ pendingOrders: boolean; debtCollections: boolean; newDebts: boolean }>({ pendingOrders: false, debtCollections: false, newDebts: false });
  const toggleVerify = (k: keyof typeof verifications) => setVerifications((v) => ({ ...v, [k]: !v[k] }));

  // Auto-verified when block has no data
  const { data: pendingOrdersCount = 0 } = useQuery({
    queryKey: ['pending-orders-count', selectedWorkerId, periodStart, periodEnd],
    queryFn: async () => {
      const toIso = (v: string, end: boolean) => v.includes('T') ? new Date(v).toISOString() : new Date(`${v}T${end ? '23:59:59' : '00:00:00'}`).toISOString();
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', selectedWorkerId!)
        .not('status', 'in', '(delivered,cancelled)')
        .gte('created_at', toIso(periodStart, false))
        .lte('created_at', toIso(periodEnd, true));
      return count || 0;
    },
    enabled: !!selectedWorkerId && !!periodStart && !!periodEnd,
  });
  const queryClient = useQueryClient();

  // Worker freeze status (final review pending close)
  const { data: frozenRows = [] } = useQuery({
    queryKey: ['worker-freeze-status', selectedWorkerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('loading_sessions')
        .select('id')
        .eq('worker_id', selectedWorkerId!)
        .eq('status', 'review')
        .eq('is_final', true);
      return data || [];
    },
    enabled: !!selectedWorkerId && open,
  });
  const isFrozen = frozenRows.length > 0;

  const handleUnfreeze = async () => {
    if (!selectedWorkerId || frozenRows.length === 0) return;
    setIsUnfreezing(true);
    try {
      const { error } = await supabase
        .from('loading_sessions')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .in('id', frozenRows.map(r => r.id));
      if (error) throw error;
      toast.success(t('create_session.unfrozen'));
      queryClient.invalidateQueries({ queryKey: ['worker-freeze-status', selectedWorkerId] });
      queryClient.invalidateQueries({ queryKey: ['loading-sessions'] });
    } catch (e: any) {
      toast.error(e.message || t('create_session.unfreeze_failed'));
    } finally {
      setIsUnfreezing(false);
    }
  };

  const handleFreeze = async () => {
    if (!selectedWorkerId) return;
    setIsUnfreezing(true);
    try {
      // لا يُسمح بالتجميد إلا إذا كان رصيد منتجات العامل = 0
      const { data: stockRows, error: stockErr } = await supabase
        .from('worker_stock')
        .select('quantity')
        .eq('worker_id', selectedWorkerId)
        .gt('quantity', 0);
      if (stockErr) throw stockErr;
      if (stockRows && stockRows.length > 0) {
        toast.error('لا يمكن التجميد: العامل لا يزال يحمل منتجات في شاحنته. يجب تفريغ الشاحنة أولاً.');
        return;
      }

      // ابحث عن آخر جلسة شحن لتجميدها، وإلا أنشئ جلسة تجميد رمزية
      const { data: latest, error: qErr } = await supabase
        .from('loading_sessions')
        .select('id')
        .eq('worker_id', selectedWorkerId)
        .neq('status', 'review')
        .order('created_at', { ascending: false })
        .limit(1);
      if (qErr) throw qErr;

      if (latest && latest.length > 0) {
        const { error } = await supabase
          .from('loading_sessions')
          .update({ status: 'review', is_final: true } as any)
          .eq('id', latest[0].id);
        if (error) throw error;
      } else {
        if (!currentWorkerId) {
          toast.error(t('create_session.freeze_failed'));
          return;
        }
        const { error } = await supabase
          .from('loading_sessions')
          .insert({
            worker_id: selectedWorkerId,
            manager_id: currentWorkerId,
            branch_id: activeBranch?.id || null,
            status: 'review',
            is_final: true,
            notes: 'تجميد حساب (شاحنة فارغة)',
          } as any);
        if (error) throw error;
      }

      toast.success(t('create_session.frozen'));
      queryClient.invalidateQueries({ queryKey: ['worker-freeze-status', selectedWorkerId] });
      queryClient.invalidateQueries({ queryKey: ['loading-sessions'] });
    } catch (e: any) {
      toast.error(e.message || t('create_session.freeze_failed'));
    } finally {
      setIsUnfreezing(false);
    }
  };

  const handleShowConfirmation = () => {
    if (!selectedWorkerId || !calc) { toast.error(t('create_session.select_worker')); return; }
    setShowConfirmation(true);
  };

  // Branch manager must confirm full truck unload before save (new sessions only)
  const handleProceedToSave = () => {
    if (isEditMode) {
      // Editing existing session: skip unload step
      handleSubmit();
      return;
    }
    if (isFinancialOnly) {
      // الفئة "محاسبة مالية فقط": لا يوجد تفريغ شاحنة — احفظ مباشرة
      handleSubmit();
      return;
    }
    setShowConfirmation(false);
    setShowUnloadDialog(true);
  };


  const handleSubmit = async (unloadNotes?: string) => {
    if (!selectedWorkerId || !calc || isSubmitting) { toast.error(t('create_session.select_worker')); return; }

    setIsSubmitting(true);
    try {
      const items = [
        { item_type: 'total_sales', expected_amount: calc.totalSales, actual_amount: calc.totalSales },
        { item_type: 'total_paid', expected_amount: calc.totalPaid, actual_amount: calc.totalPaid },
        { item_type: 'new_debts', expected_amount: calc.newDebts, actual_amount: calc.newDebts },
        { item_type: 'invoice1_total', expected_amount: calc.invoice1.total, actual_amount: calc.invoice1.total },
        { item_type: 'invoice1_check', expected_amount: calc.invoice1.check, actual_amount: calc.invoice1.check },
        { item_type: 'invoice1_transfer', expected_amount: calc.invoice1.transfer, actual_amount: calc.invoice1.transfer },
        { item_type: 'invoice1_receipt', expected_amount: calc.invoice1.receipt, actual_amount: calc.invoice1.receipt },
        { item_type: 'invoice1_espace_cash', expected_amount: calc.invoice1.espaceCash, actual_amount: calc.invoice1.espaceCash },
        { item_type: 'invoice1_versement_cash', expected_amount: calc.invoice1.versementCash, actual_amount: calc.invoice1.versementCash },
        { item_type: 'invoice2_cash', expected_amount: calc.invoice2.cash, actual_amount: calc.invoice2.cash },
        { item_type: 'debt_collections_total', expected_amount: calc.debtCollections.total, actual_amount: calc.debtCollections.total },
        { item_type: 'debt_collections_cash', expected_amount: calc.debtCollections.cash, actual_amount: calc.debtCollections.cash },
        { item_type: 'debt_collections_check', expected_amount: calc.debtCollections.check, actual_amount: calc.debtCollections.check },
        { item_type: 'debt_collections_transfer', expected_amount: calc.debtCollections.transfer, actual_amount: calc.debtCollections.transfer },
        { item_type: 'debt_collections_receipt', expected_amount: calc.debtCollections.receipt, actual_amount: calc.debtCollections.receipt },
        { item_type: 'physical_cash', expected_amount: calc.physicalCash, actual_amount: Number(actualCash || 0) },
        { item_type: 'coin_amount', expected_amount: 0, actual_amount: Number(coinAmount || 0) },
        { item_type: 'expenses', expected_amount: calc.expenses, actual_amount: calc.expenses },
        { item_type: 'customer_surplus_cash', expected_amount: calc.customerSurplusCash, actual_amount: calc.customerSurplusCash },
      ];

      let sessionId: string | undefined;

      if (isEditMode && editSession) {
        await updateSession.mutateAsync({
          session_id: editSession.id,
          period_start: periodStart,
          period_end: periodEnd,
          notes: sessionNotes || undefined,
          items,
        });
        sessionId = editSession.id;
        toast.success(t('accounting.session_updated') || t('create_session.session_updated_ok'));
      } else {
        const result = await createSession.mutateAsync({
          worker_id: selectedWorkerId,
          period_start: periodStart,
          period_end: periodEnd,
          notes: sessionNotes || undefined,
          items,
          unload_notes: unloadNotes || undefined,
        });
        sessionId = result?.id;
        toast.success(t('accounting.session_created'));
      }

      // Apply any pending manager decision drafts for this worker now that
      // the accounting session has been saved.
      try {
        await (supabase as any).rpc('apply_manager_decision_drafts', {
          p_worker_id: selectedWorkerId,
          p_session_id: sessionId,
        });
        // Reflect updated invoice/document statuses across tracking dialogs
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['invoice-tracking'] }),
          queryClient.invalidateQueries({ queryKey: ['invoice1-status'] }),
          queryClient.invalidateQueries({ queryKey: ['session-stamped-invoices'] }),
          queryClient.invalidateQueries({ queryKey: ['session-document-collections'] }),
          queryClient.invalidateQueries({ queryKey: ['manager-decision-drafts', selectedWorkerId] }),
          queryClient.invalidateQueries({ queryKey: ['pending-documents'] }),
        ]);
      } catch (e) {
        console.warn('Failed to apply manager decision drafts', e);
      }


      // Register deficit as worker debt AND in surplus/deficit treasury
      if (registerDeficit && cashDifference < 0) {
        try {
          await createWorkerDebt.mutateAsync({
            worker_id: selectedWorkerId,
            amount: Math.abs(cashDifference),
            debt_type: 'deficit',
            session_id: sessionId,
            description: `${t('create_session.deficit_session_desc')} ${format(new Date(), 'dd/MM/yyyy')}`,
          });
          // Always also record in surplus/deficit treasury
          await supabase.from('manager_treasury').insert({
            manager_id: currentWorkerId!,
            branch_id: activeBranch?.id || null,
            session_id: sessionId || null,
            source_type: 'accounting_deficit',
            payment_method: 'cash',
            amount: Math.abs(cashDifference),
            notes: `${t('create_session.deficit_session_desc')} - ${workerName || selectedWorkerId}`,
          });
          toast.success(t('create_session.deficit_recorded_full'));
        } catch { toast.error(t('create_session.deficit_error')); }
      }

      // Register deficit ONLY in surplus/deficit treasury (no worker debt)
      if (registerDeficitTreasury && cashDifference < 0) {
        try {
          await supabase.from('manager_treasury').insert({
            manager_id: currentWorkerId!,
            branch_id: activeBranch?.id || null,
            session_id: sessionId || null,
            source_type: 'accounting_deficit',
            payment_method: 'cash',
            amount: Math.abs(cashDifference),
            notes: `${t('create_session.deficit_session_desc')} - ${workerName || selectedWorkerId}`,
          });
          toast.success(t('create_session.deficit_recorded_treasury'));
        } catch { toast.error(t('create_session.deficit_treasury_error')); }
      }

      // Register surplus in manager treasury
      if (registerSurplus && cashDifference > 0) {
        try {
          await supabase.from('manager_treasury').insert({
            manager_id: currentWorkerId!,
            branch_id: activeBranch?.id || null,
            session_id: sessionId || null,
            source_type: 'accounting_surplus',
            payment_method: 'cash',
            amount: cashDifference,
            notes: `${t('create_session.surplus_session_note')} - ${workerName || selectedWorkerId}`,
          });
          toast.success(t('create_session.surplus_recorded'));
        } catch { toast.error(t('create_session.surplus_error')); }
      }

      setShowConfirmation(false);
      onOpenChange(false);

      // Clear the stock confirmation log between this manager and worker
      // once the accounting session has been saved successfully.
      try {
        if (currentWorkerId && selectedWorkerId) {
          await supabase
            .from('stock_confirmations')
            .delete()
            .eq('manager_id', currentWorkerId)
            .eq('worker_id', selectedWorkerId);
        }
      } catch (e) {
        // non-blocking
        console.warn('Failed to clear stock confirmations log', e);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col" dir={dir}>
        <DialogHeader className="p-4 pb-3 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Calculator className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>{isEditMode ? (t('accounting.edit_session') || t('common.edit')) : t('accounting.new_session')}</span>
                  {periodStart && periodEnd && (
                    <span className="flex items-center gap-1.5 text-xs font-normal" dir="ltr">
                      <span className="text-emerald-600 font-semibold">{periodStart.replace('T', ' ')}</span>
                      <span className="text-muted-foreground">←</span>
                      <span className="font-bold text-foreground">{periodEnd.replace('T', ' ')}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {workerName && <span className="text-xs font-normal text-muted-foreground">{workerName}</span>}
                  {selectedWorkerId && (
                    <Badge
                      variant={isFinancialOnly ? 'secondary' : 'default'}
                      className={`text-[10px] h-5 px-2 ${isFinancialOnly ? 'bg-sky-100 text-sky-700 hover:bg-sky-100 border-sky-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200'}`}
                    >
                      {ACCOUNTING_PROFILE_LABELS_AR[accountingProfile]}
                    </Badge>
                  )}
                </div>
              </div>

            </DialogTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-muted-foreground">تمرير</Label>
                <Switch checked={swipeMode} onCheckedChange={setSwipeMode} />
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-muted-foreground">{t('create_session.by_product')}</Label>
                <Switch checked={viewByProduct} onCheckedChange={setViewByProduct} />
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3" style={{ WebkitOverflowScrolling: 'touch' }}>
          <SwipeStack enabled={swipeMode} initialIndex={1}>

            {/* ━━━ Step 1: Period ━━━ */}
            <StepSection step={1} title={t('accounting.period') || 'الفترة'} color="primary">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-emerald-600">{t('accounting.period_start')}</Label>
                  <Input type="datetime-local" value={periodStart} readOnly disabled className="text-xs rounded-lg bg-muted/40 cursor-not-allowed text-emerald-600 font-semibold" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">{t('accounting.period_end')}</Label>
                    {!isEditMode && (
                      <Button type="button" variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] text-primary hover:text-primary/80 gap-1" onClick={() => setPeriodEnd(nowLocal())}>
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <Input type="datetime-local" value={periodEnd} readOnly disabled className="text-xs rounded-lg bg-muted/40 cursor-not-allowed font-bold" />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                {t('create_session.period_auto_note')}
              </p>
            </StepSection>

            {/* Warning: sessions after last review */}
            {(postReviewInfo?.count || 0) > 0 && (
              <Alert className="rounded-xl border-orange-300 bg-orange-50 dark:bg-orange-900/10">
                <Info className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-sm font-medium text-orange-800 dark:text-orange-400">
                  ⚠️ {postReviewInfo!.count} {t('create_session.post_review_warning')}
                </AlertDescription>
              </Alert>
            )}

            {calcLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="mr-2 text-sm text-muted-foreground">{t('accounting.calculating')}</span>
              </div>
            )}

            {calcError && !calcLoading && (
              <Alert className="rounded-xl border-destructive/30 bg-destructive/5">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-sm text-destructive">
                  {calcError instanceof Error ? calcError.message : (t('common.error') || t('create_session.calc_load_error'))}
                </AlertDescription>
              </Alert>
            )}

            {calc && (
              <>
                {/* ━━━ Step 2: Sales Overview ━━━ */}
                <StepSection step={2} title={t('create_session.sales_summary')} color="primary" defaultOpen>
                  <div className="bg-black rounded-xl p-3 mb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowUpCircle className="w-5 h-5 text-white" />
                        <span className="font-bold text-sm text-white">{t('accounting.total_sales')}</span>
                      </div>
                      <span className="text-xl font-bold text-white">{fmt(calc.totalSales)} DA</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground">{t('accounting.total_paid')}</p>
                      <p className="font-bold text-lg text-green-600">{fmt(calc.totalPaid)} DA</p>
                    </div>
                    <div className="bg-destructive/5 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground">{t('accounting.new_debts')}</p>
                      <p className="font-bold text-lg text-destructive">{fmt(calc.newDebts)} DA</p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground">الكاش المقبوض</p>
                      <p className="font-bold text-lg text-emerald-600">
                        {fmt((calc.invoice2?.cash || 0) + (calc.invoice1?.espaceCash || 0) + (calc.invoice1?.versementCash || 0))} DA
                      </p>
                    </div>
                    {(() => {
                      const check = (calc.invoice1?.check || 0) + (calc.debtCollections?.check || 0);
                      const receipt = (calc.invoice1?.receipt || 0) + (calc.debtCollections?.receipt || 0);
                      const transfer = (calc.invoice1?.transfer || 0) + (calc.debtCollections?.transfer || 0);
                      const total = check + receipt + transfer;
                      return (
                        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-2.5 text-center">
                          <p className="text-[10px] text-muted-foreground">مدفوعات وثائقية (Doc Payments)</p>
                          <p className="font-bold text-lg text-blue-600">{fmt(total)} DA</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">
                            شيك {fmt(check)} · فيرسمو {fmt(receipt)} · فيرمو {fmt(transfer)}
                          </p>
                        </div>
                      );
                    })()}
                    <div className="bg-orange-50 dark:bg-orange-900/10 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground">المصاريف</p>
                      <p className="font-bold text-lg text-orange-700">{fmt(calc.expenses || 0)} DA</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/10 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground">الديون المحصلة</p>
                      <p className="font-bold text-lg text-orange-600">{fmt(calc.debtCollections?.total || 0)} DA</p>
                    </div>
                  </div>
                  {/* الكاش المسلم للمدير - تصميم مميز بارز */}
                  <div className="relative overflow-hidden rounded-xl p-3 bg-gradient-to-l from-indigo-600 via-purple-600 to-fuchsia-600 shadow-lg shadow-purple-500/30 ring-2 ring-purple-300">
                    <div className="absolute -top-6 -left-6 w-20 h-20 rounded-full bg-white/20 blur-xl" />
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/20 blur-xl" />
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-white/25 backdrop-blur flex items-center justify-center ring-1 ring-white/40">
                          <Wallet className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-white/90 font-medium">يجب تسليمه نقداً للمدير</span>
                          <span className="font-bold text-sm text-white">الكاش المسلم للمدير</span>
                        </div>
                      </div>
                      <span className="text-2xl font-extrabold text-white drop-shadow">{fmt(calc.physicalCash)} DA</span>
                    </div>
                  </div>
                </StepSection>

                {/* ━━━ Step 3: Document Collections ━━━ */}
                {selectedWorkerId && periodStart && periodEnd && (
                  <StepSection step={3} title={t('create_session.collected_documents')} color="blue">
                    <DocumentCollectionsSummary workerId={selectedWorkerId} periodStart={periodStart} periodEnd={periodEnd} receivedDocs={receivedDocs} onReceivedDocsChange={setReceivedDocs} onItemsChange={setDocItems} />
                  </StepSection>
                )}

                {/* ━━━ Step 4: Physical Cash (Key Input) ━━━ */}
                <StepSection step={4} title={t('accounting.physical_cash')} color="primary" important>
                  <div className="space-y-1 text-xs bg-muted/40 rounded-lg p-2.5">
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t('accounting.invoice2')} ({t('accounting.method_direct_cash')})</span>
                      <span>{fmt(calc.invoice2.cash)} DA</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t('accounting.invoice1')} ({t('accounting.method_espace_cash')})</span>
                      <span>{fmt(calc.invoice1.espaceCash)} DA</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Versement (cache)</span>
                      <span>{fmt(calc.invoice1.versementCash)} DA</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t('accounting.debt_collections')} ({t('accounting.method_cash')})</span>
                      <span>{fmt(calc.debtCollections.cash)} DA</span>
                    </div>
                    <div className="flex justify-between text-blue-600">
                      <span>{t('create_session.customer_surplus_cash')}</span>
                      <span>{calc.customerSurplusCash > 0 ? '+' : ''}{fmt(calc.customerSurplusCash)} DA</span>
                    </div>
                    <div className="flex justify-between text-destructive">
                      <span>{t('accounting.expenses')} ({t('accounting.method_cash')})</span>
                      <span>-{fmt(calc.cashExpenses)} DA</span>
                    </div>
                    <div className="border-t pt-1.5 flex justify-between font-bold text-sm">
                      <span>{t('accounting.expected')}</span>
                      <span className="text-primary">{fmt(calc.physicalCash)} DA</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-3">
                    <Label className="text-xs font-semibold">{t('accounting.actual_cash_received')}</Label>
                    {(() => {
                      const onlyExpenses =
                        calc.cashExpenses > 0 &&
                        (calc.invoice2?.cash || 0) === 0 &&
                        (calc.invoice1?.espaceCash || 0) === 0 &&
                        (calc.invoice1?.versementCash || 0) === 0 &&
                        (calc.debtCollections?.cash || 0) === 0 &&
                        (calc.customerSurplusCash || 0) === 0;
                      if (onlyExpenses) {
                        const negVal = String(-calc.cashExpenses);
                        const checked = actualCash === negVal;
                        return (
                          <label className="flex items-center justify-between gap-3 w-full h-11 px-3 rounded-lg border border-dashed cursor-pointer hover:bg-accent/50">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => setActualCash(v ? negVal : '')}
                              />
                              <span className="text-xs text-muted-foreground">{t('accounting.expenses')}</span>
                            </div>
                            <span className="text-lg font-bold text-destructive">-{fmt(calc.cashExpenses)} DA</span>
                          </label>
                        );
                      }
                      return (
                        <Input type="number" value={actualCash} onChange={e => setActualCash(e.target.value)} className="h-11 text-lg font-bold text-center rounded-lg" placeholder="0" />
                      );
                    })()}
                  </div>

                  {actualCash !== '' && (() => {
                    const displayDiff = Math.abs(cashDifference) < 0.005 ? 0 : cashDifference;
                    return (
                    <div className={`rounded-xl p-3 text-center mt-2 ${displayDiff >= 0 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-destructive/10'}`}>
                      <p className="text-xs text-muted-foreground mb-0.5">{t('accounting.difference')}</p>
                      <p className={`text-xl font-bold ${displayDiff >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {displayDiff > 0 ? '+' : ''}{fmt(displayDiff)} DA
                      </p>
                    </div>
                    );
                  })()}

                  {actualCash !== '' && cashDifference < 0 && (
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10">
                        <Checkbox id="register-deficit" checked={registerDeficit} onCheckedChange={(v) => { setRegisterDeficit(!!v); if (!!v) setRegisterDeficitTreasury(false); }} />
                        <label htmlFor="register-deficit" className="text-xs font-medium text-destructive cursor-pointer">
                          {t('create_session.deficit_as_debt_and_treasury')} ({fmt(Math.abs(cashDifference))} DA)
                        </label>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20">
                        <Checkbox id="register-deficit-treasury" checked={registerDeficitTreasury} onCheckedChange={(v) => { setRegisterDeficitTreasury(!!v); if (!!v) setRegisterDeficit(false); }} />
                        <label htmlFor="register-deficit-treasury" className="text-xs font-medium text-orange-700 dark:text-orange-400 cursor-pointer">
                          {t('create_session.deficit_treasury_only')} ({fmt(Math.abs(cashDifference))} DA)
                        </label>
                      </div>
                    </div>
                  )}

                  {actualCash !== '' && cashDifference > 0 && (
                    <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                      <Checkbox id="register-surplus" checked={registerSurplus} onCheckedChange={(v) => setRegisterSurplus(!!v)} />
                      <label htmlFor="register-surplus" className="text-xs font-medium text-green-700 dark:text-green-400 cursor-pointer">
                        {t('create_session.surplus_in_treasury')} ({fmt(cashDifference)} DA)
                      </label>
                    </div>
                  )}

                  {/* Coin amount */}
                  <div className="space-y-1.5 border-t pt-3 mt-3">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-xs font-semibold">{t('accounting.coin_amount')}</Label>
                    </div>
                    <Input type="number" value={coinAmount} onChange={e => setCoinAmount(e.target.value)} onFocus={e => e.target.select()} className="h-9 text-center rounded-lg" placeholder="0" />
                    {coinAmount && Number(coinAmount) > 0 && actualCash !== '' && (
                      <p className="text-xs text-muted-foreground text-center">
                        {t('accounting.coin_amount')}: {fmt(Number(coinAmount))} DA — {t('accounting.method_cash')}: {fmt(Number(actualCash || 0) - Number(coinAmount))} DA
                      </p>
                    )}
                  </div>
                </StepSection>

                {/* ━━━ Step 5: Payment Breakdown ━━━ */}
                <StepSection step={5} title={t('create_session.payment_details')} color="blue">

                  {/* Invoice 1 */}
                  <div className="rounded-lg border p-3 space-y-1.5 mb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-3.5 h-3.5 text-blue-600" />
                        <span className="font-bold text-xs">{t('accounting.invoice1')}</span>
                      </div>
                      <span className="font-bold text-xs text-blue-600">{fmt(calc.invoice1.total)} DA</span>
                    </div>
                    <div className="space-y-0.5">
                      <PaymentRow label={t('accounting.method_check')} value={calc.invoice1.check} />
                      <PaymentRow label={t('accounting.method_transfer')} value={calc.invoice1.transfer} />
                      <PaymentRow label={t('accounting.method_receipt')} value={calc.invoice1.receipt} />
                      <PaymentRow label={t('accounting.method_espace_cash')} value={calc.invoice1.espaceCash} highlight />
                      <PaymentRow label="Versement (cache)" value={calc.invoice1.versementCash} highlight />
                    </div>
                  </div>
                  {/* Invoice 2 */}
                  <div className="rounded-lg border p-3 space-y-1.5 mb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-bold text-xs">{t('accounting.invoice2')}</span>
                      </div>
                      <span className="font-bold text-xs text-emerald-600">{fmt(calc.invoice2.total)} DA</span>
                    </div>
                    <PaymentRow label={t('accounting.method_direct_cash')} value={calc.invoice2.cash} highlight />
                  </div>
                  {/* Debt Collections */}
                  <div className="rounded-lg border p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowDownCircle className="w-3.5 h-3.5 text-orange-600" />
                        <span className="font-bold text-xs">{t('accounting.debt_collections')}</span>
                      </div>
                      <span className="font-bold text-xs text-orange-600">{fmt(calc.debtCollections?.total || 0)} DA</span>
                    </div>
                    <div className="space-y-0.5">
                      <PaymentRow label={t('accounting.method_cash')} value={calc.debtCollections?.cash || 0} highlight />
                      <PaymentRow label={t('accounting.method_check')} value={calc.debtCollections?.check || 0} />
                      <PaymentRow label={t('accounting.method_transfer')} value={calc.debtCollections?.transfer || 0} />
                      <PaymentRow label={t('accounting.method_receipt')} value={calc.debtCollections?.receipt || 0} />
                    </div>
                  </div>
                </StepSection>

                {/* ━━━ Step 4: Debt Details (mirrors payment_details layout) ━━━ */}
                <StepSection step={6} title={t('create_session.debt_details')} color="orange" badge={`${fmt((calc.newDebts || 0) + (calc.debtCollections?.total || 0))} DA`} verified={verifications.newDebts || ((calc.newDebts || 0) === 0 && (calc.debtCollections?.total || 0) === 0)} requiresVerification={(calc.newDebts || 0) > 0 || (calc.debtCollections?.total || 0) > 0}>
                  {/* New Debts */}
                  <div className="rounded-lg border p-3 space-y-1.5 mb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                        <span className="font-bold text-xs">{t('create_session.new_debts_card')}</span>
                      </div>
                      <span className="font-bold text-xs text-destructive">{fmt(calc.newDebts || 0)} DA</span>
                    </div>
                    <div className="space-y-0.5">
                      <PaymentRow label={t('accounting.invoice1')} value={calc.newDebtsByInvoice?.invoice1 || 0} highlight />
                      {(calc.newDebtsByInvoice?.invoice1 || 0) > 0 && (
                        <div className="ps-3 space-y-0.5 border-s-2 border-muted">
                          <PaymentRow label={t('accounting.method_check')} value={calc.newDebtsByInvoice?.invoice1Methods?.check || 0} />
                          <PaymentRow label={t('accounting.method_transfer')} value={calc.newDebtsByInvoice?.invoice1Methods?.transfer || 0} />
                          <PaymentRow label={t('accounting.method_receipt')} value={calc.newDebtsByInvoice?.invoice1Methods?.receipt || 0} />
                          <PaymentRow label={t('accounting.method_espace_cash')} value={calc.newDebtsByInvoice?.invoice1Methods?.espaceCash || 0} />
                          <PaymentRow label="Versement (cache)" value={calc.newDebtsByInvoice?.invoice1Methods?.versementCash || 0} />
                        </div>
                      )}
                      <PaymentRow label={t('accounting.invoice2')} value={calc.newDebtsByInvoice?.invoice2 || 0} />
                    </div>
                  </div>
                  <VerifyButton verified={verifications.newDebts} onClick={() => toggleVerify('newDebts')} label="تحقق من تفاصيل الديون" />
                  {/* Debt Collections */}
                  <div className="rounded-lg border p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowDownCircle className="w-3.5 h-3.5 text-orange-600" />
                        <span className="font-bold text-xs">{t('accounting.debt_collections')}</span>
                      </div>
                      <span className="font-bold text-xs text-orange-600">{fmt(calc.debtCollections?.total || 0)} DA</span>
                    </div>
                    <div className="space-y-0.5">
                      <PaymentRow label={t('accounting.method_cash')} value={calc.debtCollections?.cash || 0} highlight />
                      <PaymentRow label={t('accounting.method_check')} value={calc.debtCollections?.check || 0} />
                      <PaymentRow label={t('accounting.method_transfer')} value={calc.debtCollections?.transfer || 0} />
                      <PaymentRow label={t('accounting.method_receipt')} value={calc.debtCollections?.receipt || 0} />
                    </div>
                  </div>
                </StepSection>
              </>
            )}


            {/* ━━━ Step 9: Stock & Sales Tracking ━━━ */}
            {selectedWorkerId && periodStart && periodEnd && (
              <>
                {!isFinancialOnly && (
                  <StepSection step={10} title={t('accounting.truck_stock') || t('create_session.product_tracking')} color="primary" badge="A">
                    <div className="space-y-3">
                      <WorkerTruckStockList workerId={selectedWorkerId} />
                      <ProductStockSummary workerId={selectedWorkerId} branchId={activeBranch?.id} periodStart={periodStart} periodEnd={periodEnd} viewByProduct={viewByProduct} promoTracking={viewByProduct ? calc?.promoTracking : undefined} />
                    </div>
                  </StepSection>
                )}
                {!viewByProduct && (
                  <StepSection step={10} title={t('accounting.sales_details')} color="primary" badge="B">
                    <SalesDetailsSummary workerId={selectedWorkerId} periodStart={periodStart} periodEnd={periodEnd} />
                  </StepSection>
                )}
                {!isFinancialOnly && (
                  <StepSection step={10} title={t('session_details.pricing_groups') || 'قوائم الأسعار'} color="blue" badge="D">
                    <PricingGroupsSummary workerId={selectedWorkerId} periodStart={periodStart} periodEnd={periodEnd} />
                  </StepSection>
                )}
                {!isFinancialOnly && !viewByProduct && calc && calc.promoTracking.length > 0 && (
                  <StepSection step={10} title={t('create_session.promo_tracking')} color="purple" badge="C">
                    <PromoTrackingSummary items={calc.promoTracking} periodStart={periodStart} periodEnd={periodEnd} />
                  </StepSection>
                )}

                {/* ━━━ Step 10: Debt Collections Detail ━━━ */}
                <StepSection step={11} title={t('create_session.collected_debts_details')} color="orange" verified={verifications.debtCollections || (calc?.debtCollections?.total || 0) === 0} requiresVerification={(calc?.debtCollections?.total || 0) > 0}>
                  <DebtCollectionsSummary workerId={selectedWorkerId} periodStart={periodStart} periodEnd={periodEnd} completedAt={null} />
                  <VerifyButton verified={verifications.debtCollections} onClick={() => toggleVerify('debtCollections')} label="تحقق من الديون المحصلة" />
                </StepSection>


                {/* ━━━ Step 12: Exceptional Actions ━━━ */}
                <StepSection step={12} title={t('create_session.exceptional_actions')} color="amber">
                  <ExceptionalActionsSummary workerId={selectedWorkerId} periodStart={periodStart} periodEnd={periodEnd} />
                </StepSection>

                {/* ━━━ Pending Customer Approval Requests ━━━ */}
                <StepSection step={13} title="تفاصيل الطلبيات الجديدة" color="amber" verified={verifications.pendingOrders || pendingOrdersCount === 0} requiresVerification={pendingOrdersCount > 0}>
                  <PendingRequestsSummary workerId={selectedWorkerId} periodStart={periodStart} periodEnd={periodEnd} />
                  <VerifyButton verified={verifications.pendingOrders} onClick={() => toggleVerify('pendingOrders')} label="تحقق من الطلبيات الجديدة" />
                </StepSection>

                {/* ━━━ Step 13: Stock Discrepancies ━━━ */}
                {!isFinancialOnly && pendingDiscrepancies.length > 0 && (
                  <StepSection step={13} title={t('create_session.stock_discrepancies')} color="red">
                    <StockDiscrepancySection discrepancies={pendingDiscrepancies} />
                  </StepSection>
                )}
              </>
            )}


            {/* Notes */}
            <div className="space-y-2">
              <Label className="font-semibold">{t('common.notes')}</Label>
              <Textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} rows={2} className="rounded-lg" />
            </div>

          </SwipeStack>

        </div>

        {/* Sticky footer with action buttons */}
        <div className="border-t bg-background p-3 space-y-2 shrink-0">
          {!isEditMode && !isFrozen && !isFinancialOnly && selectedWorkerId && (
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription className="text-xs">
                {t('create_session.cannot_save_until_review')}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            {selectedWorkerId && !isFinancialOnly && (
              <Button
                variant="outline"
                className={`rounded-xl h-11 text-base font-bold text-white ${isFrozen ? 'bg-green-600 hover:bg-green-700 border-green-600' : 'bg-red-600 hover:bg-red-700 border-red-600'}`}
                onClick={isFrozen ? handleUnfreeze : handleFreeze}
                disabled={isUnfreezing}
              >
                {isUnfreezing && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                {isFrozen ? t('create_session.unfreeze') : t('create_session.freeze')}
              </Button>
            )}

            <Button
              className="flex-1 rounded-xl h-11 text-base font-bold"
              onClick={handleShowConfirmation}
              disabled={isSubmitting || createSession.isPending || updateSession.isPending || !selectedWorkerId || !calc || hasOutstandingCollections || (!verifications.newDebts && ((calc?.newDebts || 0) > 0 || (calc?.debtCollections?.total || 0) > 0)) || (!verifications.debtCollections && (calc?.debtCollections?.total || 0) > 0) || (!verifications.pendingOrders && pendingOrdersCount > 0)}
            >
              {isEditMode ? 'حفظ التعديلات' : t('accounting.save_session')}
            </Button>

          </div>
        </div>
      </DialogContent>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="max-w-lg max-h-[90vh] p-0 gap-0 overflow-hidden" dir={dir}>
          <DialogHeader className="p-4 pb-3 border-b bg-muted/30">
            <DialogTitle className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span>{t('create_session.handover_summary')}</span>
                {workerName && <span className="text-xs font-normal text-muted-foreground">{workerName}</span>}
              </div>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-12rem)] px-4 py-3 space-y-3">
            {calc && (
              <WorkerHandoverSummary
                workerId={selectedWorkerId}
                periodStart={periodStart}
                periodEnd={periodEnd}
                calc={calc}
                coinAmount={Number(coinAmount || 0)}
              />
            )}

            {/* Warning for unchecked document items */}
            {hasOutstandingCollections && (
              <div className="mt-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">
                  {t('create_session.unconfirmed_docs_warning')}
                </p>
              </div>
            )}
          </ScrollArea>
          <div className="p-4 border-t flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl h-11"
              onClick={() => setShowConfirmation(false)}
            >
              {t('create_session.back_to_review')}
            </Button>
            <Button
              className="flex-1 rounded-xl h-11 text-base font-bold"
              onClick={handleProceedToSave}
              disabled={isSubmitting || createSession.isPending || updateSession.isPending}
            >
              {(isSubmitting || createSession.isPending || updateSession.isPending) && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              {isEditMode || isFinancialOnly ? t('create_session.confirm_save') : t('create_session.continue_to_unload')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mandatory full truck unload — branch manager confirms before save */}
      <TruckUnloadDialog
        open={showUnloadDialog}
        onOpenChange={(v) => { if (!isSubmitting && !createSession.isPending) setShowUnloadDialog(v); }}
        onConfirm={async (notes) => {
          await handleSubmit(notes);
          setShowUnloadDialog(false);
        }}
        isPending={isSubmitting || createSession.isPending}
        workerId={selectedWorkerId}
        workerName={workerName}
      />
    </Dialog>
  );
};

// === Step Section Component ===
const stepColors: Record<string, string> = {
  primary: 'border-primary/30 text-primary bg-primary/10',
  blue: 'border-blue-300 dark:border-blue-800 text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  orange: 'border-orange-300 dark:border-orange-800 text-orange-600 bg-orange-50 dark:bg-orange-900/20',
  amber: 'border-amber-300 dark:border-amber-800 text-amber-600 bg-amber-50 dark:bg-amber-900/20',
  red: 'border-destructive/30 text-destructive bg-destructive/5',
  muted: 'border-border text-muted-foreground bg-muted/30',
  green: 'border-green-300 dark:border-green-800 text-green-600 bg-green-50 dark:bg-green-900/20',
};

const StepSection: React.FC<{
  step: number;
  title: string;
  color?: string;
  badge?: string;
  important?: boolean;
  forceOpen?: boolean;
  hideHeader?: boolean;
  defaultOpen?: boolean;
  verified?: boolean;
  requiresVerification?: boolean;
  children: React.ReactNode;
}> = ({ step, title, color = 'primary', badge, important, forceOpen, hideHeader, defaultOpen, verified, requiresVerification, children }) => {
  const colorClass = stepColors[color] || stepColors.primary;
  const [open, setOpen] = React.useState(!!defaultOpen);
  React.useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);
  const needsVerify = !!requiresVerification && !verified;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={hideHeader ? 'space-y-2.5' : `rounded-xl border-2 p-3.5 space-y-2.5 ${important ? 'border-primary bg-primary/5' : needsVerify ? 'border-destructive bg-destructive/5' : verified ? 'border-emerald-300 bg-emerald-50/40' : 'border-border'}`}>
      {!hideHeader && (
        <CollapsibleTrigger className="flex items-center gap-2.5 w-full text-right">
          <div className={`${badge ? 'w-auto px-1.5 min-w-[1.5rem]' : 'w-6'} h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${colorClass}`}>
            {badge ? `${step}-${badge}` : step}
          </div>
          <h3 className="font-bold text-sm flex-1 text-right flex items-center gap-2 justify-end">
            {verified ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded-full px-2 py-0.5">
                ✓ تم التحقق
              </span>
            ) : requiresVerification && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive bg-destructive/10 border border-destructive/30 rounded-full px-2 py-0.5 animate-pulse">
                ⚠ يتطلب التحقق
              </span>
            )}
            <span>{title}</span>
          </h3>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
      )}
      <CollapsibleContent className="space-y-2.5 data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

// === Helper Components ===

const SectionDivider: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-2">
    <div className="h-px flex-1 bg-border" />
    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
    <div className="h-px flex-1 bg-border" />
  </div>
);

const SectionDividerWithIcon: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div className="flex items-center gap-2.5 mb-3">
    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
      {icon}
    </div>
    <h3 className="font-bold text-sm">{label}</h3>
    <div className="h-px flex-1 bg-border" />
  </div>
);

const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: number;
  color?: string;
  highlight?: boolean;
  small?: boolean;
}> = ({ icon, title, value, color, highlight, small }) => (
  <div className={`border-2 rounded-xl p-3.5 ${highlight ? 'border-primary/30 bg-primary/5' : ''}`}>
    <div className="flex items-center gap-2">
      {icon}
      <span className={`font-semibold ${small ? 'text-xs' : 'text-sm'}`}>{title}</span>
    </div>
    <p className={`font-bold mt-1.5 ${small ? 'text-lg' : 'text-2xl'} ${
      color === 'green' ? 'text-green-600' : 
      color === 'red' ? 'text-destructive' : 
      color === 'orange' ? 'text-orange-600' : 
      color === 'purple' ? 'text-purple-600' :
      'text-primary'
    }`}>
      {fmt(value)} DA
    </p>
  </div>
);

const PaymentRow: React.FC<{ label: string; value: number; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={`flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg ${highlight ? 'bg-amber-50 dark:bg-amber-900/10 font-medium' : ''}`}>
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-bold ${value > 0 ? '' : 'text-muted-foreground/50'}`}>
      {fmt(value)} DA
    </span>
  </div>
);

const SummaryItem: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color }) => (
  <div className="text-center p-2 bg-background rounded-lg">
    <p className="text-muted-foreground text-[10px]">{label}</p>
    <p className={`font-bold text-sm ${
      color === 'green' ? 'text-green-600' :
      color === 'red' ? 'text-destructive' :
      color === 'orange' ? 'text-orange-600' :
      color === 'primary' ? 'text-primary' :
      ''
    }`}>
      {fmt(value)}
    </p>
  </div>
);

export default CreateSessionDialog;
