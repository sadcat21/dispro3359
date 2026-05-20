import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ShoppingCart, Warehouse, Activity, Trophy, Gift } from 'lucide-react';
import { fetchProjectManagerWorkerActivity } from '@/utils/projectManagerWorkerActivity';

export type PMSummaryKind = 'sales' | 'inventory' | 'workers' | 'achievements' | 'offers';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: PMSummaryKind | null;
  branchId?: string | null;
}

const titles: Record<PMSummaryKind, { title: string; desc: string; icon: React.ElementType }> = {
  sales: { title: 'تفاصيل المبيعات', desc: 'الطلبات المسلّمة لهذا الشهر مع تفصيل اليوم', icon: ShoppingCart },
  inventory: { title: 'تفاصيل المخزون', desc: 'منتجات منخفضة المخزون والكميات التالفة', icon: Warehouse },
  workers: { title: 'نشاط العمال اليوم', desc: 'عمليات التسليم المعتمدة لكل عامل اليوم', icon: Activity },
  achievements: { title: 'تفاصيل الإنجازات والمكافآت', desc: 'ترتيب الموظفين حسب النقاط لهذا الشهر', icon: Trophy },
  offers: { title: 'العروض المسلّمة والهدايا', desc: 'العروض المُفعّلة والمنتجات المسلّمة كهدايا هذا الشهر', icon: Gift },
};

const startOfDayIso = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).toISOString();
};
const startOfMonthIso = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
};

