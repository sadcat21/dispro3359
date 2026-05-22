import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calculator, User, Calendar, Banknote, TrendingUp, TrendingDown, AlertTriangle, Wallet, ChevronLeft, CheckCircle2, History, Clock, FileCheck, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUnreviewedSessions, useManagerReviewSessions, useConfirmManagerReview } from '@/hooks/useManagerReview';
import { toast } from 'sonner';
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
  const { workerId: managerId, activeBranch } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

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

  const pendingTotals = useMemo(() => calcTotals(pendingSessions), [pendingSessions]);

  const handleConfirmReview = () => {
    const sessionIds = pendingSessions.map((s: any) => s.id);
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

  const displaySessions = selectedReview ? reviewDetailSessions : (activeTab === 'pending' ? pendingSessions : []);
  const displayTotals = useMemo(() => calcTotals(displaySessions), [displaySessions]);

  const handlePrint = () => {
    if (typeof document === 'undefined') return;

    if (displaySessions.length === 0) {
      toast.error('لا توجد جلسات متاحة للطباعة');
      return;
    }

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
        <div>
          <h2 className="text-xl font-bold leading-tight">مراجعة حسابات المدير</h2>
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

        {/* Pending Tab */}
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
              {/* Warning banner */}
              <Card className="border-amber-300 bg-amber-50">
                <CardContent className="p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-800">
                    <p className="font-bold">مبالغ معلّقة</p>
                    <p>هذه الجلسات لم تُسجّل بعد في الخزينة. يجب تأكيد المراجعة لإدراجها.</p>
                  </div>
                </CardContent>
              </Card>

              <SessionsSummary totals={pendingTotals} sessions={pendingSessions} />

              {/* Confirm button */}
              <Button
                onClick={() => setShowConfirmDialog(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                size="lg"
                disabled={confirmMutation.isPending}
              >
                {confirmMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileCheck className="w-4 h-4" />
                )}
                تأكيد المراجعة وإدراج في الخزينة ({pendingSessions.length} جلسة)
              </Button>

              <Button onClick={handlePrint} variant="outline" className="w-full gap-2" size="lg">
                <Printer className="w-4 h-4" /> طباعة ملخص A4
              </Button>

              {/* Per-Worker Breakdown */}
              <WorkerBreakdown sessions={pendingSessions} />
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">مراجعة #{reviewHistory.indexOf(review) + 1}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {review.completed_at ? format(new Date(review.completed_at), 'yyyy-MM-dd HH:mm') : format(new Date(review.created_at), 'yyyy-MM-dd HH:mm')}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700">
                      مكتملة
                    </Badge>
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد مراجعة حسابات المدير</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إدراج جميع المبالغ المعلّقة ({pendingSessions.length} جلسة) في خزينة المدير. هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="ملاحظات (اختياري)..."
            value={reviewNotes}
            onChange={e => setReviewNotes(e.target.value)}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReview} className="bg-emerald-600 hover:bg-emerald-700">
              تأكيد المراجعة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Summary Component
export const SessionsSummary: React.FC<{ totals: any; sessions: any[] }> = ({ totals, sessions }) => {
  const totalCashReceived = totals.invoice1EspaceCash + totals.invoice1VersementCash + totals.invoice2Cash + totals.debtCollectionsCash;
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
export const WorkerBreakdown: React.FC<{ sessions: any[] }> = ({ sessions }) => {
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
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
      const diff = cashAct - cashExp;
      const expensesTotal = get('expenses');

      return (
        <Card
          key={session.id}
          className="rounded-xl border cursor-pointer hover:border-primary/60 hover:shadow-sm transition"
          onClick={() => setSelectedSession(session)}
        >
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="font-bold text-sm">{session.worker?.full_name}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {session.completed_at ? format(new Date(session.completed_at), 'HH:mm') : ''}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <MiniBox label="المبيعات" value={get('total_sales')} />
              <MiniBox label="نقدية فعلية" value={cashAct} color="green" />
              <MiniBox label={diff >= 0 ? 'فائض' : 'عجز'} value={diff} color={diff >= 0 ? 'green' : 'red'} showSign />
              <MiniBox label="ديون جديدة" value={get('new_debts')} color="red" />
              <MiniBox label="تحصيل ديون" value={get('debt_collections_total')} color="orange" />
              <MiniBox label="مصاريف" value={expensesTotal} color="orange" />
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
  const bg = color === 'green' ? 'bg-green-50' : color === 'red' ? 'bg-red-50' : color === 'orange' ? 'bg-orange-50' : 'bg-muted/30';
  const text = color === 'green' ? 'text-green-700' : color === 'red' ? 'text-red-700' : color === 'orange' ? 'text-orange-700' : '';
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

export const buildManagerReviewPrintHtml = ({ totals, sessions, branchName, qrDataUrl, qrUrl }: { totals: any; sessions: any[]; branchName: string; qrDataUrl?: string; qrUrl?: string }) => {
  const totalCash = totals.invoice1EspaceCash + totals.invoice1VersementCash + totals.invoice2Cash + totals.debtCollectionsCash;
  const totalChecks = totals.invoice1Check + totals.debtCollectionsCheck;
  const totalReceipts = totals.invoice1Receipt + totals.debtCollectionsReceipt;
  const totalTransfers = totals.invoice1Transfer + totals.debtCollectionsTransfer;
  const today = format(new Date(), 'yyyy-MM-dd HH:mm');
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
    const ts = session.completed_at ? new Date(session.completed_at) : null;
    const tsCell = ts
      ? `<div style="color:#b91c1c;font-weight:800">${format(ts, 'HH:mm')}</div><div style="color:#0f172a;font-size:8px">${format(ts, 'yyyy-MM-dd')}</div>`
      : '—';
    return `
      <tr>
        <td style="white-space:nowrap">${tsCell}</td>
        <td>${escapeHtml(session.worker?.full_name || session.worker?.username || '—')}</td>
        <td>${get('total_sales').toLocaleString()}</td>
        <td>${get('physical_cash').toLocaleString()}</td>
        <td style="color:${diff >= 0 ? '#15803d' : '#b91c1c'};font-weight:800">${diff >= 0 ? '+' : ''}${diff.toLocaleString()}</td>
        <td>${get('new_debts').toLocaleString()}</td>
        <td>${get('debt_collections_total').toLocaleString()}</td>
        <td>${get('expenses').toLocaleString()}</td>
        <td style="font-weight:800;color:#0369a1">${sessionTotal.toLocaleString()}</td>
      </tr>`;
  }).join('');

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
  <title>Rapport de Révision des Comptes du Gérant</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #0f172a; font-family: 'Helvetica Neue', Arial, sans-serif; }
    body { width: 190mm; min-height: 277mm; }
    .sheet { width: 100%; padding: 0; }
    .header { border-bottom: 3px double #0f172a; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; }
    .title { font-size: 18px; font-weight: 800; letter-spacing: 0.3px; }
    .subtitle { font-size: 10px; color: #000; margin-top: 4px; }
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
    thead th { background: #fff; color: #000; font-weight: 900; padding: 5px 4px; text-transform: uppercase; letter-spacing: 0.3px; font-size: 9px; border: 1px solid #e2e8f0; }
    td { border: 1px solid #e2e8f0; padding: 4px; text-align: center; font-variant-numeric: tabular-nums; color: #000; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    td:nth-child(2) { text-align: left; font-weight: 700; color: #0f172a; }
    .signatures { margin-top: 14px; display: flex; justify-content: space-between; gap: 30px; font-size: 10px; color: #000; }
    .sign { flex: 1; border-top: 1px solid #0f172a; padding-top: 4px; text-align: center; }
  </style>
</head>
<body>
  <main class="sheet">
    <header class="header">
      <div style="flex:1">
        <div class="title">Rapport de Révision des Comptes du Gérant</div>
        <div class="subtitle"><b>Agence :</b> ${escapeHtml(branchName || '—')} &nbsp;|&nbsp; <b>Date d'impression :</b> ${escapeHtml(today)} &nbsp;|&nbsp; <b>Nombre de sessions :</b> ${sessions.length}</div>
      </div>
      ${qrDataUrl ? `<div style="border:2px solid #0f172a;padding:4px;border-radius:4px;background:#fff"><img src="${qrDataUrl}" alt="QR" style="width:64px;height:64px;display:block" /></div>` : ''}
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
            <th>Horodatage</th>
            <th style="text-align:left;padding-left:8px">Vendeur</th>
            <th>Ventes</th>
            <th>Espèces</th>
            <th>Écart</th>
            <th>Nouvelles Dettes</th>
            <th>Recouvrement</th>
            <th>Dépenses</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>${workerRows}</tbody>
      </table>
    </div>

    <footer class="signatures">
      <div class="sign">Signature du Gérant</div>
      <div class="sign">Signature du Comptable</div>
    </footer>

  </main>
</body>
</html>`;
};
