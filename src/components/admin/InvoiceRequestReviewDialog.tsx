import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, FileText, CheckCircle2, XCircle, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requestId: string | null;
}

const InvoiceRequestReviewDialog: React.FC<Props> = ({ open, onOpenChange, requestId }) => {
  const { t } = useLanguage();
  const { workerId } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);

  const requestQ = useQuery({
    queryKey: ['invoice-request-detail', requestId],
    enabled: !!requestId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manual_invoice_requests')
        .select(`
          *,
          customers(name, store_name, phone),
          worker:workers!manual_invoice_requests_worker_id_fkey(full_name),
          branches(name)
        `)
        .eq('id', requestId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => { if (!open) setOrderData(null); }, [open]);

  const handleUpload = async (file: File) => {
    if (!requestId || !file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${requestId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('manual-invoices')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('manual-invoices').getPublicUrl(path);
      const { error: updErr } = await (supabase as any)
        .from('manual_invoice_requests')
        .update({
          invoice_file_url: pub.publicUrl,
          invoice_file_name: file.name,
          invoice_uploaded_at: new Date().toISOString(),
          invoice_uploaded_by: workerId,
        })
        .eq('id', requestId);
      if (updErr) throw updErr;
      toast.success(t('invoice_review.upload_success'));
      qc.invalidateQueries({ queryKey: ['invoice-request-detail', requestId] });
      qc.invalidateQueries({ queryKey: ['assistant-invoice-requests'] });
      qc.invalidateQueries({ queryKey: ['branch-invoice-approvals'] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from('manual_invoice_requests')
        .update({
          invoice_file_url: null,
          invoice_file_name: null,
          invoice_uploaded_at: null,
          invoice_uploaded_by: null,
        })
        .eq('id', requestId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('invoice_review.file_removed'));
      qc.invalidateQueries({ queryKey: ['invoice-request-detail', requestId] });
      qc.invalidateQueries({ queryKey: ['assistant-invoice-requests'] });
      qc.invalidateQueries({ queryKey: ['branch-invoice-approvals'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: async () => {
      const r = requestQ.data;
      if (!r?.invoice_file_url) {
        throw new Error(t('invoice_review.must_upload_first'));
      }
      const { error } = await supabase
        .from('manual_invoice_requests')
        .update({
          status: 'approved',
          assistant_approved_at: new Date().toISOString(),
          assistant_approved_by: workerId,
        } as any)
        .eq('id', requestId!);
      if (error) throw error;
      if (r.order_id) {
        await supabase.from('orders').update({ status: 'pending' } as any).eq('id', r.order_id);
      }
    },
    onSuccess: () => {
      toast.success(t('assistant_approvals.approved_success'));
      qc.invalidateQueries({ queryKey: ['assistant-invoice-requests'] });
      qc.invalidateQueries({ queryKey: ['branch-invoice-approvals'] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('manual_invoice_requests')
        .update({ status: 'rejected' } as any)
        .eq('id', requestId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('assistant_approvals.rejected_success'));
      qc.invalidateQueries({ queryKey: ['assistant-invoice-requests'] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openOrderDetails = async () => {
    const r = requestQ.data;
    if (!r?.order_id) {
      toast.error(t('branch_invoice_approvals.no_linked_order'));
      return;
    }
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customer:customers!orders_customer_id_fkey(*),
        assigned_worker:workers!orders_assigned_worker_id_fkey(id, full_name),
        created_by_worker:workers!orders_created_by_fkey(id, full_name),
        items:order_items(*, product:products(*))
      `)
      .eq('id', r.order_id)
      .single();
    if (error) { toast.error(error.message); return; }
    setOrderData({ ...data, _hideModifyAction: true });
    setOrderDetailsOpen(true);
  };

  const r = requestQ.data;
  const fileUrl = r?.invoice_file_url as string | undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-600" />
              {t('invoice_review.title')}
            </DialogTitle>
          </DialogHeader>

          {requestQ.isLoading || !r ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-red-500" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* بيانات الطلب */}
              <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/50 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('branch_invoice_approvals.sales_rep')}:</span>
                  <span className="font-medium">{r.worker?.full_name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('invoice_review.customer')}:</span>
                  <span className="font-medium">{r.customers?.name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('assistant_approvals.unknown_branch')}:</span>
                  <span className="font-medium">{r.branches?.name || '—'}</span>
                </div>
                {r.payment_method && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('branch_invoice_approvals.payment')}:</span>
                    <Badge variant="outline">{r.payment_method}</Badge>
                  </div>
                )}
              </div>

              {/* عرض تفاصيل الطلبية */}
              {r.order_id && (
                <Button variant="outline" className="w-full" onClick={openOrderDetails}>
                  <FileText className="w-4 h-4 me-2" />
                  {t('invoice_review.view_order_details')}
                </Button>
              )}

              {/* رفع الفاتورة */}
              <div className="rounded-lg border-2 border-dashed border-red-300 p-4 bg-red-50/50">
                <h3 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  {t('invoice_review.upload_section_title')}
                </h3>
                <p className="text-xs text-slate-600 mb-3">{t('invoice_review.upload_hint')}</p>

                {fileUrl ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-slate-200">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-green-600 shrink-0" />
                        <span className="text-sm truncate">{r.invoice_file_name || 'invoice.pdf'}</span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" asChild>
                          <a href={fileUrl} target="_blank" rel="noreferrer" download>
                            <Download className="w-4 h-4" />
                          </a>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removeFile.mutate()} disabled={removeFile.isPending}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <label className="block">
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUpload(f);
                          e.target.value = '';
                        }}
                      />
                      <span className="text-xs text-blue-600 cursor-pointer hover:underline">
                        {t('invoice_review.replace_file')}
                      </span>
                    </label>
                  </div>
                ) : (
                  <label className="block">
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(f);
                        e.target.value = '';
                      }}
                    />
                    <div className="flex flex-col items-center justify-center py-6 cursor-pointer hover:bg-red-100/50 rounded transition">
                      {uploading ? (
                        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-red-400 mb-2" />
                          <span className="text-sm font-medium text-red-700">{t('invoice_review.choose_file')}</span>
                          <span className="text-xs text-slate-500 mt-1">PDF / JPG / PNG</span>
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>

              {/* أزرار الإجراءات */}
              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => approve.mutate()}
                  disabled={approve.isPending || !fileUrl}
                >
                  <CheckCircle2 className="w-4 h-4 me-1" />
                  {t('assistant_approvals.approve_final')}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => reject.mutate()}
                  disabled={reject.isPending}
                >
                  <XCircle className="w-4 h-4 me-1" />
                  {t('assistant_approvals.reject')}
                </Button>
              </div>
              {!fileUrl && (
                <p className="text-xs text-amber-600 text-center">⚠️ {t('invoice_review.must_upload_first')}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <OrderDetailsDialog
        open={orderDetailsOpen}
        onOpenChange={setOrderDetailsOpen}
        order={orderData}
        hideModifyAction={true}
      />
    </>
  );
};

export default InvoiceRequestReviewDialog;
