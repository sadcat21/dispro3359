import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Package, PackageOpen, TrendingUp, TrendingDown, Gift, History, CalendarDays } from 'lucide-react';
import { getPaidQuantity } from '@/utils/orderItemQuantities';

const formatTruckQty = (value: number) => {
  const safe = Number.isFinite(value) ? value : 0;
  const rounded = Math.round(safe * 100) / 100;
  if (Number.isInteger(rounded)) return String(Math.trunc(rounded));
  const [w, f = ''] = rounded.toFixed(2).split('.');
  return `${w}.${f.padEnd(2, '0')}`;
};

const toGiftQty = (boxes: number, pieces: number = 0) =>
  Math.max(0, Number(boxes || 0) + Number(pieces || 0) / 100);

interface Props {
  workerId: string;
  emptyLabel?: string;
}

export const WorkerTruckStockList: React.FC<Props> = ({ workerId, emptyLabel = 'لا يوجد مخزون في الشاحنة' }) => {
  const [selected, setSelected] = useState<any | null>(null);

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
        .select('session_id, product_id, quantity, gift_quantity, previous_quantity')
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
        .select('order_id, product_id, quantity, gift_quantity, gift_pieces')
        .in('order_id', orders.map(o => o.id));
      const map = new Map(orders.map((o: any) => [o.id, o]));
      return (items || []).map((i: any) => {
        const o: any = map.get(i.order_id);
        return {
          ...i,
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

  const stats = useMemo(() => {
    const out: Record<string, any> = {};
    const ensure = (id: string) => (out[id] ||= { loaded: 0, unloaded: 0, sold: 0, giftQty: 0, loadCount: new Set(), unloadCount: new Set(), saleCount: new Set() });
    for (const it of loadedData) {
      const s = ensure(it.product_id);
      const q = Number(it.quantity || 0) + Number(it.gift_quantity || 0);
      s.loaded += q;
      if (q > 0 && it.session_id) s.loadCount.add(String(it.session_id));
      s.giftQty += Number(it.gift_quantity || 0);
    }
    for (const it of unloadedData) {
      const s = ensure(it.product_id);
      const q = Number(it.quantity || 0);
      s.unloaded += q;
      if (q > 0 && it.session_id) s.unloadCount.add(String(it.session_id));
    }
    for (const it of soldData) {
      const s = ensure(it.product_id);
      const paid = getPaidQuantity(it);
      s.sold += paid;
      if (paid > 0 && it.order_id) s.saleCount.add(String(it.order_id));
      s.giftQty += toGiftQty(it.gift_quantity, it.gift_pieces);
    }
    return out;
  }, [loadedData, unloadedData, soldData]);

  const history = useMemo(() => {
    if (!selected) return null;
    const pid = selected.product_id;
    const currentQty = Number(selected.quantity || 0);
    const lastLabel = lastAccounting
      ? new Date(lastAccounting).toLocaleString('ar-DZ', { dateStyle: 'short', timeStyle: 'short' })
      : null;

    type Mv = { id: string; type: 'load' | 'unload' | 'sale' | 'gift'; label: string; quantity: number; when: string; note?: string | null; paymentType?: string | null; customerStoreName?: string | null; customerName?: string | null; sourceLabel?: string | null; delta: number; before?: number; after?: number };
    const movements: Mv[] = [];

    for (const it of loadedData.filter((x: any) => x.product_id === pid)) {
      const giftQty = toGiftQty(it.gift_quantity || 0);
      const q = Number(it.quantity || 0) + giftQty;
      movements.push({ id: `load-${it.session_id}-${q}`, type: 'load', label: 'شحن', quantity: q, when: it._session?.created_at || '', note: it._session?.notes || null, sourceLabel: it._session?.manager?.full_name || null, delta: q });
    }
    for (const it of unloadedData.filter((x: any) => x.product_id === pid)) {
      const q = Number(it.quantity || 0);
      movements.push({ id: `unload-${it.session_id}-${q}`, type: 'unload', label: 'تفريغ', quantity: q, when: it._session?.created_at || '', note: it._session?.notes || null, sourceLabel: it._session?.manager?.full_name || null, delta: -q });
    }
    for (const it of soldData.filter((x: any) => x.product_id === pid)) {
      const giftBoxes = Math.max(0, Number(it.gift_quantity || 0));
      const giftPieces = Math.max(0, Number(it.gift_pieces || 0));
      const giftQty = toGiftQty(giftBoxes, giftPieces);
      const saleQty = Math.max(0, Number(it.quantity || 0) - giftBoxes);
      const when = it.order_updated_at || it.order_created_at || '';
      if (saleQty > 0) movements.push({ id: `sale-${it.order_id}-${when}`, type: 'sale', label: 'بيع', quantity: saleQty, when, paymentType: it.order_payment_type, customerStoreName: it.customer_store_name, customerName: it.customer_name, note: giftQty > 0 ? `هدايا ${formatTruckQty(giftQty)}` : null, delta: -saleQty });
      if (giftQty > 0) movements.push({ id: `gift-${it.order_id}-${when}`, type: 'gift', label: 'هدية', quantity: giftQty, when, paymentType: it.order_payment_type, customerStoreName: it.customer_store_name, customerName: it.customer_name, note: 'من نفس عملية البيع', delta: -giftQty });
    }

    movements.sort((a, b) => (new Date(a.when).getTime() || 0) - (new Date(b.when).getTime() || 0));
    const chronological = [...movements].reverse();
    let bal = currentQty;
    const entries = chronological.map(m => { const after = bal; const before = bal - m.delta; bal = before; return { ...m, before, after }; });

    const totalLoaded = movements.filter(m => m.type === 'load').reduce((s, m) => s + m.quantity, 0);
    const totalUnloaded = movements.filter(m => m.type === 'unload').reduce((s, m) => s + m.quantity, 0);
    const totalSold = movements.filter(m => m.type === 'sale').reduce((s, m) => s + m.quantity, 0);
    const totalGift = movements.filter(m => m.type === 'gift').reduce((s, m) => s + m.quantity, 0);

    return { entries, currentQty, totalLoaded, totalUnloaded, totalSold, totalGift, lastLabel, productName: selected.product?.name || 'المنتج', productImage: selected.product?.image_url || null };
  }, [selected, loadedData, unloadedData, soldData, lastAccounting]);

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
      <div className="grid gap-2">
        {sorted.map((item: any) => {
          const s = stats[item.product_id] || {};
          const isZero = item.quantity === 0;
          return (
            <button
              key={item.id}
              type="button"
              className={`w-full min-w-0 p-3 rounded-xl border text-start transition-all active:scale-[0.99] hover:shadow-md ${isZero ? 'bg-destructive/10 border-destructive/30' : 'bg-card border-border'}`}
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
                      {formatTruckQty(Number(item.quantity || 0))}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">انقر لعرض سجل الحركة</p>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t pt-2 text-[10px]">
                <span className="flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full font-semibold">
                  <Package className="w-3 h-3" /> الباقي {formatTruckQty(Number(item.quantity || 0))}
                </span>
                <span className="flex items-center gap-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-full font-semibold">
                  <Package className="w-3 h-3" /> المجموع {formatTruckQty(s.loaded || 0)}
                </span>
                <span className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                  <TrendingUp className="w-3 h-3" /> شحن {formatTruckQty(s.loaded || 0)}
                  {s.loadCount?.size > 0 && <span className="font-bold">×{s.loadCount.size}</span>}
                </span>
                <span className="flex items-center gap-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded-full">
                  <PackageOpen className="w-3 h-3" /> تفريغ -{formatTruckQty(s.unloaded || 0)}
                  {s.unloadCount?.size > 0 && <span className="font-bold">×{s.unloadCount.size}</span>}
                </span>
                <span className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full">
                  <TrendingDown className="w-3 h-3" /> مباع {formatTruckQty(s.sold || 0)}
                  {s.saleCount?.size > 0 && <span className="font-bold">×{s.saleCount.size}</span>}
                </span>
                {s.giftQty > 0 && (
                  <span className="flex items-center gap-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full">
                    <Gift className="w-3 h-3" /> هدايا {formatTruckQty(s.giftQty)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

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
                    <Badge className="bg-violet-100 text-violet-700 border-violet-200">المجموع {formatTruckQty(history.totalLoaded)}</Badge>
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">شحن {formatTruckQty(history.totalLoaded)}</Badge>
                    <Badge className="bg-red-100 text-red-700 border-red-200">تفريغ {formatTruckQty(history.totalUnloaded)}</Badge>
                    <Badge className="bg-green-100 text-green-700 border-green-200">مباع {formatTruckQty(history.totalSold)}</Badge>
                    {history.totalGift > 0 && (
                      <Badge className="bg-orange-100 text-orange-700 border-orange-200">هدايا {formatTruckQty(history.totalGift)}</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">الباقي {formatTruckQty(history.currentQty)}</div>
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
                        : 'bg-green-100 text-green-700 border-green-200';
                      const cardBg = entry.type === 'unload' ? 'bg-red-50 border-red-200' : entry.type === 'sale' ? 'bg-green-50 border-green-200' : entry.type === 'gift' ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200';
                      const deltaColor = entry.type === 'unload' ? 'text-red-700' : entry.type === 'sale' ? 'text-green-700' : entry.type === 'gift' ? 'text-orange-700' : 'text-blue-700';
                      return (
                        <div key={entry.id} className="space-y-1">
                          {showDay && <div className="text-center text-[11px] font-semibold text-muted-foreground pt-1">{dateLabel}</div>}
                          <div className={`rounded-xl border px-3 py-2.5 ${cardBg}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge className={`text-[10px] ${typeBadge}`}>{entry.label}</Badge>
                                  {entry.type === 'sale' && entry.paymentType && (
                                    <Badge className="text-[10px] bg-muted text-foreground border-border">{entry.paymentType}</Badge>
                                  )}
                                  {entry.type !== 'sale' && entry.sourceLabel && (
                                    <span className="text-[11px] text-muted-foreground">{entry.sourceLabel}</span>
                                  )}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {timeLabel || '—'}
                                  {entry.customerStoreName ? ` • ${entry.customerStoreName}` : ''}
                                  {entry.customerName && entry.customerName !== entry.customerStoreName ? ` • ${entry.customerName}` : ''}
                                </div>
                              </div>
                              <div className={`text-sm font-bold ${deltaColor}`}>
                                {entry.delta < 0 ? `-${formatTruckQty(Math.abs(entry.quantity))}` : `+${formatTruckQty(entry.quantity)}`}
                              </div>
                            </div>
                            <div className="mt-2 text-[11px]">
                              <div className="rounded-lg bg-background/70 p-2 flex items-center justify-between gap-2">
                                <div className="text-muted-foreground">الباقي</div>
                                <div className="font-semibold">{formatTruckQty(entry.after)}</div>
                              </div>
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