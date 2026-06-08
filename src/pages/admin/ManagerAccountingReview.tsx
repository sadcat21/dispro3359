import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calculator, User, Calendar, Banknote, TrendingUp, TrendingDown, AlertTriangle, Wallet, ChevronLeft, CheckCircle2, History, Clock, FileCheck, Printer, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUnreviewedSessions, useManagerReviewSessions, useConfirmManagerReview, useUndoManagerReview } from '@/hooks/useManagerReview';
import { useAllWorkersLiability } from '@/hooks/useWorkerLiability';
import { toast } from 'sonner';
import { boxesToBPAlways, dbBPToBoxes } from '@/utils/boxPieceInput';
import { inferPricingSubtype } from '@/utils/pricingSubtype';
import DateRangeFilter, { DateFilterType, getDateRangeFromFilter } from '@/components/stats/DateRangeFilter';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import ExpensesDetailsSummary from '@/components/accounting/ExpensesDetailsSummary';
import companyLogo from '@/assets/logo.png';
import SessionDetailsDialog from '@/components/accounting/SessionDetailsDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Receipt } from 'lucide-react';

export const fmt = (n: number) => n.toLocaleString();

export const calcTotals = (sessions: any[]) => {
  const result = {
    totalSales: 0, physicalCashExpected: 0, physicalCashActual: 0,
    newDebts: 0, debtCollectionsCash: 0, debtCollectionsCheck: 0,
    debtCollectionsReceipt: 0, debtCollectionsTransfer: 0, debtCollectionsTotal: 0,
    expenses: 0, invoice1EspaceCash: 0, invoice1VersementCash: 0,
    invoice1Check: 0, invoice1Receipt: 0, invoice1Transfer: 0,
    invoice2Cash: 0, coinAmount: 0, cashDifference: 0,
    surplus: 0, deficit: 0, workersCount: sessions.length,
  };
  for (const session of sessions) {
    const items = session.items || [];
    const get = (type: string, field: 'actual_amount' | 'expected_amount' = 'actual_amount') => {
      const item = items.find((i: any) => i.item_type === type);
      return item ? Number(item[field]) : 0;
    };
    result.totalSales += get('total_sales');
    result.physicalCashExpected += get('physical_cash', 'expected_amount');
    result.physicalCashActual += get('physical_cash');
    result.newDebts += get('new_debts');
    result.debtCollectionsCash += get('debt_collections_cash');
    result.debtCollectionsCheck += get('debt_collections_check');
    result.debtCollectionsReceipt += get('debt_collections_receipt');
    result.debtCollectionsTransfer += get('debt_collections_transfer');
    result.debtCollectionsTotal += get('debt_collections_total');
    result.expenses += get('expenses');
    result.invoice1EspaceCash += get('invoice1_espace_cash');
    result.invoice1VersementCash += get('invoice1_versement_cash');
    result.invoice1Check += get('invoice1_check');
    result.invoice1Receipt += get('invoice1_receipt');
    result.invoice1Transfer += get('invoice1_transfer');
    result.invoice2Cash += get('invoice2_cash');
    result.coinAmount += get('coin_amount');
    const cashExp = get('physical_cash', 'expected_amount');
    const cashAct = get('physical_cash');
    const diff = cashAct - cashExp;
    if (diff >= 0) result.surplus += diff;
    else result.deficit += Math.abs(diff);
  }
  result.cashDifference = result.physicalCashActual - result.physicalCashExpected;
  return result;
};

