import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Package, PackageOpen, TrendingUp, TrendingDown, Gift, History, CalendarDays, List, LayoutGrid, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDeliveredPaidQuantity, getPaidQuantity } from '@/utils/orderItemQuantities';
import { dbBPToBoxes, boxesToBPAlways } from '@/utils/boxPieceInput';
import { getProductDisplayName } from '@/utils/productDisplayName';
import AccountingSessionsTimelineDialog, { type SelectedSessionRange } from '@/components/accounting/AccountingSessionsTimelineDialog';
import { format } from 'date-fns';
import RecalibrateBalanceButton from './RecalibrateBalanceButton';

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

/** Gift portion still pending confirmation (in fractional boxes). Not yet delivered to the customer. */
const pendingGiftFractional = (item: any, ppb: number) => {
  const safePpb = Math.max(1, ppb || 1);
  const pendingPieces = Math.max(0, Number(item.pending_gift_boxes || 0)) * safePpb
    + Math.max(0, Number(item.pending_gift_pieces || 0));
  return pendingPieces / safePpb;
};

const deliveredSaleBreakdown = (item: any, ppb: number) => {
  // اعتمد الكمية المدفوعة كما هي في order_items بدل التقييد بـ stock_movements،
  // لأن بعض الحركات قد تُحذف وتُعاد بصيغة جزئية عند تصحيح رصيد الشاحنة، مما
  // يُظهر «القسم» أقل من الحقيقة (مثلاً 2 بدل 100). الهدية تُعالَج مستقلًا.
  const isUnitSale = !!item?.is_unit_sale;
  const paidFromOrderRaw = Math.max(0, Number(getPaidQuantity(item) || 0));
  const paidCappedRaw = Math.max(0, Number(getDeliveredPaidQuantity(item) || 0));
  const paidFromOrder = isUnitSale ? (paidFromOrderRaw / Math.max(1, ppb)) : dbBPToBoxes(paidFromOrderRaw, ppb);
  const paidCapped = isUnitSale ? (paidCappedRaw / Math.max(1, ppb)) : dbBPToBoxes(paidCappedRaw, ppb);
  const paid = Math.max(paidFromOrder, paidCapped);
  const gift = confirmedGiftFractional(item, ppb);
  return {
    paid,
    gift,
    total: paid + gift,
  };
};

interface Props {
  workerId: string;
  emptyLabel?: string;
}

