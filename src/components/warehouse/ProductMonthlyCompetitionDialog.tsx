import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BarChart3, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Sector, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import { dbBPDisplayAlways } from '@/utils/boxPieceInput';
import { dedupeSalesTrackingRows } from '@/utils/salesTrackingDedup';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  productId: string;
  productName: string;
  piecesPerBox: number;
}

const COLORS = ['#ea580c', '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#0891b2', '#ca8a04', '#db2777'];

const ProductMonthlyCompetitionDialog: React.FC<Props> = ({
  open, onOpenChange, branchId, productId, productName, piecesPerBox,
}) => {
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const ppb = Math.max(1, piecesPerBox);
  const toDb = (pieces: number) => Math.floor(pieces / ppb) + (pieces % ppb) / 100;
  const fmt = (pieces: number) => dbBPDisplayAlways(toDb(Math.max(0, pieces)), ppb);
  const FmtBP: React.FC<{ pieces: number; className?: string }> = ({ pieces, className }) => {
    const s = fmt(pieces);
    const [b, p] = s.split('.');
    return (
      <span className={className}>
        {b}
        {p !== undefined && (
          <>
            <span className="opacity-60">.</span>
            <span className="text-red-600">{p}</span>
          </>
        )}
      </span>
    );
  };

  const { start, end, label, daysInMonth, year, month } = useMemo(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const startD = new Date(y, m, 1);
    const endD = new Date(y, m + 1, 1);
    const dim = new Date(y, m + 1, 0).getDate();
    return {
      start: startD.toISOString(),
      end: endD.toISOString(),
      label: startD.toLocaleDateString('ar-DZ', { month: 'long', year: 'numeric' }),
      daysInMonth: dim,
      year: y,
      month: m,
    };
  }, [monthOffset]);

  const { data, isLoading } = useQuery({
    queryKey: ['product-monthly-competition', branchId, productId, year, month],
    enabled: open && !!branchId && !!productId,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from('sales_tracking')
        .select('sold_boxes, sold_pieces, pieces_per_box, sold_at, source, branch_id, worker_id, order_id')
        .eq('product_id', productId)
        .in('source', ['warehouse_sale', 'delivery_sale', 'direct_sale'])
        .or(`branch_id.eq.${branchId},branch_id.is.null`)
        .gte('sold_at', start)
        .lt('sold_at', end);

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

  const { workers, totalsByWorker, dailySeries } = useMemo(() => {
    const rows = (data as any)?.rows || [];
    const nameMap: Map<string, string> = (data as any)?.nameMap || new Map();
    const workerTotals = new Map<string, number>();
    const workerDaily = new Map<string, Map<number, number>>();

    for (const r of rows) {
      const rppb = Number(r.pieces_per_box || ppb);
      const pieces = Number(r.sold_boxes || 0) * rppb + Number(r.sold_pieces || 0);
      if (pieces <= 0) continue;
      const wn = nameMap.get(r.worker_id) || 'بدون عامل';
      const day = new Date(r.sold_at).getDate();
      workerTotals.set(wn, (workerTotals.get(wn) || 0) + pieces);
      if (!workerDaily.has(wn)) workerDaily.set(wn, new Map());
      const dm = workerDaily.get(wn)!;
      dm.set(day, (dm.get(day) || 0) + pieces);
    }

    const sortedWorkers = Array.from(workerTotals.entries()).sort((a, b) => b[1] - a[1]);
    const wnames = sortedWorkers.map(([n]) => n);

    const totals = sortedWorkers.map(([name, pieces]) => ({
      name,
      pieces,
      value: toDb(pieces),
    }));

    const daily: any[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const row: any = { day: d };
      for (const wn of wnames) {
        const p = workerDaily.get(wn)?.get(d) || 0;
        row[wn] = p;
      }
      daily.push(row);
    }

    return { workers: wnames, totalsByWorker: totals, dailySeries: daily };
  }, [data, ppb, daysInMonth]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <BarChart3 className="w-5 h-5 text-orange-600" />
            <span className="truncate">{productName}</span>
            <span className="text-[11px] font-normal text-muted-foreground">منافسة العمال الشهرية</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 border rounded-xl p-2 bg-orange-50">
          <Button size="icon" variant="ghost" onClick={() => setMonthOffset((v) => v - 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="text-sm font-bold text-orange-700">{label}</div>
          <Button size="icon" variant="ghost" disabled={monthOffset >= 0} onClick={() => setMonthOffset((v) => v + 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground border rounded-xl">جارٍ التحميل...</div>
          ) : workers.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground border rounded-xl">لا توجد مبيعات لهذا الشهر</div>
          ) : (
            <>
              <div className="border rounded-xl p-3 bg-gradient-to-br from-background to-orange-50/30">
                <div className="flex items-center gap-1.5 text-sm font-bold mb-2">
                  <BarChart3 className="w-4 h-4 text-orange-600" />
                  <span>إجمالي مبيعات كل عامل خلال الشهر</span>
                  <span className="text-[10px] font-normal text-muted-foreground mr-auto">انقر على جزء لعرض التفاصيل</span>
                </div>
                <div className="relative w-full h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Pie
                        data={totalsByWorker}
                        dataKey="pieces"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={115}
                        paddingAngle={3}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                        isAnimationActive
                        animationDuration={900}
                        onClick={(_d: any, idx: number) =>
                          setSelectedIdx((cur) => (cur === idx ? null : idx))
                        }
                        activeIndex={selectedIdx ?? undefined}
                        activeShape={(props: any) => {
                          const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
                          const RAD = Math.PI / 180;
                          const mid = (startAngle + endAngle) / 2;
                          const dx = Math.cos(-mid * RAD) * 8;
                          const dy = Math.sin(-mid * RAD) * 8;
                          return (
                            <g style={{ transition: 'transform 400ms cubic-bezier(.2,.8,.2,1)' }}>
                              <Sector
                                cx={cx + dx}
                                cy={cy + dy}
                                innerRadius={innerRadius}
                                outerRadius={outerRadius + 10}
                                startAngle={startAngle}
                                endAngle={endAngle}
                                fill={fill}
                              />
                              <Sector
                                cx={cx + dx}
                                cy={cy + dy}
                                innerRadius={outerRadius + 14}
                                outerRadius={outerRadius + 18}
                                startAngle={startAngle}
                                endAngle={endAngle}
                                fill={fill}
                                opacity={0.35}
                              />
                            </g>
                          );
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {totalsByWorker.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center summary */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    {selectedIdx === null ? (
                      <div className="text-center">
                        <div className="text-[10px] text-muted-foreground">الإجمالي</div>
                        <div className="text-base font-extrabold text-orange-700">
                          <FmtBP pieces={totalsByWorker.reduce((s, x) => s + x.pieces, 0)} />
                        </div>
                      </div>
                    ) : (
                      <div className="text-center animate-scale-in">
                        <div className="text-xs font-bold" style={{ color: COLORS[selectedIdx % COLORS.length] }}>
                          {totalsByWorker[selectedIdx]?.name}
                        </div>
                        <div className="text-sm font-extrabold mt-0.5">
                          {fmt(Number(totalsByWorker[selectedIdx]?.pieces || 0))}
                        </div>
                        <div className="text-base font-extrabold" style={{ color: COLORS[selectedIdx % COLORS.length] }}>
                          {(
                            (Number(totalsByWorker[selectedIdx]?.pieces || 0) /
                              (totalsByWorker.reduce((s, x) => s + x.pieces, 0) || 1)) *
                            100
                          ).toFixed(1)}
                          %
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cinematic detail card */}
                <div
                  className={`overflow-hidden transition-all duration-500 ease-out ${
                    selectedIdx !== null ? 'max-h-96 mt-3 opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-2'
                  }`}
                >
                  {selectedIdx !== null && totalsByWorker[selectedIdx] && (() => {
                    const w = totalsByWorker[selectedIdx];
                    const total = totalsByWorker.reduce((s, x) => s + x.pieces, 0) || 1;
                    const pct = (w.pieces / total) * 100;
                    const rank = selectedIdx + 1;
                    const color = COLORS[selectedIdx % COLORS.length];
                    return (
                      <div
                        className="rounded-2xl p-4 border shadow-lg animate-fade-in"
                        style={{
                          background: `linear-gradient(135deg, ${color}15, transparent 70%)`,
                          borderColor: `${color}55`,
                        }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                            <div className="font-extrabold text-base">{w.name}</div>
                          </div>
                          <div
                            className="text-[10px] font-bold px-2 py-1 rounded-full text-white"
                            style={{ background: color }}
                          >
                            المرتبة #{rank}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-xl bg-background/70 p-2 text-center border">
                            <div className="text-[10px] text-muted-foreground">الكمية المباعة</div>
                            <div className="font-extrabold text-sm">{fmt(w.pieces)}</div>
                          </div>
                          <div className="rounded-xl bg-background/70 p-2 text-center border">
                            <div className="text-[10px] text-muted-foreground">النسبة</div>
                            <div className="font-extrabold text-sm" style={{ color }}>
                              {pct.toFixed(1)}%
                            </div>
                          </div>
                          <div className="rounded-xl bg-background/70 p-2 text-center border">
                            <div className="text-[10px] text-muted-foreground">الإجمالي</div>
                            <div className="font-extrabold text-sm">{fmt(total)}</div>
                          </div>
                        </div>
                        {/* Animated progress bar */}
                        <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${pct}%`, background: color }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="border rounded-xl p-3 bg-background">
                <div className="flex items-center gap-1.5 text-sm font-bold mb-2">
                  <TrendingUp className="w-4 h-4 text-orange-600" />
                  <span>الأداء اليومي لكل عامل</span>
                </div>
                <div className="w-full h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailySeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: any) => fmt(Number(v))} />
                      <Tooltip formatter={(v: any) => fmt(Number(v))} labelFormatter={(l) => `يوم ${l}`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {workers.map((w, i) => (
                        <Line
                          key={w}
                          type="monotone"
                          dataKey={w}
                          stroke={COLORS[i % COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          activeDot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductMonthlyCompetitionDialog;
