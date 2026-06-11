import React, { useMemo } from 'react';
import QRCode from 'qrcode';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronLeft, Calculator, Printer, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  calcTotals,
  SessionsSummary,
  WorkerBreakdown,
  buildManagerReviewPrintHtml,
  fetchProductMatrix,
  ProductMatrix,
} from './ManagerAccountingReview';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package } from 'lucide-react';

const ManagerReviewDetail: React.FC = () => {
  const { reviewId } = useParams<{ reviewId: string }>();
  const navigate = useNavigate();
  const { activeBranch, user } = useAuth() as any;

  const { data: review, isLoading: loadingReview } = useQuery({
    queryKey: ['manager-review-session', reviewId],
    queryFn: async () => {
      if (!reviewId) return null;
      const { data, error } = await supabase
        .from('manager_review_sessions')
        .select('*')
        .eq('id', reviewId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!reviewId,
  });

  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['review-detail-sessions', reviewId],
    queryFn: async () => {
      if (!reviewId) return [];
      const { data, error } = await supabase
        .from('accounting_sessions')
        .select(`
          *,
          worker:workers!accounting_sessions_worker_id_fkey(id, full_name, username),
          items:accounting_session_items(*)
        `)
        .eq('review_session_id', reviewId)
        .order('completed_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!reviewId,
  });

  const totals = useMemo(() => calcTotals(sessions), [sessions]);

  const { data: productMatrix } = useQuery({
    queryKey: ['review-detail-product-matrix', reviewId, sessions.length],
    queryFn: () => fetchProductMatrix(sessions),
    enabled: sessions.length > 0,
  });

  const METHOD_KEYS = ['invoice1', 'super_gros', 'gros', 'retail', 'remise'] as const;
  const METHOD_LABELS: Record<string, string> = {
    invoice1: 'FACTURE 1',
    super_gros: 'SUPER GROS',
    gros: 'GROS',
    retail: 'DÉTAIL',
    remise: 'REMISE',
  };

  const productSalesMatrix = useMemo(() => {
    if (!productMatrix) return null as null | {
      products: { id: string; name: string; piecesPerBox: number; cells: Record<string, { paid: number; debt: number; paidAmt: number; debtAmt: number }>; offered: number; rowQty: number; rowAmt: number }[];
      totals: Record<string, { paidAmt: number; debtAmt: number }>;
      grandAmt: number;
    };
    const aggMQty: Record<string, Record<string, { paid: number; debt: number; paidAmt: number; debtAmt: number }>> = { invoice1: {}, super_gros: {}, gros: {}, retail: {}, remise: {} };
    const aggOffered: Record<string, number> = {};
    productMatrix.workers.forEach((w) => {
      const mQty = (productMatrix.workerMethodProductQty?.[w.id] || {}) as any;
      const off = productMatrix.workerOfferedQty?.[w.id] || {};
      METHOD_KEYS.forEach((k) => {
        productMatrix.products.forEach((p) => {
          const cur = aggMQty[k][p.id] || { paid: 0, debt: 0, paidAmt: 0, debtAmt: 0 };
          const src = mQty[k]?.[p.id] || { paid: 0, debt: 0, paidAmt: 0, debtAmt: 0 };
          aggMQty[k][p.id] = {
            paid: cur.paid + Number(src.paid || 0),
            debt: cur.debt + Number(src.debt || 0),
            paidAmt: cur.paidAmt + Number(src.paidAmt || 0),
            debtAmt: cur.debtAmt + Number(src.debtAmt || 0),
          };
        });
      });
      productMatrix.products.forEach((p) => {
        aggOffered[p.id] = (aggOffered[p.id] || 0) + Number((off as any)[p.id] || 0);
      });
    });
    const totals: Record<string, { paidAmt: number; debtAmt: number }> = { invoice1: { paidAmt: 0, debtAmt: 0 }, super_gros: { paidAmt: 0, debtAmt: 0 }, gros: { paidAmt: 0, debtAmt: 0 }, retail: { paidAmt: 0, debtAmt: 0 }, remise: { paidAmt: 0, debtAmt: 0 } };
    const rows = productMatrix.products.map((p) => {
      const cells: Record<string, { paid: number; debt: number; paidAmt: number; debtAmt: number }> = {};
      let rowQty = 0;
      let rowAmt = 0;
      METHOD_KEYS.forEach((k) => {
        const c = aggMQty[k][p.id] || { paid: 0, debt: 0, paidAmt: 0, debtAmt: 0 };
        cells[k] = c;
        rowQty += c.paid + c.debt;
        rowAmt += c.paidAmt + c.debtAmt;
        totals[k].paidAmt += c.paidAmt;
        totals[k].debtAmt += c.debtAmt;
      });
      const offered = Number(aggOffered[p.id] || 0);
      return { id: p.id, name: p.name, piecesPerBox: p.piecesPerBox, cells, offered, rowQty, rowAmt };
    }).filter((r) => r.rowQty + r.offered > 0);
    const grandAmt = METHOD_KEYS.reduce((a, k) => a + totals[k].paidAmt + totals[k].debtAmt, 0);
    return { products: rows, totals, grandAmt };
  }, [productMatrix]);


  const handlePrint = async () => {
    if (typeof document === 'undefined') return;
    if (sessions.length === 0) { toast.error('لا توجد جلسات متاحة للطباعة'); return; }
    const qrUrl = `${window.location.origin}/manager-accounting-review/${reviewId}`;
    let qrDataUrl: string | undefined;
    try {
      qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 300, margin: 1 });
    } catch (e) {
      console.error('QR generation failed', e);
    }
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
    document.body.appendChild(iframe);
    const w = iframe.contentWindow; const d = iframe.contentDocument || w?.document;
    if (!w || !d) { iframe.remove(); return; }
    d.open();
    const productMatrix = await fetchProductMatrix(sessions);
    d.write(buildManagerReviewPrintHtml({ totals, sessions, branchName: activeBranch?.name || '', qrDataUrl, qrUrl, accountantName: user?.full_name || user?.fullName || user?.username || '', productMatrix }));
    d.close();
    const remove = () => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); };
    w.onafterprint = remove;
    setTimeout(() => { w.focus(); w.print(); setTimeout(remove, 3000); }, 400);
  };

  if (loadingReview || loadingSessions) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  }

  if (!review) {
    return (
      <div className="p-4 space-y-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/manager-accounting-review')} className="gap-1">
          <ChevronLeft className="w-4 h-4" /> رجوع
        </Button>
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="text-sm font-medium">جلسة المراجعة غير موجودة</p>
            <p className="text-[10px] mt-1 font-mono">{reviewId}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 pb-32 space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/manager-accounting-review')} className="shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-emerald-700" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold leading-tight">تفاصيل جلسة المراجعة</h2>
          <p className="text-[11px] text-muted-foreground font-mono truncate">#{review.id}</p>
        </div>
        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 gap-1">
          <CheckCircle2 className="w-3 h-3" /> مكتملة
        </Badge>
      </div>

      <Card>
        <CardContent className="p-3 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">تاريخ الإكمال</span><span className="font-semibold">{review.completed_at ? format(new Date(review.completed_at), 'yyyy-MM-dd HH:mm') : '—'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">عدد العمال</span><span className="font-semibold">{new Set(sessions.map((s: any) => s.worker?.id).filter(Boolean)).size}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">عدد الجلسات</span><span className="font-semibold">{sessions.length}</span></div>
          {review.notes && <p className="mt-2 bg-muted/30 rounded p-2 text-muted-foreground">{review.notes}</p>}
        </CardContent>
      </Card>

      {sessions.length > 0 && (
        <>
          <SessionsSummary totals={totals} sessions={sessions} />
          <Button onClick={handlePrint} variant="outline" className="w-full gap-2">
            <Printer className="w-4 h-4" /> طباعة ملخص A4
          </Button>
          <WorkerBreakdown sessions={sessions} />

          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold">المنتجات المباعة</h3>
                <Badge variant="secondary" className="text-[10px]">{soldProducts.length}</Badge>
              </div>
              {soldProducts.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-6">لا توجد منتجات مباعة</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المنتج</TableHead>
                        <TableHead className="text-center">الصناديق المباعة</TableHead>
                        <TableHead className="text-center">القطع</TableHead>
                        <TableHead className="text-center">المهدى (صناديق)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {soldProducts.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-center">{p.soldBoxes.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-center text-muted-foreground">{p.soldPieces.toLocaleString('fr-FR')}</TableCell>
                          <TableCell className="text-center text-emerald-700">{p.offeredBoxes.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ManagerReviewDetail;
