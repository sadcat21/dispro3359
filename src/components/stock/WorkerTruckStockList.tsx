import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Package, PackageOpen, TrendingUp, TrendingDown, Gift, History, CalendarDays, List, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDeliveredPaidQuantity } from '@/utils/orderItemQuantities';
import { dbBPToBoxes, boxesToBPAlways } from '@/utils/boxPieceInput';

/** Format a fractional-boxes value as B.P notation using the product's pieces-per-box. */
const fmtBP = (fractionalBoxes: number, ppb: number) =>
  boxesToBPAlways(Math.max(0, Number.isFinite(fractionalBoxes) ? fractionalBoxes : 0), Math.max(1, ppb || 1));

const confirmedGiftFractional = (item: any, ppb: number) => {
  const safePpb = Math.max(1, ppb || 1);
  const storedPieces = Math.max(0, Number(item.gift_quantity || 0)) * safePpb
    + Math.max(0, Number(item.gift_pieces || 0));
  const pendingPieces = Math.max(0, Number(item.pending_gift_boxes || 0)) * safePpb
    + Math.max(0, Number(item.pending_gift_pieces || 0));
  return Math.max(0, storedPieces - pendingPieces) / safePpb;
};

interface Props {
  workerId: string;
  emptyLabel?: string;
}

