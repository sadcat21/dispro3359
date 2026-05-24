import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Calendar, User, BarChart3 } from 'lucide-react';
import { dbBPDisplay } from '@/utils/boxPieceInput';
import { dedupeSalesTrackingRows } from '@/utils/salesTrackingDedup';
import ProductMonthlyCompetitionDialog from './ProductMonthlyCompetitionDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  productId: string;
  productName: string;
  piecesPerBox: number;
  /** ISO date; sales before this date are ignored (e.g. last receipt date) */
  sinceIso?: string | null;
}

const ProductDailySoldDialog: React.FC<Props> = ({
  open, onOpenChange, branchId, productId, productName, piecesPerBox, sinceIso,
}) => {
  const fmt = (v: number) => dbBPDisplay(Math.max(0, v), piecesPerBox);
  const [competitionOpen, setCompetitionOpen] = useState(false);


  const { data, isLoading } = useQuery({
    queryKey: ['product-daily-sold', branchId, productId, sinceIso],
    enabled: open && !!branchId && !!productId,
    queryFn: async () => {
      let q = supabase
        .from('sales_tracking')
        .select('sold_boxes, sold_pieces, pieces_per_box, sold_at, source, branch_id, worker_id, customer_id, order_id')
        .eq('product_id', productId)
        .in('source', ['warehouse_sale', 'delivery_sale', 'direct_sale'])
        .or(`branch_id.eq.${branchId},branch_id.is.null`);
      if (sinceIso) q = q.gte('sold_at', sinceIso);
      const { data: rows } = await q;

      const orderIds = Array.from(new Set((rows || []).map((r: any) => r.order_id).filter(Boolean)));
      const ordersRes = orderIds.length
        ? await supabase.from('orders').select('id, status, branch_id').in('id', orderIds as string[])
        : { data: [] as any[] };
      const orderById = new Map((ordersRes.data || []).map((o: any) => [o.id, o]));

      const filtered = dedupeSalesTrackingRows((rows || []).filter((r: any) => {
        const order = r.order_id ? orderById.get(r.order_id) : null;
        if (r.order_id && order?.status !== 'delivered') return false;
        const inferred = r.branch_id || order?.branch_id || null;
        return !inferred || inferred === branchId;
      }));

      const workerIds = Array.from(new Set(filtered.map((r: any) => r.worker_id).filter(Boolean)));
      const namesRes = workerIds.length
        ? await supabase.from('workers_safe').select('id, full_name').in('id', workerIds as string[])
        : { data: [] as any[] };
      const nameMap = new Map((namesRes.data || []).map((w: any) => [w.id, w.full_name]));

      return { rows: filtered, nameMap };
    },
  });

  const byDay = useMemo(() => {
    const ppb = Math.max(1, piecesPerBox);
    const toDb = (pieces: number) => {
      const boxes = Math.floor(pieces / ppb);
      const rem = pieces % ppb;
      return boxes + rem / 100;
    };
    const dayMap = new Map<string, { pieces: number; workers: Map<string, number> }>();
    for (const r of ((data as any)?.rows || [])) {
      const rppb = Number((r as any).pieces_per_box || ppb);
      const pieces = Number((r as any).sold_boxes || 0) * rppb + Number((r as any).sold_pieces || 0);
      if (pieces <= 0) continue;
      const day = (r as any).sold_at ? new Date((r as any).sold_at).toISOString().slice(0, 10) : '—';
      if (!dayMap.has(day)) dayMap.set(day, { pieces: 0, workers: new Map() });
      const entry = dayMap.get(day)!;
      entry.pieces += pieces;
      const wn = ((data as any)?.nameMap?.get((r as any).worker_id)) || 'بدون عامل';
      entry.workers.set(wn, (entry.workers.get(wn) || 0) + pieces);
    }
    return Array.from(dayMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, e]) => ({
        day,
        pieces: e.pieces,
        dbValue: toDb(e.pieces),
        workers: Array.from(e.workers.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([name, p]) => ({ name, pieces: p, dbValue: toDb(p) })),
      }));
  }, [data, piecesPerBox]);

  const totalPieces = byDay.reduce((s, d) => s + d.pieces, 0);
  const totalDb = (() => {
    const ppb = Math.max(1, piecesPerBox);
    const boxes = Math.floor(totalPieces / ppb);
    const rem = totalPieces % ppb;
    return boxes + rem / 100;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <ShoppingBag className="w-5 h-5 text-orange-600" />
            <span className="truncate">{productName}</span>
            <span className="text-[11px] font-normal text-muted-foreground">المبيعات اليومية</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between border rounded-xl p-3 bg-orange-50">
          <span className="text-sm font-semibold text-orange-700">الإجمالي</span>
          <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-sm">{fmt(totalDb)}</Badge>
        </div>

        <Button
          onClick={() => setCompetitionOpen(true)}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white gap-2"
        >
          <BarChart3 className="w-4 h-4" />
          منافسة العمال الشهرية
        </Button>


        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground border rounded-xl">جارٍ التحميل...</div>
          ) : byDay.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground border rounded-xl">لا توجد مبيعات</div>
          ) : (
            byDay.map((d, idx) => (
              <details key={d.day} open={idx === 0} className="rounded-xl border overflow-hidden bg-muted/20">
                <summary className="cursor-pointer select-none flex items-center justify-between gap-2 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>{d.day === '—' ? '—' : new Date(d.day).toLocaleDateString('ar-DZ')}</span>
                  </div>
                  <span className="font-extrabold text-orange-700 tabular-nums">{fmt(d.dbValue)}</span>
                </summary>
                <div className="px-3 pb-2 pt-1 space-y-1">
                  {d.workers.map(w => (
                    <div key={w.name} className="flex items-center justify-between gap-2 border rounded-lg px-2 py-1 bg-background">
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <User className="w-3.5 h-3.5" />
                        <span>{w.name}</span>
                      </div>
                      <span className="text-xs font-extrabold text-orange-700 tabular-nums">{fmt(w.dbValue)}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))
          )}
        </div>
      </DialogContent>
      <ProductMonthlyCompetitionDialog
        open={competitionOpen}
        onOpenChange={setCompetitionOpen}
        branchId={branchId}
        productId={productId}
        productName={productName}
        piecesPerBox={piecesPerBox}
      />
    </Dialog>

  );
};

export default ProductDailySoldDialog;
