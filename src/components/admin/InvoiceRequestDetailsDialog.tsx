import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Package, Layers, CreditCard, Calendar, User } from 'lucide-react';

interface InvoiceRequestLike {
  id: string;
  customer_id?: string | null;
  payment_method?: string | null;
  created_at: string;
  products: any;
  is_merged_parent?: boolean | null;
  merged_request_ids?: string[] | null;
  customers?: { name: string; name_fr?: string | null; store_name?: string | null } | null;
  worker?: { full_name: string } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  request: InvoiceRequestLike | null;
  customerName?: string;
}

const InvoiceRequestDetailsDialog: React.FC<Props> = ({ open, onOpenChange, request, customerName }) => {
  const items: any[] = useMemo(
    () => (request && Array.isArray(request.products) ? request.products : []),
    [request]
  );

  const productIds = useMemo(
    () => items.map((it: any) => it.product_id || it.productId).filter(Boolean) as string[],
    [items]
  );

  const productImagesQ = useQuery({
    queryKey: ['invoice-request-products', request?.id, productIds],
    enabled: open && productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, image_url')
        .in('id', productIds);
      if (error) throw error;
      const map: Record<string, { name: string; image_url: string | null }> = {};
      (data || []).forEach((p: any) => { map[p.id] = { name: p.name, image_url: p.image_url }; });
      return map;
    },
  });

  const imagesMap = productImagesQ.data || {};
  const totalQty = items.reduce((s, it) => s + (Number(it.quantity ?? it.qty ?? 0) || 0), 0);
  const mergedCount = Array.isArray(request?.merged_request_ids) ? request!.merged_request_ids!.length : 0;
  const displayName = customerName
    || request?.customers?.name_fr
    || request?.customers?.name
    || '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-3 border-b shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Package className="w-5 h-5 text-blue-600" />
            <span className="truncate">تفاصيل الفاتورة — {displayName}</span>
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {request?.is_merged_parent && (
              <Badge className="bg-blue-100 text-blue-800 border border-blue-300 gap-1 text-[10px]">
                <Layers className="w-3 h-3" />
                موحَّدة ({mergedCount})
              </Badge>
            )}
            {request?.payment_method && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <CreditCard className="w-3 h-3" />
                {request.payment_method}
              </Badge>
            )}
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Calendar className="w-3 h-3" />
              {request && new Date(request.created_at).toLocaleString('ar')}
            </Badge>
            {request?.worker?.full_name && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <User className="w-3 h-3" />
                {request.worker.full_name}
              </Badge>
            )}
            <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px]">
              {items.length} منتج • إجمالي {totalQty}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-3">
          {items.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">لا توجد منتجات</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {items.map((it: any, i: number) => {
                const pid = it.product_id || it.productId;
                const info = pid ? imagesMap[pid] : null;
                const productImage = info?.image_url || null;
                const name = info?.name || it.product_name || it.name || '—';
                const qty = Number(it.quantity ?? it.qty ?? 0) || 0;
                return (
                  <div
                    key={(pid || name) + '-' + i}
                    className="flex flex-col rounded-xl overflow-hidden shadow-sm border border-border bg-card"
                  >
                    <div className="px-2 py-1.5 border-b bg-muted border-border">
                      <span className="font-bold text-[11px] leading-tight block truncate text-foreground">
                        {name}
                      </span>
                    </div>
                    <div className="relative w-full aspect-[4/3] bg-muted overflow-hidden">
                      {productImage ? (
                        <img src={productImage} alt={name} className="w-full h-full object-contain" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-3xl text-muted-foreground/30">📦</span>
                        </div>
                      )}
                      <span className="absolute bottom-1 right-1 flex h-7 min-w-7 px-2 items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold shadow-md ring-2 ring-white">
                        {qty}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceRequestDetailsDialog;
