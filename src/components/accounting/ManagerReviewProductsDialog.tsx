import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getProductDisplayName } from '@/utils/productDisplayName';
import { boxesToBPAlways } from '@/utils/boxPieceInput';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewIds: string[];
  title?: string;
}

type Bucket = 'invoice' | 'retail' | 'gros' | 'super_gros' | 'custom';

const BUCKET_LABELS: Record<Bucket, string> = {
  invoice: 'فاتورة 1',
  retail: 'التجزئة',
  gros: 'الجملة',
  super_gros: 'سوبر جملة',
  custom: 'أسعار مخصصة',
};

const BUCKET_COLORS: Record<Bucket, string> = {
  invoice: 'bg-orange-100 text-orange-800 border-orange-200',
  retail: 'bg-blue-100 text-blue-800 border-blue-200',
  gros: 'bg-green-100 text-green-800 border-green-200',
  super_gros: 'bg-purple-100 text-purple-800 border-purple-200',
  custom: 'bg-pink-100 text-pink-800 border-pink-200',
};

interface ProductRow {
  productId: string;
  name: string;
  imageUrl: string | null;
  piecesPerBox: number;
  boxes: number;
  totalAmount: number;
  giftBoxes: number;
  buckets: Record<Bucket, number>;
}

const classify = (item: any, order: any): Bucket => {
  const pt = String(order?.payment_type || '').toLowerCase();
  if (pt === 'with_invoice') return 'invoice';
  const sub = String(item.price_subtype || '').toLowerCase();
  if (sub === 'invoice') return 'invoice';
  if (sub === 'retail') return 'retail';
  if (sub === 'gros') return 'gros';
  if (sub === 'super_gros') return 'super_gros';
  if (sub === 'custom' || sub === 'special') return 'custom';

  // Infer from unit price vs product catalog
  const p = item.product || {};
  const unit = Number(item.unit_price || 0);
  const candidates: Array<[Bucket, number]> = ([
    ['retail', Number(p.price_retail || 0)],
    ['gros', Number(p.price_gros || 0)],
    ['super_gros', Number(p.price_super_gros || 0)],
  ] as Array<[Bucket, number]>).filter(([, v]) => v > 0);
  const tol = 0.75;
  const match = candidates.find(([, v]) => Math.abs(v - unit) <= tol);
  if (match) return match[0];
  return 'custom';
};

const ManagerReviewProductsDialog: React.FC<Props> = ({ open, onOpenChange, reviewIds, title }) => {
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['manager-review-products', reviewIds],
    enabled: open && reviewIds.length > 0,
    queryFn: async () => {
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

      const [{ data: items }, { data: orders }] = await Promise.all([
        supabase
          .from('order_items')
          .select('order_id, product_id, quantity, total_price, unit_price, price_subtype, product:products(name, app_name, image_url, pieces_per_box, price_retail, price_gros, price_super_gros, price_invoice)')
          .in('order_id', orderIds),
        supabase
          .from('orders')
          .select('id, payment_type')
          .in('id', orderIds),
      ]);

      const orderMap = new Map<string, any>();
      for (const o of (orders || []) as any[]) orderMap.set(o.id, o);

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
          totalAmount: 0,
          buckets: { invoice: 0, retail: 0, gros: 0, super_gros: 0, custom: 0 },
        };
        const qty = Number(it.quantity || 0);
        row.boxes += qty;
        row.totalAmount += Number(it.total_price || 0);
        const bucket = classify(it, orderMap.get(it.order_id));
        row.buckets[bucket] += qty;
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
    <>
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
                    <button
                      type="button"
                      key={p.productId}
                      onClick={() => setSelectedProduct(p)}
                      className="relative rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-md hover:ring-2 hover:ring-blue-400 transition text-start"
                    >
                      <div className="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden relative">
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
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedProduct} onOpenChange={(o) => !o && setSelectedProduct(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden" dir="rtl">
          {selectedProduct && (
            <>
              <DialogHeader className="p-4 border-b bg-gradient-to-l from-blue-50 to-white dark:from-blue-950/30">
                <DialogTitle className="flex items-center gap-3 text-sm">
                  {selectedProduct.imageUrl ? (
                    <img src={selectedProduct.imageUrl} alt="" className="w-10 h-10 rounded-md object-cover" />
                  ) : (
                    <Package className="w-10 h-10 text-muted-foreground/40" />
                  )}
                  <div className="flex-1 text-start">
                    <p className="font-bold leading-tight">{selectedProduct.name}</p>
                    <p className="text-[11px] text-muted-foreground font-normal">
                      إجمالي: {selectedProduct.boxes.toLocaleString('fr-FR')} صندوق ·{' '}
                      {Number(selectedProduct.totalAmount).toLocaleString('fr-FR')} دج
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">توزيع الكميات حسب نوع السعر</p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(BUCKET_LABELS) as Bucket[]).map((b) => (
                    <div key={b} className={`rounded-lg border px-3 py-2 ${BUCKET_COLORS[b]}`}>
                      <p className="text-[10px] opacity-80">{BUCKET_LABELS[b]}</p>
                      <p className="text-lg font-extrabold">
                        {selectedProduct.buckets[b].toLocaleString('fr-FR')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ManagerReviewProductsDialog;
