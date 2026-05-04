import React, { useMemo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Send, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import InvoicePaymentMethodSelect from '@/components/orders/InvoicePaymentMethodSelect';
import { InvoicePaymentMethod, INVOICE_PAYMENT_METHODS } from '@/types/stamp';
import { useLanguage } from '@/contexts/LanguageContext';

export interface PostponedRequest {
  id: string;
  customer_id?: string | null;
  invoice_number: string | null;
  created_at: string;
  payment_method: string | null;
  whatsapp_contact: string | null;
  invoice_scope?: 'public' | 'private' | null;
  products: any;
  worker_id?: string | null;
  branch_id?: string | null;
  order_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId: string;
  customerName: string;
  requests: PostponedRequest[];
}

interface AggLine {
  product_id?: string;
  product_name: string;
  unit?: string;
  quantity: number;
}

const MergeInvoicesDialog: React.FC<Props> = ({ open, onOpenChange, customerId, customerName, requests }) => {
  const { workerId, activeBranch } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>(() => requests.map(r => r.id));
  const [paymentMethod, setPaymentMethod] = useState<InvoicePaymentMethod | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedIds(requests.map(r => r.id));
      setPaymentMethod(null);
    }
  }, [open, requests]);

  const toggle = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const selectedRequests = requests.filter(r => selectedIds.includes(r.id));

  const aggregated: AggLine[] = useMemo(() => {
    const map = new Map<string, AggLine>();
    for (const r of selectedRequests) {
      const items: any[] = Array.isArray(r.products) ? r.products : [];
      for (const it of items) {
        const key = String(it.product_id || it.productId || it.id || it.name || it.product_name || Math.random());
        const name = it.product_name || it.name || '—';
        const qty = Number(it.quantity ?? it.qty ?? 0) || 0;
        const existing = map.get(key);
        if (existing) {
          existing.quantity += qty;
        } else {
          map.set(key, {
            product_id: it.product_id || it.productId,
            product_name: name,
            unit: it.unit,
            quantity: qty,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [selectedRequests]);

  // جلب صور المنتجات
  const productIds = useMemo(
    () => aggregated.map(a => a.product_id).filter(Boolean) as string[],
    [aggregated]
  );

  const productImagesQ = useQuery({
    queryKey: ['merge-products-images', productIds],
    enabled: productIds.length > 0,
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

  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (selectedRequests.length === 0) throw new Error(t('merge_invoices.error_no_selection'));
      if (!paymentMethod) throw new Error(t('merge_invoices.error_no_payment'));

      const first = selectedRequests[0];
      const productsPayload = aggregated.map(a => ({
        product_id: a.product_id,
        product_name: a.product_name,
        unit: a.unit,
        quantity: a.quantity,
      }));

      // 1) إنشاء طلب فاتورة موحّد جديد بحالة pending_assistant
      const { data: parent, error: insErr } = await supabase
        .from('manual_invoice_requests')
        .insert({
          customer_id: customerId,
          worker_id: workerId,
          branch_id: activeBranch?.id || first.branch_id || null,
          status: 'pending_assistant',
          payment_method: INVOICE_PAYMENT_METHODS[paymentMethod].label,
          whatsapp_contact: first.whatsapp_contact,
          invoice_scope: first.invoice_scope || 'private',
          products: productsPayload as any,
          is_merged_parent: true,
          merged_request_ids: selectedRequests.map(r => r.id),
          branch_approved_by: workerId,
          branch_approved_at: new Date().toISOString(),
        } as any)
        .select('id')
        .single();
      if (insErr) throw insErr;

      // 2) تعليم الفواتير الأصلية كمدمجة (merged) وربطها بالأب
      const { error: updErr } = await supabase
        .from('manual_invoice_requests')
        .update({
          status: 'merged',
          merged_into_request_id: parent.id,
        } as any)
        .in('id', selectedRequests.map(r => r.id));
      if (updErr) throw updErr;

      return parent.id;
    },
    onSuccess: () => {
      toast.success(t('merge_invoices.success'));
      qc.invalidateQueries({ queryKey: ['branch-invoice-approvals'] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || t('merge_invoices.send_failed')),
  });

  const imagesMap = productImagesQ.data || {};

  const methods = Object.entries(INVOICE_PAYMENT_METHODS) as [InvoicePaymentMethod, typeof INVOICE_PAYMENT_METHODS[InvoicePaymentMethod]][];

  const PAYMENT_COLORS: Record<InvoicePaymentMethod, string> = {
    receipt: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600',
    check: 'bg-red-600 hover:bg-red-700 text-white border-red-600',
    cash: 'bg-green-600 hover:bg-green-700 text-white border-green-600',
    transfer: 'bg-orange-600 hover:bg-orange-700 text-white border-orange-600',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[95vh] sm:h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Package className="w-5 h-5 text-blue-600" />
            {t('merge_invoices.title')}: {customerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-y-auto p-3">
          {/* قائمة الفواتير لتحديد ما يُجمَّع — شبكية */}
          <div className="border rounded-lg p-2.5 bg-muted/30">
            <p className="text-xs font-semibold mb-2">{t('merge_invoices.select_hint')} ({selectedIds.length}/{requests.length})</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {requests.map(r => {
                const checked = selectedIds.includes(r.id);
                const productsCount = Array.isArray(r.products) ? r.products.length : 0;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggle(r.id)}
                    className={`relative rounded-lg border-2 p-2 transition ${checked ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 ring-2 ring-red-400' : 'border-border bg-card hover:border-red-300'}`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className={`text-xs font-semibold ${checked ? 'text-white' : 'text-foreground'}`}>
                        {new Date(r.created_at).toLocaleDateString('ar')}
                      </span>
                      <span className="flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold ring-2 ring-white">
                        {productsCount}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* المنتجات المُجمَّعة كبطاقات شبكية */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-blue-50 px-3 py-2 text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Package className="w-4 h-4 text-blue-600" />
                {t('merge_invoices.merged_products')}
              </span>
              <span className="text-blue-700 text-xs">{t('merge_invoices.products_count')} ({aggregated.length})</span>
            </div>
            <div className="p-2">
              {aggregated.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-6">{t('merge_invoices.no_products')}</div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {aggregated.map((a, i) => {
                    const info = a.product_id ? imagesMap[a.product_id] : null;
                    const productImage = info?.image_url || null;
                    const displayName = info?.name || a.product_name;
                    return (
                      <div
                        key={(a.product_id || a.product_name) + '-' + i}
                        className="flex flex-col rounded-xl overflow-hidden shadow border border-border bg-card"
                      >
                        <div className="px-1.5 py-1 border-b bg-muted border-border">
                          <span className="font-bold text-[10px] leading-tight block truncate text-foreground">
                            {displayName}
                          </span>
                        </div>
                        <div className="relative w-full aspect-[4/3] bg-muted overflow-hidden">
                          {productImage ? (
                            <img src={productImage} alt={displayName} className="w-full h-full object-contain" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-2xl text-muted-foreground/30">📦</span>
                            </div>
                          )}
                        </div>
                        <div className="px-1 py-1 bg-card flex items-center justify-center gap-1 border-t border-border">
                          <span className="flex h-6 min-w-6 px-1.5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                            {a.quantity}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* تذييل ثابت: طريقة الدفع + أزرار الإجراءات */}
        <div className="border-t bg-background p-3 space-y-2 shrink-0">
          <p className="text-xs font-semibold text-muted-foreground">طريقة الدفع</p>
          <div className="grid grid-cols-4 gap-1.5">
            {methods.map(([methodKey, method]) => (
              <Button
                key={methodKey}
                type="button"
                size="sm"
                onClick={() => setPaymentMethod(methodKey)}
                disabled={mergeMutation.isPending}
                className={`h-9 px-1 text-xs font-bold transition-opacity ${PAYMENT_COLORS[methodKey]} ${paymentMethod === methodKey ? 'ring-2 ring-offset-1 ring-blue-400' : ''} ${paymentMethod !== null && paymentMethod !== methodKey ? 'opacity-50' : ''}`}
              >
                {method.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mergeMutation.isPending}
              className="h-10"
            >
              {t('merge_invoices.close')}
            </Button>
            <Button
              onClick={() => mergeMutation.mutate()}
              disabled={mergeMutation.isPending || selectedIds.length < 1 || !paymentMethod}
              className="gap-1 bg-blue-600 hover:bg-blue-700 h-10"
            >
              {mergeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {t('merge_invoices.send_merged')} ({selectedIds.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MergeInvoicesDialog;