const ProjectManagerSummaryDialog: React.FC<Props> = ({ open, onOpenChange, kind, branchId }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['pm-summary-details', kind, branchId],
    enabled: open && !!kind,
    queryFn: async () => {
      if (kind === 'sales') {
        let q = supabase
          .from('orders')
          .select('id, total_amount, payment_status, created_at, customer_id, branch_id, customers(name)')
          .eq('status', 'delivered')
          .gte('created_at', startOfMonthIso())
          .order('created_at', { ascending: false })
          .limit(100);
        if (branchId) q = q.eq('branch_id', branchId);
        const { data: rows } = await q as any;
        const today = startOfDayIso();
        const todayRows = (rows || []).filter((r: any) => r.created_at >= today);
        const sum = (arr: any[]) => arr.reduce((s, r) => s + Number(r.total_amount || 0), 0);
        return { rows: rows || [], todayCount: todayRows.length, todayTotal: sum(todayRows), monthTotal: sum(rows || []) };
      }
      if (kind === 'inventory') {
        let q = supabase
          .from('warehouse_stock')
          .select('product_id, quantity, damaged_quantity, branch_id, products(name)')
          .order('quantity', { ascending: true })
          .limit(150);
        if (branchId) q = q.eq('branch_id', branchId);
        const { data: rows } = await q as any;
        const low = (rows || []).filter((r: any) => Number(r.quantity || 0) > 0 && Number(r.quantity || 0) < 10);
        const out = (rows || []).filter((r: any) => Number(r.quantity || 0) <= 0);
        const damaged = (rows || []).filter((r: any) => Number(r.damaged_quantity || 0) > 0);
        return { low, out, damaged };
      }
      if (kind === 'workers') {
        const summary = await fetchProjectManagerWorkerActivity(branchId);
        return {
          list: summary.list.map((worker) => ({
            id: worker.workerId,
            name: worker.workerName,
            count: worker.count,
            last: worker.last,
          })),
          total: summary.deliveriesToday,
        };
      }
      if (kind === 'achievements') {
        let q = supabase
          .from('monthly_bonus_summary')
          .select('worker_id, total_points, reward_points, penalty_points, bonus_amount, branch_id, month, workers(full_name)')
          .gte('month', startOfMonthIso().slice(0, 10));
        if (branchId) q = q.eq('branch_id', branchId);
        const { data: rows } = await q as any;
        const agg: Record<string, { name: string; total: number; rewards: number; penalties: number; bonus: number }> = {};
        for (const r of rows || []) {
          const id = r.worker_id;
          if (!id) continue;
          const name = (r as any).workers?.full_name || '—';
          if (!agg[id]) agg[id] = { name, total: 0, rewards: 0, penalties: 0, bonus: 0 };
          agg[id].total += Number(r.total_points || 0);
          agg[id].rewards += Number(r.reward_points || 0);
          agg[id].penalties += Number(r.penalty_points || 0);
          agg[id].bonus += Number(r.bonus_amount || 0);
        }
        const list = Object.values(agg).sort((a, b) => b.total - a.total);
        return { list };
      }
      if (kind === 'offers') {
        let q = supabase
          .from('sales_tracking')
          .select('id, product_id, product_name, gift_pieces, gift_boxes, sold_pieces, sold_boxes, sold_at, worker_name, customer_name, branch_id, order_id')
          .gte('sold_at', startOfMonthIso())
          .gt('gift_pieces', 0)
          .order('sold_at', { ascending: false })
          .limit(200);
        if (branchId) q = q.eq('branch_id', branchId);
        const { data: rows } = await q as any;
        const list = (rows || []) as any[];

        // Fetch product images in a single batch
        const productIds = Array.from(new Set(list.map((r) => r.product_id).filter(Boolean)));
        const imageMap: Record<string, string | null> = {};
        if (productIds.length) {
          const { data: prods } = await supabase
            .from('products')
            .select('id, image_url')
            .in('id', productIds);
          for (const p of (prods || []) as any[]) imageMap[p.id] = p.image_url || null;
        }
        const enriched = list.map((r) => ({ ...r, image_url: imageMap[r.product_id] || null }));

        const today = startOfDayIso();
        const todayRows = enriched.filter((r) => r.sold_at >= today);
        const sumGifts = (arr: any[]) => arr.reduce((s, r) => s + Number(r.gift_pieces || 0), 0);
        const uniqueOrders = (arr: any[]) => new Set(arr.map((r) => r.order_id || r.id)).size;
        return {
          rows: enriched,
          todayCount: uniqueOrders(todayRows),
          monthCount: uniqueOrders(list),
          todayGifts: sumGifts(todayRows),
          monthGifts: sumGifts(list),
        };
      }
      return null;
    },
  });

  const navigate = useNavigate();

  if (!kind) return null;
  const meta = titles[kind];
  const Icon = meta.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {meta.title}
          </DialogTitle>
          <DialogDescription>{meta.desc}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-2">
            {kind === 'sales' && data && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl bg-blue-50 p-3"><p className="text-muted-foreground">طلبات اليوم</p><p className="mt-1 text-base font-bold">{(data as any).todayCount}</p></div>
                  <div className="rounded-xl bg-blue-50 p-3"><p className="text-muted-foreground">مبيعات اليوم</p><p className="mt-1 text-base font-bold">{(data as any).todayTotal.toLocaleString()} DA</p></div>
                  <div className="rounded-xl bg-blue-50 p-3"><p className="text-muted-foreground">مبيعات الشهر</p><p className="mt-1 text-base font-bold">{(data as any).monthTotal.toLocaleString()} DA</p></div>
                </div>
                <div className="space-y-1">
                  {((data as any).rows || []).slice(0, 50).map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.customers?.name || `#${r.id.slice(0, 6)}`}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString('ar')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{r.payment_status}</Badge>
                        <span className="font-bold">{Number(r.total_amount).toLocaleString()} DA</span>
                      </div>
                    </div>
                  ))}
                  {((data as any).rows || []).length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">لا توجد مبيعات هذا الشهر</p>}
                </div>
              </div>
            )}

            {kind === 'inventory' && data && (
              <div className="space-y-4">
                {[
                  { title: 'نفد المخزون', rows: (data as any).out, color: 'text-rose-700' },
                  { title: 'مخزون منخفض (<10)', rows: (data as any).low, color: 'text-amber-700' },
                  { title: 'كميات تالفة', rows: (data as any).damaged, color: 'text-rose-600' },
                ].map((sec) => (
                  <div key={sec.title}>
                    <h4 className={`mb-2 text-sm font-bold ${sec.color}`}>{sec.title} ({sec.rows.length})</h4>
                    {sec.rows.length === 0 ? (
                      <p className="text-xs text-muted-foreground">لا توجد عناصر</p>
                    ) : (
                      <div className="space-y-1">
                        {sec.rows.slice(0, 40).map((r: any, i: number) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-xs">
                            <span className="truncate font-medium">{r.products?.name || r.product_id?.slice(0, 8)}</span>
                            <div className="flex gap-3 text-[11px]">
                              <span>متوفر: <b>{r.quantity}</b></span>
                              {Number(r.damaged_quantity) > 0 && <span className="text-rose-600">تالف: <b>{r.damaged_quantity}</b></span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {kind === 'workers' && data && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">إجمالي عمليات التسليم اليوم: <b>{(data as any).total}</b></p>
                {((data as any).list || []).map((w: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-xs">
                    <div>
                      <p className="font-medium">{w.name}</p>
                      <p className="text-[10px] text-muted-foreground">آخر نشاط: {new Date(w.last).toLocaleTimeString('ar')}</p>
                    </div>
                    <Badge variant="secondary">{w.count} تسليم</Badge>
                  </div>
                ))}
                {((data as any).list || []).length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">لا يوجد نشاط اليوم</p>}
              </div>
            )}

            {kind === 'achievements' && data && (
              <div className="space-y-2">
                {((data as any).list || []).map((w: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-center font-bold text-muted-foreground">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                      <div>
                        <p className="font-medium">{w.name}</p>
                        <p className="text-[10px] text-muted-foreground">+{w.rewards} مكافأة · -{w.penalties} خصم</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-bold">{w.total} نقطة</p>
                      <p className="text-[10px] text-emerald-600">{Number(w.bonus).toLocaleString()} DA</p>
                    </div>
                  </div>
                ))}
                {((data as any).list || []).length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">لا توجد نقاط هذا الشهر</p>}
              </div>
            )}

            {kind === 'offers' && data && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="rounded-xl bg-rose-50 p-3"><p className="text-muted-foreground">عروض اليوم</p><p className="mt-1 text-base font-bold">{(data as any).todayCount}</p></div>
                  <div className="rounded-xl bg-rose-50 p-3"><p className="text-muted-foreground">هدايا اليوم</p><p className="mt-1 text-base font-bold">{Number((data as any).todayGifts).toLocaleString()}</p></div>
                  <div className="rounded-xl bg-rose-50 p-3"><p className="text-muted-foreground">عروض الشهر</p><p className="mt-1 text-base font-bold">{(data as any).monthCount}</p></div>
                  <div className="rounded-xl bg-rose-50 p-3"><p className="text-muted-foreground">هدايا الشهر</p><p className="mt-1 text-base font-bold">{Number((data as any).monthGifts).toLocaleString()}</p></div>
                </div>
                <div className="space-y-1">
                  {((data as any).rows || []).slice(0, 80).map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {r.image_url ? (
                          <img src={r.image_url} alt={r.product_name} className="h-10 w-10 rounded-md object-cover border shrink-0" loading="lazy" />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-muted border flex items-center justify-center text-[10px] text-muted-foreground shrink-0">—</div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{r.product_name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{r.worker_name || '—'} · {r.customer_name || '—'} · {new Date(r.sold_at).toLocaleString('ar')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px]">بيع: {r.sold_pieces}</Badge>
                        <Badge className="text-[10px] bg-rose-600">هدية: {r.gift_pieces}</Badge>
                      </div>
                    </div>
                  ))}
                  {((data as any).rows || []).length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">لا توجد عروض مسلّمة هذا الشهر</p>}
                </div>
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProjectManagerSummaryDialog;
