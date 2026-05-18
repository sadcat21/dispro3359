import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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

const fmt = (n: number) => n.toLocaleString();

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

  // Aggregate totals
  const calcTotals = (sessions: any[]) => {
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

  const pendingTotals = useMemo(() => calcTotals(pendingSessions), [pendingSessions]);

  const handleConfirmReview = () => {
    const sessionIds = pendingSessions.map((s: any) => s.id);
    confirmMutation.mutate(
      { notes: reviewNotes || undefined, sessionIds },
      {
        onSuccess: () => {
          toast.success('تم تأكيد المراجعة وإدراج المبالغ في الخزينة');
          setShowConfirmDialog(false);
          setReviewNotes('');
        },
        onError: () => toast.error('حدث خطأ أثناء تأكيد المراجعة'),
      }
    );
  };

  const displaySessions = selectedReview ? reviewDetailSessions : (activeTab === 'pending' ? pendingSessions : []);
  const displayTotals = useMemo(() => calcTotals(displaySessions), [displaySessions]);

  const handlePrint = () => window.print();

  return (
    <div className="p-4 space-y-5">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; }
          body * { visibility: hidden !important; }
          #manager-review-print, #manager-review-print * { visibility: visible !important; }
          #manager-review-print {
            position: fixed !important;
            top: 0; left: 0; right: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            background: #fff !important;
            z-index: 999999 !important;
            transform: none !important;
            overflow: visible !important;
          }
        }
        @media screen { #manager-review-print { display: none; } }
      `}</style>
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
                onClick={() => { setSelectedReview(review.id); }}
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

      {/* A4 Printable Summary */}
      <PrintableA4
        totals={displayTotals}
        sessions={displaySessions}
        branchName={activeBranch?.name || ''}
      />

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
const SessionsSummary: React.FC<{ totals: any; sessions: any[] }> = ({ totals, sessions }) => {
  const totalCashReceived = totals.invoice1EspaceCash + totals.invoice1VersementCash + totals.invoice2Cash + totals.debtCollectionsCash;
  const totalChecks = totals.invoice1Check + totals.debtCollectionsCheck;
  const totalReceipts = totals.invoice1Receipt + totals.debtCollectionsReceipt;
  const totalTransfers = totals.invoice1Transfer + totals.debtCollectionsTransfer;

  return (
    <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
      <CardContent className="p-4 space-y-4">
        <h3 className="font-bold text-sm text-emerald-800 flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          الملخص الإجمالي — {sessions.length} عامل
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
const WorkerBreakdown: React.FC<{ sessions: any[] }> = ({ sessions }) => (
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

      return (
        <Card key={session.id} className="rounded-xl border">
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
              <MiniBox label="مصاريف" value={get('expenses')} />
            </div>
          </CardContent>
        </Card>
      );
    })}
  </div>
);

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
const PrintableA4: React.FC<{ totals: any; sessions: any[]; branchName: string }> = ({ totals, sessions, branchName }) => {
  const totalCash = totals.invoice1EspaceCash + totals.invoice1VersementCash + totals.invoice2Cash + totals.debtCollectionsCash;
  const totalChecks = totals.invoice1Check + totals.debtCollectionsCheck;
  const totalReceipts = totals.invoice1Receipt + totals.debtCollectionsReceipt;
  const totalTransfers = totals.invoice1Transfer + totals.debtCollectionsTransfer;
  const today = format(new Date(), 'yyyy-MM-dd HH:mm');

  const Row = ({ label, value, color = '#0f172a' }: { label: string; value: number | string; color?: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 11 }}>
      <span style={{ color: '#475569' }}>{label}</span>
      <span style={{ fontWeight: 700, color }}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
    </div>
  );

  const SectionTitle = ({ children, bg }: { children: React.ReactNode; bg: string }) => (
    <div style={{ background: bg, color: '#fff', padding: '4px 8px', fontWeight: 700, fontSize: 12, marginTop: 8 }}>{children}</div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div id="manager-review-print" dir="rtl" style={{ background: '#fff', color: '#0f172a', fontFamily: 'system-ui, sans-serif', padding: 0 }}>
      {/* Header */}
      <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: 8, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>تقرير مراجعة حسابات المدير</div>
          <div style={{ fontSize: 11, color: '#475569' }}>الفرع: {branchName || '—'} • تاريخ الطباعة: {today}</div>
        </div>
        <div style={{ fontSize: 11, color: '#475569', textAlign: 'left' }}>
          عدد الجلسات: <b>{sessions.length}</b>
        </div>
      </div>

      {/* KPIs grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
        {[
          { l: 'إجمالي المبيعات', v: totals.totalSales, c: '#0369a1' },
          { l: 'النقدية الفعلية', v: totals.physicalCashActual, c: '#15803d' },
          { l: 'النقدية المتوقعة', v: totals.physicalCashExpected, c: '#475569' },
          { l: 'صافي الفرق', v: (totals.cashDifference >= 0 ? '+' : '') + totals.cashDifference.toLocaleString(), c: totals.cashDifference >= 0 ? '#15803d' : '#b91c1c' },
        ].map((k, i) => (
          <div key={i} style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#64748b' }}>{k.l}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: k.c }}>{typeof k.v === 'number' ? k.v.toLocaleString() : k.v}</div>
          </div>
        ))}
      </div>

      <SectionTitle bg="#059669">النقدية المستلمة</SectionTitle>
      <Row label="نقدية مبيعات (إسباس)" value={totals.invoice1EspaceCash} />
      <Row label="نقدية مبيعات (فرسمان)" value={totals.invoice1VersementCash} />
      <Row label="نقدية فاتورة 2" value={totals.invoice2Cash} />
      <Row label="نقدية تحصيل ديون" value={totals.debtCollectionsCash} />
      <Row label="إجمالي النقدية" value={totalCash} color="#059669" />

      <SectionTitle bg="#2563eb">الشيكات والتحويلات</SectionTitle>
      <Row label="شيكات" value={totalChecks} color="#1d4ed8" />
      <Row label="وصولات بنكية" value={totalReceipts} color="#7e22ce" />
      <Row label="تحويلات" value={totalTransfers} color="#0e7490" />

      <SectionTitle bg="#e11d48">الديون</SectionTitle>
      <Row label="ديون جديدة" value={totals.newDebts} color="#b91c1c" />
      <Row label="إجمالي تحصيل الديون" value={totals.debtCollectionsTotal} color="#15803d" />

      <SectionTitle bg="#d97706">المصاريف والفروقات</SectionTitle>
      <Row label="مصاريف معتمدة" value={totals.expenses} color="#c2410c" />
      <Row label="صرف عملة" value={totals.coinAmount} />
      <Row label="إجمالي الفائض" value={'+' + totals.surplus.toLocaleString()} color="#15803d" />
      <Row label="إجمالي العجز" value={'-' + totals.deficit.toLocaleString()} color="#b91c1c" />

      <SectionTitle bg="#0f172a">تفاصيل العمال</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginTop: 4 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ padding: 4, border: '1px solid #cbd5e1' }}>العامل</th>
            <th style={{ padding: 4, border: '1px solid #cbd5e1' }}>المبيعات</th>
            <th style={{ padding: 4, border: '1px solid #cbd5e1' }}>نقدية</th>
            <th style={{ padding: 4, border: '1px solid #cbd5e1' }}>فرق</th>
            <th style={{ padding: 4, border: '1px solid #cbd5e1' }}>ديون جديدة</th>
            <th style={{ padding: 4, border: '1px solid #cbd5e1' }}>تحصيل</th>
            <th style={{ padding: 4, border: '1px solid #cbd5e1' }}>مصاريف</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s: any) => {
            const items = s.items || [];
            const g = (t: string, f: 'actual_amount' | 'expected_amount' = 'actual_amount') => {
              const it = items.find((i: any) => i.item_type === t);
              return it ? Number(it[f]) : 0;
            };
            const diff = g('physical_cash') - g('physical_cash', 'expected_amount');
            return (
              <tr key={s.id}>
                <td style={{ padding: 4, border: '1px solid #e2e8f0', fontWeight: 600 }}>{s.worker?.full_name}</td>
                <td style={{ padding: 4, border: '1px solid #e2e8f0', textAlign: 'center' }}>{g('total_sales').toLocaleString()}</td>
                <td style={{ padding: 4, border: '1px solid #e2e8f0', textAlign: 'center' }}>{g('physical_cash').toLocaleString()}</td>
                <td style={{ padding: 4, border: '1px solid #e2e8f0', textAlign: 'center', color: diff >= 0 ? '#15803d' : '#b91c1c', fontWeight: 700 }}>{diff >= 0 ? '+' : ''}{diff.toLocaleString()}</td>
                <td style={{ padding: 4, border: '1px solid #e2e8f0', textAlign: 'center' }}>{g('new_debts').toLocaleString()}</td>
                <td style={{ padding: 4, border: '1px solid #e2e8f0', textAlign: 'center' }}>{g('debt_collections_total').toLocaleString()}</td>
                <td style={{ padding: 4, border: '1px solid #e2e8f0', textAlign: 'center' }}>{g('expenses').toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', borderTop: '1px solid #cbd5e1', paddingTop: 6 }}>
        <span>توقيع المدير: ____________________</span>
        <span>توقيع المحاسب: ____________________</span>
      </div>
    </div>
  );
};
