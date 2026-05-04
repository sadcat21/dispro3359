import React, { useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Package, Layers, CreditCard, Calendar, User, ShoppingBag, Hash } from 'lucide-react';

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
      <DialogContent className="max-w-3xl h-[92vh] flex flex-col p-0 gap-0 overflow-hidden border-0 shadow-2xl">
        {/* ترويسة بتصميم عصري */}
        <div className="relative shrink-0 bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white overflow-hidden">
          {/* زخارف خلفية */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-cyan-300/20 rounded-full blur-3xl" />

          <div className="relative p-5 pb-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur ring-2 ring-white/30 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-white/70 font-semibold">تفاصيل الفاتورة</p>
                <h2 className="text-xl font-bold truncate">{displayName}</h2>
                {request?.customers?.store_name && (
                  <p className="text-xs text-white/80 truncate mt-0.5">{request.customers.store_name}</p>
                )}
              </div>
            </div>

            {/* بطاقات إحصائيات */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-white/15 backdrop-blur rounded-xl p-2.5 ring-1 ring-white/20">
                <div className="flex items-center gap-1.5 text-[10px] text-white/80 mb-1">
                  <Package className="w-3 h-3" />
                  المنتجات
                </div>
                <div className="text-2xl font-bold leading-none">{items.length}</div>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-xl p-2.5 ring-1 ring-white/20">
                <div className="flex items-center gap-1.5 text-[10px] text-white/80 mb-1">
                  <Hash className="w-3 h-3" />
                  الكمية
                </div>
                <div className="text-2xl font-bold leading-none">{totalQty}</div>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-xl p-2.5 ring-1 ring-white/20">
                <div className="flex items-center gap-1.5 text-[10px] text-white/80 mb-1">
                  <Layers className="w-3 h-3" />
                  فواتير مدمجة
                </div>
                <div className="text-2xl font-bold leading-none">{mergedCount || '—'}</div>
              </div>
            </div>

            {/* شارات التفاصيل */}
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {request?.payment_method && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-blue-700 text-[11px] font-bold shadow-sm">
                  <CreditCard className="w-3 h-3" />
                  {request.payment_method}
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur text-white text-[11px] font-medium ring-1 ring-white/30">
                <Calendar className="w-3 h-3" />
                {request && new Date(request.created_at).toLocaleString('ar')}
              </span>
              {request?.worker?.full_name && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur text-white text-[11px] font-medium ring-1 ring-white/30">
                  <User className="w-3 h-3" />
                  {request.worker.full_name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* المحتوى */}
        <div className="flex-1 overflow-y-auto p-3 bg-gradient-to-b from-slate-50 to-white">
          {items.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              لا توجد منتجات
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-1 mb-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-300" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">قائمة المنتجات</span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-300" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {items.map((it: any, i: number) => {
                  const pid = it.product_id || it.productId;
                  const info = pid ? imagesMap[pid] : null;
                  const productImage = info?.image_url || null;
                  const name = info?.name || it.product_name || it.name || '—';
                  const qty = Number(it.quantity ?? it.qty ?? 0) || 0;
                  return (
                    <div
                      key={(pid || name) + '-' + i}
                      className="group flex flex-col rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-300 hover:-translate-y-0.5 transition-all"
                    >
                      <div className="relative w-full aspect-square bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
                        {productImage ? (
                          <img
                            src={productImage}
                            alt={name}
                            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-10 h-10 text-slate-300" />
                          </div>
                        )}
                        {/* شارة الكمية */}
                        <div className="absolute top-1.5 right-1.5 flex h-8 min-w-8 px-2 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white text-sm font-bold shadow-lg ring-2 ring-white">
                          {qty}
                        </div>
                      </div>
                      <div className="px-2.5 py-2 border-t border-slate-100 bg-white">
                        <p className="font-semibold text-[11px] leading-tight text-slate-800 line-clamp-2 min-h-[28px]">
                          {name}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceRequestDetailsDialog;