const ManagerAccountingReview: React.FC = () => {
  const navigate = useNavigate();
  const { workerId: managerId, activeBranch, user } = useAuth() as any;
  const [activeTab, setActiveTab] = useState('pending');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

  // Date/time filter for pending sessions
  const [selectedPeriod, setSelectedPeriod] = useState<DateFilterType>('all');
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();

  // Unreviewed sessions
  const { data: pendingSessions = [], isLoading: loadingPending } = useUnreviewedSessions();

  // Review history
  const { data: reviewHistory = [], isLoading: loadingHistory } = useManagerReviewSessions();

  // For review history detail: fetch sessions linked to a specific review
  const [selectedReview, setSelectedReview] = useState<string | null>(null);
  const { data: reviewDetailSessions = [] } = useQuery({
    queryKey: ['review-detail-sessions', selectedReview],
    queryFn: async () => {
      if (!selectedReview) return [];
      const { data, error } = await supabase
        .from('accounting_sessions')
        .select(`
          *,
          worker:workers!accounting_sessions_worker_id_fkey(id, full_name, username),
          items:accounting_session_items(*)
        `)
        .eq('review_session_id', selectedReview)
        .order('completed_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedReview,
  });

  const confirmMutation = useConfirmManagerReview();
  const undoMutation = useUndoManagerReview();
  const [undoTargetId, setUndoTargetId] = useState<string | null>(null);

  // Filter pending by date range (uses completed_at)
  const filteredPendingSessions = useMemo(() => {
    const { start, end } = getDateRangeFromFilter(selectedPeriod, customDateFrom, customDateTo);
    return pendingSessions.filter((s: any) => {
      const ts = s.completed_at || s.period_end || s.created_at;
      if (!ts) return false;
      const t = new Date(ts).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
  }, [pendingSessions, selectedPeriod, customDateFrom, customDateTo]);

  // Session selection (default: all filtered selected)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelectedIds(new Set(filteredPendingSessions.map((s: any) => s.id)));
  }, [filteredPendingSessions]);

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allSelected = filteredPendingSessions.length > 0 && filteredPendingSessions.every((s: any) => selectedIds.has(s.id));
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredPendingSessions.map((s: any) => s.id)));
  };

  const selectedSessions = useMemo(
    () => filteredPendingSessions.filter((s: any) => selectedIds.has(s.id)),
    [filteredPendingSessions, selectedIds]
  );
  const pendingTotals = useMemo(() => calcTotals(selectedSessions), [selectedSessions]);

  // Workers with activity that has not been accounted (no session in selected pending list)
  const { data: allLiabilities = [] } = useAllWorkersLiability();
  const uncoveredWorkers = useMemo(() => {
    const accountedIds = new Set<string>(
      filteredPendingSessions.map((s: any) => s.worker_id).filter(Boolean)
    );
    return (allLiabilities || []).filter(
      (l: any) => Math.abs(Number(l.totalLiability || 0)) > 0 && !accountedIds.has(l.workerId)
    );
  }, [allLiabilities, filteredPendingSessions]);

  const handleConfirmReview = () => {
    const sessionIds = Array.from(selectedIds);
    if (sessionIds.length === 0) {
      toast.error('لم يتم اختيار أي جلسة');
      return;
    }
    confirmMutation.mutate(
      { notes: reviewNotes || undefined, sessionIds },
      {
        onSuccess: (review: any) => {
          toast.success('تم تأكيد المراجعة وإدراج المبالغ في الخزينة');
          setShowConfirmDialog(false);
          setReviewNotes('');
          if (review?.id) navigate(`/manager-accounting-review/${review.id}`);
        },
        onError: () => toast.error('حدث خطأ أثناء تأكيد المراجعة'),
      }
    );
  };

  const displaySessions = selectedReview ? reviewDetailSessions : (activeTab === 'pending' ? selectedSessions : []);
  const displayTotals = useMemo(() => calcTotals(displaySessions), [displaySessions]);

  const handlePrint = async () => {
    if (typeof document === 'undefined') return;

    if (displaySessions.length === 0) {
      toast.error('لا توجد جلسات متاحة للطباعة');
      return;
    }

    const productMatrix = await fetchProductMatrix(displaySessions);

    const iframe = document.createElement('iframe');
    iframe.title = 'manager-review-print';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    document.body.appendChild(iframe);

    const frameWindow = iframe.contentWindow;
    const frameDocument = iframe.contentDocument || frameWindow?.document;
    if (!frameWindow || !frameDocument) {
      iframe.remove();
      toast.error('تعذر تجهيز صفحة الطباعة');
      return;
    }

    frameDocument.open();
    frameDocument.write(buildManagerReviewPrintHtml({
      totals: displayTotals,
      sessions: displaySessions,
      branchName: activeBranch?.name || '',
      accountantName: user?.full_name || user?.fullName || user?.username || '',
      productMatrix,
    }));
    frameDocument.close();

    const removeFrame = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    frameWindow.onafterprint = removeFrame;
    setTimeout(() => {
      frameWindow.focus();
      frameWindow.print();
      setTimeout(removeFrame, 3000);
    }, 250);
  };

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-emerald-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold leading-tight">مراجعة حسابات المدير</h2>
            {reviewHistory.length > 0 && (
              <>
                <Badge className="bg-red-600 text-white hover:bg-red-600 text-xs">
                  إجمالي النقد: {Number(reviewHistory.reduce((s: number, r: any) => s + Number(r.total_cash || 0), 0)).toLocaleString('fr-FR')} دج
                </Badge>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  title="طباعة الملخص"
                  onClick={() => {
                    const total = reviewHistory.reduce((s: number, r: any) => s + Number(r.total_cash || 0), 0);
                    const rows = reviewHistory.map((r: any, idx: number) => `
                      <tr>
                        <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center">#${reviewHistory.length - idx}</td>
                        <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center">${r.completed_at ? format(new Date(r.completed_at), 'yyyy-MM-dd HH:mm') : (r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd HH:mm') : '—')}</td>
                        <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center">${r.sessions_count || 0}</td>
                        <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;color:#047857;font-weight:700">${Number(r.total_cash || 0).toLocaleString('fr-FR')} دج</td>
                      </tr>`).join('');
                    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>ملخص مراجعة حسابات المدير</title>
                      <style>body{font-family:Arial,sans-serif;padding:20px;color:#0f172a}h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;color:#64748b;margin:0 0 16px;font-weight:500}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}th{background:#f1f5f9;padding:8px;border:1px solid #e2e8f0;text-align:center}.total{margin-top:16px;padding:10px;background:#fef2f2;border:2px solid #dc2626;border-radius:8px;text-align:center;font-size:14px;font-weight:800;color:#dc2626}@media print{.no-print{display:none}}</style>
                      </head><body>
                      <h1>ملخص مراجعة حسابات المدير</h1>
                      <h2>تاريخ الطباعة: ${format(new Date(), 'yyyy-MM-dd HH:mm')}</h2>
                      <table><thead><tr><th>المراجعة</th><th>تاريخ الإيداع</th><th>عدد الجلسات</th><th>إجمالي النقد</th></tr></thead><tbody>${rows}</tbody></table>
                      <div class="total">الإجمالي العام: ${Number(total).toLocaleString('fr-FR')} دج</div>
                      <script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script>
                      </body></html>`;
                    const iframe = document.createElement('iframe');
                    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
                    document.body.appendChild(iframe);
                    const w = iframe.contentWindow; const d = iframe.contentDocument || w?.document;
                    if (!w || !d) { iframe.remove(); return; }
                    d.open(); d.write(html); d.close();
                    w.onafterprint = () => iframe.remove();
                    setTimeout(() => { try { iframe.remove(); } catch {} }, 60000);
                  }}
                >
                  <Printer className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">مرحلة وسطى قبل إدراج المبالغ في الخزينة</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={selectedReview ? 'detail' : activeTab} onValueChange={(v) => { if (v !== 'detail') { setSelectedReview(null); setActiveTab(v); } }}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="pending" className="gap-1.5 text-xs">
            <Clock className="w-3.5 h-3.5" />
            معلّقة ({pendingSessions.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs">
            <History className="w-3.5 h-3.5" />
            سجل المراجعات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {loadingPending ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
            </div>
          ) : pendingSessions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30 text-green-500" />
                <p className="text-sm font-medium">لا توجد جلسات معلّقة للمراجعة</p>
                <p className="text-xs mt-1">تم مراجعة جميع الجلسات</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Date/time filter */}
              <Card>
                <CardContent className="p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> تصفية حسب التاريخ والوقت
                  </p>
                  <DateRangeFilter
                    selectedPeriod={selectedPeriod}
                    setSelectedPeriod={setSelectedPeriod}
                    customDateFrom={customDateFrom}
                    setCustomDateFrom={setCustomDateFrom}
                    customDateTo={customDateTo}
                    setCustomDateTo={setCustomDateTo}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {filteredPendingSessions.length} من أصل {pendingSessions.length} جلسة • محدد: {selectedIds.size}
                  </p>
                </CardContent>
              </Card>

              {filteredPendingSessions.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-10 text-center text-muted-foreground text-xs">
                    لا توجد جلسات تطابق الفلتر المختار
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Warning banner */}
                  <Card className="border-amber-300 bg-amber-50">
                    <CardContent className="p-3 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-xs text-amber-800">
                        <p className="font-bold">مبالغ معلّقة</p>
                        <p>اختر الجلسات المراد تأكيدها وإدراجها في الخزينة.</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Select all */}
                  <div className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                      {allSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                    </label>
                    <span className="text-[11px] text-muted-foreground">{selectedIds.size} / {filteredPendingSessions.length}</span>
                  </div>

                  <SessionsSummary totals={pendingTotals} sessions={selectedSessions} />

                  {/* Confirm button */}
                  <Button
                    onClick={() => setShowConfirmDialog(true)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    size="lg"
                    disabled={confirmMutation.isPending || selectedIds.size === 0}
                  >
                    {confirmMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileCheck className="w-4 h-4" />
                    )}
                    تأكيد المراجعة وإدراج في الخزينة ({selectedIds.size} جلسة)
                  </Button>

                  <Button onClick={handlePrint} variant="outline" className="w-full gap-2" size="lg" disabled={selectedSessions.length === 0}>
                    <Printer className="w-4 h-4" /> طباعة ملخص A4
                  </Button>

                  {/* Per-Worker Breakdown with selection */}
                  <WorkerBreakdown
                    sessions={filteredPendingSessions}
                    selectedIds={selectedIds}
                    onToggleSelected={toggleSelected}
                  />
                </>
              )}
            </>
          )}
        </TabsContent>


        {/* History Tab */}
        <TabsContent value="history" className="space-y-3 mt-4">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
            </div>
          ) : reviewHistory.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">لا توجد مراجعات سابقة</p>
              </CardContent>
            </Card>
          ) : (
            reviewHistory.map((review: any) => (
              <Card
                key={review.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => { navigate(`/manager-accounting-review/${review.id}`); }}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold">مراجعة #{reviewHistory.length - reviewHistory.indexOf(review)}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {review.sessions_count || 0} جلسة
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          تاريخ الإيداع: {review.completed_at ? format(new Date(review.completed_at), 'yyyy-MM-dd HH:mm') : format(new Date(review.created_at), 'yyyy-MM-dd HH:mm')}
                        </p>
                        {(review.period_earliest || review.period_latest) && (
                          <p className="text-[10px] text-muted-foreground">
                            فترة الجلسات: {review.period_earliest ? format(new Date(review.period_earliest), 'yyyy-MM-dd') : '—'}
                            {' → '}
                            {review.period_latest ? format(new Date(review.period_latest), 'yyyy-MM-dd') : '—'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700">
                        مكتملة
                      </Badge>
                      <p className="text-sm font-bold text-emerald-700 whitespace-nowrap">
                        {Number(review.total_cash || 0).toLocaleString('fr-FR')} دج
                      </p>
                      <p className="text-[9px] text-muted-foreground">إجمالي النقد</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 gap-1 mt-1"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const { data: sess, error } = await supabase
                              .from('accounting_sessions')
                              .select(`*, worker:workers!accounting_sessions_worker_id_fkey(id, full_name, username), items:accounting_session_items(*)`)
                              .eq('review_session_id', review.id)
                              .order('completed_at', { ascending: false });
                            if (error) throw error;
                            const sessions = sess || [];
                            if (sessions.length === 0) { toast.error('لا توجد جلسات للطباعة'); return; }
                            const totals = calcTotals(sessions);
                            const productMatrix = await fetchProductMatrix(sessions);
                            const iframe = document.createElement('iframe');
                            iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
                            document.body.appendChild(iframe);
                            const w = iframe.contentWindow; const d = iframe.contentDocument || w?.document;
                            if (!w || !d) { iframe.remove(); return; }
                            d.open();
                            d.write(buildManagerReviewPrintHtml({ totals, sessions, branchName: activeBranch?.name || '', accountantName: user?.full_name || user?.fullName || user?.username || '', productMatrix }));
                            d.close();
                            const remove = () => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); };
                            w.onafterprint = remove;
                            setTimeout(() => { w.focus(); w.print(); setTimeout(remove, 3000); }, 400);
                          } catch (err) {
                            console.error(err);
                            toast.error('فشلت الطباعة');
                          }
                        }}
                      >
                        <Printer className="w-3 h-3" /> طباعة A4
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                        disabled={undoMutation.isPending}
                        onClick={(e) => { e.stopPropagation(); setUndoTargetId(review.id); }}
                      >
                        {undoMutation.isPending && undoTargetId === review.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Undo2 className="w-3 h-3" />
                        )}
                        تراجع
                      </Button>
                    </div>
                  </div>
                  {review.notes && (
                    <p className="text-xs text-muted-foreground mt-2 bg-muted/30 rounded p-1.5">{review.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Detail view for a specific review */}
        <TabsContent value="detail" className="space-y-4 mt-4">
          <Button variant="outline" size="sm" onClick={() => setSelectedReview(null)} className="gap-1">
            <ChevronLeft className="w-3.5 h-3.5" />
            العودة لسجل المراجعات
          </Button>

          {reviewDetailSessions.length > 0 && (
            <>
              <SessionsSummary totals={displayTotals} sessions={reviewDetailSessions} />
              <Button onClick={handlePrint} variant="outline" className="w-full gap-2">
                <Printer className="w-4 h-4" /> طباعة ملخص A4
              </Button>
              <WorkerBreakdown sessions={reviewDetailSessions} />
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              تأكيد مراجعة حسابات المدير
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-800 font-semibold">
                  ⚠️ تنبيه: لا يمكن التراجع عن هذه العملية بعد التأكيد.
                </div>
                <p>
                  سيتم إدراج المبالغ من <strong>{selectedIds.size}</strong> جلسة في خزينة المدير بشكل نهائي.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {uncoveredWorkers.length > 0 && (
            <div className="border border-amber-300 bg-amber-50 rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                <AlertTriangle className="w-4 h-4" />
                عمّال لديهم نشاط لم تتم محاسبته ({uncoveredWorkers.length})
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {uncoveredWorkers.map((w: any) => (
                  <Badge key={w.workerId} variant="outline" className="border-amber-400 text-amber-800 bg-white text-[11px]">
                    👤 {w.workerName} — {fmt(Number(w.totalLiability || 0))}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Textarea
            placeholder="ملاحظات (اختياري)..."
            value={reviewNotes}
            onChange={e => setReviewNotes(e.target.value)}
            className="mt-2"
          />
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>خروج</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReview} className="bg-emerald-600 hover:bg-emerald-700">
              <FileCheck className="w-4 h-4 ml-2" />
              تأكيد نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Summary Component
export const SessionsSummary: React.FC<{ totals: any; sessions: any[] }> = ({ totals, sessions }) => {
  const totalCashReceived = totals.invoice1EspaceCash + totals.invoice1VersementCash + totals.invoice2Cash + totals.debtCollectionsCash - totals.expenses;
  const totalChecks = totals.invoice1Check + totals.debtCollectionsCheck;
  const totalReceipts = totals.invoice1Receipt + totals.debtCollectionsReceipt;
  const totalTransfers = totals.invoice1Transfer + totals.debtCollectionsTransfer;

  return (
    <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
      <CardContent className="p-4 space-y-4">
        <h3 className="font-bold text-sm text-emerald-800 flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          الملخص الإجمالي — {new Set(sessions.map((s: any) => s.worker?.id ?? s.worker_id).filter(Boolean)).size} عامل ({sessions.length} جلسة)
        </h3>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">💰 النقدية المستلمة</p>
          <div className="grid grid-cols-2 gap-2">
            <SummaryRow label="نقدية مبيعات (إسباس)" value={totals.invoice1EspaceCash} />
            <SummaryRow label="نقدية مبيعات (فرسمان)" value={totals.invoice1VersementCash} />
            <SummaryRow label="نقدية فاتورة 2" value={totals.invoice2Cash} />
            <SummaryRow label="نقدية تحصيل ديون" value={totals.debtCollectionsCash} />
          </div>
          <div className="bg-emerald-100 rounded-lg p-2 text-center">
            <p className="text-[10px] text-emerald-700 font-medium">إجمالي النقدية</p>
            <p className="text-lg font-bold text-emerald-800">{fmt(totalCashReceived)} د.ج</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">📄 الشيكات والتحويلات</p>
          <div className="grid grid-cols-3 gap-2">
            <SummaryRow label="شيكات" value={totalChecks} color="blue" />
            <SummaryRow label="وصولات بنكية" value={totalReceipts} color="purple" />
            <SummaryRow label="تحويلات" value={totalTransfers} color="cyan" />
          </div>
        </div>

        {/* قسم الديون — مستقل */}
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-semibold text-rose-700">📋 الديون</p>
          <div className="grid grid-cols-2 gap-2">
            <SummaryRow label="ديون جديدة" value={totals.newDebts} color="red" />
            <SummaryRow label="إجمالي تحصيل الديون" value={totals.debtCollectionsTotal} color="green" />
          </div>
        </div>

        {/* قسم منفصل: المصاريف والعملة والفروقات */}
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-semibold text-amber-700">💼 المصاريف والفروقات</p>
          <div className="grid grid-cols-2 gap-2">
            <SummaryRow label="مصاريف معتمدة" value={totals.expenses} color="orange" />
            <SummaryRow label="صرف عملة" value={totals.coinAmount} color="slate" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-green-700 flex items-center justify-center gap-1"><TrendingUp className="w-3 h-3" /> إجمالي الفائض</p>
              <p className="text-sm font-bold text-green-700">+{fmt(totals.surplus)}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-red-700 flex items-center justify-center gap-1"><TrendingDown className="w-3 h-3" /> إجمالي العجز</p>
              <p className="text-sm font-bold text-red-700">-{fmt(totals.deficit)}</p>
            </div>
          </div>
        </div>

        <div className={`rounded-lg p-3 text-center ${totals.cashDifference >= 0 ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
          <p className="text-xs font-medium flex items-center justify-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            صافي الفرق (فعلي - متوقع)
          </p>
          <p className={`text-xl font-bold ${totals.cashDifference >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {totals.cashDifference >= 0 ? '+' : ''}{fmt(totals.cashDifference)} د.ج
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

// Worker Breakdown Component
export const WorkerBreakdown: React.FC<{
  sessions: any[];
  selectedIds?: Set<string>;
  onToggleSelected?: (id: string) => void;
}> = ({ sessions, selectedIds, onToggleSelected }) => {
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const selectable = !!onToggleSelected;
  return (
  <div className="space-y-2">
    <h3 className="text-sm font-bold flex items-center gap-2">
      <User className="w-4 h-4 text-primary" />
      تفاصيل كل عامل
    </h3>
    {sessions.map((session: any) => {
      const items = session.items || [];
      const get = (type: string, field: 'actual_amount' | 'expected_amount' = 'actual_amount') => {
        const item = items.find((i: any) => i.item_type === type);
        return item ? Number(item[field]) : 0;
      };
      const cashExp = get('physical_cash', 'expected_amount');
      const cashAct = get('physical_cash');
      const expensesTotal = get('expenses');
      // Neutralize expenses' effect on expected cash so that an expense-only
      // session doesn't appear as a surplus (expected is already reduced by expenses).
      const diff = cashAct - (cashExp + expensesTotal);
      const isChecked = selectedIds?.has(session.id) ?? false;

      const dateStr = session.completed_at ? format(new Date(session.completed_at), 'yyyy-MM-dd') : '';
      const timeStr = session.completed_at ? format(new Date(session.completed_at), 'HH:mm') : '';

      return (
        <Card
          key={session.id}
          className={`rounded-xl border cursor-pointer hover:border-primary/60 hover:shadow-sm transition select-none ${selectable && isChecked ? 'border-emerald-400 bg-emerald-50/30 ring-2 ring-emerald-400' : ''}`}
          onClick={() => setSelectedSession(session)}
        >
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="font-bold text-sm">{session.worker?.full_name}</span>
              </div>
              <div className="flex items-center gap-2">
                {session.completed_at && (
                  <div className="flex flex-col items-end leading-tight">
                    <span className="text-[12px] font-bold text-black">{dateStr}</span>
                    <span className="text-[12px] font-bold text-red-600">{timeStr}</span>
                  </div>
                )}
                {selectable && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleSelected?.(session.id); }}
                    className={`h-8 px-3 rounded-lg text-[11px] font-bold border transition ${isChecked ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                  >
                    {isChecked ? 'إلغاء التحديد' : 'تحديد'}
                  </button>
                )}
              </div>
            </div>



            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <MiniBox label="المبيعات" value={get('total_sales')} />
              <MiniBox label="نقدية فعلية" value={cashAct} color="green" />
              <MiniBox label={diff >= 0 ? 'فائض' : 'عجز'} value={diff} color={diff >= 0 ? 'green' : 'red'} showSign />
              <MiniBox label="ديون جديدة" value={get('new_debts')} color="red" />
              <MiniBox label="تحصيل ديون" value={get('debt_collections_total')} color="orange" />
              <MiniBox label="مصاريف" value={expensesTotal} color="orange" />
              <MiniBox label="شيك" value={get('invoice1_check') + get('debt_collections_check')} color="blue" />
              <MiniBox label="فيرسمو" value={get('invoice1_receipt') + get('debt_collections_receipt')} color="blue" />
              <MiniBox label="فيرمو" value={get('invoice1_transfer') + get('debt_collections_transfer')} color="blue" />
            </div>
            {expensesTotal > 0 && session.worker?.id && session.period_start && session.period_end && (
              <Collapsible>
                <CollapsibleTrigger
                  onClick={(e) => e.stopPropagation()}
                  className="w-full flex items-center justify-between text-[11px] font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg px-2.5 py-1.5 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5" />
                    تفاصيل المصاريف ({fmt(expensesTotal)} د.ج)
                  </span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2" onClick={(e) => e.stopPropagation()}>
                  <ExpensesDetailsSummary
                    workerId={session.worker.id}
                    periodStart={session.period_start}
                    periodEnd={session.period_end}
                    completedAt={session.completed_at}
                  />
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </Card>
      );
    })}
    {selectedSession && (
      <SessionDetailsDialog
        open={!!selectedSession}
        onOpenChange={(o) => !o && setSelectedSession(null)}
        session={selectedSession}
      />
    )}
  </div>
  );
};

const SummaryRow: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color }) => {
  const bg = color === 'red' ? 'bg-red-50' : color === 'green' ? 'bg-green-50' : color === 'blue' ? 'bg-blue-50' : color === 'purple' ? 'bg-purple-50' : color === 'cyan' ? 'bg-cyan-50' : color === 'orange' ? 'bg-orange-50' : color === 'slate' ? 'bg-slate-50' : 'bg-muted/30';
  const text = color === 'red' ? 'text-red-700' : color === 'green' ? 'text-green-700' : color === 'blue' ? 'text-blue-700' : color === 'purple' ? 'text-purple-700' : color === 'cyan' ? 'text-cyan-700' : color === 'orange' ? 'text-orange-700' : color === 'slate' ? 'text-slate-700' : '';
  return (
    <div className={`${bg} rounded-lg p-2 text-center`}>
      <p className="text-[9px] text-muted-foreground truncate">{label}</p>
      <p className={`text-xs font-bold ${text}`}>{fmt(value)}</p>
    </div>
  );
};

