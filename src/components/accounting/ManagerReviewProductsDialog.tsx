import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getProductDisplayName } from '@/utils/productDisplayName';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewIds: string[];
  title?: string;
}

interface ProductRow {
  productId: string;
  name: string;
  imageUrl: string | null;
  piecesPerBox: number;
  boxes: number;
  pieces: number;
  totalAmount: number;
}

const ManagerReviewProductsDialog: React.FC<Props> = ({ open, onOpenChange, reviewIds, title }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['manager-review-products', reviewIds],
    enabled: open && reviewIds.length > 0,
    queryFn: async () => {
      // 1) Linked accounting sessions
      const { data: sessions } = await supabase
        .from('accounting_sessions')
        .select('id, worker_id, period_start, period_end, completed_at, created_at')
        .in('review_session_id', reviewIds);

      const orderIdSet = new Set<string>();
      for (const s of (sessions || []) as any[]) {
        if (!s.worker_id) continue;
        const start = s.period_start || s.created_at;
        const end = s.period_end || s.completed_at;
        if (!start || !end) continue;
        const { data: orders } = await supabase
          .from('orders')
          .select('id')
          .eq('status', 'delivered')
          .or(`assigned_worker_id.eq.${s.worker_id},created_by.eq.${s.worker_id}`)
          .gte('updated_at', start)
          .lte('updated_at', end);
        for (const o of (orders || []) as any[]) orderIdSet.add(o.id);
      }

      const orderIds = Array.from(orderIdSet);
      if (orderIds.length === 0) return [] as ProductRow[];

      // 2) Order items + products
      const { data: items } = await supabase
        .from('order_items')
        .select('product_id, quantity, total_price, product:products(name, app_name, image_url, pieces_per_box)')
        .in('order_id', orderIds);

      const map = new Map<string, ProductRow>();
      for (const it of (items || []) as any[]) {
        if (!it.product_id) continue;
        const p = it.product || {};
        const ppb = Math.max(1, Number(p.pieces_per_box || 1));
        const row = map.get(it.product_id) || {
          productId: it.product_id,
          name: getProductDisplayName(p),
          imageUrl: p.image_url || null,
          piecesPerBox: ppb,
          boxes: 0,
          pieces: 0,
          totalAmount: 0,
        };
        row.boxes += Number(it.quantity || 0);
        row.totalAmount += Number(it.total_price || 0);
        map.set(it.product_id, row);
      }
      return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    },
  });

  const totalAmount = useMemo(
    () => (data || []).reduce((s, r) => s + r.totalAmount, 0),
    [data],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden" dir="rtl">
        <DialogHeader className="p-4 border-b bg-gradient-to-l from-blue-50 to-white dark:from-blue-950/30">
          <DialogTitle className="flex items-center justify-between gap-3 text-base">
            <span className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              {title || 'تجميع المنتجات المباعة'}
            </span>
            <span className="text-sm font-bold text-blue-700">
              {Number(totalAmount).toLocaleString('fr-FR')} دج
            </span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh]">
          <div className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : !data || data.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">لا توجد مبيعات</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {data.map((p) => (
                  <div
                    key={p.productId}
                    className="relative rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <Package className="w-10 h-10 text-muted-foreground/40" />
                      )}
                      <Badge className="absolute top-1.5 start-1.5 bg-blue-600 text-white border-0 text-[11px] px-2 py-0.5 shadow-md">
                        {p.boxes.toLocaleString('fr-FR')}
                      </Badge>
                    </div>
                    <div className="p-2 space-y-0.5">
                      <p className="text-xs font-bold leading-tight line-clamp-2 min-h-[2rem]">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {Number(p.totalAmount).toLocaleString('fr-FR')} دج
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerReviewProductsDialog;
