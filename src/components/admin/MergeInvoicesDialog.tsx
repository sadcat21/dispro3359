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
  unit_price?: number;
  total: number;
}

const MergeInvoicesDialog: React.FC<Props> = ({ open, onOpenChange, customerId, customerName, requests }) => {
  const { workerId, activeBranch } = useAuth();
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>(() => requests.map(r => r.id));

  React.useEffect(() => {
    if (open) setSelectedIds(requests.map(r => r.id));
  }, [open, requests]);

  const toggle = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const selectedRequests = requests.filter(r => selectedIds.includes(r.id));

  const aggregated: AggLine[] = useMemo(() => {
    const map = new Map<string, AggLine>();
    for (const r of selectedRequests) {
      const items: any[] = Array.isArray(r.products) ? r.products : [];
      for (const it of items) {
        const key = String(it.product_id || it.id || it.name || it.product_name || Math.random());
        const name = it.product_name || it.name || '—';
        const qty = Number(it.quantity ?? it.qty ?? 0) || 0;
        const price = Number(it.unit_price ?? it.price ?? 0) || 0;
        const total = Number(it.total ?? qty * price) || 0;
        const existing = map.get(key);
        if (existing) {
          existing.quantity += qty;
          existing.total += total;
        } else {
          map.set(key, {
            product_id: it.product_id,
            product_name: name,
            unit: it.unit,
            quantity: qty,
            unit_price: price,
            total,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [selectedRequests]);

  const grandTotal = aggregated.reduce((s, x) => s + (x.total || 0), 0);

  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (selectedRequests.length === 0) throw new Error('لم يتم تحديد أي فاتورة');

      const first = selectedRequests[0];
      const productsPayload = aggregated.map(a => ({
        product_id: a.product_id,
        product_name: a.product_name,
        unit: a.unit,
        quantity: a.quantity,
        unit_price: a.unit_price,
        total: a.total,
      }));

      // 1) إنشاء طلب فاتورة موحّد جديد مباشرة بحالة pending_assistant
      const { data: parent, error: insErr } = await supabase
        .from('manual_invoice_requests')
        .insert({
          customer_id: customerId,
          worker_id: workerId,
          branch_id: activeBranch?.id || first.branch_id || null,
          status: 'pending_assistant',
          payment_method: first.payment_method,
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
      toast.success('تم إرسال الطلب الموحّد إلى الإدارة');
      qc.invalidateQueries({ queryKey: ['branch-invoice-approvals'] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || 'تعذّر الإرسال'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            تجميع فواتير العميل: {customerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* قائمة الفواتير لتحديد ما يُجمَّع */}
          <div className="border rounded-lg p-3 bg-muted/30">
            <p className="text-sm font-semibold mb-2">حدد الفواتير التي تريد تجميعها ({selectedIds.length}/{requests.length})</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {requests.map(r => (
                <label key={r.id} className="flex items-center gap-2 text-sm bg-white rounded px-2 py-1.5 cursor-pointer hover:bg-blue-50">
                  <Checkbox checked={selectedIds.includes(r.id)} onCheckedChange={() => toggle(r.id)} />
                  <span className="flex-1">
                    {r.invoice_number ? `#${r.invoice_number}` : 'بدون رقم'}
                    <span className="text-xs text-muted-foreground mr-2">
                      {new Date(r.created_at).toLocaleDateString('ar')}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Array.isArray(r.products) ? r.products.length : 0} منتج
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* المنتجات المُجمَّعة */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-blue-50 px-3 py-2 text-sm font-semibold flex items-center justify-between">
              <span>المنتجات المُجمَّعة ({aggregated.length})</span>
              <span className="text-blue-700">المجموع: {grandTotal.toLocaleString()}</span>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {aggregated.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-6">لا توجد منتجات</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs">
                    <tr>
                      <th className="text-start px-3 py-2">المنتج</th>
                      <th className="text-center px-2 py-2">الكمية</th>
                      <th className="text-center px-2 py-2">السعر</th>
                      <th className="text-end px-3 py-2">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregated.map((a, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">{a.product_name}</td>
                        <td className="text-center px-2 py-2 font-medium">{a.quantity}</td>
                        <td className="text-center px-2 py-2">{a.unit_price?.toLocaleString() || '—'}</td>
                        <td className="text-end px-3 py-2 font-semibold">{a.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mergeMutation.isPending}>
            إلغاء
          </Button>
          <Button
            onClick={() => mergeMutation.mutate()}
            disabled={mergeMutation.isPending || selectedIds.length < 1}
            className="gap-1 bg-blue-600 hover:bg-blue-700"
          >
            {mergeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            إرسال مجمّع ({selectedIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MergeInvoicesDialog;