const MiniBox: React.FC<{ label: string; value: number; color?: string; showSign?: boolean }> = ({ label, value, color, showSign }) => {
  const bg = color === 'green' ? 'bg-green-50' : color === 'red' ? 'bg-red-50' : color === 'orange' ? 'bg-orange-50' : color === 'blue' ? 'bg-blue-50' : 'bg-muted/30';
  const text = color === 'green' ? 'text-green-700' : color === 'red' ? 'text-red-700' : color === 'orange' ? 'text-orange-700' : color === 'blue' ? 'text-blue-700' : '';
  return (
    <div className={`${bg} rounded p-1.5`}>
      <p className="text-muted-foreground truncate">{label}</p>
      <p className={`text-[11px] font-bold ${text}`}>{showSign && value > 0 ? '+' : ''}{fmt(value)}</p>
    </div>
  );
};

export default ManagerAccountingReview;

// ============== A4 Print Summary ==============
const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const amount = (value: number | string) => typeof value === 'number' ? value.toLocaleString() : escapeHtml(value);

const WILAYA_FR: Record<string, string> = {
  'مستغانم': 'Mostaganem', 'وهران': 'Oran', 'الجزائر': 'Alger', 'قسنطينة': 'Constantine',
  'عنابة': 'Annaba', 'سطيف': 'Sétif', 'باتنة': 'Batna', 'بجاية': 'Béjaïa',
  'تلمسان': 'Tlemcen', 'تيارت': 'Tiaret', 'البليدة': 'Blida', 'سيدي بلعباس': 'Sidi Bel Abbès',
  'غليزان': 'Relizane', 'معسكر': 'Mascara', 'الشلف': 'Chlef', 'تيبازة': 'Tipaza',
  'بومرداس': 'Boumerdès', 'تيزي وزو': 'Tizi Ouzou', 'ورقلة': 'Ouargla',
};
const translateBranchToFr = (name: string) => {
  let out = (name || '').replace(/فرع/g, 'Dépôt de').trim();
  Object.entries(WILAYA_FR).forEach(([ar, fr]) => { out = out.replace(new RegExp(ar, 'g'), fr); });
  return out.replace(/\s+/g, ' ').trim();
};

