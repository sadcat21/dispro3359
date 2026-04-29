import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, FileText, CheckCircle2, XCircle, Download, Trash2, User, Store, Package, Briefcase, Lock, Globe2 } from 'lucide-react';
import { toast } from 'sonner';

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

  const requestQ = useQuery({
    queryKey: ['invoice-request-detail', requestId],
    enabled: !!requestId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manual_invoice_requests')
        .select(`
          *,
          customers(name, name_fr, store_name, phone),
          worker:workers!manual_invoice_requests_worker_id_fkey(full_name),
          branches(name)
        `)
        .eq('id', requestId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  // جلب صور المنتجات لإظهارها في الشبكة
  const productIds = useMemo(() => {
    const products = requestQ.data?.products;
    if (!Array.isArray(products)) return [];
    return products.map((p: any) => p.productId || p.product_id).filter(Boolean);
  }, [requestQ.data]);

  const productImagesQ = useQuery({
    queryKey: ['invoice-review-products', productIds],
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

  const r = requestQ.data;
  const fileUrl = r?.invoice_file_url as string | undefined;
  const customerDisplayName = r?.customers?.name_fr || r?.customers?.name || '—';
  const products: any[] = Array.isArray(r?.products) ? r.products : [];
  const isPrivate = r?.invoice_scope === 'private';
  const headerClass = isPrivate
    ? 'bg-amber-100 border-amber-300 text-amber-900'
    : 'bg-emerald-100 border-emerald-300 text-emerald-900';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col gap-0">
        <DialogHeader className={`px-5 pt-5 pb-3 border-b shrink-0 ${r ? headerClass : ''}`}>
          <DialogTitle className="flex items-center gap-2">
            <FileText className={`w-5 h-5 ${isPrivate ? 'text-amber-700' : 'text-emerald-700'}`} />
            {t('invoice_review.title')}
          </DialogTitle>
        </DialogHeader>

        {requestQ.isLoading || !r ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-red-500" />
          </div>
        ) : (
          <>
            {/* المحتوى القابل للتمرير */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* بطاقة العميل + الدفع */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-bold text-base text-slate-900" dir="ltr">
                        {customerDisplayName}
                      </span>
                    </div>
                    {r.customers?.store_name && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Store className="w-3.5 h-3.5 shrink-0" />
                        <span dir="ltr">{r.customers.store_name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Briefcase className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-xs text-slate-500">منشئ الطلب:</span>
                      <span className="font-semibold text-slate-800" dir="ltr">{r.worker?.full_name || '—'}</span>
                    </div>
                    {r.branches?.name && (
                      <div className="flex items-center gap-2 text-sm">
                        <Store className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                        <span className="text-xs text-slate-500">الفرع:</span>
                        <Badge className="bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold text-sm">
                          🏢 {r.branches.name}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {r.payment_method && (
                      <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-sm font-semibold">
                        💰 {r.payment_method}
                      </Badge>
                    )}
                    {r.invoice_scope === 'private' ? (
                      <Badge className="bg-amber-100 text-amber-800 border border-amber-300 gap-1 text-[10px]">
                        <Lock className="w-3 h-3" />
                        {t('branch_manual_invoice.scope_private')}
                      </Badge>
                    ) : (
                      <Badge className="bg-sky-100 text-sky-800 border border-sky-300 gap-1 text-[10px]">
                        <Globe2 className="w-3 h-3" />
                        {t('branch_manual_invoice.scope_public')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* شبكة المنتجات */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">
                    {t('branch_invoice_approvals.products_count')} ({products.length})
                  </h3>
                </div>
                {products.length === 0 ? (
                  <div className="text-center text-sm text-slate-500 py-6 border rounded-lg">—</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {products.map((p: any, idx: number) => {
                      const pid = p.productId || p.product_id;
                      const meta = pid ? productImagesQ.data?.[pid] : null;
                      const name = meta?.name || p.productName || p.name || '—';
                      const img = meta?.image_url;
                      const qty = p.quantity ?? 0;
                      return (
                        <div
                          key={pid || idx}
                          className="relative border rounded-lg overflow-hidden bg-card shadow-sm"
                        >
                          <div className="px-2 py-1.5 bg-primary/10 border-b">
                            <div className="text-[11px] font-bold text-primary truncate text-center">{name}</div>
                          </div>
                          <div className="aspect-square bg-muted flex items-center justify-center">
                            {img ? (
                              <img src={img} alt={name} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <Package className="w-8 h-8 text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="absolute top-1 end-1 bg-primary text-primary-foreground text-xs font-bold rounded-full min-w-[28px] h-7 px-1.5 flex items-center justify-center shadow-md">
                            ×{qty}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* رفع الفاتورة — مدمج وبسيط */}
              <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/50 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className={`w-4 h-4 shrink-0 ${fileUrl ? 'text-green-600' : 'text-slate-400'}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {fileUrl ? (r.invoice_file_name || 'invoice.pdf') : t('invoice_review.upload_section_title')}
                    </div>
                    {!fileUrl && (
                      <div className="text-[11px] text-slate-500">PDF / JPG / PNG</div>
                    )}
                  </div>
                </div>
                {fileUrl && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" asChild className="h-8 px-2">
                      <a href={fileUrl} target="_blank" rel="noreferrer" download>
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => removeFile.mutate()}
                      disabled={removeFile.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                )}
              </div>

              {!fileUrl && (
                <p className="text-xs text-amber-600 text-center">
                  ⚠️ {t('invoice_review.must_upload_first')}
                </p>
              )}
            </div>

            {/* أزرار ثابتة في الأسفل */}
            <div className="border-t bg-white p-3 flex gap-2 shrink-0">
              {fileUrl ? (
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white h-11"
                  onClick={() => approve.mutate()}
                  disabled={approve.isPending}
                >
                  {approve.isPending ? (
                    <Loader2 className="w-4 h-4 me-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 me-1" />
                  )}
                  {t('assistant_approvals.approve_final')}
                </Button>
              ) : (
                <label className="flex-1">
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
                  <Button
                    asChild
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 cursor-pointer"
                    disabled={uploading}
                  >
                    <span>
                      {uploading ? (
                        <Loader2 className="w-4 h-4 me-1 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 me-1" />
                      )}
                      {t('invoice_review.choose_file')}
                    </span>
                  </Button>
                </label>
              )}
              <Button
                variant="destructive"
                className="flex-1 h-11"
                onClick={() => reject.mutate()}
                disabled={reject.isPending}
              >
                {reject.isPending ? (
                  <Loader2 className="w-4 h-4 me-1 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4 me-1" />
                )}
                {t('assistant_approvals.reject')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceRequestReviewDialog;