export const WorkerTruckStockList: React.FC<Props> = ({ workerId, emptyLabel = 'لا يوجد مخزون في الشاحنة' }) => {
  const [selected, setSelected] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'list';
    return (localStorage.getItem('wtsl-view-mode') as 'list' | 'grid') || 'list';
  });
  const setMode = (m: 'list' | 'grid') => {
    setViewMode(m);
    try { localStorage.setItem('wtsl-view-mode', m); } catch {}
  };

  const { data: truckStock = [] } = useQuery({
    queryKey: ['wtsl-stock', workerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('worker_stock')
        .select('*, product:products(name, image_url, pieces_per_box)')
        .eq('worker_id', workerId)
        .gte('quantity', 0);
      return data || [];
    },
    enabled: !!workerId,
  });

  const { data: lastAccounting } = useQuery({
    queryKey: ['wtsl-last-accounting', workerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('accounting_sessions')
        .select('completed_at')
        .eq('worker_id', workerId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.completed_at || null;
    },
    enabled: !!workerId,
  });

  const { data: loadedData = [] } = useQuery({
    queryKey: ['wtsl-loaded', workerId, lastAccounting],
    queryFn: async () => {
      let q = supabase
        .from('loading_sessions')
        .select('id, created_at, status, notes, manager:workers!loading_sessions_manager_id_fkey(full_name)')
        .eq('worker_id', workerId)
        .in('status', ['completed', 'open']);
      if (lastAccounting) q = q.gte('created_at', lastAccounting);
      const { data: sessions } = await q;
      if (!sessions?.length) return [];
      const { data: items } = await supabase
        .from('loading_session_items')
        .select('session_id, product_id, quantity, gift_quantity, gift_unit, previous_quantity')
        .in('session_id', sessions.map(s => s.id));
      return (items || []).map((it: any) => ({ ...it, _session: sessions.find((s: any) => s.id === it.session_id) }));
    },
    enabled: !!workerId,
  });

  const { data: unloadedData = [] } = useQuery({
    queryKey: ['wtsl-unloaded', workerId, lastAccounting],
    queryFn: async () => {
      let q = supabase
        .from('loading_sessions')
        .select('id, created_at, status, notes, manager:workers!loading_sessions_manager_id_fkey(full_name)')
        .eq('worker_id', workerId)
        .eq('status', 'unloaded');
      if (lastAccounting) q = q.gte('created_at', lastAccounting);
      const { data: sessions } = await q;
      if (!sessions?.length) return [];
      const { data: items } = await supabase
        .from('loading_session_items')
        .select('session_id, product_id, quantity')
        .in('session_id', sessions.map(s => s.id));
      return (items || []).map((it: any) => ({ ...it, _session: sessions.find((s: any) => s.id === it.session_id) }));
    },
    enabled: !!workerId,
  });

  const { data: soldData = [] } = useQuery({
    queryKey: ['wtsl-sold', workerId, lastAccounting],
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select('id, created_at, updated_at, payment_type, customer:customers(name, store_name, phone)')
        .eq('status', 'delivered')
        .or(`assigned_worker_id.eq.${workerId},created_by.eq.${workerId}`);
      if (lastAccounting) q = q.gte('updated_at', lastAccounting);
      const { data: orders } = await q;
      if (!orders?.length) return [];
      const { data: items } = await supabase
        .from('order_items')
        .select('order_id, product_id, quantity, gift_quantity, gift_pieces, gift_offer_id, unit_price, total_price, price_subtype')
        .in('order_id', orders.map(o => o.id));
      const { data: movements } = await supabase
        .from('stock_movements')
        .select('order_id, product_id, quantity, signed_quantity, movement_type')
        .eq('worker_id', workerId)
        .in('movement_type', ['delivery', 'modification', 'direct_sale'])
        .in('order_id', orders.map(o => o.id));
      const deliveredByOrderProduct = new Map<string, number>();
      const channelByOrderProduct = new Map<string, string>();
      for (const movement of movements || []) {
        const key = `${movement.order_id}|${movement.product_id}`;
        const delta = movement.movement_type === 'modification'
          ? -Number(movement.signed_quantity || 0)
          : Number(movement.quantity || 0);
        deliveredByOrderProduct.set(key, (deliveredByOrderProduct.get(key) || 0) + delta);
        if (movement.movement_type === 'delivery' || movement.movement_type === 'direct_sale') {
          channelByOrderProduct.set(key, movement.movement_type);
        }
      }
      const { data: pendingOffers } = await supabase
        .from('pending_offer_confirmations' as any)
        .select('order_id, product_id, offer_id, gift_boxes, gift_pieces')
        .eq('status', 'pending')
        .in('order_id', orders.map(o => o.id));
      const pendingGiftByOrderProductOffer = new Map<string, { boxes: number; pieces: number }>();
      for (const pending of (pendingOffers || []) as any[]) {
        const key = `${pending.order_id}|${pending.product_id}|${pending.offer_id || ''}`;
        const current = pendingGiftByOrderProductOffer.get(key) || { boxes: 0, pieces: 0 };
        current.boxes += Number(pending.gift_boxes || 0);
        current.pieces += Number(pending.gift_pieces || 0);
        pendingGiftByOrderProductOffer.set(key, current);
      }
      const map = new Map(orders.map((o: any) => [o.id, o]));
      return (items || []).map((i: any) => {
        const o: any = map.get(i.order_id);
        const pendingGift = pendingGiftByOrderProductOffer.get(`${i.order_id}|${i.product_id}|${i.gift_offer_id || ''}`) || { boxes: 0, pieces: 0 };
        return {
          ...i,
          pending_gift_boxes: pendingGift.boxes,
          pending_gift_pieces: pendingGift.pieces,
          delivered_quantity: deliveredByOrderProduct.get(`${i.order_id}|${i.product_id}`),
          sale_channel: channelByOrderProduct.get(`${i.order_id}|${i.product_id}`) || 'delivery',
          order_updated_at: o?.updated_at || null,
          order_created_at: o?.created_at || null,
          order_payment_type: o?.payment_type || null,
          customer_name: o?.customer?.name || null,
          customer_store_name: o?.customer?.store_name || null,
        };
      });
    },
    enabled: !!workerId,
  });

  const { data: modificationData = [] } = useQuery({
    queryKey: ['wtsl-modifications', workerId, lastAccounting],
    queryFn: async () => {
      let q = supabase
        .from('stock_movements')
        .select('id, product_id, quantity, signed_quantity, created_at, notes, order_id, order:orders(payment_type, status, customer:customers(name, store_name))')
        .eq('worker_id', workerId)
        .eq('movement_type', 'modification');
      if (lastAccounting) q = q.gte('created_at', lastAccounting);
      const { data } = await q;
      return (data || []) as any[];
    },
    enabled: !!workerId,
  });

  // Map productId -> pieces_per_box from current truck stock (default 20).
  const ppbMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of truckStock as any[]) {
      m[it.product_id] = Math.max(1, Number(it.product?.pieces_per_box) || 20);
    }
    return m;
  }, [truckStock]);
  const ppbOf = (pid: string) => ppbMap[pid] || 20;

  const stats = useMemo(() => {
    const out: Record<string, any> = {};
    const ensure = (id: string) => (out[id] ||= { loaded: 0, unloaded: 0, sold: 0, giftQty: 0, loadCount: new Set(), unloadCount: new Set(), saleCount: new Set() });
    for (const it of loadedData) {
      const ppb = ppbOf(it.product_id);
      const s = ensure(it.product_id);
      const qty = dbBPToBoxes(Number(it.quantity || 0), ppb);
      const gift = it.gift_unit === 'piece'
        ? Math.max(0, Number(it.gift_quantity || 0)) / ppb
        : dbBPToBoxes(Number(it.gift_quantity || 0), ppb);
      // "Charged" = paid quantity only. Gifts are tracked separately.
      s.loaded += qty;
      if ((qty + gift) > 0 && it.session_id) s.loadCount.add(String(it.session_id));
      s.giftQty += gift;
    }
    for (const it of unloadedData) {
      const ppb = ppbOf(it.product_id);
      const s = ensure(it.product_id);
      const q = dbBPToBoxes(Number(it.quantity || 0), ppb);
      s.unloaded += q;
      if (q > 0 && it.session_id) s.unloadCount.add(String(it.session_id));
    }
    for (const it of soldData) {
      const ppb = ppbOf(it.product_id);
      const s = ensure(it.product_id);
      const paidBP = getDeliveredPaidQuantity(it);
      const paid = dbBPToBoxes(Number(paidBP || 0), ppb);
      s.sold += paid;
      if (paid > 0 && it.order_id) s.saleCount.add(String(it.order_id));
      s.giftQty += confirmedGiftFractional(it, ppb);
    }
    return out;
  }, [loadedData, unloadedData, soldData, ppbMap]);

  const history = useMemo(() => {
    if (!selected) return null;
    const pid = selected.product_id;
    const ppb = ppbOf(pid);
    const currentQty = dbBPToBoxes(Number(selected.quantity || 0), ppb);
    const lastLabel = lastAccounting
      ? new Date(lastAccounting).toLocaleString('ar-DZ', { dateStyle: 'short', timeStyle: 'short' })
      : null;

    type Mv = { id: string; type: 'load' | 'unload' | 'sale' | 'gift' | 'modification'; label: string; quantity: number; when: string; note?: string | null; paymentType?: string | null; customerStoreName?: string | null; customerName?: string | null; sourceLabel?: string | null; saleChannel?: string | null; orderStatus?: string | null; priceSubtype?: string | null; totalPaid?: number | null; delta: number; before?: number; after?: number };
    const movements: Mv[] = [];

    for (const it of loadedData.filter((x: any) => x.product_id === pid)) {
      const giftQty = it.gift_unit === 'piece'
        ? Math.max(0, Number(it.gift_quantity || 0)) / ppb
        : dbBPToBoxes(Number(it.gift_quantity || 0), ppb);
      const paid = dbBPToBoxes(Number(it.quantity || 0), ppb);
      const total = paid + giftQty;
      movements.push({ id: `load-${it.session_id}-${paid}`, type: 'load', label: 'شحن', quantity: paid, when: it._session?.created_at || '', note: giftQty > 0 ? `+${fmtBP(giftQty, ppb)} هدية` : (it._session?.notes || null), sourceLabel: it._session?.manager?.full_name || null, delta: total });
    }
    for (const it of unloadedData.filter((x: any) => x.product_id === pid)) {
      const q = dbBPToBoxes(Number(it.quantity || 0), ppb);
      movements.push({ id: `unload-${it.session_id}-${q}`, type: 'unload', label: 'تفريغ', quantity: q, when: it._session?.created_at || '', note: it._session?.notes || null, sourceLabel: it._session?.manager?.full_name || null, delta: -q });
    }
    for (const it of soldData.filter((x: any) => x.product_id === pid)) {
      const giftQty = confirmedGiftFractional(it, ppb);
      const saleQty = dbBPToBoxes(Number(getDeliveredPaidQuantity(it) || 0), ppb);
      const when = it.order_updated_at || it.order_created_at || '';
      if (saleQty > 0) movements.push({ id: `sale-${it.order_id}-${when}`, type: 'sale', label: 'بيع', quantity: saleQty, when, paymentType: it.order_payment_type, customerStoreName: it.customer_store_name, customerName: it.customer_name, saleChannel: it.sale_channel || 'delivery', priceSubtype: it.price_subtype || null, totalPaid: Number(it.total_price || 0), note: giftQty > 0 ? `هدايا ${fmtBP(giftQty, ppb)}` : null, delta: -saleQty });
      if (giftQty > 0) movements.push({ id: `gift-${it.order_id}-${when}`, type: 'gift', label: 'هدية', quantity: giftQty, when, paymentType: it.order_payment_type, customerStoreName: it.customer_store_name, customerName: it.customer_name, saleChannel: it.sale_channel || 'delivery', note: 'من نفس عملية البيع', delta: -giftQty });
    }
    for (const m of (modificationData as any[]).filter((x: any) => x.product_id === pid)) {
      const signed = Number(m.signed_quantity ?? 0);
      const deltaBP = signed; // positive => stock returned, negative => more delivered
      const deltaBoxes = dbBPToBoxes(Math.abs(deltaBP), ppb) * (deltaBP >= 0 ? 1 : -1);
      const qtyBoxes = Math.abs(deltaBoxes);
      const cust: any = m.order?.customer;
      movements.push({
        id: `mod-${m.id}`,
        type: 'modification',
        label: m.order?.status === 'cancelled' ? 'إلغاء' : 'تعديل',
        quantity: qtyBoxes,
        when: m.created_at,
        note: m.notes || null,
        paymentType: m.order?.payment_type || null,
        customerStoreName: cust?.store_name || null,
        customerName: cust?.name || null,
        orderStatus: m.order?.status || null,
        delta: deltaBoxes,
      });
    }

    movements.sort((a, b) => (new Date(a.when).getTime() || 0) - (new Date(b.when).getTime() || 0));
    const chronological = [...movements].reverse();
    let bal = currentQty;
    const entries = chronological.map(m => { const after = bal; const before = bal - m.delta; bal = before; return { ...m, before, after }; });

    const totalLoaded = movements.filter(m => m.type === 'load').reduce((s, m) => s + m.quantity, 0);
    const totalUnloaded = movements.filter(m => m.type === 'unload').reduce((s, m) => s + m.quantity, 0);
    const totalSold = movements.filter(m => m.type === 'sale').reduce((s, m) => s + m.quantity, 0);
    const totalGift = movements.filter(m => m.type === 'gift').reduce((s, m) => s + m.quantity, 0);

    return { entries, currentQty, totalLoaded, totalUnloaded, totalSold, totalGift, lastLabel, ppb, productName: selected.product?.name || 'المنتج', productImage: selected.product?.image_url || null };
  }, [selected, loadedData, unloadedData, soldData, modificationData, lastAccounting, ppbMap]);

  const sorted = [...truckStock].sort((a: any, b: any) => {
    if (a.quantity === 0 && b.quantity > 0) return 1;
    if (a.quantity > 0 && b.quantity === 0) return -1;
    return (a.product?.name || '').localeCompare(b.product?.name || '');
  });

  if (!truckStock.length) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>{emptyLabel}</p>
      </div>
    );
  }

  return (
    <>
      {lastAccounting && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-2">
          <CalendarDays className="w-3.5 h-3.5" />
          <span className="truncate">آخر محاسبة: {new Date(lastAccounting).toLocaleString('ar-DZ', { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>
      )}
      <div className="flex items-center justify-end gap-1 mb-2">
        <Button
          type="button"
          size="sm"
          variant={viewMode === 'list' ? 'default' : 'outline'}
          className="h-7 px-2 gap-1 text-[11px]"
          onClick={() => setMode('list')}
        >
          <List className="w-3.5 h-3.5" /> قائمة
        </Button>
        <Button
          type="button"
          size="sm"
          variant={viewMode === 'grid' ? 'default' : 'outline'}
          className="h-7 px-2 gap-1 text-[11px]"
          onClick={() => setMode('grid')}
        >
          <LayoutGrid className="w-3.5 h-3.5" /> شبكة
        </Button>
      </div>
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-3 gap-1.5">
          {sorted.map((item: any) => {
            const ppb = Math.max(1, Number(item.product?.pieces_per_box) || 20);
            const isZero = item.quantity === 0;
            const s = stats[item.product_id] || {};
            const hasSales = (s.sold || 0) > 0 || (s.giftQty || 0) > 0;
            return (
              <button
                key={item.id}
                type="button"
                className={`p-1 rounded-lg border text-center transition-all active:scale-[0.98] hover:shadow-md ${isZero ? 'bg-destructive/10 border-destructive/30' : hasSales ? 'bg-card border-green-500 border-2' : 'bg-card border-border'}`}
                onClick={() => setSelected(item)}
              >
                <p className="text-[10px] font-medium truncate mb-0.5">{item.product?.name}</p>
                <div className="h-14 w-full rounded-md border bg-muted/40 overflow-hidden flex items-center justify-center mb-1">
                  {item.product?.image_url ? (
                    <img src={item.product.image_url} alt={item.product?.name || ''} className="w-full h-full object-contain" loading="lazy" />
                  ) : (
                    <Package className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <span className={`inline-flex items-center gap-1 text-sm font-bold px-1.5 py-0.5 rounded-full border ${isZero ? 'border-destructive/40 text-destructive bg-destructive/5' : 'border-primary/30 text-primary bg-primary/5'}`}>
                  <Package className="w-3 h-3" /> {fmtBP(dbBPToBoxes(Number(item.quantity || 0), ppb), ppb)}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
      <div className="grid gap-2">
        {sorted.map((item: any) => {
          const s = stats[item.product_id] || {};
          const isZero = item.quantity === 0;
          const hasSales = (s.sold || 0) > 0 || (s.giftQty || 0) > 0;
          return (
            <button
              key={item.id}
              type="button"
              className={`w-full min-w-0 p-3 rounded-xl border text-start transition-all active:scale-[0.99] hover:shadow-md ${isZero ? 'bg-destructive/10 border-destructive/30' : hasSales ? 'bg-card border-green-500 border-2' : 'bg-card border-border'}`}
              onClick={() => setSelected(item)}
            >
              <div className="flex items-start gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl border bg-muted/40 overflow-hidden shrink-0 flex items-center justify-center">
                  {item.product?.image_url ? (
                    <img src={item.product.image_url} alt={item.product?.name || ''} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <Package className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-sm truncate">{item.product?.name}</span>
                    <span className={`font-bold text-lg leading-none ${isZero ? 'text-destructive' : 'text-primary'}`}>
                      {fmtBP(dbBPToBoxes(Number(item.quantity || 0), Math.max(1, Number(item.product?.pieces_per_box) || 20)), Math.max(1, Number(item.product?.pieces_per_box) || 20))}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">انقر لعرض سجل الحركة</p>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t pt-2 text-[10px]">
                <span className="flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full font-semibold">
                  <Package className="w-3 h-3" /> الباقي {fmtBP(dbBPToBoxes(Number(item.quantity || 0), Math.max(1, Number(item.product?.pieces_per_box) || 20)), Math.max(1, Number(item.product?.pieces_per_box) || 20))}
                </span>
                <span className="flex items-center gap-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-full font-semibold">
                  <Package className="w-3 h-3" /> المجموع {fmtBP(s.loaded || 0, Math.max(1, Number(item.product?.pieces_per_box) || 20))}
                </span>
                <span className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                  <TrendingUp className="w-3 h-3" /> شحن {fmtBP(s.loaded || 0, Math.max(1, Number(item.product?.pieces_per_box) || 20))}
                  {s.loadCount?.size > 0 && <span className="font-bold">×{s.loadCount.size}</span>}
                </span>
                <span className="flex items-center gap-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded-full">
                  <PackageOpen className="w-3 h-3" /> تفريغ -{fmtBP(s.unloaded || 0, Math.max(1, Number(item.product?.pieces_per_box) || 20))}
                  {s.unloadCount?.size > 0 && <span className="font-bold">×{s.unloadCount.size}</span>}
                </span>
                <span className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full">
                  <TrendingDown className="w-3 h-3" /> مباع {fmtBP(s.sold || 0, Math.max(1, Number(item.product?.pieces_per_box) || 20))}
                  {s.saleCount?.size > 0 && <span className="font-bold">×{s.saleCount.size}</span>}
                </span>
                {s.giftQty > 0 && (
                  <span className="flex items-center gap-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full">
                    <Gift className="w-3 h-3" /> هدايا {fmtBP(s.giftQty, Math.max(1, Number(item.product?.pieces_per_box) || 20))}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      )}

      {history && (
        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-md h-[90vh] flex flex-col overflow-hidden" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                <History className="w-5 h-5 text-primary" />
                <span className="truncate">{history.productName}</span>
                {history.lastLabel && (
                  <span className="text-[11px] font-normal text-muted-foreground whitespace-nowrap">
                    آخر جلسة: {history.lastLabel}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 flex flex-col flex-1 min-h-0">
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30">
                <div className="w-14 h-14 rounded-xl overflow-hidden border bg-background flex items-center justify-center shrink-0">
                  {history.productImage ? (
                    <img src={history.productImage} alt={history.productName} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{history.productName}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                    <Badge className="bg-violet-100 text-violet-700 border-violet-200">المجموع {fmtBP(history.totalLoaded, history.ppb)}</Badge>
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">شحن {fmtBP(history.totalLoaded, history.ppb)}</Badge>
                    <Badge className="bg-red-100 text-red-700 border-red-200">تفريغ {fmtBP(history.totalUnloaded, history.ppb)}</Badge>
                    <Badge className="bg-green-100 text-green-700 border-green-200">مباع {fmtBP(history.totalSold, history.ppb)}</Badge>
                    {history.totalGift > 0 && (
                      <Badge className="bg-orange-100 text-orange-700 border-orange-200">هدايا {fmtBP(history.totalGift, history.ppb)}</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">الباقي {fmtBP(history.currentQty, history.ppb)}</div>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                <div className="space-y-2 pb-2">
                  {history.entries.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground border rounded-xl">لا توجد حركات مسجلة لهذا المنتج</div>
                  ) : (
                    history.entries.map((entry: any, index: number) => {
                      const prevDay = history.entries[index - 1]?.when ? new Date(history.entries[index - 1].when).toDateString() : null;
                      const currentDay = entry.when ? new Date(entry.when).toDateString() : null;
                      const showDay = index === 0 || prevDay !== currentDay;
                      const dateLabel = entry.when ? new Date(entry.when).toLocaleDateString('ar-DZ') : '—';
                      const timeLabel = entry.when ? new Date(entry.when).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }) : '';
                      const typeBadge = entry.type === 'load' ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : entry.type === 'unload' ? 'bg-red-100 text-red-700 border-red-200'
                        : entry.type === 'gift' ? 'bg-orange-100 text-orange-700 border-orange-200'
                        : entry.type === 'modification' ? 'bg-purple-100 text-purple-700 border-purple-200'
                        : 'bg-green-100 text-green-700 border-green-200';
                      const cardBg = entry.type === 'unload' ? 'bg-red-50 border-red-200' : entry.type === 'sale' ? 'bg-green-50 border-green-200' : entry.type === 'gift' ? 'bg-orange-50 border-orange-200' : entry.type === 'modification' ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200';
                      const deltaColor = entry.type === 'unload' ? 'text-red-700' : entry.type === 'sale' ? 'text-green-700' : entry.type === 'gift' ? 'text-orange-700' : entry.type === 'modification' ? 'text-purple-700' : 'text-blue-700';
                      return (
                        <div key={entry.id} className="space-y-1">
                          {showDay && <div className="text-center text-[11px] font-semibold text-muted-foreground pt-1">{dateLabel}</div>}
                          <div className={`rounded-xl border px-3 py-2.5 ${cardBg}`}>
                            {/* Top row: delta + qty change */}
                            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge className={`text-[10px] ${typeBadge}`}>{entry.label}</Badge>
                                {entry.type === 'sale' && (
                                  <Badge className="text-[10px] bg-cyan-100 text-cyan-700 border-cyan-200">
                                    {entry.saleChannel === 'direct_sale' ? 'فان' : 'توصيل'}
                                  </Badge>
                                )}
                                {entry.type === 'sale' && entry.priceSubtype && (
                                  <Badge className="text-[10px] font-bold bg-indigo-100 text-indigo-700 border-indigo-200">
                                    {entry.priceSubtype === 'super_gros' ? 'SG' : entry.priceSubtype === 'gros' ? 'G' : 'D'}
                                  </Badge>
                                )}
                                {entry.type === 'sale' && entry.paymentType && (
                                  <Badge className="text-[10px] bg-muted text-foreground border-border">
                                    {entry.paymentType === 'without_invoice' ? 'فاتورة 2'
                                      : entry.paymentType === 'with_invoice' ? 'بفاتورة'
                                      : entry.paymentType === 'cash' ? 'نقدًا'
                                      : entry.paymentType === 'credit' ? 'آجل'
                                      : entry.paymentType}
                                  </Badge>
                                )}
                                {entry.type === 'modification' && entry.orderStatus === 'cancelled' && (
                                  <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">طلب ملغى</Badge>
                                )}
                                {entry.type !== 'sale' && entry.sourceLabel && (
                                  <span className="text-[11px] text-muted-foreground">{entry.sourceLabel}</span>
                                )}
                              </div>
                              <div />

                            </div>

                            {/* Highlighted grid: store / delivered / remaining */}
                            <div className="mt-2 grid grid-cols-3 gap-1.5">
                              <div className="rounded-lg bg-white/70 dark:bg-background/40 border px-2 py-1.5 text-center">
                                <div className="text-[9px] text-muted-foreground">المحل</div>
                                <div className="text-[11px] font-bold truncate">{entry.customerStoreName || entry.customerName || '—'}</div>
                              </div>
                              <div className="rounded-lg bg-emerald-100/70 border border-emerald-200 px-2 py-1.5 text-center">
                                <div className="text-[9px] text-emerald-800">المُسلَّم</div>
                                <div className="text-[12px] font-extrabold text-emerald-700">{fmtBP(entry.quantity, history.ppb)}</div>
                              </div>
                              <div className="rounded-lg bg-amber-100/70 border border-amber-200 px-2 py-1.5 text-center">
                                <div className="text-[9px] text-amber-800">الباقي</div>
                                <div className="text-[12px] font-extrabold text-amber-700">{fmtBP(entry.after, history.ppb)}</div>
                              </div>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>{timeLabel}</span>
                              {entry.type === 'sale' && entry.totalPaid != null && entry.totalPaid > 0 && (
                                <span className="font-bold text-emerald-700">{Number(entry.totalPaid).toLocaleString('ar-DZ')} دج</span>
                              )}
                            </div>
                            {entry.note && (
                              <div className="mt-2 text-[11px] text-muted-foreground border-t pt-2">{entry.note}</div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default WorkerTruckStockList;