export type ProductMatrix = {
  products: { id: string; name: string; piecesPerBox: number }[];
  rows: Record<string, Record<string, number>>;
  workers: { id: string; name: string }[];
  workerRows: Record<string, Record<string, number>>;
  workerMethodAmounts: Record<string, { invoice1: number; super_gros: number; gros: number; retail: number; remise: number }>;
  workerMethodProductQty: Record<string, { invoice1: Record<string, { paid: number; debt: number; paidAmt: number; debtAmt: number }>; super_gros: Record<string, { paid: number; debt: number; paidAmt: number; debtAmt: number }>; gros: Record<string, { paid: number; debt: number; paidAmt: number; debtAmt: number }>; retail: Record<string, { paid: number; debt: number; paidAmt: number; debtAmt: number }>; remise: Record<string, { paid: number; debt: number; paidAmt: number; debtAmt: number }> }>;
  workerOfferedQty: Record<string, Record<string, number>>;
  workerProductAmount: Record<string, Record<string, number>>;
};


export const fetchProductMatrix = async (sessions: any[]): Promise<ProductMatrix> => {
  const workerIds = Array.from(new Set(sessions.map((s: any) => s.worker_id ?? s.worker?.id).filter(Boolean)));
  const starts = sessions.map((s: any) => s.period_start).filter(Boolean);
  const ends = sessions.map((s: any) => s.period_end || s.completed_at).filter(Boolean);
  if (!workerIds.length || !starts.length || !ends.length) return { products: [], rows: {}, workers: [], workerRows: {}, workerMethodAmounts: {}, workerMethodProductQty: {}, workerOfferedQty: {}, workerProductAmount: {} };
  const from = new Date(Math.min(...starts.map((d: string) => new Date(d).getTime()))).toISOString();
  const to = new Date(Math.max(...ends.map((d: string) => new Date(d).getTime()))).toISOString();
  const { data: orders } = await supabase
    .from('orders')
    .select('id, payment_type, payment_status, invoice_payment_method, assigned_worker_id, created_at, order_items(product_id, quantity, unit_price, total_price, pricing_unit, gift_quantity, gift_pieces, price_subtype, products(id, name, app_name, pieces_per_box, weight_per_box, price_super_gros, price_gros, price_retail, price_invoice, price_no_invoice, pricing_unit))')
    .in('assigned_worker_id', workerIds)
    .eq('status', 'delivered')
    .gte('created_at', from)
    .lte('created_at', to);
  const productMap = new Map<string, { name: string; ppb: number }>();
  const workerMap = new Map<string, string>();
  sessions.forEach((s: any) => {
    const wid = s.worker_id ?? s.worker?.id;
    const wname = s.worker?.full_name || s.worker?.username || '—';
    if (wid) workerMap.set(wid, wname);
  });
  const rows: Record<string, Record<string, number>> = {
    sold: {}, offered: {}, invoice1: {}, super_gros: {}, gros: {}, retail: {}, remise: {}, amount: {},
  };
  const workerRows: Record<string, Record<string, number>> = {};
  const workerMethodAmounts: Record<string, { invoice1: number; super_gros: number; gros: number; retail: number; remise: number }> = {};
  const bump = (row: string, pid: string, n: number) => {
    if (!n) return;
    rows[row][pid] = (rows[row][pid] || 0) + n;
  };
  const bumpWorker = (wid: string, pid: string, n: number) => {
    if (!n) return;
    if (!workerRows[wid]) workerRows[wid] = {};
    workerRows[wid][pid] = (workerRows[wid][pid] || 0) + n;
  };
  const bumpWorkerMethod = (wid: string, method: 'invoice1' | 'super_gros' | 'gros' | 'retail' | 'remise', n: number) => {
    if (!n) return;
    if (!workerMethodAmounts[wid]) workerMethodAmounts[wid] = { invoice1: 0, super_gros: 0, gros: 0, retail: 0, remise: 0 };
    workerMethodAmounts[wid][method] += n;
  };
  const workerMethodProductQty: Record<string, { invoice1: Record<string, { paid: number; debt: number; paidAmt: number; debtAmt: number }>; super_gros: Record<string, { paid: number; debt: number; paidAmt: number; debtAmt: number }>; gros: Record<string, { paid: number; debt: number; paidAmt: number; debtAmt: number }>; retail: Record<string, { paid: number; debt: number; paidAmt: number; debtAmt: number }>; remise: Record<string, { paid: number; debt: number; paidAmt: number; debtAmt: number }> }> = {};
  const bumpWMP = (wid: string, method: 'invoice1' | 'super_gros' | 'gros' | 'retail' | 'remise', pid: string, n: number, amt: number, isPaid: boolean) => {
    if (!n) return;
    if (!workerMethodProductQty[wid]) workerMethodProductQty[wid] = { invoice1: {}, super_gros: {}, gros: {}, retail: {}, remise: {} };
    const bucket = workerMethodProductQty[wid][method][pid] || { paid: 0, debt: 0, paidAmt: 0, debtAmt: 0 };
    if (isPaid) { bucket.paid += n; bucket.paidAmt += amt; } else { bucket.debt += n; bucket.debtAmt += amt; }
    workerMethodProductQty[wid][method][pid] = bucket;
  };
  const workerOfferedQty: Record<string, Record<string, number>> = {};
  const bumpWorkerOffered = (wid: string, pid: string, n: number) => {
    if (!n) return;
    if (!workerOfferedQty[wid]) workerOfferedQty[wid] = {};
    workerOfferedQty[wid][pid] = (workerOfferedQty[wid][pid] || 0) + n;
  };
  const workerProductAmount: Record<string, Record<string, number>> = {};
  const bumpWorkerAmount = (wid: string, pid: string, n: number) => {
    if (!n) return;
    if (!workerProductAmount[wid]) workerProductAmount[wid] = {};
    workerProductAmount[wid][pid] = (workerProductAmount[wid][pid] || 0) + n;
  };




  const workerWindows = new Map<string, Array<[number, number]>>();
  sessions.forEach((s: any) => {
    const wid = s.worker_id ?? s.worker?.id;
    const ps = s.period_start ? new Date(s.period_start).getTime() : null;
    const pe = (s.period_end || s.completed_at) ? new Date(s.period_end || s.completed_at).getTime() : null;
    if (!wid || ps == null || pe == null) return;
    const arr = workerWindows.get(wid) || [];
    arr.push([ps, pe]);
    workerWindows.set(wid, arr);
  });
  (orders || []).forEach((o: any) => {
    const wins = workerWindows.get(o.assigned_worker_id);
    if (!wins) return;
    const t = new Date(o.created_at).getTime();
    if (!wins.some(([s, e]) => t >= s && t <= e)) return;
    const isInvoice1 = o.payment_type === 'with_invoice';
    const isPaid = (o.payment_status || '').toLowerCase() !== 'pending';
    (o.order_items || []).forEach((it: any) => {
      if (!it.product_id) return;
      const p = it.products || {};
      const ppb = Math.max(1, Number(p.pieces_per_box || 1));
      productMap.set(it.product_id, { name: p.app_name || p.name || '—', ppb });
      // Quantity is stored as boxes (B.P decimal for 'box', raw boxes for 'unit'/'piece',
      // raw kg for 'kg'). Verified against DB: unit_price equals the per-box price for
      // pricing_unit='unit' products (e.g. AROMA 400/700 Gr), so quantity is boxes, not pieces.
      const itemPU = (it.pricing_unit || p.pricing_unit || 'box').toString().toLowerCase();
      const isKgSale = itemPU === 'kg';
      const toBoxes = (raw: number) => {
        if (isKgSale) return raw;
        return dbBPToBoxes(raw, ppb);
      };
      const qty = toBoxes(Number(it.quantity || 0));
      const giftBoxes = toBoxes(Number(it.gift_quantity || 0));
      const giftPiecesAsBoxes = Number(it.gift_pieces || 0) / ppb;
      const gift = giftBoxes + giftPiecesAsBoxes;
      const sub = (it.price_subtype || '').toLowerCase();
      // Use stored total_price when available (already accounts for pricing_unit box/piece).
      // Fallback: derive from unit_price * (qty in boxes or pieces depending on pricing_unit).
      let lineAmount = Number(it.total_price || 0);
      if (!lineAmount) {
        const unitPrice = Number(it.unit_price || 0);
        const itemPricingUnit = (it.pricing_unit || p.pricing_unit || 'box').toString().toLowerCase();
        if (unitPrice > 0) {
          lineAmount = itemPricingUnit === 'unit' || itemPricingUnit === 'piece'
            ? unitPrice * (qty * ppb)
            : unitPrice * qty;
        } else {
          let boxPrice = 0;
          if (sub.includes('super')) boxPrice = Number(p.price_super_gros || 0);
          else if (sub.includes('gros')) boxPrice = Number(p.price_gros || 0);
          else if (sub.includes('retail') || sub.includes('detail')) boxPrice = Number(p.price_retail || 0);
          else if (isInvoice1) boxPrice = Number(p.price_invoice || 0);
          else boxPrice = Number(p.price_no_invoice || p.price_retail || 0);
          lineAmount = boxPrice * qty;
        }
      }
      bump('sold', it.product_id, qty);
      bump('offered', it.product_id, gift);
      bump('amount', it.product_id, lineAmount);
      bumpWorker(o.assigned_worker_id, it.product_id, qty);
      bumpWorkerOffered(o.assigned_worker_id, it.product_id, gift);
      bumpWorkerAmount(o.assigned_worker_id, it.product_id, lineAmount);
      // Resolve effective method: prefer explicit subtype, otherwise infer from unit price vs catalog
      const explicitSub = (it.price_subtype || '').toString().toLowerCase();
      const resolvedSubtype = isInvoice1
        ? 'invoice'
        : inferPricingSubtype({
            itemPaymentType: o.payment_type,
            unitPrice: Number(it.unit_price || 0),
            explicitSubtype: it.price_subtype,
            product: p,
            pricingUnit: it.pricing_unit,
            piecesPerBox: p.pieces_per_box,
          });
      // Detect Remise: explicit subtype OR effective box unit price below catalog retail price
      const boxUnitPrice = (() => {
        const up = Number(it.unit_price || 0);
        if (!up) return 0;
        if (itemPU === 'unit' || itemPU === 'piece') return up * ppb;
        if (itemPU === 'kg') return up * Math.max(1, Number(p.weight_per_box || 1));
        return up;
      })();
      const retailRef = Number(p.price_retail || 0);
      const isRemise = !isInvoice1 && (explicitSub === 'remise' || (retailRef > 0 && boxUnitPrice > 0 && boxUnitPrice < retailRef * 0.95));
      if (isRemise) {
        bump('remise', it.product_id, qty);
        bumpWorkerMethod(o.assigned_worker_id, 'remise', lineAmount);
        bumpWMP(o.assigned_worker_id, 'remise', it.product_id, qty, lineAmount, isPaid);
      } else if (resolvedSubtype === 'invoice') {
        bump('invoice1', it.product_id, qty);
        bumpWorkerMethod(o.assigned_worker_id, 'invoice1', lineAmount);
        bumpWMP(o.assigned_worker_id, 'invoice1', it.product_id, qty, lineAmount, isPaid);
      } else if (resolvedSubtype === 'super_gros') {
        bump('super_gros', it.product_id, qty);
        bumpWorkerMethod(o.assigned_worker_id, 'super_gros', lineAmount);
        bumpWMP(o.assigned_worker_id, 'super_gros', it.product_id, qty, lineAmount, isPaid);
      } else if (resolvedSubtype === 'gros') {
        bump('gros', it.product_id, qty);
        bumpWorkerMethod(o.assigned_worker_id, 'gros', lineAmount);
        bumpWMP(o.assigned_worker_id, 'gros', it.product_id, qty, lineAmount, isPaid);
      } else {
        bump('retail', it.product_id, qty);
        bumpWorkerMethod(o.assigned_worker_id, 'retail', lineAmount);
        bumpWMP(o.assigned_worker_id, 'retail', it.product_id, qty, lineAmount, isPaid);
      }
    });
  });
  const products = Array.from(productMap.entries()).map(([id, v]) => ({ id, name: v.name, piecesPerBox: v.ppb }));
  const workers = Array.from(workerMap.entries())
    .filter(([id]) => workerRows[id])
    .map(([id, name]) => ({ id, name }));
  return { products, rows, workers, workerRows, workerMethodAmounts, workerMethodProductQty, workerOfferedQty, workerProductAmount };



};

