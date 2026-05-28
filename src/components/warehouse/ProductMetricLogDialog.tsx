import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Gift, AlertTriangle, TrendingUp, TrendingDown, RotateCcw, HandCoins, Sparkles, Calendar, User, ChevronLeft, ShoppingCart,
} from 'lucide-react';
import { dbBPDisplayAlways } from '@/utils/boxPieceInput';
import { dedupeSalesTrackingRows } from '@/utils/salesTrackingDedup';
import { fetchDeliveredOrdersForBranch } from '@/utils/fetchDeliveredOrdersForBranch';
import type { SelectedReceiptRange } from './ReceiptSessionsTimelineDialog';
import { isInRanges } from './ReceiptSessionsTimelineDialog';

export type MetricKind =
  | 'gifts'
  | 'damaged'
  | 'surplus'
  | 'deficit'
  | 'factoryReturn'
  | 'compensation'
  | 'offers';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  productId: string;
  productName: string;
  piecesPerBox: number;
  metric: MetricKind;
  /** When provided, only entries whose date falls inside one window are shown. */
  ranges?: SelectedReceiptRange[];
}

interface Entry {
  id: string;
  when: string | null;
  qty: number; // in db box-piece display format
  who?: string | null;
  note?: string | null;
  refLabel?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerStoreName?: string | null;
  customerFullName?: string | null;
  delivered?: boolean | null; // null = no related order
  workerName?: string | null;
}

