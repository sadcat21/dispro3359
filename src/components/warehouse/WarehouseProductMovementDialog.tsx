import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Package, History, TrendingDown, PackageOpen, Truck, AlertTriangle, RotateCcw, Filter, ClipboardList, X } from 'lucide-react';
import { dbBPDisplay } from '@/utils/boxPieceInput';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  productId: string;
  productName: string;
  productImage?: string | null;
  piecesPerBox: number;
}

type MvType = 'receipt' | 'load' | 'return' | 'factory_return' | 'damaged';

interface Mv {
  id: string;
  type: MvType;
  label: string;
  when: string;
  qty: number;
  sign: 1 | -1;
  note?: string | null;
  who?: string | null;
  whoId?: string | null;
  sessionId?: string | null;
  sessionStatus?: string | null;
}

const TYPE_STYLE: Record<MvType, { badge: string; card: string; delta: string; icon: React.ReactNode }> = {
  receipt:        { badge: 'bg-blue-100 text-blue-700 border-blue-200',          card: 'bg-blue-50 border-blue-200',       delta: 'text-blue-700',    icon: <PackageOpen className="w-3 h-3" /> },
  load:           { badge: 'bg-red-100 text-red-700 border-red-200',             card: 'bg-red-50 border-red-200',         delta: 'text-red-700',     icon: <Truck className="w-3 h-3" /> },
  return:         { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', card: 'bg-emerald-50 border-emerald-200', delta: 'text-emerald-700', icon: <RotateCcw className="w-3 h-3" /> },
  factory_return: { badge: 'bg-orange-100 text-orange-700 border-orange-200',    card: 'bg-orange-50 border-orange-200',   delta: 'text-orange-700',  icon: <TrendingDown className="w-3 h-3" /> },
  damaged:        { badge: 'bg-rose-100 text-rose-700 border-rose-200',          card: 'bg-rose-50 border-rose-200',       delta: 'text-rose-700',    icon: <AlertTriangle className="w-3 h-3" /> },
};

const TYPE_LABEL_AR: Record<MvType, string> = {
  receipt: 'استلام',
  load: 'شحن',
  return: 'تفريغ',
  factory_return: 'للمصنع',
  damaged: 'تالف',
};

// Render notes nicely — parse JSON-like payloads into readable Arabic key/value rows.
const renderNote = (note: string, pieces: number) => {
  const trimmed = note.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const obj = JSON.parse(trimmed);
      const fmt = (v: any) => dbBPDisplay(Math.max(0, Number(v) || 0), pieces);
      const map: Record<string, string> = {
        item_type: 'النوع',
        new_qty: 'كمية جديدة',
        comp_qty: 'تعويض',
        comp_offers_qty: 'تعويض عروض',
      };
      const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== 0 && v !== '0');
      if (entries.length === 0) return null;
      return (
        <div className="flex flex-wrap gap-1">
          {entries.map(([k, v]) => (
            <Badge key={k} variant="outline" className="text-[10px] font-normal">
              {map[k] || k}: {typeof v === 'number' && k.includes('qty') ? fmt(v) : String(v)}
            </Badge>
          ))}
        </div>
      );
    } catch {/* fallthrough */}
  }
  return <div className="text-[11px] text-muted-foreground break-words">{note}</div>;
};

