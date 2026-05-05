import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, RotateCcw, Package, Gift, Truck, Calculator, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { getGiftTotalPieces, getPaidQuantity } from '@/utils/orderItemQuantities';

const formatQty = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
};

interface RoundProduct {
  product_id: string;
  product_name: string;
  image_url?: string | null;
  loaded_qty: number;
  gift_loaded: number;
  sold_qty: number;
  gift_sold: number;
  expected_remaining: number;
  status: 'matched' | 'surplus' | 'deficit';
}

interface Round {
  session_id: string;
  session_date: string;
  manager_name: string;
  products: RoundProduct[];
  totalLoaded: number;
  totalSold: number;
  totalGifts: number;
}

interface AccountingDivider {
  type: 'accounting';
  id: string;
  date: string;
  status: string;
}

type TimelineItem = 
  | { type: 'round'; round: Round; index: number }
  | AccountingDivider;

const WorkerRounds: React.FC = () => {
  const { workerId: currentWorkerId, activeBranch } = useAuth();
  const branchId = activeBranch?.id || null;
  const navigate = useNavigate();
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);

  const { data: workers = [] } = useQuery({
    queryKey: ['rounds-workers', branchId],
    queryFn: async () => {
      const q = supabase.from('workers').select('id, full_name, role').eq('is_active', true);
      if (branchId) q.eq('branch_id', branchId);
      const { data } = await q.order('full_name');
      return data || [];
    },
  });

  const workerId = selectedWorkerId || currentWorkerId;

  const { data: accountingSessions = [] } = useQuery({
    queryKey: ['rounds-accounting-sessions', workerId],
    queryFn: async () => {
      if (!workerId) return [];
      const { data } = await supabase
        .from('accounting_sessions')
        .select('id, created_at, period_start, period_end, status')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!workerId,
  });

  const { data: loadingSessions = [] } = useQuery({
    queryKey: ['rounds-loading-sessions', workerId],
    queryFn: async () => {
      if (!workerId) return [];
      const { data } = await supabase
        .from('loading_sessions')
        .select(`
          id, status, created_at, completed_at, notes,
          manager:workers!loading_sessions_manager_id_fkey(full_name)
        `)
        .eq('worker_id', workerId)
        .in('status', ['completed', 'open'])
        .order('created_at', { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
    enabled: !!workerId,
  });

  const sessionIds = loadingSessions.map((s: any) => s.id);
  const { data: sessionItems = [] } = useQuery({
    queryKey: ['rounds-session-items', sessionIds],
    queryFn: async () => {
      if (sessionIds.length === 0) return [];
      const { data } = await supabase
        .from('loading_session_items')
        .select('*, product:products(name, app_name, pieces_per_box, image_url)')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: true });
      return (data || []) as any[];
    },
    enabled: sessionIds.length > 0,
  });

  const { data: orderItems = [] } = useQuery({
    queryKey: ['rounds-order-items', workerId, loadingSessions.length],
    queryFn: async () => {
      if (!workerId || loadingSessions.length === 0) return [];
      const earliest = loadingSessions[loadingSessions.length - 1]?.created_at;
      if (!earliest) return [];
      const { data: orders } = await supabase
        .from('orders')
        .select('id, created_at, status')
        .eq('assigned_worker_id', workerId)
        .gte('created_at', earliest)
        .in('status', ['delivered', 'completed', 'confirmed'])
        .order('created_at', { ascending: true });
      if (!orders || orders.length === 0) return [];
      const orderIds = orders.map(o => o.id);
      const { data: items } = await supabase
        .from('order_items')
        .select('order_id, product_id, quantity, gift_quantity, gift_pieces, pieces_per_box')
        .in('order_id', orderIds);
      const orderDateMap = new Map(orders.map(o => [o.id, o.created_at]));
      return (items || []).map((item: any) => ({
        ...item,
        order_date: orderDateMap.get(item.order_id),
      }));
    },
    enabled: !!workerId && loadingSessions.length > 0,
  });

  // Build rounds
  const rounds: Round[] = useMemo(() => {
    if (loadingSessions.length === 0) return [];
    return loadingSessions.map((session: any, idx: number) => {
      const nextSession = loadingSessions[idx + 1];
      const sessionStart = session.created_at;
      const sessionEnd = nextSession?.created_at || '1970-01-01';
      const items = sessionItems.filter((i: any) => i.session_id === session.id);
      const periodOrders = orderItems.filter((oi: any) => {
        const d = oi.order_date;
        return d >= sessionStart && (idx === loadingSessions.length - 1 || d < sessionEnd);
      });
      const productMap = new Map<string, RoundProduct>();
      items.forEach((item: any) => {
        const pid = item.product_id;
        const name = item.product?.app_name || item.product?.name || '—';
        const ppb = item.product?.pieces_per_box || 20;
        const qty = Number(item.quantity || 0);
        const giftQty = Number(item.gift_quantity || 0);
        const giftInBoxes = (item.gift_unit === 'box') ? giftQty : giftQty / ppb;
        if (!productMap.has(pid)) {
          productMap.set(pid, {
            product_id: pid, product_name: name, image_url: item.product?.image_url,
            loaded_qty: 0, gift_loaded: 0, sold_qty: 0, gift_sold: 0,
            expected_remaining: 0, status: 'matched',
          });
        }
        const p = productMap.get(pid)!;
        p.loaded_qty += qty;
        p.gift_loaded += giftInBoxes;
      });
      periodOrders.forEach((oi: any) => {
        const pid = oi.product_id;
        const ppb = oi.pieces_per_box || 20;
        const soldPieces = getPaidQuantity({ ...oi, pieces_per_box: ppb }) * ppb;
        const giftPieces = getGiftTotalPieces({ ...oi, pieces_per_box: ppb });
        if (!productMap.has(pid)) {
          productMap.set(pid, {
            product_id: pid, product_name: pid,
            loaded_qty: 0, gift_loaded: 0, sold_qty: 0, gift_sold: 0,
            expected_remaining: 0, status: 'matched',
          });
        }
        const p = productMap.get(pid)!;
        p.sold_qty += soldPieces / ppb;
        p.gift_sold += giftPieces / ppb;
      });
      productMap.forEach(p => {
        p.expected_remaining = p.loaded_qty + p.gift_loaded - p.sold_qty - p.gift_sold;
      });
      const products = Array.from(productMap.values());
      return {
        session_id: session.id,
        session_date: session.created_at,
        manager_name: session.manager?.full_name || '—',
        products,
        totalLoaded: products.reduce((s, p) => s + p.loaded_qty, 0),
        totalSold: products.reduce((s, p) => s + p.sold_qty, 0),
        totalGifts: products.reduce((s, p) => s + p.gift_loaded + p.gift_sold, 0),
      };
    });
  }, [loadingSessions, sessionItems, orderItems]);

  // Build timeline with accounting dividers
  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];
    let roundCounter = 0;

    // Merge rounds and accounting sessions by date (descending)
    const allEvents: { date: string; type: 'round' | 'accounting'; data: any }[] = [];
    
    rounds.forEach(r => allEvents.push({ date: r.session_date, type: 'round', data: r }));
    accountingSessions.forEach(a => allEvents.push({ date: a.created_at, type: 'accounting', data: a }));
    
    allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    allEvents.forEach(ev => {
      if (ev.type === 'accounting') {
        items.push({
          type: 'accounting',
          id: ev.data.id,
          date: ev.data.created_at,
          status: ev.data.status,
        });
      } else {
        roundCounter++;
        items.push({ type: 'round', round: ev.data, index: roundCounter });
      }
    });

    return items;
  }, [rounds, accountingSessions]);

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-3 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <RotateCcw className="w-5 h-5 text-primary" />
          <h1 className="text-base font-bold">تتبع الجولات</h1>
        </div>
        <Select value={workerId || ''} onValueChange={setSelectedWorkerId}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="اختر العامل" />
          </SelectTrigger>
          <SelectContent>
            {workers.map((w: any) => (
              <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!workerId && (
          <div className="text-center py-8 text-muted-foreground text-sm">اختر عاملاً لعرض جولاته</div>
        )}

        {workerId && timeline.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-40" />
            لا توجد جولات مسجلة
          </div>
        )}

        {timeline.map((item, i) => {
          if (item.type === 'accounting') {
            return (
              <div key={`acc-${item.id}`} className="flex items-center gap-2 py-1.5">
                <div className="flex-1 h-px bg-destructive/30" />
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 border border-destructive/20">
                  <Calculator className="w-3.5 h-3.5 text-destructive" />
                  <span className="text-[11px] font-semibold text-destructive">جلسة محاسبة</span>
                  <span className="text-[10px] text-destructive/70">
                    {new Date(item.date).toLocaleDateString('ar-DZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex-1 h-px bg-destructive/30" />
              </div>
            );
          }

          const round = item.round;
          return (
            <button
              key={round.session_id}
              onClick={() => setSelectedRound(round)}
              className="w-full rounded-xl border bg-card p-3 text-right active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{item.index}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">جولة {item.index}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(round.session_date).toLocaleDateString('ar-DZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {' · '}{round.manager_name}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0.5">
                  <Truck className="w-3 h-3" /> شحن {formatQty(round.totalLoaded)}
                </Badge>
                <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0.5 bg-accent text-accent-foreground">
                  <Package className="w-3 h-3" /> مبيعات {formatQty(round.totalSold)}
                </Badge>
                {round.totalGifts > 0 && (
                  <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0.5">
                    <Gift className="w-3 h-3" /> هدايا {formatQty(round.totalGifts)}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                  {round.products.length} منتج
                </Badge>
              </div>
            </button>
          );
        })}
      </div>

      {/* Round Details Dialog — full screen like truck balance */}
      <Dialog open={!!selectedRound} onOpenChange={(open) => !open && setSelectedRound(null)}>
        <DialogContent className="max-w-full w-full h-[100dvh] m-0 p-0 rounded-none border-none gap-0 [&>button]:hidden" dir="rtl">
          {selectedRound && (
            <div className="flex flex-col h-full bg-secondary/30">
              {/* Dialog Header */}
              <div className="shrink-0 bg-background border-b px-4 py-3 safe-area-top">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <RotateCcw className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-base font-bold">تفاصيل الجولة</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(selectedRound.session_date).toLocaleDateString('ar-DZ', { weekday: 'long', month: 'short', day: 'numeric' })}
                        {' · '}{new Date(selectedRound.session_date).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}{selectedRound.manager_name}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSelectedRound(null)}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="rounded-xl bg-primary/10 p-2 text-center">
                    <Truck className="w-4 h-4 text-primary mx-auto mb-0.5" />
                    <p className="text-[9px] text-muted-foreground">شحن</p>
                    <p className="text-sm font-bold text-primary">{formatQty(selectedRound.totalLoaded)}</p>
                  </div>
                  <div className="rounded-xl bg-accent/30 p-2 text-center">
                    <Package className="w-4 h-4 text-accent-foreground mx-auto mb-0.5" />
                    <p className="text-[9px] text-muted-foreground">مبيعات</p>
                    <p className="text-sm font-bold text-accent-foreground">{formatQty(selectedRound.totalSold)}</p>
                  </div>
                  <div className="rounded-xl bg-secondary p-2 text-center">
                    <Gift className="w-4 h-4 text-muted-foreground mx-auto mb-0.5" />
                    <p className="text-[9px] text-muted-foreground">هدايا</p>
                    <p className="text-sm font-bold">{formatQty(selectedRound.totalGifts)}</p>
                  </div>
                </div>
              </div>

              {/* Product list */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 safe-area-bottom">
                {selectedRound.products.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">لا توجد منتجات في هذه الجولة</div>
                ) : (
                  selectedRound.products.map((prod) => {
                    const totalGifts = prod.gift_loaded + prod.gift_sold;
                    return (
                      <div key={prod.product_id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                        {/* Product header */}
                        <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border/50">
                          {prod.image_url ? (
                            <img src={prod.image_url} alt="" className="w-11 h-11 rounded-xl object-cover border shrink-0" />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold truncate">{prod.product_name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">المتبقي:</span>
                              <span className={`text-xs font-bold ${
                                prod.expected_remaining < 0 ? 'text-destructive' : 'text-foreground'
                              }`}>
                                {formatQty(prod.expected_remaining)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Stats grid */}
                        <div className="grid grid-cols-4 divide-x divide-x-reverse divide-border/50">
                          <div className="p-2 text-center">
                            <p className="text-[8px] uppercase tracking-wide text-muted-foreground mb-0.5">شحن</p>
                            <p className="text-[15px] font-bold text-primary leading-tight">{formatQty(prod.loaded_qty)}</p>
                          </div>
                          <div className="p-2 text-center">
                            <p className="text-[8px] uppercase tracking-wide text-muted-foreground mb-0.5">مبيعات</p>
                            <p className="text-[15px] font-bold text-accent-foreground leading-tight">{formatQty(prod.sold_qty)}</p>
                          </div>
                          <div className="p-2 text-center">
                            <p className="text-[8px] uppercase tracking-wide text-muted-foreground mb-0.5">هدايا ش.</p>
                            <p className="text-[15px] font-bold leading-tight">{formatQty(prod.gift_loaded)}</p>
                          </div>
                          <div className="p-2 text-center">
                            <p className="text-[8px] uppercase tracking-wide text-muted-foreground mb-0.5">هدايا ب.</p>
                            <p className="text-[15px] font-bold leading-tight">{formatQty(prod.gift_sold)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkerRounds;
