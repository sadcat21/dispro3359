import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle2, XCircle, Truck, Package, Users, FileText, ShieldCheck, X, Eye, Lock, Globe2, Info } from 'lucide-react';
import { toast } from 'sonner';
import InvoiceRequestReviewDialog from '@/components/admin/InvoiceRequestReviewDialog';
import FactoryApprovalsDialog from '@/components/stock/FactoryApprovalsDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ReceiptRow {
  id: string;
  receipt_date: string;
  invoice_number: string | null;
  total_items: number | null;
  branch_approved_at: string | null;
  branch_id: string | null;
  branches?: { name: string } | null;
}

interface CoverageRow {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  approval_status: string;
  absent_worker?: { full_name: string } | null;
  substitute_worker?: { full_name: string } | null;
  sectors?: { name: string; branch_id?: string; branches?: { name: string } | null } | null;
}

interface InvoiceRequestRow {
  id: string;
  order_id: string | null;
  invoice_number: string | null;
  status: string;
  branch_approved_at: string | null;
  invoice_file_url?: string | null;
  invoice_scope?: 'public' | 'private' | null;
  created_by_role?: string | null;
  customer_id?: string | null;
  customers?: { name: string } | null;
  branches?: { name: string } | null;
}

const AssistantApprovals: React.FC = () => {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [tab, setTab] = useState('factory_in');
  const [searchParams, setSearchParams] = useSearchParams();
  const [reviewRequestId, setReviewRequestId] = useState<string | null>(null);
  const [customerDialog, setCustomerDialog] = useState<{ id: string; name: string } | null>(null);
  const [detailsReceiptId, setDetailsReceiptId] = useState<string | null>(null);
  const branchFilter = searchParams.get('branch');

  // اسم الفرع المختار للعرض
  const { data: filterBranch } = useQuery({
    queryKey: ['filter-branch-name', branchFilter],
    queryFn: async () => {
      if (!branchFilter) return null;
      const { data } = await supabase.from('branches').select('id, name, wilaya').eq('id', branchFilter).maybeSingle();
      return data;
    },
    enabled: !!branchFilter,
  });

  const clearBranchFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('branch');
    setSearchParams(next);
  };

  // ===== استلامات المصنع =====
  const receiptsQ = useQuery({
    queryKey: ['assistant-receipts', branchFilter],
    queryFn: async () => {
      let q = supabase
        .from('stock_receipts')
        .select('id, receipt_date, invoice_number, total_items, branch_approved_at, branch_id, branches(name)')
        .eq('status', 'pending_assistant')
        .order('branch_approved_at', { ascending: false });
      if (branchFilter) q = q.eq('branch_id', branchFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ReceiptRow[];
    },
  });

  const approveReceipt = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('approve_stock_receipt_two_stage', {
        p_receipt_id: id,
        p_stage: 'assistant',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('assistant_approvals.approved_success'));
      qc.invalidateQueries({ queryKey: ['assistant-receipts'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Error'),
  });

  const rejectReceipt = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stock_receipts')
        .update({ status: 'rejected' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('assistant_approvals.rejected_success'));
      qc.invalidateQueries({ queryKey: ['assistant-receipts'] });
    },
  });

  // ===== تعويض السكتورات =====
  const coverageQ = useQuery({
    queryKey: ['assistant-coverage', branchFilter],
    queryFn: async () => {
      let q = supabase
        .from('sector_coverage')
        .select(`
          id, start_date, end_date, reason, approval_status,
          absent_worker:workers!sector_coverage_absent_worker_id_fkey(full_name),
          substitute_worker:workers!sector_coverage_substitute_worker_id_fkey(full_name),
          sectors!inner(name, branch_id, branches(name))
        `)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });
      if (branchFilter) q = q.eq('sectors.branch_id', branchFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as CoverageRow[];
    },
  });

  const approveCoverage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sector_coverage')
        .update({ approval_status: 'approved', system_approved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('assistant_approvals.approved_success'));
      qc.invalidateQueries({ queryKey: ['assistant-coverage'] });
    },
  });

  const rejectCoverage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sector_coverage')
        .update({ approval_status: 'rejected' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('assistant_approvals.rejected_success'));
      qc.invalidateQueries({ queryKey: ['assistant-coverage'] });
    },
  });

  // ===== طلبات الفواتير =====
  const invoicesQ = useQuery({
    queryKey: ['assistant-invoice-requests', branchFilter],
    queryFn: async () => {
      let q = supabase
        .from('manual_invoice_requests')
        .select('id, order_id, invoice_number, status, branch_approved_at, branch_id, invoice_file_url, invoice_scope, created_by_role, customer_id, customers(name), branches(name)')
        .eq('status', 'pending_assistant')
        .order('branch_approved_at', { ascending: false });
      if (branchFilter) q = q.eq('branch_id', branchFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as InvoiceRequestRow[];
    },
  });

  // طلبات الفاتورة المعلقة لعميل محدد (نافذة منبثقة)
  const customerInvoicesQ = useQuery({
    queryKey: ['assistant-customer-invoices', customerDialog?.id],
    queryFn: async () => {
      if (!customerDialog) return [];
      const { data, error } = await supabase
        .from('manual_invoice_requests')
        .select('id, order_id, invoice_number, status, branch_approved_at, payment_method, total_amount, created_at, branches(name)')
        .eq('customer_id', customerDialog.id)
        .eq('status', 'pending_assistant')
        .order('branch_approved_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!customerDialog,
  });

  const approveInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { data: request, error: fetchError } = await supabase
        .from('manual_invoice_requests')
        .select('order_id')
        .eq('id', id)
        .maybeSingle();
      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('manual_invoice_requests')
        .update({
          status: 'approved',
          assistant_approved_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;

      if (request?.order_id) {
        const { error: orderError } = await supabase
          .from('orders')
          .update({ status: 'pending' })
          .eq('id', request.order_id);
        if (orderError) throw orderError;
      }
    },
    onSuccess: () => {
      toast.success(t('assistant_approvals.approved_success'));
      qc.invalidateQueries({ queryKey: ['assistant-invoice-requests'] });
    },
  });

  const rejectInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('manual_invoice_requests')
        .update({ status: 'rejected' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('assistant_approvals.rejected_success'));
      qc.invalidateQueries({ queryKey: ['assistant-invoice-requests'] });
    },
  });

  const renderEmpty = (loading: boolean) => {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        </div>
      );
    }
    return (
      <div className="text-center py-12 text-slate-500">
        <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p>{t('assistant_approvals.no_pending')}</p>
      </div>
    );
  };

  const ActionButtons: React.FC<{
    onApprove: () => void;
    onReject: () => void;
    pending?: boolean;
    onDetails?: () => void;
  }> = ({ onApprove, onReject, pending, onDetails }) => (
    <div className="flex gap-2 flex-wrap">
      {onDetails && (
        <Button size="sm" variant="outline" onClick={onDetails} disabled={pending}
          className="border-slate-300">
          <Info className="w-4 h-4 me-1" />
          عرض التفاصيل
        </Button>
      )}
      <Button size="sm" onClick={onApprove} disabled={pending}
        className="bg-green-600 hover:bg-green-700 text-white">
        <CheckCircle2 className="w-4 h-4 me-1" />
        {t('assistant_approvals.approve_final')}
      </Button>
      <Button size="sm" onClick={onReject} disabled={pending}
        className="bg-red-600 hover:bg-red-700 text-white">
        <XCircle className="w-4 h-4 me-1" />
        {t('assistant_approvals.reject')}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-24">
      <div className="px-4 py-6 border-b border-red-200 bg-gradient-to-r from-red-50 via-white to-red-50/60">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-red-700">{t('assistant_approvals.title')}</h1>
            <p className="text-sm text-slate-600">{t('assistant_approvals.subtitle')}</p>
          </div>
        </div>
        {filterBranch && (
          <div className="mt-3 flex items-center gap-2">
            <Badge className="bg-red-100 text-red-800 border border-red-300">
              {t('assistant_approvals.filtered_by_branch')}: {filterBranch.name}
              {filterBranch.wilaya ? ` — ${filterBranch.wilaya}` : ''}
            </Badge>
            <Button size="sm" variant="ghost" onClick={clearBranchFilter} className="h-7 px-2">
              <X className="w-3.5 h-3.5 me-1" />
              {t('assistant_approvals.clear_filter')}
            </Button>
          </div>
        )}
      </div>

      <div className="p-4">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="bg-red-50 border border-red-200 grid grid-cols-2 md:grid-cols-4 h-auto">
            <TabsTrigger value="factory_in" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
              <Truck className="w-4 h-4 me-1" />
              {t('assistant_approvals.tab_factory_in')}
              {(receiptsQ.data?.length || 0) > 0 && (
                <Badge className="ms-2 bg-red-600 text-white">{receiptsQ.data!.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sector" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
              <Users className="w-4 h-4 me-1" />
              {t('assistant_approvals.tab_sector')}
              {(coverageQ.data?.length || 0) > 0 && (
                <Badge className="ms-2 bg-red-600 text-white">{coverageQ.data!.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="invoices" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
              <FileText className="w-4 h-4 me-1" />
              {t('assistant_approvals.tab_invoices')}
              {(invoicesQ.data?.length || 0) > 0 && (
                <Badge className="ms-2 bg-red-600 text-white">{invoicesQ.data!.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="factory_out" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
              <Package className="w-4 h-4 me-1" />
              {t('assistant_approvals.tab_factory_out')}
            </TabsTrigger>
          </TabsList>

          {/* استلامات المصنع */}
          <TabsContent value="factory_in" className="mt-4 space-y-3">
            {!receiptsQ.data || receiptsQ.data.length === 0
              ? renderEmpty(receiptsQ.isLoading)
              : receiptsQ.data.map((r) => (
                  <Card key={r.id} className="border-slate-200 bg-white">
                    <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-blue-100 text-blue-800 border border-blue-300">
                            🏢 {r.branches?.name || t('assistant_approvals.unknown_branch')}
                          </Badge>
                          <span className="text-sm text-slate-500">{r.receipt_date}</span>
                        </div>
                        <p className="text-sm text-slate-600">
                          {t('assistant_approvals.invoice_number')}: {r.invoice_number || '—'} ·{' '}
                          {t('assistant_approvals.items_count')}: {r.total_items || 0}
                        </p>
                        {r.branch_approved_at && (
                          <p className="text-xs text-slate-500">
                            {t('assistant_approvals.branch_approved_at')}: {new Date(r.branch_approved_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <ActionButtons
                        onApprove={() => approveReceipt.mutate(r.id)}
                        onReject={() => rejectReceipt.mutate(r.id)}
                        pending={approveReceipt.isPending || rejectReceipt.isPending}
                        onDetails={() => setDetailsReceiptId(r.id)}
                      />
                    </CardContent>
                  </Card>
                ))}
          </TabsContent>

          {/* تعويض السكتورات */}
          <TabsContent value="sector" className="mt-4 space-y-3">
            {!coverageQ.data || coverageQ.data.length === 0
              ? renderEmpty(coverageQ.isLoading)
              : coverageQ.data.map((c) => (
                  <Card key={c.id} className="border-slate-200 bg-white">
                    <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-blue-100 text-blue-800 border border-blue-300">
                            🏢 {c.sectors?.branches?.name || t('assistant_approvals.unknown_branch')}
                          </Badge>
                          <span className="font-semibold text-slate-900">{c.sectors?.name || '—'}</span>
                        </div>
                        <p className="text-sm text-slate-600">
                          {t('assistant_approvals.absent_worker')}: {c.absent_worker?.full_name || '—'} →{' '}
                          {t('assistant_approvals.substitute_worker')}: {c.substitute_worker?.full_name || '—'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {t('assistant_approvals.coverage_period')}: {c.start_date} → {c.end_date}
                          {c.reason ? ` · ${c.reason}` : ''}
                        </p>
                      </div>
                      <ActionButtons
                        onApprove={() => approveCoverage.mutate(c.id)}
                        onReject={() => rejectCoverage.mutate(c.id)}
                        pending={approveCoverage.isPending || rejectCoverage.isPending}
                      />
                    </CardContent>
                  </Card>
                ))}
          </TabsContent>

          {/* طلبات الفواتير */}
          <TabsContent value="invoices" className="mt-4 space-y-3">
            {!invoicesQ.data || invoicesQ.data.length === 0
              ? renderEmpty(invoicesQ.isLoading)
              : invoicesQ.data.map((i) => (
                  <Card key={i.id} className="border-slate-200 bg-white">
                    <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-blue-100 text-blue-800 border border-blue-300">
                            🏢 {i.branches?.name || t('assistant_approvals.unknown_branch')}
                          </Badge>
                          {i.invoice_scope === 'private' ? (
                            <Badge className="bg-amber-100 text-amber-800 border border-amber-300 gap-1">
                              <Lock className="w-3 h-3" />
                              {t('branch_manual_invoice.scope_private')}
                            </Badge>
                          ) : (
                            <Badge className="bg-sky-100 text-sky-800 border border-sky-300 gap-1">
                              <Globe2 className="w-3 h-3" />
                              {t('branch_manual_invoice.scope_public')}
                            </Badge>
                          )}
                          {i.customer_id && i.customers?.name ? (
                            <button
                              type="button"
                              onClick={() => setCustomerDialog({ id: i.customer_id!, name: i.customers!.name })}
                              className="font-semibold text-primary hover:underline cursor-pointer"
                              title="عرض كل طلبات الفاتورة المعلقة لهذا العميل"
                            >
                              {i.customers.name}
                            </button>
                          ) : (
                            <span className="font-semibold text-slate-900">—</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600">
                          {t('assistant_approvals.invoice_number')}: {i.invoice_number || '—'}
                        </p>
                        {i.branch_approved_at && (
                          <p className="text-xs text-slate-500">
                            {t('assistant_approvals.branch_approved_at')}: {new Date(i.branch_approved_at).toLocaleString()}
                          </p>
                        )}
                        {i.invoice_file_url && (
                          <Badge className="bg-green-100 text-green-700 border border-green-300 mt-1">
                            ✅ {t('invoice_review.file_uploaded')}
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setReviewRequestId(i.id)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Eye className="w-4 h-4 me-1" />
                        {t('invoice_review.review_and_upload')}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
          </TabsContent>

          {/* تسليمات للمصنع */}
          <TabsContent value="factory_out" className="mt-4">
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-6 text-center text-slate-500">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>{t('assistant_approvals.no_pending')}</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* نافذة طلبات الفاتورة المعلقة لعميل محدد */}
      <Dialog open={!!customerDialog} onOpenChange={(v) => { if (!v) setCustomerDialog(null); }}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              طلبات الفاتورة المعلقة — {customerDialog?.name}
            </DialogTitle>
          </DialogHeader>
          {customerInvoicesQ.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (customerInvoicesQ.data?.length ?? 0) === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد طلبات معلقة</p>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-2">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  العدد الإجمالي: <span className="font-bold text-foreground">{customerInvoicesQ.data!.length}</span>
                </p>
                {customerInvoicesQ.data!.map((r: any) => (
                  <Card key={r.id} className="border-slate-200">
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{r.branches?.name || '—'}</Badge>
                          <Badge variant="secondary">{r.payment_method || '—'}</Badge>
                          <span className="font-bold">
                            {Number(r.total_amount || 0).toLocaleString('ar')} دج
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          فاتورة #{r.invoice_number || '—'} • {new Date(r.branch_approved_at || r.created_at).toLocaleString('ar')}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCustomerDialog(null);
                          setReviewRequestId(r.id);
                        }}
                      >
                        <Eye className="w-4 h-4 me-1" />
                        مراجعة
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <InvoiceRequestReviewDialog
        open={!!reviewRequestId}
        onOpenChange={(v) => { if (!v) setReviewRequestId(null); }}
        requestId={reviewRequestId}
      />

      {detailsReceiptId && (
        <FactoryReceiptQuickDialog
          open={!!detailsReceiptId}
          onOpenChange={(v) => { if (!v) setDetailsReceiptId(null); }}
          editReceiptId={detailsReceiptId}
          onSaved={() => { setDetailsReceiptId(null); qc.invalidateQueries(); }}
        />
      )}
    </div>
  );
};

export default AssistantApprovals;