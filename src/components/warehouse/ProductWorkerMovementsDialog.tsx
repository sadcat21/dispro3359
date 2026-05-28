import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Users, Truck, RotateCcw, Package, Boxes, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { dbBPDisplay } from '@/utils/boxPieceInput';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  productId: string;
  productName: string;
  piecesPerBox: number;
}

interface Row {
  id: string;
  type: 'load' | 'return';
  when: string;
  qty: number;
  worker: string;
  note?: string | null;
}

const ProductWorkerMovementsDialog: React.FC<Props> = ({
  open, onOpenChange, branchId, productId, productName, piecesPerBox,
}) => {
  const fmt = (v: number) => dbBPDisplay(Math.max(0, v), piecesPerBox);

  const { data, isLoading } = useQuery({
    queryKey: ['product-worker-movements', branchId, productId],
    enabled: open && !!branchId && !!productId,
    queryFn: async () => {
      const { data: movs } = await supabase
        .from('stock_movements')
        .select('id, movement_type, quantity, created_at, notes, worker_id, status')
        .eq('branch_id', branchId)
        .eq('product_id', productId)
        .in('movement_type', ['load', 'return'])
        .neq('status', 'rejected')
        .order('created_at', { ascending: false });

      const workerIds = Array.from(new Set((movs || []).map(m => m.worker_id).filter(Boolean) as string[]));
      const [wRes, stockRes] = await Promise.all([
        workerIds.length
          ? supabase.from('workers_safe').select('id, full_name').in('id', workerIds)
          : Promise.resolve({ data: [] as any[] }),
        workerIds.length
          ? supabase.from('worker_stock').select('worker_id, quantity').eq('branch_id', branchId).eq('product_id', productId).in('worker_id', workerIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const nameById = new Map((wRes.data || []).map((w: any) => [w.id, w.full_name]));
      const stockByWorker = new Map<string, number>((stockRes.data || []).map((s: any) => [s.worker_id, Number(s.quantity || 0)]));

      const rows: Row[] = (movs || []).map((m: any) => ({
        id: m.id,
        type: m.movement_type as 'load' | 'return',
        when: m.created_at,
        qty: Number(m.quantity || 0),
        worker: nameById.get(m.worker_id || '') || '—',
        note: m.notes,
      }));
      const stockByWorkerName = new Map<string, number>();
      for (const [wid, qty] of stockByWorker) {
        const n = nameById.get(wid) || '—';
        stockByWorkerName.set(n, (stockByWorkerName.get(n) || 0) + qty);
      }
      return { rows, stockByWorkerName };
    },
  });

  const rowsData = (data as any)?.rows as Row[] | undefined;
  const stockByWorkerName = (data as any)?.stockByWorkerName as Map<string, number> | undefined;

  const grouped = useMemo(() => {
    const map = new Map<string, { worker: string; loaded: number; returned: number; entries: Row[] }>();
    for (const r of (rowsData || [])) {
      const k = r.worker;
      const cur = map.get(k) || { worker: k, loaded: 0, returned: 0, entries: [] };
      if (r.type === 'load') cur.loaded += r.qty;
      else cur.returned += r.qty;
      cur.entries.push(r);
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => (b.loaded + b.returned) - (a.loaded + a.returned));
  }, [rowsData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Users className="w-5 h-5 text-primary" />
            <span className="truncate">{productName}</span>
            <span className="text-[11px] font-normal text-muted-foreground">حركات الشحن/التفريغ للعمال</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground border rounded-xl">جارٍ التحميل...</div>
          ) : grouped.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground border rounded-xl">لا توجد حركات</div>
          ) : (
            grouped.map(g => (
              <Collapsible key={g.worker} className="border rounded-xl p-3 space-y-2 bg-muted/20">
                <CollapsibleTrigger className="w-full text-right space-y-2">
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-primary" />
                    {g.worker}
                    <ChevronDown className="w-4 h-4 ml-auto transition-transform data-[state=open]:rotate-180" />
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1"><Boxes className="w-3 h-3" />الرصيد {fmt(stockByWorkerName?.get(g.worker) || 0)}</Badge>
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1"><Truck className="w-3 h-3" />شحن {fmt(g.loaded)}</Badge>
                    <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200 gap-1"><RotateCcw className="w-3 h-3" />تفريغ {fmt(g.returned)}</Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1">
                    {g.entries.map(e => {
                      const isLoad = e.type === 'load';
                      return (
                        <div key={e.id} className={`text-[11px] flex items-center justify-between gap-2 px-2 py-1 rounded-md ${isLoad ? 'bg-blue-50' : 'bg-cyan-50'}`}>
                          <span className="text-muted-foreground">{new Date(e.when).toLocaleString('ar-DZ', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          <span className={`font-bold ${isLoad ? 'text-blue-700' : 'text-cyan-700'}`}>
                            {isLoad ? 'شحن' : 'تفريغ'} {fmt(e.qty)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductWorkerMovementsDialog;
