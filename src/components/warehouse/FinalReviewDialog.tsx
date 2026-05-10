import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, Package, Save, TrendingUp, TrendingDown, Search, ShieldCheck, KeyRound, Check, X, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { parseBP, dbBPToBoxes, dbBPDisplay } from '@/utils/boxPieceInput';

interface FinalReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string;
  workerName: string;
  branchId: string | null;
}

interface AggregatedRow {
  productId: string;
  productName: string;
  imageUrl?: string | null;
  loaded: number;   // قطع إجمالية
  unloaded: number; // قطع إجمالية
  sold: number;     // قطع إجمالية
  gifts: number;    // قطع إجمالية
  salesAmount: number; // قيمة المبيعات من سجل المبيعات
  expected: number; // قطع إجمالية المتبقي
  expectedBoxes: number;
  expectedPieces: number;
  actualBoxes: string;
  actualPieces: string;
  confirmed: boolean;
  ppb: number;
}

type ReviewSession = {
  id: string;
  created_at: string;
  status?: string | null;
  notes?: string | null;
};

const isUnloadReviewSession = (session?: Pick<ReviewSession, 'status' | 'notes'> | null): boolean => {
  const status = (session?.status || '').toLowerCase();
  const notes = session?.notes || '';
  return status === 'unloaded' || status === 'return' || notes.includes('تفريغ');
};

const isShipmentReviewSession = (session?: Pick<ReviewSession, 'status' | 'notes'> | null): boolean => {
  const status = (session?.status || '').toLowerCase();
  return !!session && !isUnloadReviewSession(session) && status !== 'review' && status !== 'exchange';
};

const getReviewSessionLabel = (session?: Pick<ReviewSession, 'status' | 'notes'> | null): string => {
  const status = (session?.status || '').toLowerCase();
  if (isUnloadReviewSession(session)) return 'تفريغ';
  if (status === 'exchange') return 'تغيير';
  if (status === 'review') return 'مراجعة';
  return 'شحنة';
};

// عرض موحّد بصيغة B.P (boxes.pp) — يطابق formatGiftDisplay في تجميعات المبيعات والعروض
const formatBP = (totalPieces: number, piecesPerBox: number): string => {
  const ppb = Math.max(1, Math.round(piecesPerBox || 1));
  const sign = totalPieces < 0 ? '-' : '';
  const p = Math.abs(Math.round(totalPieces));
  if (ppb <= 1) return `${sign}${p}`;
  const boxes = Math.floor(p / ppb);
  const remaining = p % ppb;
  return `${sign}${boxes}.${String(remaining).padStart(2, '0')}`;
};

const toWholePieces = (value: number): number => Math.round(Number(value || 0));