export const WorkerTruckStockList: React.FC<Props> = ({ workerId, emptyLabel = 'لا يوجد مخزون في الشاحنة' }) => {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'list';
    return (localStorage.getItem('wtsl-view-mode') as 'list' | 'grid') || 'list';
  });
  const setMode = (m: 'list' | 'grid') => {
    setViewMode(m);
    try { localStorage.setItem('wtsl-view-mode', m); } catch {}
  };
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [selectedRanges, setSelectedRanges] = useState<SelectedSessionRange[]>([]);
  const selectedRangeIds = useMemo(() => new Set(selectedRanges.map(r => r.id)), [selectedRanges]);
  const inSelectedRanges = (iso?: string | null) => {
    if (!selectedRanges.length || !iso) return true;
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return true;
    return selectedRanges.some(r => t >= new Date(r.start).getTime() && t <= new Date(r.end).getTime());
  };

  const { data: truckStock = [] } = useQuery({
    queryKey: ['wtsl-stock', workerId],
    queryFn: async () => {
      if (workerId) {
        await supabase.rpc('recalibrate_worker_stock', { p_worker_id: workerId }).then(() => {}, () => {});
      }
      const { data } = await supabase
        .from('worker_stock')
        .select('*, product:products(name, app_name, image_url, pieces_per_box)')
        .eq('worker_id', workerId)
        .gte('quantity', 0);
      return data || [];
    },
    enabled: !!workerId,
  });

  // إعادة جلب تلقائية عند أي تغيير في رصيد العامل/الحركات/العروض المؤكدة
  // لمنع ظهور أرقام قديمة بعد التأكيد أو بعد تحديث الصفحة.
  useEffect(() => {
    if (!workerId) return;
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['wtsl-stock', workerId] });
      qc.invalidateQueries({ queryKey: ['wtsl-loaded', workerId] });
      qc.invalidateQueries({ queryKey: ['wtsl-unloaded', workerId] });
      qc.invalidateQueries({ queryKey: ['wtsl-sold', workerId] });
      qc.invalidateQueries({ queryKey: ['wtsl-modifications', workerId] });
    };
    const ch = supabase
      .channel(`wtsl-rt-${workerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_stock', filter: `worker_id=eq.${workerId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements', filter: `worker_id=eq.${workerId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_offer_confirmations', filter: `worker_id=eq.${workerId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workerId, qc]);


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

  // النافذة الزمنية الفعّالة: إن وُجدت جلسات محاسبية مختارة استُخدم بدايتها/نهايتها الموحدة،
  // وإلا fallback إلى ما بعد آخر محاسبة مكتملة.
  const effFrom = selectedRanges.length
    ? new Date(Math.min(...selectedRanges.map(r => new Date(r.start).getTime()))).toISOString()
    : (lastAccounting || null);
  const effTo = selectedRanges.length
    ? new Date(Math.max(...selectedRanges.map(r => new Date(r.end).getTime()))).toISOString()
    : null;
  const rangesKey = selectedRanges.map(r => r.id).join(',');

  const { data: loadedData = [] } = useQuery({
    queryKey: ['wtsl-loaded', workerId, effFrom, effTo, rangesKey],
    queryFn: async () => {
      let q = supabase
        .from('loading_sessions')
        .select('id, created_at, status, notes, manager:workers!loading_sessions_manager_id_fkey(full_name)')
        .eq('worker_id', workerId)
        .eq('status', 'completed');
      if (effFrom) q = q.gte('created_at', effFrom);
      if (effTo) q = q.lte('created_at', effTo);
      const { data: sessionsRaw } = await q;
      // Exclude review sessions — they are stock-verification, not actual shipments,
      // so their quantities must not be counted toward "loaded" totals.
      const sessions = (sessionsRaw || []).filter(
        (s: any) => !String(s.notes || '').trim().startsWith('جلسة مراجعة')
      );
      if (!sessions.length) return [];
      const { data: items } = await supabase
        .from('loading_session_items')
        .select('session_id, product_id, quantity, gift_quantity, gift_unit, previous_quantity')
        .in('session_id', sessions.map(s => s.id));
      return (items || []).map((it: any) => ({ ...it, _session: sessions.find((s: any) => s.id === it.session_id) }));
    },
    enabled: !!workerId,
  });

  const { data: unloadedData = [] } = useQuery({
    queryKey: ['wtsl-unloaded', workerId, effFrom, effTo, rangesKey],
    queryFn: async () => {
      let q = supabase
        .from('loading_sessions')
        .select('id, created_at, status, notes, manager:workers!loading_sessions_manager_id_fkey(full_name)')
        .eq('worker_id', workerId)
        .eq('status', 'unloaded');
      if (effFrom) q = q.gte('created_at', effFrom);
      if (effTo) q = q.lte('created_at', effTo);
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
    queryKey: ['wtsl-sold', workerId, effFrom, effTo, rangesKey],
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select('id, created_at, updated_at, payment_type, customer:customers(name, store_name, phone)')
        .eq('status', 'delivered')
        .or(`assigned_worker_id.eq.${workerId},created_by.eq.${workerId}`);
      if (effFrom) q = q.gte('updated_at', effFrom);
      if (effTo) q = q.lte('updated_at', effTo);
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
        .in('movement_type', ['delivery', 'direct_sale'])
        .in('order_id', orders.map(o => o.id));
      const deliveredByOrderProduct = new Map<string, number>();
      const channelByOrderProduct = new Map<string, string>();
      for (const movement of movements || []) {
        const key = `${movement.order_id}|${movement.product_id}`;
        // Only original delivery/direct_sale counts toward sale row.
        // Modifications are shown as their own movement entries with real deltas.
        const delta = Number(movement.quantity || 0);
        deliveredByOrderProduct.set(key, (deliveredByOrderProduct.get(key) || 0) + delta);
        channelByOrderProduct.set(key, movement.movement_type);
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
    queryKey: ['wtsl-modifications', workerId, effFrom, effTo, rangesKey],
    queryFn: async () => {
      let q = supabase
        .from('stock_movements')
        .select('id, product_id, quantity, signed_quantity, created_at, notes, order_id, order:orders(payment_type, status, customer:customers(name, store_name))')
        .eq('worker_id', workerId)
        .eq('movement_type', 'modification');
      if (effFrom) q = q.gte('created_at', effFrom);
      if (effTo) q = q.lte('created_at', effTo);
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
    const ensure = (id: string) => (out[id] ||= {
      loaded: 0,
      loadedGiftQty: 0,
      lastLoaded: 0,
      lastLoadedAt: 0,
      unloaded: 0,
      sold: 0,
      deliveredGiftQty: 0,
      loadCount: new Set(),
      unloadCount: new Set(),
      saleCount: new Set(),
    });
    for (const it of loadedData) {
      const ppb = ppbOf(it.product_id);
      const s = ensure(it.product_id);
      const qty = dbBPToBoxes(Number(it.quantity || 0), ppb);
      const gift = it.gift_unit === 'piece'
        ? Math.max(0, Number(it.gift_quantity || 0)) / ppb
        : dbBPToBoxes(Number(it.gift_quantity || 0), ppb);
      // "Charged" = paid quantity only. Gifts are tracked separately.
      s.loaded += qty;
      const ts = it._session?.created_at ? new Date(it._session.created_at).getTime() : 0;
      if (qty > 0 && ts >= s.lastLoadedAt) {
        s.lastLoadedAt = ts;
        s.lastLoaded = qty;
      }
      if ((qty + gift) > 0 && it.session_id) s.loadCount.add(String(it.session_id));
      s.loadedGiftQty += gift;
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
      const { paid, gift } = deliveredSaleBreakdown(it, ppb);
      s.sold += paid;
      if ((paid > 0 || gift > 0) && it.order_id) s.saleCount.add(String(it.order_id));
      s.deliveredGiftQty += gift;
    }
    return out;
  }, [loadedData, unloadedData, soldData, ppbMap]);

  const balanceByProduct = useMemo(() => {
    const out: Record<string, { remaining: number; total: number; openingBalance: number }> = {};
    const productIds = new Set<string>([
      ...truckStock.map((p: any) => String(p.product_id)),
      ...loadedData.map((it: any) => String(it.product_id)),
      ...unloadedData.map((it: any) => String(it.product_id)),
      ...soldData.map((it: any) => String(it.product_id)),
      ...modificationData.map((it: any) => String(it.product_id)),
    ]);

    for (const pid of productIds) {
      const ppb = ppbOf(pid);
      const s = stats[pid] || {};
      // الباقي = آخر شحنة − (المباع + الهدايا + التفريغ + خصومات التعريض) منذ آخر شحنة فقط.
      const lastAt = Number(s.lastLoadedAt || 0);
      const total = Number(s.lastLoaded || 0);

      let sinceConsumed = 0;
      // التفريغ منذ آخر شحنة
      for (const it of unloadedData) {
        if (String(it.product_id) !== pid) continue;
        const ts = it._session?.created_at ? new Date(it._session.created_at).getTime() : 0;
        if (ts < lastAt) continue;
        sinceConsumed += dbBPToBoxes(Number(it.quantity || 0), ppb);
      }
      // المباع + الهدايا المُسلَّمة منذ آخر شحنة
      for (const it of soldData) {
        if (String(it.product_id) !== pid) continue;
        const ts = it.order_updated_at
          ? new Date(it.order_updated_at).getTime()
          : (it.order_created_at ? new Date(it.order_created_at).getTime() : 0);
        if (ts < lastAt) continue;
        const { paid, gift } = deliveredSaleBreakdown(it, ppb);
        sinceConsumed += paid + gift;
      }
      // التعريض السالب (خصم إضافي) منذ آخر شحنة — الموجب مُتجاهَل دائماً
      for (const m of modificationData as any[]) {
        if (String(m.product_id) !== pid) continue;
        const ts = m.created_at ? new Date(m.created_at).getTime() : 0;
        if (ts < lastAt) continue;
        const signed = Number(m.signed_quantity ?? 0);
        if (signed >= 0) continue;
        sinceConsumed += dbBPToBoxes(Math.abs(signed), ppb);
      }

      const remaining = Math.max(0, total - sinceConsumed);
      out[pid] = { remaining, total, openingBalance: 0 };
    }

    return out;
  }, [truckStock, loadedData, unloadedData, soldData, modificationData, stats, ppbMap]);


  const history = useMemo(() => {
    if (!selected) return null;
    const pid = selected.product_id;
    const ppb = ppbOf(pid);
    const currentQty = dbBPToBoxes(Number(selected.quantity || 0), ppb);
    const lastLabel = lastAccounting
      ? new Date(lastAccounting).toLocaleString('ar-DZ', { dateStyle: 'short', timeStyle: 'short' })
      : null;

    type Mv = { id: string; type: 'load' | 'unload' | 'sale' | 'gift' | 'modification' | 'empty'; label: string; quantity: number; when: string; note?: string | null; paymentType?: string | null; customerStoreName?: string | null; customerName?: string | null; sourceLabel?: string | null; saleChannel?: string | null; orderStatus?: string | null; priceSubtype?: string | null; totalPaid?: number | null; paidQty?: number; giftQty?: number; previousQty?: number; delta: number; before?: number; after?: number; orderId?: string | null; mods?: Array<{ id: string; label: string; note?: string | null; when: string; delta: number; orderStatus?: string | null }> };
    const movements: Mv[] = [];

    let hasAppliedTrueReset = false;
    const productLoads = [...loadedData.filter((x: any) => x.product_id === pid)].sort(
      (a: any, b: any) => (new Date(a._session?.created_at || 0).getTime() || 0) - (new Date(b._session?.created_at || 0).getTime() || 0)
    );
    for (const it of productLoads) {
      const giftQty = it.gift_unit === 'piece'
        ? Math.max(0, Number(it.gift_quantity || 0)) / ppb
        : dbBPToBoxes(Number(it.gift_quantity || 0), ppb);
      const paid = dbBPToBoxes(Number(it.quantity || 0), ppb);
      const total = paid + giftQty;
      const previousQty = dbBPToBoxes(Number(it.previous_quantity || 0), ppb);
      if (total > 0 && previousQty <= 0) {
        const isTrueReset = !hasAppliedTrueReset;
        movements.push({ id: `empty-${it.session_id}-${pid}`, type: 'empty', label: 'الشاحنة فارغة', quantity: 0, when: it._session?.created_at || '', note: isTrueReset ? 'تم بدء هذا الشحن من رصيد صفر فعلي لهذا المنتج' : 'كان الطلب يبدأ من رصيد صفر وقت إنشائه، لكن وُجد شحن مؤكد سابق قبل اعتماده لذلك لا يُعد هذا تصفيرًا فعليًا', sourceLabel: it._session?.manager?.full_name || null, delta: 0, previousQty: 0, before: isTrueReset ? 0 : undefined, after: isTrueReset ? 0 : undefined });
        if (isTrueReset) hasAppliedTrueReset = true;
      }
      movements.push({ id: `load-${it.session_id}-${paid}`, type: 'load', label: 'شحن', quantity: total, when: it._session?.created_at || '', note: it._session?.notes || null, sourceLabel: it._session?.manager?.full_name || null, delta: total, previousQty, paidQty: paid, giftQty });
    }
    for (const it of unloadedData.filter((x: any) => x.product_id === pid)) {
      const q = dbBPToBoxes(Number(it.quantity || 0), ppb);
      movements.push({ id: `unload-${it.session_id}-${q}`, type: 'unload', label: 'تفريغ', quantity: q, when: it._session?.created_at || '', note: it._session?.notes || null, sourceLabel: it._session?.manager?.full_name || null, delta: -q });
    }
    for (const it of soldData.filter((x: any) => x.product_id === pid)) {
      const { paid: saleQty, gift: giftQty, total: totalDelta } = deliveredSaleBreakdown(it, ppb);
      const when = it.order_updated_at || it.order_created_at || '';
      // الخصم من الشاحنة: المباع + الهدية المؤكدة فقط. الهدية المعلَّقة تبقى في الشاحنة حتى التأكيد.
      if (saleQty > 0 || giftQty > 0) movements.push({ id: `sale-${it.order_id}-${when}`, type: 'sale', label: 'بيع', quantity: saleQty, giftQty, when, paymentType: it.order_payment_type, customerStoreName: it.customer_store_name, customerName: it.customer_name, saleChannel: it.sale_channel || 'delivery', priceSubtype: it.price_subtype || null, totalPaid: Number(it.total_price || 0), delta: -totalDelta, orderId: it.order_id || null });
    }
    for (const m of (modificationData as any[]).filter((x: any) => x.product_id === pid)) {
      const isCancelled = m.order?.status === 'cancelled';
      const signed = Number(m.signed_quantity ?? 0);
      const qtyBoxes = dbBPToBoxes(Math.abs(signed), ppb);
      const deltaBoxes = signed < 0 ? -qtyBoxes : 0;
      const cust: any = m.order?.customer;
      movements.push({
        id: `mod-${m.id}`,
        type: 'modification',
        label: isCancelled ? 'إلغاء' : 'تعديل',
        quantity: qtyBoxes,
        when: m.created_at,
        note: signed > 0
          ? [m.notes, 'هذا الإرجاع لا يُضاف إلى الباقي في الشاحنة.'].filter(Boolean).join(' — ')
          : (m.notes || null),
        paymentType: m.order?.payment_type || null,
        customerStoreName: cust?.store_name || null,
        customerName: cust?.name || null,
        orderStatus: m.order?.status || null,
        // التعديل الموجب يُعرض كسجل فقط ولا يزيد رصيد الشاحنة، بينما التعديل السالب يخصم فعلياً.
        delta: deltaBoxes,
        orderId: m.order_id || null,
      });
    }

    movements.sort((a, b) => (new Date(a.when).getTime() || 0) - (new Date(b.when).getTime() || 0));
    const totalDelta = movements.reduce((sum, m) => sum + m.delta, 0);
    const hasTrueReset = movements.some(m => m.type === 'empty' && m.before === 0 && m.after === 0);
    const openingBalance = hasTrueReset ? 0 : Math.max(0, currentQty - totalDelta);
    let runningBalance = openingBalance;
    const forwardEntries = movements.map(m => {
      if (m.type === 'empty') {
        const isTrueReset = typeof m.after === 'number' && typeof m.before === 'number';
        if (isTrueReset) {
          runningBalance = 0;
          return { ...m, before: 0, after: 0 };
        }
        return { ...m, before: runningBalance, after: runningBalance };
      }
      const before = m.type === 'load' && typeof m.previousQty === 'number' ? Math.max(0, m.previousQty) : runningBalance;
      const after = Math.max(0, before + m.delta);
      runningBalance = after;
      return { ...m, before, after };
    });
    const chronological = [...forwardEntries].reverse();
    const allEntries = chronological;

    // Group modifications/cancellations into their parent sale card (when same order_id).
    const saleByOrderId = new Map<string, any>();
    for (const e of allEntries) {
      if (e.type === 'sale' && e.orderId) saleByOrderId.set(e.orderId, e);
    }
    const entries: any[] = [];
    for (const e of allEntries) {
      if (e.type === 'modification' && e.orderId && saleByOrderId.has(e.orderId)) {
        const parent = saleByOrderId.get(e.orderId);
        parent.mods = parent.mods || [];
        parent.mods.push({ id: e.id, label: e.label, note: e.note, when: e.when, delta: e.delta, orderStatus: e.orderStatus });
        // Reflect the latest cancellation status on the parent sale for badging.
        if (e.orderStatus === 'cancelled') parent.orderStatus = 'cancelled';
        continue;
      }
      entries.push(e);
    }

    const loadMovements = movements.filter(m => m.type === 'load');
    const totalLoaded = loadMovements.reduce((s, m) => s + m.quantity, 0);
    const lastLoadedQty = loadMovements.length ? loadMovements[loadMovements.length - 1].quantity : 0;
    const totalUnloaded = movements.filter(m => m.type === 'unload').reduce((s, m) => s + m.quantity, 0);
    const totalSold = movements.filter(m => m.type === 'sale').reduce((s, m) => s + m.quantity, 0);
    const totalGift = movements.reduce((s, m) => s + (m.type === 'sale' ? Number(m.giftQty || 0) : m.type === 'gift' ? m.quantity : 0), 0);
    // مجموع الهدايا المؤجَّلة التي لم يؤكِّدها المسؤول بعد — تبقى داخل الشاحنة وتفسّر فرق «الباقي».
    const pendingGiftTotal = soldData
      .filter((x: any) => x.product_id === pid)
      .reduce((s: number, x: any) => s + pendingGiftFractional(x, ppb), 0);
    // مجموع التعديلات (إرجاع للمخزون موجب، سحب إضافي سالب) — يفسّر اختلاف «الباقي» عن (الشحن − البيع − الهدايا).
    const totalReturned = movements
      .filter(m => m.type === 'modification' && m.delta > 0)
      .reduce((s, m) => s + m.delta, 0);
    const totalExtraDeducted = movements
      .filter(m => m.type === 'modification' && m.delta < 0)
      .reduce((s, m) => s + Math.abs(m.delta), 0);
    // اعتمد آخر "الباقي" من السجل الزمني كرصيد نهائي للشاحنة (يعكس أي إعادة تعيين مثل "الشاحنة فارغة")
    const finalRemaining = forwardEntries.length ? forwardEntries[forwardEntries.length - 1].after : currentQty;

    return { entries, currentQty: finalRemaining, totalLoaded, lastLoadedQty, totalUnloaded, totalSold, totalGift, pendingGiftTotal, totalReturned, totalExtraDeducted, openingBalance, lastLabel, ppb, productName: getProductDisplayName(selected.product) || 'المنتج', productImage: selected.product?.image_url || null };


  }, [selected, loadedData, unloadedData, soldData, modificationData, lastAccounting, ppbMap]);

  const getRemaining = (item: any) => {
    const ppb = Math.max(1, Number(item.product?.pieces_per_box) || 20);
    // اعتمد رصيد worker_stock (تمت إعادة معايرته من stock_movements) كمصدر الحقيقة،
    // لأن balanceByProduct يحسب فقط منذ آخر شحنة ويتجاهل الرصيد المُرحَّل قبلها،
    // مما يُظهر 0 رغم أن سجل الحركة يُظهر القيمة الصحيحة (مثلاً 91).
    return dbBPToBoxes(Math.max(0, Number(item.quantity || 0)), ppb);
  };
  const sorted = [...truckStock].sort((a: any, b: any) => {
    const ra = getRemaining(a);
    const rb = getRemaining(b);
    if (ra === 0 && rb > 0) return 1;
    if (ra > 0 && rb === 0) return -1;
    return getProductDisplayName(a.product).localeCompare(getProductDisplayName(b.product));
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
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant={selectedRanges.length ? 'default' : 'outline'}
            className="h-7 px-2 gap-1 text-[11px]"
            onClick={() => setSessionsOpen(true)}
            title="تصفية حسب الجلسات المحاسبية"
          >
            <Clock className="w-3.5 h-3.5" />
            {selectedRanges.length ? `جلسات (${selectedRanges.length})` : 'الجلسات المحاسبية'}
          </Button>
          {selectedRanges.length > 0 && (
            <>
              <span className="text-[10px] text-muted-foreground" dir="ltr">
                {format(new Date(effFrom!), 'dd/MM HH:mm')} ← {format(new Date(effTo!), 'dd/MM HH:mm')}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedRanges([])}
              >
                <X className="w-3 h-3" /> إلغاء
              </Button>
            </>
          )}
          <RecalibrateBalanceButton
            workerId={workerId}
            title="إعادة معايرة رصيد الشاحنة"
            className="!h-7 !w-auto !px-2 !mx-0 gap-1 text-[11px] rounded-md border border-amber-500/30 bg-amber-500/5"
          />
        </div>
        <div className="flex items-center gap-1">
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
      </div>
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-3 gap-1.5">
          {sorted.map((item: any) => {
            const ppb = Math.max(1, Number(item.product?.pieces_per_box) || 20);
            const remaining = getRemaining(item);
            const isZero = remaining === 0;
            const s = stats[item.product_id] || {};
            const deliveredGiftQty = s.deliveredGiftQty || 0;
            const totalQty = balanceByProduct[item.product_id]?.total ?? ((s.loaded || 0) + (s.loadedGiftQty || 0));
            const hasSales = (s.sold || 0) > 0 || deliveredGiftQty > 0;
            return (
              <button
                key={item.id}
                type="button"
                className={`p-1 rounded-lg border text-center transition-all active:scale-[0.98] hover:shadow-md ${isZero ? 'bg-destructive/10 border-destructive/30' : hasSales ? 'bg-card border-green-500 border-2' : 'bg-card border-border'}`}
                onClick={() => setSelected(item)}
              >
                <p className="text-[10px] font-medium truncate mb-0.5">{getProductDisplayName(item.product)}</p>
                <div className="h-14 w-full rounded-md border bg-muted/40 overflow-hidden flex items-center justify-center mb-1">
                  {item.product?.image_url ? (
                    <img src={item.product.image_url} alt={getProductDisplayName(item.product)} className="w-full h-full object-contain" loading="lazy" />
                  ) : (
                    <Package className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex items-center justify-center gap-1 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-sm font-bold px-1.5 py-0.5 rounded-full border ${isZero ? 'border-destructive/40 text-destructive bg-destructive/5' : 'border-primary/30 text-primary bg-primary/5'}`}>
                    <Package className="w-3 h-3" /> {fmtBP(remaining, ppb)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold px-1.5 py-0.5 rounded-full border border-violet-300 text-violet-700 bg-violet-50 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800">
                    <TrendingUp className="w-3 h-3" /> {fmtBP(s.lastLoaded || 0, ppb)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
      <div className="grid gap-2">
        {sorted.map((item: any) => {
          const s = stats[item.product_id] || {};
          const ppb = Math.max(1, Number(item.product?.pieces_per_box) || 20);
          const remaining = getRemaining(item);
          const isZero = remaining === 0;
          const deliveredGiftQty = s.deliveredGiftQty || 0;
          const totalQty = balanceByProduct[item.product_id]?.total ?? ((s.loaded || 0) + (s.loadedGiftQty || 0));
          const hasSales = (s.sold || 0) > 0 || deliveredGiftQty > 0;
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
                    <img src={item.product.image_url} alt={getProductDisplayName(item.product)} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <Package className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-sm truncate">{getProductDisplayName(item.product)}</span>
                    <span className={`font-bold text-lg leading-none ${isZero ? 'text-destructive' : 'text-primary'}`}>
                      {fmtBP(remaining, ppb)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">انقر لعرض سجل الحركة</p>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t pt-2 text-[10px]">
                <span className="flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full font-semibold">
                  <Package className="w-3 h-3" /> الباقي {fmtBP(remaining, ppb)}
                </span>
                <span className="flex items-center gap-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-full font-semibold">
                  <Package className="w-3 h-3" /> المجموع {fmtBP(totalQty, Math.max(1, Number(item.product?.pieces_per_box) || 20))}
                </span>
                <span className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                  <TrendingUp className="w-3 h-3" /> شحن {fmtBP(s.lastLoaded || 0, Math.max(1, Number(item.product?.pieces_per_box) || 20))}
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
                {deliveredGiftQty > 0 && (
                  <span className="flex items-center gap-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full">
                    <Gift className="w-3 h-3" /> هدايا {fmtBP(deliveredGiftQty, Math.max(1, Number(item.product?.pieces_per_box) || 20))}
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
          <DialogContent className="max-w-md h-[90vh] flex flex-col overflow-hidden">
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
                    {history.openingBalance > 0 && (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200">رصيد قبل الشحن {fmtBP(history.openingBalance, history.ppb)}</Badge>
                    )}
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">آخر شحن {fmtBP(history.lastLoadedQty, history.ppb)}</Badge>
                    <Badge className="bg-red-100 text-red-700 border-red-200">تفريغ {fmtBP(history.totalUnloaded, history.ppb)}</Badge>
                    {history.totalGift > 0 && (
                      <Badge className="bg-orange-100 text-orange-700 border-orange-200">هدايا {fmtBP(history.totalGift, history.ppb)}</Badge>
                    )}
                    {history.pendingGiftTotal > 0 && (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300" title="هدايا مؤجَّلة لم يؤكِّدها المسؤول بعد، لذلك لا تزال داخل الشاحنة">
                        هدايا بانتظار التأكيد {fmtBP(history.pendingGiftTotal, history.ppb)}
                      </Badge>
                    )}
                    {history.totalReturned > 0 && (

                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" title="كميات أُعيدت إلى الشاحنة بعد تعديل/إلغاء طلبيات">
                        إرجاع للمخزون +{fmtBP(history.totalReturned, history.ppb)}
                      </Badge>
                    )}
                    {history.totalExtraDeducted > 0 && (
                      <Badge className="bg-rose-100 text-rose-700 border-rose-200" title="كميات إضافية خُصمت من الشاحنة بسبب تعديل طلبيات">
                        خصم إضافي −{fmtBP(history.totalExtraDeducted, history.ppb)}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    الباقي {fmtBP(history.currentQty, history.ppb)}
                    {history.pendingGiftTotal > 0 && (
                      <span className="mr-1 text-amber-700">(منها {fmtBP(history.pendingGiftTotal, history.ppb)} هدايا بانتظار التأكيد)</span>
                    )}
                  </div>



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
                        : entry.type === 'empty' ? 'bg-slate-100 text-slate-700 border-slate-200'
                        : entry.type === 'modification' ? 'bg-purple-100 text-purple-700 border-purple-200'
                        : 'bg-green-100 text-green-700 border-green-200';
                      const cardBg = entry.type === 'unload' ? 'bg-red-50 border-red-200' : entry.type === 'sale' ? 'bg-green-50 border-green-200' : entry.type === 'gift' ? 'bg-orange-50 border-orange-200' : entry.type === 'empty' ? 'bg-slate-50 border-slate-200' : entry.type === 'modification' ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200';
                      const deltaColor = entry.type === 'unload' ? 'text-red-700' : entry.type === 'sale' ? 'text-green-700' : entry.type === 'gift' ? 'text-orange-700' : entry.type === 'empty' ? 'text-slate-700' : entry.type === 'modification' ? 'text-purple-700' : 'text-blue-700';
                      // New design for load/empty (matches main entries dialog)
                      if (entry.type === 'load' || entry.type === 'empty') {
                        const deltaLabel = entry.type === 'empty' ? '—' : `+${fmtBP(entry.quantity, history.ppb)}`;
                        return (
                          <div key={entry.id} className="space-y-1">
                            {showDay && <div className="text-center text-[11px] font-semibold text-muted-foreground pt-1">{dateLabel}</div>}
                            <div className={`rounded-xl border px-3 py-2.5 ${entry.type === 'empty' ? 'bg-slate-50 border-slate-300 border-dashed' : 'bg-blue-50 border-blue-200'}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Badge className={`text-[10px] ${typeBadge}`}>{entry.label}</Badge>
                                    {entry.sourceLabel && (
                                      <span className="text-[11px] text-muted-foreground">{entry.sourceLabel}</span>
                                    )}
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground">{timeLabel || '—'}</div>
                                </div>
                                <div className={`text-sm font-bold ${entry.type === 'empty' ? 'text-slate-600' : 'text-blue-700'}`}>{deltaLabel}</div>
                              </div>

                              {entry.type === 'load' && (entry.paidQty !== undefined || entry.giftQty !== undefined) && (
                                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                                  <div className="rounded-lg bg-background/70 p-2 border border-blue-100">
                                    <div className="text-muted-foreground">للبيع</div>
                                    <div className="font-semibold text-blue-700">{fmtBP(entry.paidQty || 0, history.ppb)}</div>
                                  </div>
                                  <div className="rounded-lg bg-background/70 p-2 border border-orange-100">
                                    <div className="text-muted-foreground">برومو</div>
                                    <div className="font-semibold text-orange-700">{fmtBP(entry.giftQty || 0, history.ppb)}</div>
                                  </div>
                                </div>
                              )}

                              {entry.type === 'empty' ? (
                                <div className="mt-2 text-[11px] text-slate-600 bg-background/70 rounded-lg p-2 border border-slate-200">
                                  {entry.note || 'الشاحنة فارغة قبل بدء هذا الشحن'}
                                </div>
                              ) : (
                                <div className="mt-2 text-[11px]">
                                  <div className="rounded-lg bg-background/70 p-2 flex items-center justify-between gap-2">
                                    <div className="text-muted-foreground">قبل</div>
                                    <div className="font-medium text-red-600">{fmtBP(entry.before || 0, history.ppb)}</div>
                                    <div className="text-muted-foreground">←</div>
                                    <div className="text-muted-foreground">بعد</div>
                                    <div className="font-bold text-green-600">{fmtBP(entry.after || 0, history.ppb)}</div>
                                  </div>
                                </div>
                              )}

                              {entry.note && entry.type !== 'empty' && (
                                <div className="mt-2 text-[11px] text-muted-foreground border-t pt-2">{entry.note}</div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={entry.id} className="space-y-1">
                          {showDay && <div className="text-center text-[11px] font-semibold text-muted-foreground pt-1">{dateLabel}</div>}
                          <div className={`rounded-xl border-2 shadow-sm px-3 py-2.5 ${cardBg}`}>
                            {/* Top row: badges + time + amount */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {entry.type !== 'sale' && (
                                <Badge className={`text-[10px] ${typeBadge}`}>{entry.label}</Badge>
                              )}
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
                              {/* gift moved to grid row below */}
                              {entry.type === 'modification' && entry.orderStatus === 'cancelled' && (
                                <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">طلب ملغى</Badge>
                              )}
                              {entry.type === 'sale' && entry.orderStatus === 'cancelled' && (
                                <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">ملغى</Badge>
                              )}
                              {entry.type === 'sale' && entry.mods && entry.mods.length > 0 && entry.mods.map((mm: any) => (
                                <Badge
                                  key={mm.id}
                                  className={`text-[10px] ${mm.orderStatus === 'cancelled' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`}
                                  title={mm.note || ''}
                                >
                                  {mm.label}
                                </Badge>
                              ))}
                              {entry.type !== 'sale' && entry.sourceLabel && (
                                <span className="text-[11px] text-muted-foreground">{entry.sourceLabel}</span>
                              )}
                              <span className="text-[10px] text-muted-foreground ms-auto">{timeLabel}</span>
                              {entry.type === 'sale' && entry.totalPaid != null && entry.totalPaid > 0 && (
                                <span className="text-[11px] font-bold text-emerald-700">{Number(entry.totalPaid).toLocaleString('ar-DZ')} دج</span>
                              )}
                            </div>

                            {/* Highlighted grid: store / gift / delivered / remaining */}
                            <div className={`mt-2 grid gap-1.5 ${entry.type === 'sale' && entry.giftQty > 0 ? 'grid-cols-[1fr_auto_auto_auto]' : 'grid-cols-[1fr_auto_auto]'}`}>
                              <div className="rounded-lg bg-white/70 dark:bg-background/40 border px-2 py-1.5 text-center">
                                <div className="text-[9px] text-muted-foreground">المحل</div>
                                <div className="text-[11px] font-bold truncate">{entry.customerStoreName || entry.customerName || '—'}</div>
                              </div>
                              {entry.type === 'sale' && entry.giftQty > 0 && (
                                <div className="rounded-lg bg-orange-100/70 border border-orange-200 px-1.5 py-1.5 text-center min-w-[52px]">
                                  <div className="text-[9px] text-orange-800">هدية</div>
                                  <div className="text-[12px] font-extrabold text-orange-700">{fmtBP(entry.giftQty, history.ppb)}</div>
                                </div>
                              )}
                              <div className="rounded-lg bg-emerald-100/70 border border-emerald-200 px-1.5 py-1.5 text-center min-w-[52px]">
                                <div className="text-[9px] text-emerald-800">{entry.type === 'load' ? 'الشحن' : entry.type === 'empty' ? 'قبل الشحن' : 'المُسلَّم'}</div>
                                <div className="text-[12px] font-extrabold text-emerald-700">{entry.type === 'empty' ? fmtBP(0, history.ppb) : fmtBP(entry.quantity, history.ppb)}</div>
                              </div>
                              <div className="rounded-lg bg-red-600 border border-red-700 px-1.5 py-1.5 text-center min-w-[52px]">
                                <div className="text-[9px] text-white/90">الباقي</div>
                                <div className="text-[12px] font-extrabold text-white">{fmtBP(entry.after, history.ppb)}</div>
                              </div>
                            </div>
                            {entry.note && (
                              <div className="mt-2 text-[11px] text-muted-foreground border-t pt-2">{entry.note}</div>
                            )}
                            {entry.type === 'sale' && entry.mods && entry.mods.length > 0 && (
                              <div className="mt-2 border-t pt-2 space-y-1">
                                {entry.mods.map((mm: any) => (
                                  <div key={`note-${mm.id}`} className="flex items-center gap-1.5 text-[11px]">
                                    <Badge className={`text-[9px] ${mm.orderStatus === 'cancelled' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                                      {mm.label}
                                    </Badge>
                                    <span className="text-muted-foreground truncate">{mm.note || '—'}</span>
                                    <span className="ms-auto text-[10px] text-muted-foreground shrink-0">
                                      {mm.when ? new Date(mm.when).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </span>
                                  </div>
                                ))}
                              </div>
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
      <AccountingSessionsTimelineDialog
        open={sessionsOpen}
        onOpenChange={setSessionsOpen}
        workerId={workerId}
        selectedIds={selectedRangeIds}
        onApply={(ranges) => setSelectedRanges(ranges)}
      />
    </>
  );
};

export default WorkerTruckStockList;