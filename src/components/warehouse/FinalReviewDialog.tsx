import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, Package, Save, TrendingUp, TrendingDown, Search, ShieldCheck, KeyRound, Check, X } from 'lucide-react';
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
  loaded: number;   // مجموع الشحن (B.P)
  unloaded: number; // مجموع التفريغ (B.P)
  sold: number;     // مجموع المبيعات (B.P)
  gifts: number;    // مجموع الهدايا (B.P)
  expected: number; // المتوقع المتبقي (B.P)
  expectedBoxes: number;
  expectedPieces: number;
  actualBoxes: string;
  actualPieces: string;
  confirmed: boolean;
  ppb: number;
}

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

        // 2. جلسات الشحن للعامل بعد ذلك التاريخ
        const { data: loadSessions } = await supabase
          .from('loading_sessions')
          .select('id')
          .eq('worker_id', workerId)
          .gte('created_at', sinceTs);
        const loadSessionIds = (loadSessions || []).map((s: any) => s.id);
        if (!cancelled) setLoadCount(loadSessionIds.length);

        // 3. بنود الشحن (موجبة)
        let loadItems: any[] = [];
        if (loadSessionIds.length > 0) {
          const { data } = await supabase
            .from('loading_session_items')
            .select('product_id, quantity, gift_quantity, product:products(id, name, image_url, pieces_per_box)')
            .in('session_id', loadSessionIds);
          loadItems = data || [];
        }

        // 4. حركات التفريغ (return) من stock_movements للعامل
        const { data: unloadMoves } = await supabase
          .from('stock_movements')
          .select('product_id, quantity, product:products(id, name, image_url, pieces_per_box)')
          .eq('worker_id', workerId)
          .eq('movement_type', 'return')
          .gte('created_at', sinceTs);
        if (!cancelled) setUnloadCount((unloadMoves || []).length);

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
          expected: 0,
          expectedBoxes: 0,
          expectedPieces: 0,
          actualBoxes: '',
          actualPieces: '',
          confirmed: false,
          ppb: prod.pieces_per_box || 1,
        });
        for (const it of loadItems) {
          const pid = it.product_id;
          const prod = it.product || {};
          const ex = map.get(pid) || baseRow(pid, prod);
          ex.loaded += Number(it.quantity || 0);
          map.set(pid, ex);
        }
        for (const m of (unloadMoves || [])) {
          const pid = m.product_id;
          const prod = (m as any).product || {};
          const ex = map.get(pid) || baseRow(pid, prod);
          ex.unloaded += Number(m.quantity || 0);
          map.set(pid, ex);
        }

        // 4.b طلبيات مسلَّمة للعامل بعد ذلك التاريخ — لجمع المبيعات والهدايا لكل منتج
        const { data: deliveredOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('assigned_worker_id', workerId)
          .eq('status', 'delivered')
          .gte('created_at', sinceTs);
        const deliveredIds = (deliveredOrders || []).map((o: any) => o.id);
        if (deliveredIds.length > 0) {
          const { data: soldItems } = await supabase
            .from('order_items')
            .select('product_id, quantity, gift_quantity, product:products(id, name, image_url, pieces_per_box)')
            .in('order_id', deliveredIds);
          for (const it of (soldItems || [])) {
            const pid = (it as any).product_id;
            const prod = (it as any).product || {};
            const ex = map.get(pid) || baseRow(pid, prod);
            const giftQ = Number((it as any).gift_quantity || 0);
            const totalQ = Number((it as any).quantity || 0);
            ex.sold += Math.max(0, totalQ - giftQ);
            ex.gifts += giftQ;
            map.set(pid, ex);
          }
        }

        const list = Array.from(map.values()).map(r => {
          const ppb = Math.max(1, Math.round(r.ppb || 1));
          const loadedPieces = parseBP(Number(r.loaded).toFixed(2), ppb).totalPieces;
          const unloadedPieces = parseBP(Number(r.unloaded).toFixed(2), ppb).totalPieces;
          const soldPieces = parseBP(Number(r.sold).toFixed(2), ppb).totalPieces;
          const giftsPieces = parseBP(Number(r.gifts).toFixed(2), ppb).totalPieces;
          const expectedTotalPieces = Math.max(0, loadedPieces - unloadedPieces - soldPieces - giftsPieces);
          const expectedBoxes = Math.floor(expectedTotalPieces / ppb);
          const expectedPieces = expectedTotalPieces % ppb;
          const expected = expectedBoxes + expectedPieces / ppb;
          return { ...r, expected, expectedBoxes, expectedPieces };
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

  const filtered = useMemo(
    () => rows
      .slice()
      .sort((a, b) => {
        if (a.confirmed !== b.confirmed) return a.confirmed ? 1 : -1;
        return a.productName.localeCompare(b.productName);
      }),
    [rows]
  );

  const isFilled = (r: AggregatedRow) => r.actualBoxes !== '' || r.actualPieces !== '';
  const actualTotalBoxes = (r: AggregatedRow) => {
    const ppb = Math.max(1, Math.round(r.ppb || 1));
    const b = Math.max(0, parseInt(r.actualBoxes || '0', 10) || 0);
    const p = Math.max(0, parseInt(r.actualPieces || '0', 10) || 0);
    return b + p / ppb;
  };
  const getDiff = (r: AggregatedRow) => actualTotalBoxes(r) - r.expected;
  const getStatus = (r: AggregatedRow): 'match' | 'surplus' | 'deficit' => {
    const d = getDiff(r);
    if (Math.abs(d) < 0.001) return 'match';
    return d > 0 ? 'surplus' : 'deficit';
  };

  const stats = useMemo(() => {
    let surplus = 0, deficit = 0, matched = 0, untouched = 0;
    for (const r of rows) {
      if (!r.confirmed) { untouched++; continue; }
      const s = getStatus(r);
      if (s === 'match') matched++;
      else if (s === 'surplus') surplus++;
      else deficit++;
    }
    return { surplus, deficit, matched, untouched, total: rows.length };
  }, [rows]);

  const updateActualBoxes = (pid: string, val: string) => {
    setRows(prev => prev.map(r => r.productId === pid ? { ...r, actualBoxes: val.replace(/[^0-9]/g, ''), confirmed: false } : r));
  };
  const updateActualPieces = (pid: string, val: string) => {
    setRows(prev => prev.map(r => r.productId === pid ? { ...r, actualPieces: val.replace(/[^0-9]/g, ''), confirmed: false } : r));
  };
  const confirmRow = (pid: string) => {
    setRows(prev => prev.map(r => {
      if (r.productId !== pid) return r;
      // إن لم يدخل شيئاً نعتبره مطابق تلقائياً
      if (!isFilled(r)) {
        return {
          ...r,
          actualBoxes: String(r.expectedBoxes),
          actualPieces: r.expectedPieces > 0 ? String(r.expectedPieces) : '0',
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

      const totalExpected = rows.reduce((s, r) => s + r.expected, 0);
      const totalActual = rows.reduce((s, r) => s + actualTotalBoxes(r), 0);
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
      for (const r of rows) {
        const a = actualTotalBoxes(r);
        const diff = a - r.expected;
        const diffType = Math.abs(diff) < 0.001 ? 'matched' : diff > 0 ? 'surplus' : 'deficit';
        itemRows.push({
          final_review_session_id: sessionId,
          product_id: r.productId,
          expected_qty: r.expected,
          actual_qty: a,
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
            notes: `مراجعة نهائية للعامل ${workerName} — متوقع ${r.expected}، فعلي ${a}`,
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
                📅 {new Date(periodStart).toLocaleDateString('ar-DZ', { year: 'numeric', month: '2-digit', day: '2-digit' })}
              </span>
              <span className="text-muted-foreground">
                🕒 {new Date(periodStart).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })}
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
          </div>
        </div>

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
                const expectedPiecesTotal = r.expectedBoxes * ppb + r.expectedPieces;
                const actualPiecesTotal = (parseInt(r.actualBoxes || '0', 10) || 0) * ppb + (parseInt(r.actualPieces || '0', 10) || 0);
                const diffTotalPieces = filled ? actualPiecesTotal - expectedPiecesTotal : 0;
                const absPieces = Math.abs(diffTotalPieces);
                const diffBoxes = Math.floor(absPieces / ppb);
                const diffPieces = absPieces % ppb;
                const diffLabel = diffPieces > 0 ? `${diffBoxes}.${String(diffPieces).padStart(2, '0')}` : `${diffBoxes}`;
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
                        شُحن <strong>{dbBPDisplay(r.loaded, ppb)}</strong>
                      </Badge>
                      <Badge variant="outline" className="text-[10px] gap-1 justify-center py-1 border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
                        فُرّغ <strong>{dbBPDisplay(r.unloaded, ppb)}</strong>
                      </Badge>
                      <Badge variant="outline" className="text-[10px] gap-1 justify-center py-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                        مُباع <strong>{dbBPDisplay(r.sold, ppb)}</strong>
                      </Badge>
                      <Badge variant="outline" className="text-[10px] gap-1 justify-center py-1 border-pink-300 bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-800">
                        🎁 هدية <strong>{dbBPDisplay(r.gifts, ppb)}</strong>
                      </Badge>
                    </div>

                    {/* Expected — highlighted full width */}
                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30">
                      <span className="text-[11px] font-medium text-primary">المتوقع</span>
                      <span className="text-sm font-bold text-primary">
                        {dbBPDisplay(r.expected, ppb)}
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

        <DialogFooter className="shrink-0">
          <Button
            onClick={handleSave}
            disabled={isSaving || loading || rows.length === 0}
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
