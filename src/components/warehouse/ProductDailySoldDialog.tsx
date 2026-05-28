import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Calendar, User, BarChart3 } from 'lucide-react';
import { dbBPDisplay } from '@/utils/boxPieceInput';
import { fetchDeliveredOrdersForBranch } from '@/utils/fetchDeliveredOrdersForBranch';
import ProductMonthlyCompetitionDialog from './ProductMonthlyCompetitionDialog';
import type { SelectedReceiptRange } from './ReceiptSessionsTimelineDialog';
import { isInRanges } from './ReceiptSessionsTimelineDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  productId: string;
  productName: string;
  piecesPerBox: number;
  /** ISO date; sales before this date are ignored (e.g. last receipt date) */
  sinceIso?: string | null;
  /** When provided, only orders delivered within one of these windows are shown. */
  ranges?: SelectedReceiptRange[];
}

const ProductDailySoldDialog: React.FC<Props> = ({
  open, onOpenChange, branchId, productId, productName, piecesPerBox, sinceIso, ranges,
}) => {
  const fmt = (v: number) => dbBPDisplay(Math.max(0, v), piecesPerBox);
  const [competitionOpen, setCompetitionOpen] = useState(false);


  const rangesKey = useMemo(
    () => (ranges || []).map((r) => `${r.id}:${r.start}:${r.end}`).join('|'),
    [ranges],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['product-daily-sold-v2', branchId, productId, sinceIso, rangesKey],
    enabled: open && !!branchId && !!productId,
    queryFn: async () => {

      const hasRanges = !!(ranges && ranges.length);
      const minStart = hasRanges
        ? ranges!.reduce((m, r) => (new Date(r.start).getTime() < new Date(m).getTime() ? r.start : m), ranges![0].start)
        : null;

      const orders = await fetchDeliveredOrdersForBranch({
        branchId,
        minStart,
        sinceIso,
        select: 'id, status, branch_id, assigned_worker_id, created_at, updated_at',
      });


      const filteredOrders = orders.filter((o: any) =>
        !hasRanges || isInRanges(o.updated_at || o.created_at, ranges!),
      );


      const orderIds = filteredOrders.map((o: any) => o.id);
      if (orderIds.length === 0) return { rows: [], nameMap: new Map() };


      const { data: items } = await supabase
        .from('order_items')
        .select('order_id, product_id, quantity, gift_quantity, pieces_per_box')
        .eq('product_id', productId)
        .in('order_id', orderIds);

      const orderById = new Map(filteredOrders.map((o: any) => [o.id, o]));
      const rows = (items || []).map((it: any) => {
        const o = orderById.get(it.order_id) as any;
        return {
          order_id: it.order_id,
          worker_id: o?.assigned_worker_id || null,
          sold_at: o?.updated_at || o?.created_at,
          pieces_per_box: it.pieces_per_box || piecesPerBox,
          quantity: Number(it.quantity || 0),
          gift_quantity: Number(it.gift_quantity || 0),
        };
      });

      const workerIds = Array.from(new Set(rows.map((r: any) => r.worker_id).filter(Boolean)));
      const namesRes = workerIds.length
        ? await supabase.from('workers_safe').select('id, full_name').in('id', workerIds as string[])
        : { data: [] as any[] };
      const nameMap = new Map((namesRes.data || []).map((w: any) => [w.id, w.full_name]));

      return { rows, nameMap };
    },
  });

  const byDay = useMemo(() => {
    const ppb = Math.max(1, piecesPerBox);
    const toDb = (pieces: number) => {
      const boxes = Math.floor(pieces / ppb);
      const rem = pieces % ppb;
  const byDay = useMemo(() => {
    const ppb = Math.max(1, piecesPerBox);
    const toDb = (pieces: number) => {
      const boxes = Math.floor(pieces / ppb);
      const rem = pieces % ppb;
      return boxes + rem / 100;
    };
    const dayMap = new Map<string, { pieces: number; giftPieces: number; workers: Map<string, { pieces: number; giftPieces: number }> }>();
    for (const r of ((data as any)?.rows || [])) {
      const rppb = Number((r as any).pieces_per_box || ppb);
      const q = Number((r as any).quantity || 0);
      const giftBoxes = Number((r as any).gift_quantity || 0);
      const qBoxes = Math.max(0, Math.floor(q) - giftBoxes);
      const qPieces = Math.round((q - Math.floor(q)) * 100);
      const pieces = qBoxes * rppb + qPieces;
      const giftPieces = giftBoxes * rppb;
      if (pieces <= 0 && giftPieces <= 0) continue;
      const day = (r as any).sold_at ? new Date((r as any).sold_at).toISOString().slice(0, 10) : '—';
      if (!dayMap.has(day)) dayMap.set(day, { pieces: 0, giftPieces: 0, workers: new Map() });
      const entry = dayMap.get(day)!;
      entry.pieces += pieces;
      entry.giftPieces += giftPieces;
      const wn = ((data as any)?.nameMap?.get((r as any).worker_id)) || 'بدون عامل';
      const w = entry.workers.get(wn) || { pieces: 0, giftPieces: 0 };
      w.pieces += pieces;
      w.giftPieces += giftPieces;
      entry.workers.set(wn, w);
    }

    return Array.from(dayMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, e]) => ({
        day,
        pieces: e.pieces,
        dbValue: toDb(e.pieces),
        giftPieces: e.giftPieces,
        giftDbValue: toDb(e.giftPieces),
        workers: Array.from(e.workers.entries())
          .sort((a, b) => b[1].pieces - a[1].pieces)
          .map(([name, p]) => ({ name, pieces: p.pieces, dbValue: toDb(p.pieces), giftPieces: p.giftPieces, giftDbValue: toDb(p.giftPieces) })),
      }));
  }, [data, piecesPerBox]);
  const totalPieces = byDay.reduce((s, d) => s + d.pieces, 0);
  const totalGiftPieces = byDay.reduce((s, d) => s + d.giftPieces, 0);
  const totalDb = (() => {
    const ppb = Math.max(1, piecesPerBox);
    const boxes = Math.floor(totalPieces / ppb);
    const rem = totalPieces % ppb;
    return boxes + rem / 100;
  })();
  const totalGiftDb = (() => {
    const ppb = Math.max(1, piecesPerBox);
    const boxes = Math.floor(totalGiftPieces / ppb);
    const rem = totalGiftPieces % ppb;
    return boxes + rem / 100;
  })();


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <ShoppingBag className="w-5 h-5 text-orange-600" />
            <span className="truncate">{productName}</span>
            <span className="text-[11px] font-normal text-muted-foreground">
              {sinceIso
                ? `المبيعات منذ ${new Date(sinceIso).toLocaleDateString('ar-DZ')} حتى الآن`
                : 'كل المبيعات'}
            </span>
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