const META: Record<MetricKind, { title: string; icon: React.ReactNode; color: string; tone: string; accent: string }> = {
  gifts:         { title: 'سجل الهدايا',        icon: <Gift className="w-5 h-5" />,         color: 'pink',    tone: 'bg-pink-50 text-pink-700 border-pink-200',         accent: 'text-pink-700' },
  damaged:       { title: 'سجل التالف',         icon: <AlertTriangle className="w-5 h-5" />, color: 'red',     tone: 'bg-red-50 text-red-700 border-red-200',             accent: 'text-red-700' },
  surplus:       { title: 'سجل الزيادة',        icon: <TrendingUp className="w-5 h-5" />,    color: 'amber',   tone: 'bg-amber-50 text-amber-700 border-amber-200',       accent: 'text-amber-700' },
  deficit:       { title: 'سجل النقص',          icon: <TrendingDown className="w-5 h-5" />,  color: 'red',     tone: 'bg-red-50 text-red-700 border-red-200',             accent: 'text-red-700' },
  factoryReturn: { title: 'سجل الإرجاع للمصنع', icon: <RotateCcw className="w-5 h-5" />,     color: 'violet',  tone: 'bg-violet-50 text-violet-700 border-violet-200',     accent: 'text-violet-700' },
  compensation:  { title: 'سجل التعويض',        icon: <HandCoins className="w-5 h-5" />,     color: 'teal',    tone: 'bg-teal-50 text-teal-700 border-teal-200',           accent: 'text-teal-700' },
  offers:        { title: 'سجل العروض',         icon: <Sparkles className="w-5 h-5" />,      color: 'fuchsia', tone: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', accent: 'text-fuchsia-700' },
};

const piecesToDbBP = (pieces: number, ppb: number) => {
  const p = Math.max(0, Math.round(pieces));
  const b = Math.floor(p / Math.max(1, ppb));
  const r = p % Math.max(1, ppb);
  return b + r / 100;
};

const parseDisplay = (v: any): number => {
  if (v == null) return 0;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const buildPromoTrackingKey = ({
  workerId,
  customerId,
  occurredAt,
  giftBoxes,
  giftPieces,
}: {
  workerId?: string | null;
  customerId?: string | null;
  occurredAt?: string | null;
  giftBoxes?: number | null;
  giftPieces?: number | null;
}) => [
  workerId || '',
  customerId || '',
  occurredAt || '',
  Number(giftBoxes || 0),
  Number(giftPieces || 0),
].join('|');

const ProductMetricLogDialog: React.FC<Props> = ({
  open, onOpenChange, branchId, productId, productName, piecesPerBox, metric, ranges,
}) => {
  const meta = META[metric];
  const fmt = (v: number) => dbBPDisplayAlways(Math.max(0, v), piecesPerBox);
  const rangesKey = useMemo(
    () => (ranges || []).map((r) => `${r.id}:${r.start}:${r.end}`).join('|'),
    [ranges],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['product-metric-log', metric, branchId, productId, rangesKey],
    enabled: open && !!branchId && !!productId,
    queryFn: async (): Promise<Entry[]> => {
      // Helper to resolve worker names
      const resolveWorkers = async (ids: string[]) => {
        const uniq = Array.from(new Set(ids.filter(Boolean)));
        if (!uniq.length) return new Map<string, string>();
        const { data } = await supabase.from('workers_safe').select('id, full_name').in('id', uniq);
        return new Map((data || []).map((w: any) => [w.id, w.full_name]));
      };

      if (metric === 'surplus' || metric === 'deficit') {
        const { data: rows } = await supabase
          .from('stock_discrepancies')
          .select('id, quantity, discrepancy_type, created_at, notes, worker_id')
          .eq('branch_id', branchId)
          .eq('product_id', productId)
          .eq('discrepancy_type', metric)
          .order('created_at', { ascending: false });
        const names = await resolveWorkers((rows || []).map((r: any) => r.worker_id));
        return (rows || []).map((r: any) => ({
          id: r.id,
          when: r.created_at,
          qty: Number(r.quantity || 0),
          who: names.get(r.worker_id || '') || null,
          note: r.notes || null,
        }));
      }

      if (metric === 'gifts') {
        // Source of truth: delivered orders + order_items (sales_tracking is unreliable —
        // rows get deleted on order modification and partial-inserted by deferred-offer confirms).
        const orders = await fetchDeliveredOrdersForBranch({
          branchId,
          select: 'id, status, branch_id, assigned_worker_id, created_at, updated_at',
        });
        const rangeFilteredOrders = (orders || []).filter((order: any) =>
          !(ranges && ranges.length) || isInRanges(order?.updated_at || order?.created_at, ranges),
        );
        const orderIds = rangeFilteredOrders.map((o: any) => o.id);
        if (!orderIds.length) return [];
        const { data: items } = await supabase
          .from('order_items')
          .select('id, order_id, product_id, gift_quantity, pieces_per_box')
          .eq('product_id', productId)
          .in('order_id', orderIds);
        const orderById = new Map(rangeFilteredOrders.map((o: any) => [o.id, o]));
        const filtered = (items || []).filter((it: any) => Number(it.gift_quantity || 0) > 0);
        const names = await resolveWorkers(filtered.map((it: any) => orderById.get(it.order_id)?.assigned_worker_id).filter(Boolean));
        return filtered
          .map((it: any) => {
            const o = orderById.get(it.order_id) as any;
            const ppb = Number(it.pieces_per_box) || piecesPerBox;
            const g = Number(it.gift_quantity || 0);
            const gBoxes = Math.floor(g);
            const gPieces = Math.round((g - gBoxes) * 100);
            const pieces = gBoxes * ppb + gPieces;
            return {
              id: it.id,
              when: o?.updated_at || o?.created_at || null,
              qty: piecesToDbBP(pieces, piecesPerBox),
              who: names.get(o?.assigned_worker_id) || null,
              refLabel: 'توصيل',
            };
          })
          .sort((a: any, b: any) => new Date(b.when || 0).getTime() - new Date(a.when || 0).getTime());
      }


      if (metric === 'offers') {
        const orders = await fetchDeliveredOrdersForBranch({
          branchId,
          select: 'id, status, branch_id, customer_id, assigned_worker_id, created_at, updated_at',
        });
        const rangeFilteredOrders = (orders || []).filter((order: any) =>
          !(ranges && ranges.length) || isInRanges(order?.updated_at || order?.created_at, ranges),
        );
        const orderIds = rangeFilteredOrders.map((o: any) => o.id);
        if (!orderIds.length) return [];
        const { data: items } = await supabase
          .from('order_items')
          .select('id, order_id, product_id, gift_quantity, gift_pieces, pieces_per_box')
          .eq('product_id', productId)
          .in('order_id', orderIds);

        const orderById = new Map(rangeFilteredOrders.map((o: any) => [o.id, o]));
        const filtered = (items || []).filter((it: any) =>
          Number(it.gift_quantity || 0) > 0 || Number(it.gift_pieces || 0) > 0,
        );
        const names = await resolveWorkers(filtered.map((it: any) => orderById.get(it.order_id)?.assigned_worker_id).filter(Boolean));
        const customerIds = Array.from(new Set(filtered.map((it: any) => orderById.get(it.order_id)?.customer_id).filter(Boolean)));
        const { data: customers } = customerIds.length
          ? await supabase.from('customers').select('id, name, store_name').in('id', customerIds as string[])
          : { data: [] as any[] };
        const custMap = new Map((customers || []).map((c: any) => [c.id, { store: c.store_name || null, full: c.name || null }]));

        const orderEntries = filtered
          .map((it: any) => {
            const o = orderById.get(it.order_id) as any;
            const ppb = Number(it.pieces_per_box) || piecesPerBox;
            const giftBoxesRaw = Number(it.gift_quantity || 0);
            const giftBoxes = Math.floor(giftBoxesRaw);
            const giftBoxPieces = Math.round((giftBoxesRaw - giftBoxes) * 100);
            const extraGiftPieces = Number(it.gift_pieces || 0);
            const pieces = giftBoxes * ppb + giftBoxPieces + extraGiftPieces;
            const c = custMap.get(o?.customer_id) || { store: null, full: null };
            const cname = c.store || c.full || null;
            return {
              id: it.id,
              when: o?.updated_at || o?.created_at || null,
              qty: piecesToDbBP(pieces, piecesPerBox),
              who: cname || names.get(o?.assigned_worker_id) || null,
              refLabel: 'توصيل',
              customerId: o?.customer_id || null,
              customerName: cname,
              customerStoreName: c.store,
              customerFullName: c.full,
              delivered: true,
              workerName: names.get(o?.assigned_worker_id) || null,
            };
          });

        // Manual promo entries (admin-entered) — sales_tracking with order_id = null
        const { data: manualRows } = await supabase
          .from('sales_tracking')
          .select('id, product_id, branch_id, worker_id, customer_id, gift_boxes, gift_pieces, pieces_per_box, sold_at, order_id, source')
          .eq('product_id', productId)
          .eq('branch_id', branchId)
          .is('order_id', null);
        const mFiltered = (manualRows || []).filter((r: any) => {
          if (!(Number(r.gift_boxes || 0) > 0 || Number(r.gift_pieces || 0) > 0)) return false;
          if (ranges && ranges.length && !isInRanges(r.sold_at, ranges)) return false;
          return true;
        });
        const mWorkerIds = Array.from(new Set(mFiltered.map((r: any) => r.worker_id).filter(Boolean)));
        const mCustomerIds = Array.from(new Set(mFiltered.map((r: any) => r.customer_id).filter(Boolean)));
        const [mNamesBase, mAdminRes, mCustRes] = await Promise.all([
          resolveWorkers(mWorkerIds),
          mWorkerIds.length
            ? supabase.from('workers').select('id, full_name, role').in('id', mWorkerIds as string[])
            : Promise.resolve({ data: [] as any[] }),
          mCustomerIds.length
            ? supabase.from('customers').select('id, name, store_name').in('id', mCustomerIds as string[])
          : Promise.resolve({ data: [] as any[] }),
        ]);
        const mCustMap = new Map<string, { store: string | null; full: string | null }>(((mCustRes as any).data || []).map((c: any) => [c.id, { store: c.store_name || null, full: c.name || null }]));
        const manualEntries = mFiltered.map((r: any) => {
          const ppb = Number(r.pieces_per_box) || piecesPerBox;
          const pieces = Number(r.gift_boxes || 0) * ppb + Number(r.gift_pieces || 0);
          const c = mCustMap.get(r.customer_id) || { store: null, full: null };
          const cname = c.store || c.full || null;
          return {
            id: `manual-${r.id}`,
            when: r.sold_at,
            qty: piecesToDbBP(pieces, piecesPerBox),
            who: cname || mNames.get(r.worker_id || '') || null,
            refLabel: 'يدوي',
            customerId: r.customer_id || null,
            customerName: cname,
            customerStoreName: c.store,
            customerFullName: c.full,
            delivered: true,
            workerName: mNames.get(r.worker_id || '') || null,
          };
        });

        return [...orderEntries, ...manualEntries]
          .sort((a: any, b: any) => new Date(b.when || 0).getTime() - new Date(a.when || 0).getTime());
      }


      // damaged / factoryReturn / compensation → activity_logs manual edits
      const changeKey = metric; // 'damaged' | 'factoryReturn' | 'compensation'
      const { data: edits } = await supabase
        .from('activity_logs')
        .select('id, created_at, worker_id, details')
        .eq('branch_id', branchId)
        .eq('entity_type', 'warehouse_stock_manual_edit')
        .eq('entity_id', productId)
        .order('created_at', { ascending: false })
        .limit(300);
      const names = await resolveWorkers((edits || []).map((e: any) => e.worker_id));
      const out: Entry[] = [];
      for (const e of (edits || [])) {
        const ch = ((e.details as any) && (e.details as any).changes) || {};
        const c = ch[changeKey];
        if (!c) continue;
        const delta = parseDisplay(c.to) - parseDisplay(c.from);
        if (Math.abs(delta) < 0.0001) continue;
        out.push({
          id: `${e.id}-${changeKey}`,
          when: e.created_at,
          qty: Math.abs(delta),
          who: names.get(e.worker_id || '') || null,
          note: `${c.from} ← ${c.to}${delta < 0 ? ' (انخفاض)' : ''}`,
        });
      }
      return out;
    },
  });

  const [offerDetail, setOfferDetail] = useState<Entry | null>(null);
  const [workerFilter, setWorkerFilter] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    let arr = data || [];
    if (ranges && ranges.length) {
      arr = arr.filter((e) => isInRanges(e.when, ranges));
    }
    if (workerFilter) arr = arr.filter((e) => e.workerName === workerFilter);
    return arr;
  }, [data, workerFilter, ranges]);

  const total = useMemo(() => filteredData.reduce((s, e) => s + (e.qty || 0), 0), [filteredData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className={meta.accent}>{meta.icon}</span>
            <span className="truncate">{productName}</span>
            <span className="text-[11px] font-normal text-muted-foreground">{meta.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className={`flex items-center justify-between border-2 rounded-xl p-3 ${meta.tone}`}>
          <span className="text-sm font-semibold">الإجمالي</span>
          <Badge className={`${meta.tone} text-sm font-bold border`}>{fmt(total)}</Badge>
        </div>

        {workerFilter && (
          <button
            type="button"
            onClick={() => setWorkerFilter(null)}
            className="text-[11px] underline text-muted-foreground hover:text-foreground self-start"
          >
            إزالة فلتر العامل: {workerFilter}
          </button>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground border rounded-xl">جارٍ التحميل...</div>
          ) : (filteredData.length === 0) ? (
            <div className="p-4 text-center text-muted-foreground border rounded-xl">لا توجد سجلات</div>
          ) : (() => {
            // Group entries by workerName
            const groups = new Map<string, Entry[]>();
            for (const e of filteredData) {
              const k = e.workerName || 'بدون عامل';
              if (!groups.has(k)) groups.set(k, []);
              groups.get(k)!.push(e);
            }
            const palette = [
              'bg-blue-50 text-blue-700 border-blue-300',
              'bg-amber-50 text-amber-700 border-amber-300',
              'bg-emerald-50 text-emerald-700 border-emerald-300',
              'bg-purple-50 text-purple-700 border-purple-300',
              'bg-rose-50 text-rose-700 border-rose-300',
              'bg-cyan-50 text-cyan-700 border-cyan-300',
              'bg-orange-50 text-orange-700 border-orange-300',
              'bg-indigo-50 text-indigo-700 border-indigo-300',
            ];
            const colorFor = (name: string) => {
              let h = 0;
              for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
              return palette[h % palette.length];
            };
            return Array.from(groups.entries())
              .sort((a, b) => b[1].reduce((s, e) => s + (e.qty || 0), 0) - a[1].reduce((s, e) => s + (e.qty || 0), 0))
              .map(([workerName, entries]) => {
              const groupTotal = entries.reduce((s, e) => s + (e.qty || 0), 0);
              const headerCls = colorFor(workerName);
              const isActive = workerFilter === workerName;
              return (
                <details key={workerName} open className="rounded-xl border overflow-hidden">
                  <summary className={`cursor-pointer select-none flex items-center justify-between gap-2 px-3 py-2 ${headerCls} ${isActive ? 'ring-2 ring-foreground/40' : ''}`}>
                    <span className="inline-flex items-center gap-2 text-xs font-bold">
                      <User className="w-3.5 h-3.5" />
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          setWorkerFilter(isActive ? null : workerName);
                        }}
                        className="underline-offset-2 hover:underline"
                      >
                        {workerName}
                      </button>
                      <span className="text-[10px] opacity-70">({entries.length})</span>
                    </span>
                    <span className="font-extrabold tabular-nums text-sm">{fmt(groupTotal)}</span>
                  </summary>
                  <div className="p-2 space-y-2 bg-background">
                    {entries.map(e => {
                      const clickable = metric === 'offers' && !!e.customerId;
                      const inner = (
                        <>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>{e.when ? new Date(e.when).toLocaleString('ar-DZ', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
                            </div>
                            <span className={`font-extrabold tabular-nums ${meta.accent}`}>{fmt(e.qty)}</span>
                          </div>
                          {(e.who || e.refLabel || e.delivered != null) && (
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                              {e.who && (<span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{e.who}</span>)}
                              {e.refLabel && <Badge variant="outline" className="text-[10px]">{e.refLabel}</Badge>}
                              {e.delivered != null && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${e.delivered ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-orange-50 text-orange-700 border-orange-300'}`}
                                >
                                  {e.delivered ? 'تم التسليم' : 'لم يُسلَّم'}
                                </Badge>
                              )}
                              {clickable && <ChevronLeft className="w-3 h-3 ms-auto opacity-60" />}
                            </div>
                          )}
                          {e.note && (<div className="mt-1 text-[11px] text-muted-foreground break-words">{e.note}</div>)}
                        </>
                      );
                      const cls = `block w-full text-right rounded-lg border px-3 py-2 ${meta.tone} bg-opacity-40 ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-fuchsia-300 active:scale-[0.99] transition' : ''}`;
                      return clickable ? (
                        <button key={e.id} type="button" className={cls} onClick={() => setOfferDetail(e)}>{inner}</button>
                      ) : (
                        <div key={e.id} className={cls}>{inner}</div>
                      );
                    })}
                  </div>
                </details>
              );
            });
          })()}
        </div>

        {offerDetail && (
          <OfferRecipientDetailsDialog
            open={!!offerDetail}
            onOpenChange={(v) => !v && setOfferDetail(null)}
            branchId={branchId}
            productId={productId}
            productName={productName}
            piecesPerBox={piecesPerBox}
            entry={offerDetail}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Nested dialog: For a given offer event, show the customer's purchases of
// this product accumulating until the offer was granted.
// ─────────────────────────────────────────────────────────────────────────────
const OfferRecipientDetailsDialog: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branchId: string;
  productId: string;
  productName: string;
  piecesPerBox: number;
  entry: Entry;
}> = ({ open, onOpenChange, branchId, productId, productName, piecesPerBox, entry }) => {
  const fmt = (v: number) => dbBPDisplayAlways(Math.max(0, v), piecesPerBox);

  const { data, isLoading } = useQuery({
    queryKey: ['offer-recipient-detail', branchId, productId, entry.customerId, entry.when],
    enabled: open && !!entry.customerId,
    queryFn: async () => {
      // All purchases by this customer for this product, up to and including this offer event
      const upTo = entry.when || new Date().toISOString();
      const { data: rows } = await supabase
        .from('sales_tracking')
        .select('id, sold_at, sold_boxes, sold_pieces, gift_boxes, gift_pieces, pieces_per_box, source, order_id, product_id, worker_id, customer_id')
        .eq('product_id', productId)
        .eq('customer_id', entry.customerId!)
        .or(`branch_id.eq.${branchId},branch_id.is.null`)
        .lte('sold_at', upTo)
        .order('sold_at', { ascending: true });

      // Determine the start point: previous gift event (so we show the accumulation that triggered THIS gift)
      const list = dedupeSalesTrackingRows((rows || []) as any[]).sort((a, b) => {
        const at = new Date(a.sold_at || 0).getTime();
        const bt = new Date(b.sold_at || 0).getTime();
        return at - bt;
      });
      // last index where a gift was received BEFORE current entry
      let startIdx = 0;
      for (let i = list.length - 2; i >= 0; i--) {
        const g = Number(list[i].gift_boxes || 0) + Number(list[i].gift_pieces || 0);
        if (g > 0) { startIdx = i + 1; break; }
      }
      const slice = list.slice(startIdx);

      let cumPieces = 0;
      return slice.map((r) => {
        const ppb = Number(r.pieces_per_box) || piecesPerBox;
        const soldPieces = Number(r.sold_boxes || 0) * ppb + Number(r.sold_pieces || 0);
        const giftPieces = Number(r.gift_boxes || 0) * ppb + Number(r.gift_pieces || 0);
        cumPieces += soldPieces;
        return {
          id: r.id,
          when: r.sold_at,
          sold: piecesToDbBP(soldPieces, piecesPerBox),
          gift: piecesToDbBP(giftPieces, piecesPerBox),
          cum: piecesToDbBP(cumPieces, piecesPerBox),
          source: r.source as string,
        };
      });
    },
  });

  const sourceLabel = (s: string) => s === 'warehouse_sale' ? 'بيع من المخزن' : s === 'direct_sale' ? 'بيع مباشر' : 'توصيل';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2">
            <ShoppingCart className="w-5 h-5 text-fuchsia-600 mt-0.5 shrink-0" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="truncate font-bold text-base">
                {entry.customerStoreName || entry.customerName || entry.who || 'الزبون'}
              </span>
              {entry.customerFullName && entry.customerStoreName && (
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {entry.customerFullName}
                </span>
              )}
              <span className="text-[11px] font-normal text-muted-foreground mt-0.5">
                المشتريات حتى استحقاق العرض
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between border-2 rounded-xl p-3 bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700">
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{productName}</span>
            {(data?.length ?? 0) > 0 && (
              <span className="text-[11px] font-normal text-fuchsia-600/80">
                إجمالي المشتريات: <span className="font-bold tabular-nums">{fmt(data![data!.length - 1].cum)}</span>
              </span>
            )}
          </div>
          <Badge className="bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 text-sm">عرض {fmt(entry.qty)}</Badge>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground border rounded-xl">جارٍ التحميل...</div>
          ) : (data?.length ?? 0) === 0 ? (
            <div className="p-4 text-center text-muted-foreground border rounded-xl">لا توجد مشتريات سابقة</div>
          ) : (
            (data || []).map((r, idx) => {
              const isTrigger = idx === (data!.length - 1);
              return (
                <div key={r.id}
                  className={`rounded-xl border px-3 py-2 ${isTrigger ? 'bg-fuchsia-50 border-fuchsia-300 ring-1 ring-fuchsia-300' : 'bg-muted/30'}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{r.when ? new Date(r.when).toLocaleString('ar-DZ', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{sourceLabel(r.source)}</Badge>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px]">
                    <span className="text-muted-foreground">
                      اشترى: <span className="font-bold text-foreground tabular-nums">{fmt(r.sold)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      التراكمي: <span className="font-extrabold text-fuchsia-700 tabular-nums">{fmt(r.cum)}</span>
                    </span>
                  </div>
                  {r.gift > 0 && (
                    <div className="mt-1 text-[11px] text-fuchsia-700 font-semibold">
                      🎁 استلم عرض: {fmt(r.gift)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductMetricLogDialog;
