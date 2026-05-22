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
} from './ManagerAccountingReview';

const ManagerReviewDetail: React.FC = () => {
  const { reviewId } = useParams<{ reviewId: string }>();
  const navigate = useNavigate();
  const { activeBranch } = useAuth();

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
    d.write(buildManagerReviewPrintHtml({ totals, sessions, branchName: activeBranch?.name || '', qrDataUrl, qrUrl }));
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
    <div className="p-4 space-y-5">
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
        </>
      )}
    </div>
  );
};

export default ManagerReviewDetail;