export const buildManagerReviewPrintHtml = ({ totals, sessions, branchName, qrDataUrl, qrUrl, accountantName, productMatrix }: { totals: any; sessions: any[]; branchName: string; qrDataUrl?: string; qrUrl?: string; accountantName?: string; productMatrix?: ProductMatrix }) => {
  const totalCash = totals.invoice1EspaceCash + totals.invoice1VersementCash + totals.invoice2Cash + totals.debtCollectionsCash;
  const totalChecks = totals.invoice1Check + totals.debtCollectionsCheck;
  const totalReceipts = totals.invoice1Receipt + totals.debtCollectionsReceipt;
  const totalTransfers = totals.invoice1Transfer + totals.debtCollectionsTransfer;
  const today = format(new Date(), 'yyyy-MM-dd HH:mm');
  const sessionDates = sessions.map((s: any) => s.completed_at).filter(Boolean).map((d: string) => new Date(d).getTime());
  const periodFrom = sessionDates.length ? format(new Date(Math.min(...sessionDates)), 'yyyy-MM-dd HH:mm') : '—';
  const periodTo = sessionDates.length ? format(new Date(Math.max(...sessionDates)), 'yyyy-MM-dd HH:mm') : '—';
  const row = (label: string, value: number | string, color = '#0f172a') => `
    <div class="row">
      <span>${escapeHtml(label)}</span>
      <strong style="color:${color}">${amount(value)}</strong>
    </div>`;
  const section = (title: string, color: string) => `<div class="section" style="background:${color}">${escapeHtml(title)}</div>`;
  const workerRows = sessions.map((session: any) => {
    const items = session.items || [];
    const get = (type: string, field: 'actual_amount' | 'expected_amount' = 'actual_amount') => {
      const item = items.find((i: any) => i.item_type === type);
      return item ? Number(item[field]) : 0;
    };
    const diff = get('physical_cash') - get('physical_cash', 'expected_amount');
    const sessionTotal = get('total_sales') + get('debt_collections_total') - get('expenses') - get('new_debts') + diff;
    const documents = get('invoice1_check') + get('invoice1_receipt') + get('invoice1_transfer');
    const ventesCash = get('total_sales') - documents;
    const ts = session.completed_at ? new Date(session.completed_at) : null;
    const workerName = escapeHtml(session.worker?.full_name || session.worker?.username || '—');
    const vendeurCell = ts
      ? `<div style="font-weight:700;color:#0f172a;line-height:1.2">${workerName}</div><div style="color:#64748b;font-size:8px;margin-top:1px">${format(ts, 'yyyy-MM-dd HH:mm')}</div>`
      : workerName;
    const recuReel = get('physical_cash');
    return `
      <tr>
        <td style="text-align:left;padding-left:8px">${vendeurCell}</td>
        <td>${get('total_sales').toLocaleString()}</td>
        <td>${get('expenses').toLocaleString()}</td>
        <td>${get('new_debts').toLocaleString()}</td>
        <td style="color:#1d4ed8">${documents.toLocaleString()}</td>
        <td style="font-weight:700;color:#059669">${ventesCash.toLocaleString()}</td>
        <td>${get('debt_collections_total').toLocaleString()}</td>
        <td>${get('physical_cash', 'expected_amount').toLocaleString()}</td>
        <td style="font-weight:700;color:#7c3aed">${recuReel.toLocaleString()}</td>
        <td style="color:${diff >= 0 ? '#15803d' : '#b91c1c'};font-weight:800">${diff >= 0 ? '+' : ''}${diff.toLocaleString()}</td>
        <td style="font-weight:800;color:#0369a1">${sessionTotal.toLocaleString()}</td>
      </tr>`;
  }).join('');

  const sumField = (type: string, field: 'actual_amount' | 'expected_amount' = 'actual_amount') =>
    sessions.reduce((acc: number, s: any) => {
      const it = (s.items || []).find((i: any) => i.item_type === type);
      return acc + (it ? Number(it[field]) : 0);
    }, 0);
  const tSales = sumField('total_sales');
  const tCash = sumField('physical_cash');
  const tDiff = tCash - sumField('physical_cash', 'expected_amount');
  const tNewDebts = sumField('new_debts');
  const tRecov = sumField('debt_collections_total');
  const tExp = sumField('expenses');
  const tDocs = sumField('invoice1_check') + sumField('invoice1_receipt') + sumField('invoice1_transfer');
  const tVentesCash = tSales - tDocs;
  const tTotal = tSales + tRecov - tExp - tNewDebts + tDiff;
  const totalRow = `
    <tr class="total-row" style="background:#fef2f2;font-weight:900;color:#000">
      <td style="text-align:right;padding-right:8px;color:#dc2626">TOTAL</td>
      <td>${tSales.toLocaleString()}</td>
      <td>${tExp.toLocaleString()}</td>
      <td>${tNewDebts.toLocaleString()}</td>
      <td style="color:#1d4ed8">${tDocs.toLocaleString()}</td>
      <td style="color:#059669">${tVentesCash.toLocaleString()}</td>
      <td>${tRecov.toLocaleString()}</td>
      <td>${sumField('physical_cash', 'expected_amount').toLocaleString()}</td>
      <td style="color:#7c3aed">${tCash.toLocaleString()}</td>
      <td style="color:${tDiff >= 0 ? '#15803d' : '#b91c1c'}">${tDiff >= 0 ? '+' : ''}${tDiff.toLocaleString()}</td>
      <td style="color:#0369a1">${tTotal.toLocaleString()}</td>
    </tr>`;

  const twoCol = (left: string, right: string) => `<div class="two-col">${left}${right}</div>`;
  const block = (title: string, color: string, rowsHtml: string) => `
    <div class="block">
      <div class="block-title" style="background:${color}">${escapeHtml(title)}</div>
      <div class="block-body">${rowsHtml}</div>
    </div>`;

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Rapport — ${escapeHtml((periodTo || periodFrom || today).slice(0, 10))} ${escapeHtml(translateBranchToFr(branchName) || '')}</title>
  <style>
    @page { size: A4 portrait; margin: 5mm 2mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #0f172a; font-family: 'Helvetica Neue', Arial, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    tr.worker-name-row td, tr.worker-name-row td:nth-child(2) { background: #dbeafe !important; color: #000 !important; text-align: center !important; font-weight: 800 !important; }
    body { width: 206mm; min-height: 287mm; }
    .sheet { width: 100%; padding: 0; }
    .header { border-bottom: 3px double #0f172a; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .title { font-size: 18px; font-weight: 800; letter-spacing: 0.3px; }
    .subtitle { font-size: 10px; color: #000; margin-top: 6px; line-height: 1.8; }
    .meta { font-size: 10px; color: #000; text-align: right; line-height: 1.5; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
    .kpi { border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px; text-align: center; background: linear-gradient(180deg,#f8fafc,#fff); }
    .kpi span { display: block; font-size: 9px; color: #000; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi strong { display: block; font-size: 14px; margin-top: 3px; font-weight: 800; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
    .block { border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; margin-top: 6px; page-break-inside: avoid; }
    .block-title { color: #dc2626 !important; background: #fef2f2 !important; padding: 5px 10px; font-size: 11px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; }
    .block-body { padding: 2px 0; }
    .row { display: flex; justify-content: space-between; gap: 10px; padding: 4px 10px; border-bottom: 1px solid #f1f5f9; font-size: 10px; }
    .row:last-child { border-bottom: none; }
    .row span { color: #000; }
    .row strong { font-variant-numeric: tabular-nums; color: #000; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 9px; }
    thead th { background: #fff; color: #000; font-weight: 900; padding: 5px 2px; text-transform: uppercase; letter-spacing: 0.2px; font-size: 8px; border: 1px solid #e2e8f0; white-space: normal; word-break: break-word; overflow-wrap: anywhere; line-height: 1.15; vertical-align: middle; }
    td { border: 1px solid #e2e8f0; padding: 4px; text-align: center; font-variant-numeric: tabular-nums; color: #000; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    td:nth-child(2) { text-align: left; font-weight: 700; color: #0f172a; }
    th:last-child, td:last-child { white-space: nowrap; padding-left: 6px; padding-right: 6px; }
    .signatures { margin-top: 14px; display: flex; justify-content: space-between; gap: 30px; font-size: 10px; color: #000; }
    .sign { flex: 1; border-top: 1px solid #0f172a; padding-top: 4px; text-align: center; }
  </style>
</head>
<body>
  <main class="sheet">
    <header class="header">
      <div style="width:90px;display:flex;align-items:center;justify-content:flex-start">
        ${qrDataUrl ? `<div style="border:2px solid #0f172a;padding:4px;border-radius:4px;background:#fff"><img src="${qrDataUrl}" alt="QR" style="width:64px;height:64px;display:block" /></div>` : ''}
      </div>
      <div style="flex:1;text-align:center">
        <div class="title" dir="ltr" style="text-align:center">Rapport Comptable — ${escapeHtml((periodTo || periodFrom || today).slice(0, 10))}</div>
        <div class="subtitle" dir="ltr" style="text-align:center"><b>Dépôt :</b> ${escapeHtml(translateBranchToFr(branchName) || '—')} &nbsp; <b>Comptable :</b> ${escapeHtml(accountantName || '—')} &nbsp;|&nbsp; <b>Période :</b> <span dir="ltr" style="unicode-bidi:isolate">${escapeHtml(periodFrom)} &rarr; ${escapeHtml(periodTo)}</span></div>
      </div>
      <div style="width:90px;display:flex;align-items:center;justify-content:flex-end"><img src="${companyLogo}" alt="Logo" style="max-width:80px;max-height:70px;object-fit:contain" /></div>
    </header>

    <section class="kpis">
      <div class="kpi"><span>Total Ventes</span><strong style="color:#0369a1">${totals.totalSales.toLocaleString()}</strong></div>
      <div class="kpi"><span>Espèces Réelles</span><strong style="color:#15803d">${totals.physicalCashActual.toLocaleString()}</strong></div>
      <div class="kpi"><span>Espèces Attendues</span><strong style="color:#475569">${totals.physicalCashExpected.toLocaleString()}</strong></div>
      <div class="kpi"><span>Écart Net</span><strong style="color:${totals.cashDifference >= 0 ? '#15803d' : '#b91c1c'}">${totals.cashDifference >= 0 ? '+' : ''}${totals.cashDifference.toLocaleString()}</strong></div>
    </section>

    ${twoCol(
      block('Espèces Encaissées', '#059669',
        row('Ventes espèces (Espace)', totals.invoice1EspaceCash) +
        row('Ventes espèces (Versement)', totals.invoice1VersementCash) +
        row('Espèces facture 2', totals.invoice2Cash) +
        row('Espèces recouvrement dettes', totals.debtCollectionsCash) +
        row('Total Espèces', totalCash, '#059669')
      ),
      block('Chèques & Virements', '#2563eb',
        row('Chèques', totalChecks, '#1d4ed8') +
        row('Reçus bancaires', totalReceipts, '#7e22ce') +
        row('Virements', totalTransfers, '#0e7490')
      )
    )}

    ${twoCol(
      block('Dettes', '#e11d48',
        row('Nouvelles dettes', totals.newDebts, '#b91c1c') +
        row('Total recouvrement dettes', totals.debtCollectionsTotal, '#15803d')
      ),
      block('Dépenses & Écarts', '#d97706',
        row('Dépenses approuvées', totals.expenses, '#c2410c') +
        row('Change de monnaie', totals.coinAmount) +
        row('Total Surplus', `+${totals.surplus.toLocaleString()}`, '#15803d') +
        row('Total Déficit', `-${totals.deficit.toLocaleString()}`, '#b91c1c')
      )
    )}

    <div class="block">
      <div class="block-title" style="background:#0f172a">Détails par Vendeur</div>
      <table>
        <thead>
          <tr>
            <th style="text-align:left;padding-left:8px">Vendeur</th>
            <th>Ventes</th>
            <th>Dépenses</th>
            <th>Dettes</th>
            <th>Docs (Chèq.+Vir.)</th>
            <th>Ventes Cash</th>
            <th>Recouvrement</th>
            <th>Espèces</th>
            <th>Reçu Réel</th>
            <th>Écart</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>${workerRows}${totalRow}</tbody>
      </table>
    </div>

    

    ${(() => {
      if (!productMatrix || !productMatrix.workers?.length || !productMatrix.products.length) return '';
      const methods: Array<['invoice1' | 'super_gros' | 'gros' | 'retail' | 'remise', string]> = [
        ['invoice1', 'Facture 1'],
        ['super_gros', 'Super Gros'],
        ['gros', 'Gros'],
        ['retail', 'Détail'],
        ['remise', 'Remise'],
      ];
      const products = productMatrix.products;
      // Columns: Produit | (Méthode Payé | Méthode Crédit) x4 | PROMO | TOTAL
      const totalCols = 1 + methods.length * 2 + 2;
      const pctProduct = 18;
      const pctOther = (100 - pctProduct) / (totalCols - 1);
      const colgroup = `<colgroup><col style="width:${pctProduct}%" />${Array.from({ length: totalCols - 1 }).map(() => `<col style="width:${pctOther}%" />`).join('')}</colgroup>`;
      const subHeaderColor = (c: string) => `style="background:#f8fafc;color:${c};font-weight:800;font-size:8px"`;
      const head = `
        <tr>
          <th rowspan="2" style="text-align:left;padding-left:8px;vertical-align:middle">Produit</th>
          ${methods.map(([, label]) => `<th colspan="2" style="background:#f1f5f9">${escapeHtml(label)}</th>`).join('')}
          <th rowspan="2" style="vertical-align:middle;color:#b91c1c">PROMO</th>
          <th rowspan="2" style="vertical-align:middle;color:#dc2626">TOTAL</th>
        </tr>
        <tr>
          ${methods.map(() => `<th ${subHeaderColor('#047857')}>Payé</th><th ${subHeaderColor('#dc2626')}>Crédit</th>`).join('')}
        </tr>`;

      const renderBlock = (
        getCell: (k: string, pid: string) => { paid: number; debt: number; paidAmt: number; debtAmt: number },
        getOffered: (pid: string) => number,
      ) => {
        const totals: Record<string, { paidAmt: number; debtAmt: number }> = { invoice1: { paidAmt: 0, debtAmt: 0 }, super_gros: { paidAmt: 0, debtAmt: 0 }, gros: { paidAmt: 0, debtAmt: 0 }, retail: { paidAmt: 0, debtAmt: 0 }, remise: { paidAmt: 0, debtAmt: 0 } };
        let totOffered = 0;
        let grandQty = 0;
        const rowsHtml = products.map(p => {
          const cells = methods.map(([k]) => {
            const c = getCell(k, p.id);
            return { paid: Number(c.paid || 0), debt: Number(c.debt || 0), paidAmt: Number(c.paidAmt || 0), debtAmt: Number(c.debtAmt || 0) };
          });
          const offered = Number(getOffered(p.id) || 0);
          const rowQty = cells.reduce((a, c) => a + c.paid + c.debt, 0);
          if (rowQty + offered <= 0) return '';
          cells.forEach((c, i) => { totals[methods[i][0]].paidAmt += c.paidAmt; totals[methods[i][0]].debtAmt += c.debtAmt; });
          totOffered += offered;
          grandQty += rowQty;
          const ppb = p.piecesPerBox;
          const fmt = (v: number) => v ? boxesToBPAlways(v, ppb) : '0';
          const tds = cells.map(c => `<td style="color:#047857">${fmt(c.paid)}</td><td style="color:#dc2626">${fmt(c.debt)}</td>`).join('');
          return `<tr>
            <td style="text-align:left;padding-left:8px;font-weight:700;color:#0f172a">${escapeHtml(p.name)}</td>
            ${tds}
            <td style="color:#dc2626">${fmt(offered)}</td>
            <td style="font-weight:800;color:#0369a1">${fmt(rowQty)}</td>
          </tr>`;
        }).join('');
        const fmtDA = (v: number) => v ? Math.round(v).toLocaleString() : '0';
        const grandAmt = methods.reduce((a, [k]) => a + totals[k].paidAmt + totals[k].debtAmt, 0);
        const totalTds = methods.map(([k]) => `<td style="color:#047857;font-weight:800;background:#ecfdf5">${fmtDA(totals[k].paidAmt)}</td><td style="color:#dc2626;font-weight:800;background:#fef2f2">${fmtDA(totals[k].debtAmt)}</td>`).join('');
        const totalRow = `<tr>
          <td style="text-align:left;padding-left:8px;font-weight:900;color:#0f172a;background:#f1f5f9;text-transform:uppercase">Total (DA)</td>
          ${totalTds}
          <td style="background:#f1f5f9">—</td>
          <td style="color:#0369a1;font-weight:900;background:#e0f2fe">${fmtDA(grandAmt)}</td>
        </tr>`;
        return rowsHtml + totalRow;
      };

      // Per-worker blocks
      const blocks = productMatrix.workers.map(w => {
        const mQty = productMatrix.workerMethodProductQty?.[w.id] || { invoice1: {}, super_gros: {}, gros: {}, retail: {}, remise: {} } as any;
        const offered = productMatrix.workerOfferedQty?.[w.id] || {};
        const wAmt = productMatrix.workerProductAmount?.[w.id] || {};
        const workerTotalAmount = products.reduce((a, p) => a + Number(wAmt[p.id] || 0), 0);
        const headerRow = `<tr class="worker-name-row"><td colspan="${totalCols}" style="background:#000 !important;color:#fff !important;text-align:center;padding:6px 8px;font-weight:800;text-transform:uppercase;font-size:11px;letter-spacing:0.5px;-webkit-print-color-adjust:exact;print-color-adjust:exact">${escapeHtml(w.name)}</td></tr>`;
        const body = renderBlock(
          (k, pid) => mQty[k as 'invoice1']?.[pid] || { paid: 0, debt: 0, paidAmt: 0, debtAmt: 0 },
          (pid) => Number((offered as any)[pid] || 0),
        );
        return headerRow + body;
      }).join('');

      // Aggregate totals across all workers
      const aggMQty: Record<string, Record<string, { paid: number; debt: number; paidAmt: number; debtAmt: number }>> = { invoice1: {}, super_gros: {}, gros: {}, retail: {}, remise: {} };
      const aggOffered: Record<string, number> = {};
      productMatrix.workers.forEach(w => {
        const mQty = productMatrix.workerMethodProductQty?.[w.id] || { invoice1: {}, super_gros: {}, gros: {}, retail: {}, remise: {} } as any;
        const off = productMatrix.workerOfferedQty?.[w.id] || {};
        methods.forEach(([k]) => {
          products.forEach(p => {
            const cur = aggMQty[k][p.id] || { paid: 0, debt: 0, paidAmt: 0, debtAmt: 0 };
            const src = mQty[k as 'invoice1']?.[p.id] || { paid: 0, debt: 0, paidAmt: 0, debtAmt: 0 };
            aggMQty[k][p.id] = {
              paid: cur.paid + Number(src.paid || 0),
              debt: cur.debt + Number(src.debt || 0),
              paidAmt: cur.paidAmt + Number(src.paidAmt || 0),
              debtAmt: cur.debtAmt + Number(src.debtAmt || 0),
            };
          });
        });
        products.forEach(p => {
          aggOffered[p.id] = (aggOffered[p.id] || 0) + Number((off as any)[p.id] || 0);
        });
      });
      const gHeader = `<tr><td colspan="${totalCols}" style="background:#bbf7d0 !important;color:#000 !important;text-align:center;padding:4px 8px;font-weight:800;text-transform:uppercase;font-size:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact">Total Général (Tous les Vendeurs)</td></tr>`;
      const gBody = renderBlock(
        (k, pid) => aggMQty[k]?.[pid] || { paid: 0, debt: 0, paidAmt: 0, debtAmt: 0 },
        (pid) => Number(aggOffered[pid] || 0),
      );
      const grandBlock = gHeader + gBody;


      return `<div class="block">
        <div class="block-title" style="background:#dcfce7">Total Général (Tous les Vendeurs)</div>
        <table style="table-layout:fixed;width:100%">${colgroup}<thead>${head}</thead><tbody>${grandBlock}</tbody></table>
      </div>
      <div class="block">
        <div class="block-title" style="background:#fef2f2">Ventes par Vendeur et Méthode</div>
        <table style="table-layout:fixed;width:100%">${colgroup}<thead>${head}</thead><tbody>${blocks}</tbody></table>
      </div>`;
    })()}




    <footer class="signatures">
      <div class="sign">Signature du Comptable</div>
      <div class="sign">Signature du Gérant</div>
    </footer>

  </main>
</body>
</html>`;
};