const WarehouseProductMovementDialog: React.FC<Props> = ({
  open, onOpenChange, branchId, productId, productName, productImage, piecesPerBox,
}) => {
  const fmt = (v: number) => dbBPDisplay(Math.max(0, v), piecesPerBox);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [workerFilter, setWorkerFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['warehouse-product-movements', branchId, productId],
    enabled: open && !!branchId && !!productId,
    queryFn: async () => {
      const { data: branchReceipts } = await supabase
        .from('stock_receipts')
        .select('id, created_at, invoice_number, notes, created_by, status')
        .eq('branch_id', branchId)
        .neq('status', 'rejected');
      const receiptIds = (branchReceipts || []).map(r => r.id);
      const receiptMap = new Map((branchReceipts || []).map(r => [r.id, r]));

      const receiptItemsRes = receiptIds.length
        ? await supabase
            .from('stock_receipt_items')
            .select('id, receipt_id, quantity, notes')
            .eq('product_id', productId)
            .in('receipt_id', receiptIds)
        : { data: [] as any[] };

      const { data: movements } = await supabase
        .from('stock_movements')
        .select('id, movement_type, quantity, created_at, notes, worker_id, created_by, status, reference_type, reference_id')
        .eq('branch_id', branchId)
        .eq('product_id', productId)
        .in('movement_type', ['load', 'return'])
        .neq('status', 'rejected');

      const sessionIds = Array.from(new Set(
        (movements || [])
          .filter(m => m.reference_type === 'loading_session' && m.reference_id)
          .map(m => m.reference_id as string)
      ));
      const sessionsRes = sessionIds.length
        ? await supabase.from('loading_sessions').select('id, status, is_final').in('id', sessionIds)
        : { data: [] as any[] };
      const sessionById = new Map((sessionsRes.data || []).map((s: any) => [s.id, s]));

      const workerIds = Array.from(new Set([
        ...((movements || []).map(m => m.worker_id).filter(Boolean) as string[]),
        ...((movements || []).map(m => m.created_by).filter(Boolean) as string[]),
        ...((branchReceipts || []).map(r => r.created_by).filter(Boolean) as string[]),
      ]));
      const workersRes = workerIds.length
        ? await supabase.from('workers_safe').select('id, full_name').in('id', workerIds)
        : { data: [] as any[] };
      const workerNameById = new Map((workersRes.data || []).map((w: any) => [w.id, w.full_name]));

      const { data: edits } = await supabase
        .from('activity_logs')
        .select('id, created_at, worker_id, details')
        .eq('branch_id', branchId)
        .eq('entity_type', 'warehouse_stock_manual_edit')
        .eq('entity_id', productId)
        .order('created_at', { ascending: false })
        .limit(200);

      const list: Mv[] = [];

      for (const it of (receiptItemsRes.data || [])) {
        const r: any = receiptMap.get(it.receipt_id);
        if (!r) continue;
        list.push({
          id: `r-${it.id}`,
          type: 'receipt',
          label: 'استلام من المصنع',
          when: r.created_at,
          qty: Number(it.quantity || 0),
          sign: 1,
          note: it.notes || r.notes || (r.invoice_number ? `فاتورة: ${r.invoice_number}` : null),
          who: workerNameById.get(r.created_by) || null,
          whoId: r.created_by || null,
        });
      }

      for (const m of (movements || [])) {
        const isLoad = m.movement_type === 'load';
        const sess: any = m.reference_type === 'loading_session' && m.reference_id
          ? sessionById.get(m.reference_id) : null;
        list.push({
          id: `m-${m.id}`,
          type: isLoad ? 'load' : 'return',
          label: isLoad ? 'شحن للعامل' : 'تفريغ من العامل',
          when: m.created_at,
          qty: Number(m.quantity || 0),
          sign: isLoad ? -1 : 1,
          note: m.notes,
          who: workerNameById.get(m.worker_id || m.created_by || '') || null,
          whoId: m.worker_id || m.created_by || null,
          sessionId: sess?.id || null,
          sessionStatus: sess?.status || null,
        });
      }

      const parseDisplay = (v: any): number => {
        if (v == null) return 0;
        const n = Number(String(v).replace(',', '.'));
        return Number.isFinite(n) ? n : 0;
      };
      for (const e of (edits || [])) {
        const det: any = e.details || {};
        const ch = det.changes || {};
        const who = workerNameById.get(e.worker_id || '') || null;
        if (ch.damaged) {
          const delta = parseDisplay(ch.damaged.to) - parseDisplay(ch.damaged.from);
          if (Math.abs(delta) > 0.0001) {
            list.push({
              id: `e-${e.id}-d`, type: 'damaged', label: 'تالف',
              when: e.created_at, qty: Math.abs(delta), sign: -1,
              note: `${ch.damaged.from} ← ${ch.damaged.to}`, who, whoId: e.worker_id,
            });
          }
        }
        if (ch.factoryReturn) {
          const delta = parseDisplay(ch.factoryReturn.to) - parseDisplay(ch.factoryReturn.from);
          if (Math.abs(delta) > 0.0001) {
            list.push({
              id: `e-${e.id}-f`, type: 'factory_return', label: 'إرجاع للمصنع',
              when: e.created_at, qty: Math.abs(delta), sign: -1,
              note: `${ch.factoryReturn.from} ← ${ch.factoryReturn.to}`, who, whoId: e.worker_id,
            });
          }
        }
      }

      // إلغاء تكرار حركات "التفريغ من العامل": الاحتفاظ بالأقدم فقط لكل (عامل) لنفس المنتج،
      // لأن التفريغات المتكررة تنتج عن إعادة معايرة مخزون العامل وليست عمليات حقيقية إضافية.
      const oldestReturnByWorker = new Map<string, Mv>();
      const nonReturn: Mv[] = [];
      for (const entry of list) {
        if (entry.type !== 'return') { nonReturn.push(entry); continue; }
        const key = entry.whoId || `__no_worker__:${entry.id}`;
        const existing = oldestReturnByWorker.get(key);
        const entryTs = new Date(entry.when).getTime() || 0;
        const existingTs = existing ? (new Date(existing.when).getTime() || 0) : Infinity;
        if (!existing || entryTs < existingTs) {
          oldestReturnByWorker.set(key, entry);
        }
      }
      const deduped = [...nonReturn, ...oldestReturnByWorker.values()];
      deduped.sort((a, b) => (new Date(b.when).getTime() || 0) - (new Date(a.when).getTime() || 0));
      return deduped;
    },
  });

  const workerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of (data || [])) {
      if (m.whoId && m.who) map.set(m.whoId, m.who);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 86400000 : null;
    return (data || []).filter(m => {
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;
      if (workerFilter !== 'all' && m.whoId !== workerFilter) return false;
      const t = new Date(m.when).getTime();
      if (fromTs && t < fromTs) return false;
      if (toTs && t >= toTs) return false;
      return true;
    });
  }, [data, dateFrom, dateTo, workerFilter, typeFilter]);

  const totals = useMemo(() => {
    const t = { receipt: 0, load: 0, return: 0, factory_return: 0, damaged: 0 };
    for (const m of filtered) t[m.type] += m.qty;
    return t;
  }, [filtered]);

  const hasActiveFilter = dateFrom || dateTo || workerFilter !== 'all' || typeFilter !== 'all';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <History className="w-5 h-5 text-primary" />
            <span className="truncate">{productName}</span>
            <span className="text-[11px] font-normal text-muted-foreground">سجل حركات المخزن</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex flex-col flex-1 min-h-0">
          <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30">
            <div className="w-14 h-14 rounded-xl overflow-hidden border bg-background flex items-center justify-center shrink-0">
              {productImage ? (
                <img src={productImage} alt={productName} className="w-full h-full object-cover" />
              ) : (
                <Package className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{productName}</p>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                <Badge className={TYPE_STYLE.receipt.badge}>استلام {fmt(totals.receipt)}</Badge>
                <Badge className={TYPE_STYLE.load.badge}>شحن {fmt(totals.load)}</Badge>
                <Badge className={TYPE_STYLE.return.badge}>تفريغ {fmt(totals.return)}</Badge>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">للزبون {fmt(Math.max(0, totals.load - totals.return))}</Badge>
                {totals.factory_return > 0 && (
                  <Badge className={TYPE_STYLE.factory_return.badge}>للمصنع {fmt(totals.factory_return)}</Badge>
                )}
                {totals.damaged > 0 && (
                  <Badge className={TYPE_STYLE.damaged.badge}>تالف {fmt(totals.damaged)}</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Filter trigger */}
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-muted-foreground">
              {filtered.length} حركة
              {hasActiveFilter && <span className="ms-2 text-primary font-semibold">• مفلتر</span>}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant={hasActiveFilter ? 'default' : 'outline'} className="h-8 gap-1 text-[11px]">
                  <Filter className="w-3.5 h-3.5" />
                  تصفية وترتيب
                  {hasActiveFilter && <Badge className="ms-1 h-4 px-1 bg-background text-primary border-primary">●</Badge>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold flex items-center gap-1"><Filter className="w-3.5 h-3.5" /> تصفية</div>
                  {hasActiveFilter && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                      onClick={() => { setDateFrom(''); setDateTo(''); setWorkerFilter('all'); setTypeFilter('all'); }}>
                      <X className="w-3 h-3 me-1" /> مسح الكل
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-1">التاريخ</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-[11px]" />
                      <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-[11px]" />
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-1">العامل</div>
                    <Select value={workerFilter} onValueChange={setWorkerFilter}>
                      <SelectTrigger className="h-8 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل العمال</SelectItem>
                        {workerOptions.map(w => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-1">نوع الحركة</div>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="h-8 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل الحركات</SelectItem>
                        {(['receipt','load','return','factory_return','damaged'] as MvType[]).map(t => (
                          <SelectItem key={t} value={t}>{TYPE_LABEL_AR[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>


          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="space-y-2 pb-2">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground border rounded-xl">جارٍ التحميل...</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground border rounded-xl">لا توجد حركات مطابقة</div>
              ) : (
                filtered.map((entry, index) => {
                  const prevDay = index > 0 && filtered[index - 1]?.when ? new Date(filtered[index - 1].when).toDateString() : null;
                  const currentDay = entry.when ? new Date(entry.when).toDateString() : null;
                  const showDay = index === 0 || prevDay !== currentDay;
                  const dateLabel = entry.when ? new Date(entry.when).toLocaleDateString('ar-DZ') : '—';
                  const timeLabel = entry.when ? new Date(entry.when).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }) : '';
                  const style = TYPE_STYLE[entry.type];
                  const sign = entry.sign > 0 ? '+' : '-';
                  return (
                    <div key={entry.id} className="space-y-1">
                      {showDay && <div className="text-center text-[11px] font-semibold text-muted-foreground pt-1">{dateLabel}</div>}
                      <div className={`rounded-xl border-2 shadow-sm px-3 py-2.5 ${style.card}`}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className={`text-[10px] gap-1 ${style.badge}`}>{style.icon}{entry.label}</Badge>
                          {entry.sessionId && (
                            <Badge className="text-[10px] gap-1 bg-indigo-100 text-indigo-700 border-indigo-200">
                              <ClipboardList className="w-3 h-3" />
                              جلسة محاسبة{entry.sessionStatus === 'completed' ? ' • مكتملة' : ''}
                            </Badge>
                          )}
                          {entry.who && <span className="text-[11px] text-muted-foreground">{entry.who}</span>}
                          <span className="text-[10px] text-muted-foreground ms-auto">{timeLabel}</span>
                          <span className={`text-sm font-extrabold ${style.delta}`}>{sign}{fmt(entry.qty)}</span>
                        </div>
                        {entry.note && (
                          <div className="mt-1.5">{renderNote(entry.note, piecesPerBox)}</div>
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
  );
};

export default WarehouseProductMovementDialog;