const FinalReviewDialog: React.FC<FinalReviewDialogProps> = ({
  open, onOpenChange, workerId, workerName, branchId,
}) => {
  const { workerId: actorId } = useAuth();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AggregatedRow[]>([]);
  const [loadCount, setLoadCount] = useState(0);
  const [unloadCount, setUnloadCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [periodStart, setPeriodStart] = useState<string | null>(null);
  const [workerPin, setWorkerPin] = useState('');
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  // Per-session preview support
  const [loadSessionsList, setLoadSessionsList] = useState<ReviewSession[]>([]);
  const [loadItemsBySession, setLoadItemsBySession] = useState<Record<string, any[]>>({});
  const [selectedSessionId, setSelectedSessionId] = useState<'all' | string>('all');
  // Raw timestamped data — used to compute per-shipment window aggregates
  const [unloadMovesAll, setUnloadMovesAll] = useState<any[]>([]);
  const [salesItemsAll, setSalesItemsAll] = useState<any[]>([]);
  const [trackingByOrderProduct, setTrackingByOrderProduct] = useState<Map<string, number>>(new Map());
  const [orderTimes, setOrderTimes] = useState<Record<string, string>>({});
  // Multi-select via long-press
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = React.useRef(false);

  const startLongPress = (sid: string) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setMultiSelected(prev => {
        const n = new Set(prev);
        n.add(sid);
        return n;
      });
      setSelectedSessionId('all'); // exit single-preview when entering multi
    }, 500);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };
  const handleSessionClick = (sid: string) => {
    if (longPressTriggered.current) { longPressTriggered.current = false; return; }
    if (multiSelected.size > 0) {
      setMultiSelected(prev => {
        const n = new Set(prev);
        if (n.has(sid)) n.delete(sid); else n.add(sid);
        return n;
      });
      return;
    }
    setSelectedSessionId(sid);
  };
  const clearMulti = () => setMultiSelected(new Set());

  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [hiddenSessionIds, setHiddenSessionIds] = useState<Set<string>>(new Set());
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; label: string } | null>(null);

  const hideSessionFromUI = (sid: string) => {
    setHiddenSessionIds(prev => { const n = new Set(prev); n.add(sid); return n; });
    setMultiSelected(prev => { const n = new Set(prev); n.delete(sid); return n; });
    if (selectedSessionId === sid) setSelectedSessionId('all');
    setConfirmTarget(null);
    toast.success('تم إخفاء الجلسة من الواجهة (يمكن استرجاعها)');
  };
  const restoreHiddenSessions = () => {
    setHiddenSessionIds(new Set());
    toast.success('تم استرجاع الجلسات المخفية');
  };
  const deleteSessionFromDB = async (sid: string) => {
    setDeletingSessionId(sid);
    setConfirmTarget(null);
    try {
      await supabase.from('loading_session_items').delete().eq('session_id', sid);
      const { error } = await supabase.from('loading_sessions').delete().eq('id', sid);
      if (error) throw error;
      toast.success('تم حذف جلسة الشحن نهائياً');
      setLoadSessionsList(prev => prev.filter(s => s.id !== sid));
      setLoadItemsBySession(prev => { const n = { ...prev }; delete n[sid]; return n; });
      setMultiSelected(prev => { const n = new Set(prev); n.delete(sid); return n; });
      setHiddenSessionIds(prev => { const n = new Set(prev); n.delete(sid); return n; });
      if (selectedSessionId === sid) setSelectedSessionId('all');
      setLoadCount(c => Math.max(0, c - 1));
      qc.invalidateQueries({ queryKey: ['warehouse-today-loadings'] });
      qc.invalidateQueries({ queryKey: ['warehouse-stock'] });
    } catch (e: any) {
      toast.error(e.message || 'تعذّر حذف الجلسة');
    } finally {
      setDeletingSessionId(null);
    }
  };
  const handleDeleteSession = (sid: string, label: string) => {
    setConfirmTarget({ id: sid, label });
  };

  // Check if worker has set up a review PIN
  useEffect(() => {
    if (!open || !workerId) return;
    (async () => {
      const { data } = await supabase
        .from('workers')
        .select('review_pin_hash')
        .eq('id', workerId)
        .maybeSingle();
      setHasPin(!!(data as any)?.review_pin_hash);
    })();
  }, [open, workerId]);

  useEffect(() => {
    if (!open || !workerId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // 1. تاريخ آخر جلسة محاسبة مكتملة لهذا العامل
        const { data: lastSession } = await supabase
          .from('accounting_sessions')
          .select('completed_at, period_end, created_at')
          .eq('worker_id', workerId)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        const realSince = lastSession?.completed_at || lastSession?.period_end || lastSession?.created_at || null;
        const sinceTs = realSince || '1970-01-01';
        if (!cancelled) setPeriodStart(realSince);

        // 2. جلسات الشحن/التفريغ للعامل بعد ذلك التاريخ (نستعملها كحدود زمنية، لكن لا نحتسب التفريغ كشحن)
        const { data: loadSessions } = await supabase
          .from('loading_sessions')
          .select('id, status, created_at, notes')
          .eq('worker_id', workerId)
          .neq('status', 'review')
          .gte('created_at', sinceTs)
          .order('created_at', { ascending: true });
        const allReviewSessions = (loadSessions || []) as ReviewSession[];
        const shipmentSessions = allReviewSessions.filter(isShipmentReviewSession);
        const loadSessionIds = shipmentSessions.map((s) => s.id);
        if (!cancelled) {
          setLoadCount(loadSessionIds.length);
          setLoadSessionsList(allReviewSessions.map((s) => ({ id: s.id, created_at: s.created_at, status: s.status, notes: s.notes })));
        }

        // 3. بنود الشحن (موجبة)
        let loadItems: any[] = [];
        const itemsBySession: Record<string, any[]> = {};
        if (loadSessionIds.length > 0) {
          const { data } = await supabase
            .from('loading_session_items')
            .select('session_id, product_id, quantity, product:products(id, name, image_url, pieces_per_box)')
            .in('session_id', loadSessionIds);
          loadItems = data || [];
          for (const it of loadItems) {
            const sid = (it as any).session_id;
            if (!sid) continue;
            (itemsBySession[sid] = itemsBySession[sid] || []).push(it);
          }
        }
        if (!cancelled) setLoadItemsBySession(itemsBySession);

        // 4. حركات التفريغ (return) من stock_movements للعامل
        const { data: unloadMoves } = await supabase
          .from('stock_movements')
          .select('product_id, quantity, created_at, product:products(id, name, image_url, pieces_per_box)')
          .eq('worker_id', workerId)
          .eq('movement_type', 'return')
          .gte('created_at', sinceTs);
        if (!cancelled) setUnloadCount((unloadMoves || []).length);
        if (!cancelled) setUnloadMovesAll(unloadMoves || []);

        // 5. تجميع
        const map = new Map<string, AggregatedRow>();
        const baseRow = (pid: string, prod: any): AggregatedRow => ({
          productId: pid,
          productName: prod.name || '—',
          imageUrl: prod.image_url,
          loaded: 0,
          unloaded: 0,
          sold: 0,
          gifts: 0,
          salesAmount: 0,
          expected: 0,
          expectedBoxes: 0,
          expectedPieces: 0,
          actualBoxes: '',
          actualPieces: '',
          confirmed: false,
          ppb: prod.pieces_per_box || 1,
        });
        // helper: B.P stored value (e.g. 5.03 with ppb=20) → total pieces
        const bpToPieces = (val: number, ppb: number): number => {
          const v = Number(val || 0);
          const boxes = Math.floor(Math.round(v * 100) / 100);
          const piecesDec = Math.round((Math.round(v * 100) / 100 - boxes) * 100);
          return boxes * ppb + piecesDec;
        };

        for (const it of loadItems) {
          const pid = it.product_id;
          const prod = it.product || {};
          const ex = map.get(pid) || baseRow(pid, prod);
          const ppb = Math.max(1, Math.round(Number(prod.pieces_per_box || 1)));
          ex.loaded += bpToPieces(Number(it.quantity || 0), ppb);
          // ملاحظة: gift_quantity في loading_session_items هو تخصيص عرض ترويجي عند الشحن
          // وليس هدية مُسلَّمة فعلياً للعميل — نُحسب الهدايا فقط من الطلبيات المُسلَّمة أدناه
          map.set(pid, ex);
        }
        for (const m of (unloadMoves || [])) {
          const pid = m.product_id;
          const prod = (m as any).product || {};
          const ex = map.get(pid) || baseRow(pid, prod);
          const ppb = Math.max(1, Math.round(Number(prod.pieces_per_box || 1)));
          ex.unloaded += bpToPieces(Number(m.quantity || 0), ppb);
          map.set(pid, ex);
        }

        // 4.b طلبيات مسلَّمة للعامل بعد ذلك التاريخ — لجمع المبيعات والهدايا لكل منتج
        const { data: deliveredOrders } = await supabase
          .from('orders')
          .select('id, created_at, updated_at, delivery_date')
          .eq('assigned_worker_id', workerId)
          .eq('status', 'delivered')
          .gte('created_at', sinceTs);
        const deliveredIds = (deliveredOrders || []).map((o: any) => o.id);
        const orderTimesMap: Record<string, string> = {};
        for (const o of (deliveredOrders || []) as any[]) {
          // For "delivered" orders, updated_at reflects the moment status flipped to delivered.
          // Fall back to delivery_date, then created_at as last resort.
          orderTimesMap[o.id] = o.updated_at || o.delivery_date || o.created_at;
        }
        if (!cancelled) setOrderTimes(orderTimesMap);
        if (deliveredIds.length > 0) {
          const { data: soldItemsWithOrder } = await supabase
            .from('order_items')
            .select('order_id, product_id, quantity, gift_quantity, gift_pieces, unit_price, total_price, pieces_per_box, product:products(id, name, image_url, pieces_per_box)')
            .in('order_id', deliveredIds);
           const itemsForMerge: any[] = (soldItemsWithOrder || []).map((it: any) => ({
             ...it,
             // احفظ القيم الأصلية قبل الدمج لاستخدامها في حساب المباع (لأن quantity مبنية عليها)
             _orig_gift_quantity: Number(it.gift_quantity || 0),
             _orig_gift_pieces: Number(it.gift_pieces || 0),
           }));
           // Override gifts from authoritative sales_tracking ledger (boxes/pieces convention)
           const { mergeGiftsFromSalesTracking } = await import('@/utils/salesTrackingMerge');
           await mergeGiftsFromSalesTracking(itemsForMerge);
          const { data: trackingRows } = await (supabase as any)
            .from('sales_tracking')
            .select('product_id, total_price, order_id')
            .in('order_id', deliveredIds);
          const trackingAmountByProduct = new Map<string, number>();
          const trackingOrderProductMap = new Map<string, number>();
          for (const tr of (trackingRows || []) as any[]) {
            const pid = String(tr.product_id || '');
            if (!pid) continue;
            trackingAmountByProduct.set(pid, (trackingAmountByProduct.get(pid) || 0) + Math.max(0, Number(tr.total_price || 0)));
            const oid = String(tr.order_id || '');
            if (oid) {
              const key = `${oid}|${pid}`;
              trackingOrderProductMap.set(key, (trackingOrderProductMap.get(key) || 0) + Math.max(0, Number(tr.total_price || 0)));
            }
          }
          if (!cancelled) {
            setSalesItemsAll(itemsForMerge);
            setTrackingByOrderProduct(trackingOrderProductMap);
          }
          for (const it of itemsForMerge) {
            const pid = (it as any).product_id;
            const prod = (it as any).product || {};
            const ex = map.get(pid) || baseRow(pid, prod);
            const ppb = Math.max(1, Math.round(Number((it as any).pieces_per_box || prod.pieces_per_box || 1)));
            // total quantity stored in B.P → total pieces (INCLUDES gifts: paid + free)
            const totalPieces = bpToPieces(Number((it as any).quantity || 0), ppb);
            // gifts (after merge with sales_tracking): gift_quantity = full boxes, gift_pieces = extra pieces
            const giftBoxes = Math.max(0, Math.floor(Number((it as any).gift_quantity || 0)));
            const giftExtraPieces = Math.max(0, Number((it as any).gift_pieces || 0));
            const giftTotalPieces = giftBoxes * ppb + giftExtraPieces;
            // quantity في order_items مبنية على القيم الأصلية لـ gift_quantity وقت إنشاء الطلب
            // لذا يجب طرح صناديق الهدية الأصلية (وليس المدموجة من sales_tracking) للحصول على المباع الصحيح
            const origGiftBoxes = Math.max(0, Math.floor(Number((it as any)._orig_gift_quantity || 0)));
            ex.sold += Math.max(0, totalPieces - origGiftBoxes * ppb);
            ex.gifts += giftTotalPieces;
            if (!trackingAmountByProduct.has(pid)) {
              ex.salesAmount += Math.max(0, Number((it as any).total_price || 0));
            }
            map.set(pid, ex);
          }
          for (const [pid, amount] of trackingAmountByProduct) {
            const ex = map.get(pid);
            if (ex) ex.salesAmount = amount;
          }
        } else {
          if (!cancelled) {
            setSalesItemsAll([]);
            setTrackingByOrderProduct(new Map());
          }
        }

        const list = Array.from(map.values()).map(r => {
          const ppb = Math.max(1, Math.round(r.ppb || 1));
          const loaded = toWholePieces(r.loaded);
          const unloaded = toWholePieces(r.unloaded);
          const sold = toWholePieces(r.sold);
          const gifts = toWholePieces(r.gifts);
          const expectedTotalPieces = loaded - unloaded - sold - gifts;
          const absPieces = Math.abs(expectedTotalPieces);
          const sign = expectedTotalPieces < 0 ? -1 : 1;
          const expectedBoxes = sign * Math.floor(absPieces / ppb);
          const expectedPieces = absPieces % ppb;
          return { ...r, loaded, unloaded, sold, gifts, expected: expectedTotalPieces, expectedBoxes, expectedPieces };
        });
        list.sort((a, b) => a.productName.localeCompare(b.productName));
        if (!cancelled) setRows(list);
      } catch (e: any) {
        toast.error(e.message || 'خطأ في جلب بيانات المراجعة');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, workerId]);

  // Per-session preview: rebuild rows from one or many sessions' items
  const sessionPreviewRows = useMemo<AggregatedRow[]>(() => {
    const sourceIds: string[] =
      multiSelected.size > 0
        ? Array.from(multiSelected)
        : (selectedSessionId !== 'all' ? [selectedSessionId] : []);
    if (sourceIds.length === 0) return [];
    const sessionById = new Map(loadSessionsList.map(s => [s.id, s]));
    const shipmentSourceIds = sourceIds.filter(sid => isShipmentReviewSession(sessionById.get(sid)));
    const shipmentSourceIdSet = new Set(shipmentSourceIds);
    const items: any[] = shipmentSourceIds.flatMap(sid => loadItemsBySession[sid] || []);
    const bpToPieces = (val: number, ppb: number): number => {
      const v = Number(val || 0);
      const boxes = Math.floor(Math.round(v * 100) / 100);
      const piecesDec = Math.round((Math.round(v * 100) / 100 - boxes) * 100);
      return boxes * ppb + piecesDec;
    };
    // Compute per-session windows: [selected session.created_at, next session.created_at)
    const sortedSessions = [...loadSessionsList].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
    const windows: Array<[string, string]> = sourceIds.map(sid => {
      const idx = sortedSessions.findIndex(s => s.id === sid);
      const start = sortedSessions[idx]?.created_at || '1970-01-01';
      const end = sortedSessions[idx + 1]?.created_at || '9999-12-31';
      return [start, end];
    });
    const inAnyWindow = (ts?: string | null): boolean => {
      if (!ts) return false;
      return windows.some(([s, e]) => ts >= s && ts < e);
    };
    const shipmentWindows = windows.filter((_, idx) => shipmentSourceIdSet.has(sourceIds[idx]));
    const inAnyShipmentWindow = (ts?: string | null): boolean => {
      if (!ts) return false;
      return shipmentWindows.some(([s, e]) => ts >= s && ts < e);
    };
    const map = new Map<string, AggregatedRow>();
    const rowsByPid = new Map(rows.map(r => [r.productId, r]));
    const ensureRow = (pid: string, prod: any, ppb: number): AggregatedRow => {
      const baseRow = rowsByPid.get(pid);
      const existing = map.get(pid);
      if (existing) return existing;
      const created = baseRow
        ? { ...baseRow, loaded: 0, unloaded: 0, sold: 0, gifts: 0, salesAmount: 0, expected: 0, expectedBoxes: 0, expectedPieces: 0, actualBoxes: '', actualPieces: '', confirmed: false }
        : {
            productId: pid, productName: prod.name || '—', imageUrl: prod.image_url,
            loaded: 0, unloaded: 0, sold: 0, gifts: 0, salesAmount: 0,
            expected: 0, expectedBoxes: 0, expectedPieces: 0,
            actualBoxes: '', actualPieces: '', confirmed: false, ppb,
          };
      map.set(pid, created);
      return created;
    };
    for (const it of items) {
      const pid = (it as any).product_id;
      const prod = (it as any).product || {};
      const ppb = Math.max(1, Math.round(Number(prod.pieces_per_box || 1)));
      const ex = ensureRow(pid, prod, ppb);
      ex.loaded += bpToPieces(Number((it as any).quantity || 0), ppb);
    }
    // For unload-only selections, carry over the remaining from the previous shipment
    // (loaded shown for an unload = remaining of prev shipment at the unload moment).
    const unloadSourceIds = sourceIds.filter(sid => isUnloadReviewSession(sessionById.get(sid)));
    for (const usid of unloadSourceIds) {
      const u = sessionById.get(usid);
      if (!u) continue;
      const prevShip = [...sortedSessions]
        .filter(s => isShipmentReviewSession(s) && s.created_at < u.created_at)
        .pop();
      if (!prevShip) continue;
      // Avoid double-counting if that shipment is also explicitly selected
      if (shipmentSourceIdSet.has(prevShip.id)) continue;
      const carryStart = prevShip.created_at;
      const carryEnd = u.created_at;
      const prevItems = loadItemsBySession[prevShip.id] || [];
      for (const it of prevItems) {
        const pid = (it as any).product_id;
        const prod = (it as any).product || {};
        const ppb = Math.max(1, Math.round(Number(prod.pieces_per_box || 1)));
        const ex = ensureRow(pid, prod, ppb);
        ex.loaded += bpToPieces(Number((it as any).quantity || 0), ppb);
      }
      for (const m of unloadMovesAll) {
        const ts = (m as any).created_at;
        if (!ts || ts < carryStart || ts >= carryEnd) continue;
        const pid = (m as any).product_id;
        const prod = (m as any).product || {};
        const ppb = Math.max(1, Math.round(Number(prod.pieces_per_box || 1)));
        const ex = ensureRow(pid, prod, ppb);
        ex.loaded -= bpToPieces(Number((m as any).quantity || 0), ppb);
      }
      for (const it of salesItemsAll) {
        const oid = String((it as any).order_id || '');
        const ts = orderTimes[oid];
        if (!ts || ts < carryStart || ts >= carryEnd) continue;
        const pid = (it as any).product_id;
        const ex = map.get(pid);
        if (!ex) continue;
        const ppb = Math.max(1, Math.round(Number((it as any).pieces_per_box || ex.ppb || 1)));
        const totalPieces = bpToPieces(Number((it as any).quantity || 0), ppb);
        const giftBoxes = Math.max(0, Math.floor(Number((it as any).gift_quantity || 0)));
        const giftExtraPieces = Math.max(0, Number((it as any).gift_pieces || 0));
        const giftTotalPieces = giftBoxes * ppb + giftExtraPieces;
        const origGiftBoxes = Math.max(0, Math.floor(Number((it as any)._orig_gift_quantity || 0)));
        const soldPieces = Math.max(0, totalPieces - origGiftBoxes * ppb);
        ex.loaded -= soldPieces;
        ex.loaded -= giftTotalPieces;
      }
    }
    // Aggregate unloads within window(s)
    for (const m of unloadMovesAll) {
      if (!inAnyWindow(m.created_at)) continue;
      const pid = m.product_id;
      const prod = (m as any).product || {};
      const ppb = Math.max(1, Math.round(Number(prod.pieces_per_box || 1)));
      const ex = ensureRow(pid, prod, ppb);
      ex.unloaded += bpToPieces(Number(m.quantity || 0), ppb);
    }
    // Aggregate sold/gifts/salesAmount within window(s) using delivered orders
    for (const it of salesItemsAll) {
      const oid = String((it as any).order_id || '');
      const ts = orderTimes[oid];
      if (!inAnyShipmentWindow(ts)) continue;
      const pid = (it as any).product_id;
      const ex = map.get(pid);
      if (!ex) continue;
      const ppb = Math.max(1, Math.round(Number((it as any).pieces_per_box || ex.ppb || 1)));
      const totalPieces = bpToPieces(Number((it as any).quantity || 0), ppb);
      const giftBoxes = Math.max(0, Math.floor(Number((it as any).gift_quantity || 0)));
      const giftExtraPieces = Math.max(0, Number((it as any).gift_pieces || 0));
      const giftTotalPieces = giftBoxes * ppb + giftExtraPieces;
      const origGiftBoxes = Math.max(0, Math.floor(Number((it as any)._orig_gift_quantity || 0)));
      ex.sold += Math.max(0, totalPieces - origGiftBoxes * ppb);
      ex.gifts += giftTotalPieces;
      const trKey = `${oid}|${pid}`;
      if (trackingByOrderProduct.has(trKey)) {
        ex.salesAmount += trackingByOrderProduct.get(trKey) || 0;
      } else {
        ex.salesAmount += Math.max(0, Number((it as any).total_price || 0));
      }
    }
    // Recompute expected after all aggregates are in
    for (const ex of map.values()) {
      const expectedTotal = ex.loaded - ex.unloaded - ex.sold - ex.gifts;
      const absP = Math.abs(expectedTotal);
      const sign = expectedTotal < 0 ? -1 : 1;
      ex.expected = expectedTotal;
      ex.expectedBoxes = sign * Math.floor(absP / ex.ppb);
      ex.expectedPieces = absP % ex.ppb;
    }
    return Array.from(map.values()).sort((a, b) => a.productName.localeCompare(b.productName));
  }, [selectedSessionId, multiSelected, loadItemsBySession, rows, loadSessionsList, unloadMovesAll, salesItemsAll, trackingByOrderProduct, orderTimes]);

  const isPreviewMode = selectedSessionId !== 'all' || multiSelected.size > 0;

  // Detect if the current preview consists only of unload sessions
  const isUnloadOnlyPreview = useMemo(() => {
    const sourceIds: string[] =
      multiSelected.size > 0
        ? Array.from(multiSelected)
        : (selectedSessionId !== 'all' ? [selectedSessionId] : []);
    if (sourceIds.length === 0) return false;
    const sessionById = new Map(loadSessionsList.map(s => [s.id, s]));
    return sourceIds.every(sid => isUnloadReviewSession(sessionById.get(sid)));
  }, [multiSelected, selectedSessionId, loadSessionsList]);

  const unloadSessionsCount = useMemo(
    () => loadSessionsList.filter(s => isUnloadReviewSession(s)).length,
    [loadSessionsList]
  );

  // Subtract loaded contributions of UI-hidden sessions
  const effectiveRows = useMemo<AggregatedRow[]>(() => {
    if (hiddenSessionIds.size === 0) return rows;
    const bpToPieces = (val: number, ppb: number): number => {
      const v = Number(val || 0);
      const boxes = Math.floor(Math.round(v * 100) / 100);
      const piecesDec = Math.round((Math.round(v * 100) / 100 - boxes) * 100);
      return boxes * ppb + piecesDec;
    };
    const subtractByPid = new Map<string, number>();
    for (const sid of hiddenSessionIds) {
      for (const it of (loadItemsBySession[sid] || [])) {
        const ppb = Math.max(1, Math.round(Number((it as any).product?.pieces_per_box || 1)));
        const pid = (it as any).product_id;
        subtractByPid.set(pid, (subtractByPid.get(pid) || 0) + bpToPieces(Number((it as any).quantity || 0), ppb));
      }
    }
    return rows.map(r => {
      const sub = subtractByPid.get(r.productId) || 0;
      if (!sub) return r;
      const newLoaded = Math.max(0, r.loaded - sub);
      const expectedTotal = newLoaded - r.unloaded - r.sold - r.gifts;
      const absP = Math.abs(expectedTotal);
      const sign = expectedTotal < 0 ? -1 : 1;
      return {
        ...r,
        loaded: newLoaded,
        expected: expectedTotal,
        expectedBoxes: sign * Math.floor(absP / r.ppb),
        expectedPieces: absP % r.ppb,
      };
    });
  }, [rows, hiddenSessionIds, loadItemsBySession]);

  const filtered = useMemo(
    () => {
      const source = isPreviewMode ? sessionPreviewRows : effectiveRows;
      return source
        .slice()
        .sort((a, b) => {
          if (a.confirmed !== b.confirmed) return a.confirmed ? 1 : -1;
          return a.productName.localeCompare(b.productName);
        });
    },
    [effectiveRows, sessionPreviewRows, isPreviewMode]
  );

  const isFilled = (r: AggregatedRow) => r.actualBoxes !== '' || r.actualPieces !== '';
  // عدد القطع الفعلي — إن لم يُدخل شيء نعتبره مطابقاً للمتوقع
  const actualTotalPieces = (r: AggregatedRow) => {
    if (!isFilled(r)) return r.expected;
    const ppb = Math.max(1, Math.round(r.ppb || 1));
    const b = Math.max(0, parseInt(r.actualBoxes || '0', 10) || 0);
    const p = Math.max(0, parseInt(r.actualPieces || '0', 10) || 0);
    return b * ppb + p;
  };
  const getDiff = (r: AggregatedRow) => actualTotalPieces(r) - r.expected; // pieces
  const getStatus = (r: AggregatedRow): 'match' | 'surplus' | 'deficit' => {
    const d = getDiff(r);
    if (d === 0) return 'match';
    return d > 0 ? 'surplus' : 'deficit';
  };
  // تحويل القطع → صيغة B.P للتخزين (boxes.pp)
  const piecesToBPNum = (pieces: number, ppb: number): number => {
    const n = Math.max(0, Math.round(pieces));
    const boxes = Math.floor(n / ppb);
    const rem = n % ppb;
    return Number((boxes + rem / 100).toFixed(2));
  };

  const stats = useMemo(() => {
    let surplus = 0, deficit = 0, matched = 0, untouched = 0;
    for (const r of effectiveRows) {
      if (!r.confirmed) { untouched++; continue; }
      const s = getStatus(r);
      if (s === 'match') matched++;
      else if (s === 'surplus') surplus++;
      else deficit++;
    }
    return { surplus, deficit, matched, untouched, total: effectiveRows.length };
  }, [effectiveRows]);

  const updateActualBoxes = (pid: string, val: string) => {
    setRows(prev => prev.map(r => r.productId === pid ? { ...r, actualBoxes: val.replace(/[^0-9]/g, ''), confirmed: false } : r));
  };
  const updateActualPieces = (pid: string, val: string) => {
    setRows(prev => prev.map(r => r.productId === pid ? { ...r, actualPieces: val.replace(/[^0-9]/g, ''), confirmed: false } : r));
  };
  const confirmRow = (pid: string) => {
    setRows(prev => prev.map(r => {
      if (r.productId !== pid) return r;
      // إن لم يُدخل شيئاً ومتوقع موجب: نملأ الحقول بقيم المتوقع لتظهر للمستخدم
      // إن كان متوقع سالب: نُبقي الحقول فارغة (تُعامل كمطابقة عبر actualTotalPieces)
      if (!isFilled(r) && r.expected >= 0) {
        return {
          ...r,
          actualBoxes: String(r.expectedBoxes),
          actualPieces: String(r.expectedPieces),
          confirmed: true,
        };
      }
      return { ...r, confirmed: true };
    }));
  };
  const resetRow = (pid: string) => {
    setRows(prev => prev.map(r => r.productId === pid ? { ...r, actualBoxes: '', actualPieces: '', confirmed: false } : r));
  };

  const handleSave = async () => {
    if (!actorId) return;
    if (stats.untouched > 0) {
      toast.error(`أدخل العد الفعلي لكل المنتجات (${stats.untouched} متبقٍ)`);
      return;
    }
    setIsSaving(true);
    try {

      const totalExpected = effectiveRows.reduce((s, r) => {
        const ppb = Math.max(1, Math.round(r.ppb || 1));
        return s + piecesToBPNum(r.expected, ppb);
      }, 0);
      const totalActual = effectiveRows.reduce((s, r) => {
        const ppb = Math.max(1, Math.round(r.ppb || 1));
        return s + piecesToBPNum(actualTotalPieces(r), ppb);
      }, 0);
      const now = new Date().toISOString();

      // 2. Create the final review session (locked immediately with both signatures)
      const { data: session, error: sErr } = await supabase
        .from('final_review_sessions')
        .insert({
          worker_id: workerId,
          warehouse_manager_id: actorId,
          branch_id: branchId,
          review_date: new Date().toISOString().slice(0, 10),
          locked_at: now,
          worker_confirmed_at: now,
          manager_confirmed_at: now,
          total_expected: totalExpected,
          total_actual: totalActual,
          surplus_count: stats.surplus,
          deficit_count: stats.deficit,
          matched_count: stats.matched,
          status: 'locked',
        })
        .select('id')
        .single();
      if (sErr) throw sErr;
      const sessionId = session.id;

      // 3. Insert all line items (audit trail) + discrepancies
      const itemRows: any[] = [];
      const discRows: any[] = [];
      for (const r of effectiveRows) {
        const ppb = Math.max(1, Math.round(r.ppb || 1));
        const expectedBP = piecesToBPNum(r.expected, ppb);
        const actualBP = piecesToBPNum(actualTotalPieces(r), ppb);
        const diff = actualBP - expectedBP;
        const diffType = Math.abs(diff) < 0.001 ? 'matched' : diff > 0 ? 'surplus' : 'deficit';
        itemRows.push({
          final_review_session_id: sessionId,
          product_id: r.productId,
          expected_qty: expectedBP,
          actual_qty: actualBP,
          difference: diff,
          diff_type: diffType,
        });
        if (diffType !== 'matched') {
          discRows.push({
            worker_id: workerId,
            branch_id: branchId,
            product_id: r.productId,
            discrepancy_type: diffType,
            quantity: Math.abs(diff),
            remaining_quantity: Math.abs(diff),
            status: 'pending',
            final_review_session_id: sessionId,
            notes: `مراجعة نهائية للعامل ${workerName} — متوقع ${formatBP(r.expected, ppb)}، فعلي ${formatBP(actualTotalPieces(r), ppb)}`,
          });
        }
      }
      if (itemRows.length > 0) {
        const { error } = await supabase.from('final_review_items').insert(itemRows);
        if (error) throw error;
      }
      if (discRows.length > 0) {
        const { error } = await supabase.from('stock_discrepancies').insert(discRows);
        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ['stock-discrepancies'] });
      qc.invalidateQueries({ queryKey: ['final-review-sessions'] });
      qc.invalidateQueries({ queryKey: ['last-final-review-info'] });
      toast.success(`✅ تم قفل المراجعة النهائية: ${stats.surplus} فائض، ${stats.deficit} عجز، ${stats.matched} مطابق`);
      setWorkerPin('');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'خطأ في حفظ المراجعة');
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92dvh] flex flex-col overflow-hidden" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-primary" />
            المراجعة النهائية — {workerName}
          </DialogTitle>
          {periodStart ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/10 text-primary">
                آخر جلسة محاسبة
              </Badge>
              <span className="text-muted-foreground">
                📅 {new Date(periodStart).toLocaleDateString('ar-DZ', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Africa/Algiers' })}
              </span>
              <span className="text-muted-foreground">
                🕒 {new Date(periodStart).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Algiers' })}
              </span>
              <span className="text-muted-foreground">— يُحتسب ما بعد هذا التاريخ</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px]">
              <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                ⚠️ لا توجد جلسة محاسبة سابقة
              </Badge>
              <span className="text-muted-foreground">— يتم احتساب جميع الحركات منذ البداية</span>
            </div>
          )}
        </DialogHeader>

        <div className="shrink-0 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-[10px]">{stats.total} منتج</Badge>
            {stats.untouched > 0 && <Badge variant="outline" className="text-[10px]">{stats.untouched} لم يُدخل</Badge>}
            <Badge className="bg-primary/80 text-primary-foreground text-[10px]">{stats.matched} مطابق</Badge>
            {stats.surplus > 0 && <Badge className="bg-amber-500 text-white text-[10px]">{stats.surplus} فائض</Badge>}
            {stats.deficit > 0 && <Badge variant="destructive" className="text-[10px]">{stats.deficit} عجز</Badge>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[10px] gap-1 border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
              📦 جلسات الشحن: <strong>{loadCount}</strong>
            </Badge>
            <Badge variant="outline" className="text-[10px] gap-1 border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
              📤 حركات التفريغ: <strong>{unloadCount}</strong>
            </Badge>
            {unloadSessionsCount > 0 && (
              <Badge variant="outline" className="text-[10px] gap-1 border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
                🗂️ جلسات التفريغ: <strong>{unloadSessionsCount}</strong>
              </Badge>
            )}
          </div>
          {loadSessionsList.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/50">
              <span className="text-[10px] text-muted-foreground">
                معاينة:{multiSelected.size > 0 && <span className="ms-1 text-primary font-bold">({multiSelected.size} محدّد)</span>}
              </span>
              <Button
                type="button"
                size="sm"
                variant={!isPreviewMode ? 'default' : 'outline'}
                onClick={() => { setSelectedSessionId('all'); clearMulti(); }}
                className="h-6 px-2 text-[10px] gap-1"
              >
                <Package className="w-3 h-3" />
                الكل ({loadSessionsList.length - hiddenSessionIds.size})
              </Button>
              {loadSessionsList.filter(s => !hiddenSessionIds.has(s.id)).map((s, idx) => {
                const isMulti = multiSelected.has(s.id);
                const isSingle = multiSelected.size === 0 && selectedSessionId === s.id;
                const active = isMulti || isSingle;
                const sessionLabel = getReviewSessionLabel(s);
                const isUnloadSession = isUnloadReviewSession(s);
                return (
                  <div key={s.id} className={`inline-flex items-center rounded-md ${isMulti ? 'ring-2 ring-primary/60' : ''}`}>
                    <Button
                      type="button"
                      size="sm"
                      variant={active ? (isUnloadSession ? 'destructive' : 'default') : 'outline'}
                      onClick={() => handleSessionClick(s.id)}
                      onMouseDown={() => startLongPress(s.id)}
                      onMouseUp={cancelLongPress}
                      onMouseLeave={cancelLongPress}
                      onTouchStart={() => startLongPress(s.id)}
                      onTouchEnd={cancelLongPress}
                      onTouchCancel={cancelLongPress}
                      onContextMenu={(e) => e.preventDefault()}
                      className={`h-6 px-2 text-[10px] rounded-e-none border-e-0 ${!active && isUnloadSession ? 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15' : ''}`}
                      title={`${new Date(s.created_at).toLocaleString('ar-DZ', { timeZone: 'Africa/Algiers' })} — اضغط مطوّلاً للتحديد المتعدد`}
                    >
                      {isMulti && '✓ '}{sessionLabel} {idx + 1} · {new Date(s.created_at).toLocaleDateString('ar-DZ', { month: '2-digit', day: '2-digit', timeZone: 'Africa/Algiers' })}
                      <span className={`ms-1 px-1 rounded font-mono text-[9px] tracking-tight ${active ? 'bg-primary-foreground/25 text-primary-foreground' : isUnloadSession ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'}`}>
                        🕒 {new Date(s.created_at).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Algiers' })}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteSession(s.id, `${sessionLabel} ${idx + 1}`)}
                      disabled={deletingSessionId === s.id}
                      className="h-6 w-6 p-0 rounded-s-none text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      title="حذف هذه الجلسة"
                    >
                      {deletingSessionId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </Button>
                  </div>
                );
              })}
              {multiSelected.size > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={clearMulti}
                  className="h-6 px-2 text-[10px] text-destructive"
                >
                  <X className="w-3 h-3" />
                  إلغاء التحديد
                </Button>
              )}
              {hiddenSessionIds.size > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={restoreHiddenSessions}
                  className="h-6 px-2 text-[10px] gap-1 border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400"
                  title="استرجاع الجلسات المخفية من الواجهة"
                >
                  ↺ استرجاع المخفية ({hiddenSessionIds.size})
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Confirm delete dialog: hide vs permanent delete */}
        <Dialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Trash2 className="w-4 h-4 text-destructive" />
                حذف {confirmTarget?.label}
              </DialogTitle>
            </DialogHeader>
            <div className="text-sm text-muted-foreground">
              اختر طريقة الحذف:
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => confirmTarget && hideSessionFromUI(confirmTarget.id)}
                className="justify-start gap-2 border-amber-400 text-amber-700 hover:bg-amber-50"
              >
                👁️‍🗨️ إخفاء من الواجهة فقط (قابل للاسترجاع)
              </Button>
              <Button
                variant="destructive"
                onClick={() => confirmTarget && deleteSessionFromDB(confirmTarget.id)}
                disabled={!!deletingSessionId}
                className="justify-start gap-2"
              >
                {deletingSessionId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                حذف نهائي من قاعدة البيانات
              </Button>
              <Button variant="ghost" onClick={() => setConfirmTarget(null)}>إلغاء</Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex-1 min-h-0 overflow-y-auto pe-1">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              لا توجد حركات شحن/تفريغ منذ آخر جلسة محاسبة
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pe-1 pb-2">
              {filtered.map(r => {
                const filled = isFilled(r);
                const status = filled ? getStatus(r) : 'match';
                const ppb = Math.max(1, Math.round(r.ppb || 1));
                const expectedPiecesTotal = r.expected;
                const actualPiecesTotal = (parseInt(r.actualBoxes || '0', 10) || 0) * ppb + (parseInt(r.actualPieces || '0', 10) || 0);
                const diffTotalPieces = filled ? actualPiecesTotal - expectedPiecesTotal : 0;
                const absPieces = Math.abs(diffTotalPieces);
                const diffLabel = formatBP(absPieces, ppb);
                const ring = !r.confirmed
                  ? 'border-border'
                  : status === 'match' ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : status === 'surplus' ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20'
                  : 'border-destructive bg-destructive/5';
                const btnLabel =
                  !filled ? 'مطابق' :
                  status === 'match' ? 'مطابق' :
                  status === 'surplus' ? `تأكيد فائض (+${diffLabel})` :
                  `تأكيد عجز (-${diffLabel})`;
                const btnClass =
                  !filled || status === 'match'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : status === 'surplus'
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground';
                const BtnIcon = !filled || status === 'match' ? Check : status === 'surplus' ? TrendingUp : TrendingDown;
                return (
                  <div key={r.productId} className={`flex flex-col gap-2.5 p-3 rounded-xl border-2 transition-opacity shadow-sm ${ring} ${r.confirmed ? 'opacity-70' : ''}`}>
                    {/* Header: image + name */}
                    <div className="flex items-center gap-2 min-w-0">
                      {r.imageUrl ? (
                        <img src={r.imageUrl} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0 border border-border/50" />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="text-xs font-semibold line-clamp-2 flex-1 min-w-0 leading-tight">{r.productName}</div>
                    </div>

                    {/* Stats grid: 2x2 + expected full-width */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <Badge variant="outline" className="text-[10px] gap-1 justify-center py-1 border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                        شُحن <strong>{formatBP(r.loaded, ppb)}</strong>
                      </Badge>
                      <Badge variant="outline" className="text-[10px] gap-1 justify-center py-1 border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
                        فُرّغ <strong>{formatBP(r.unloaded, ppb)}</strong>
                      </Badge>
                      <Badge variant="outline" className="text-[10px] gap-1 justify-center py-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                        مُباع <strong>{formatBP(r.sold, ppb)}</strong>
                      </Badge>
                      <Badge variant="outline" className="text-[10px] gap-1 justify-center py-1 border-pink-300 bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-800">
                        🎁 هدية <strong>{formatBP(r.gifts, ppb)}</strong>
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-secondary/60 border border-border">
                      <span className="text-[11px] font-medium text-muted-foreground">قيمة المبيعات</span>
                      <span className="text-sm font-bold text-foreground">
                        {r.salesAmount.toLocaleString('ar-DZ')} د.ج
                      </span>
                    </div>

                    {/* Expected — highlighted full width */}
                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30">
                      <span className="text-[11px] font-medium text-primary">المتوقع</span>
                      <span className="text-sm font-bold text-primary">
                        {formatBP(r.expected, ppb)}
                      </span>
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-medium text-muted-foreground text-center">صناديق</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={r.actualBoxes}
                          onChange={e => updateActualBoxes(r.productId, e.target.value)}
                          className="h-10 text-center text-base font-bold"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-medium text-muted-foreground text-center">قطع</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={r.actualPieces}
                          onChange={e => updateActualPieces(r.productId, e.target.value)}
                          className="h-10 text-center text-base font-bold"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => confirmRow(r.productId)}
                        className={`flex-1 h-7 text-[11px] gap-1 ${btnClass}`}
                      >
                        <BtnIcon className="w-3 h-3" />
                        {r.confirmed ? '✓ ' + btnLabel : btnLabel}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => resetRow(r.productId)}
                        disabled={!isFilled(r) && !r.confirmed}
                        className="h-7 px-2 text-[11px] shrink-0"
                        title="تفريغ الحقول"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2">
          {isPreviewMode && (
            <div className="w-full text-center text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md py-1.5 border border-amber-200 dark:border-amber-800">
              👁️ وضع المعاينة — ارجع إلى "الكل" للتأكيد والقفل
            </div>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving || loading || rows.length === 0 || isPreviewMode}
            className="w-full gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            قفل المراجعة النهائية
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FinalReviewDialog;
