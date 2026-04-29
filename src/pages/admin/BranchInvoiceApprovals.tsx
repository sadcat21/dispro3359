import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, CheckCircle2, XCircle, FileText, ArrowLeft, Info, ArrowUpRight, Clock3, Download, Plus, Lock, Globe2, Clock, ChevronDown, ChevronUp, Layers, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import BranchManualInvoiceDialog from '@/components/admin/BranchManualInvoiceDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import MergeInvoicesDialog, { type PostponedRequest } from '@/components/admin/MergeInvoicesDialog';

interface InvoiceRequestRow {
  id: string;
  order_id: string | null;
  invoice_number: string | null;
  status: string;
  payment_method: string | null;
  whatsapp_contact: string | null;
  created_at: string;
  products: any;
  invoice_file_url?: string | null;
  invoice_file_name?: string | null;
  invoice_scope?: 'public' | 'private' | null;
  created_by_role?: string | null;
  customer_id?: string | null;
  worker_id?: string | null;
  branch_id?: string | null;
  postponed_at?: string | null;
  is_merged_parent?: boolean | null;
  merged_request_ids?: string[] | null;
  customers?: { name: string; name_fr?: string | null; store_name?: string | null } | null;
  worker?: { full_name: string } | null;
}

const BranchInvoiceApprovals: React.FC = () => {
  const { t, language } = useLanguage();
  const { activeBranch, workerId } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const branchId = activeBranch?.id;

  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [scopeDialog, setScopeDialog] = useState<{ id: string; scope: 'public' | 'private' } | null>(null);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [mergeFor, setMergeFor] = useState<{ customerId: string; customerName: string; requests: PostponedRequest[] } | null>(null);

  const requestsQ = useQuery({
    queryKey: ['branch-invoice-approvals', branchId],
    enabled: !!branchId,
    queryFn: async () => {
      // 1) جلب كل العمال المرتبطين بهذا الفرع
      const { data: branchWorkers, error: wErr } = await supabase
        .from('workers')
        .select('id')
        .eq('branch_id', branchId!);
      if (wErr) throw wErr;
      const workerIds = (branchWorkers || []).map((w: any) => w.id);

      // 2) جلب طلبات الفواتير: إما branch_id = الفرع، أو worker_id ∈ عمال الفرع
      const orFilter = workerIds.length > 0
        ? `branch_id.eq.${branchId},worker_id.in.(${workerIds.join(',')})`
        : `branch_id.eq.${branchId}`;

      const { data, error } = await supabase
        .from('manual_invoice_requests')
        .select(`
          id, order_id, invoice_number, status, payment_method, whatsapp_contact, created_at, products, invoice_file_url, invoice_file_name, invoice_scope, created_by_role, customer_id, worker_id, branch_id, postponed_at, is_merged_parent, merged_request_ids,
          customers!manual_invoice_requests_customer_id_fkey(name, name_fr, store_name),
          worker:workers!manual_invoice_requests_worker_id_fkey(full_name)
        `)
        .or(orFilter)
        .in('status', ['pending_branch', 'pending_assistant', 'approved', 'postponed'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as InvoiceRequestRow[];
    },
  });

  const approve = useMutation({
    mutationFn: async ({ id, scope }: { id: string; scope: 'public' | 'private' }) => {
      // حفظ النطاق على السجل قبل التحويل
      const { error: updErr } = await supabase
        .from('manual_invoice_requests')
        .update({ invoice_scope: scope } as any)
        .eq('id', id);
      if (updErr) throw updErr;

      const { error } = await (supabase as any).rpc('forward_manual_invoice_request_to_management', {
        p_request_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('branch_invoice_approvals.approved_success'));
      qc.invalidateQueries({ queryKey: ['branch-invoice-approvals'] });
      qc.invalidateQueries({ queryKey: ['bm-kpis'] });
      setSelectedOrder(null);
      setScopeDialog(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('manual_invoice_requests')
        .update({ status: 'rejected' } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('branch_invoice_approvals.rejected_success'));
      qc.invalidateQueries({ queryKey: ['branch-invoice-approvals'] });
      qc.invalidateQueries({ queryKey: ['bm-kpis'] });
      setSelectedOrder(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const postpone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('manual_invoice_requests')
        .update({
          status: 'postponed',
          postponed_at: new Date().toISOString(),
          postponed_by: workerId,
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تأجيل الفاتورة');
      qc.invalidateQueries({ queryKey: ['branch-invoice-approvals'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openOrderDetails = async (row: InvoiceRequestRow) => {
    if (!row.order_id) {
      toast.error(t('branch_invoice_approvals.no_linked_order'));
      return;
    }
    setLoadingOrderId(row.id);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers!orders_customer_id_fkey(*),
          assigned_worker:workers!orders_assigned_worker_id_fkey(id, full_name),
          created_by_worker:workers!orders_created_by_fkey(id, full_name),
          items:order_items(
            *,
            product:products(*)
          )
        `)
        .eq('id', row.order_id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error(t('branch_invoice_approvals.no_linked_order'));
        return;
      }
      // إرفاق request_id حتى يمكن استخدامه عند الموافقة/الرفض
      setSelectedOrder({ ...data, _invoiceRequestId: row.id, _hideModifyAction: true });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingOrderId(null);
    }
  };

  const rows = requestsQ.data || [];
  const pendingBranchRows = rows.filter((r) => r.status === 'pending_branch');
  const forwardedRows = rows.filter((r) => r.status === 'pending_assistant');
  const readyRows = rows.filter((r) => r.status === 'approved' && !!r.invoice_file_url);
  const postponedRows = rows.filter((r) => r.status === 'postponed');
  const pendingTabRows = rows.filter(r => r.status === 'pending_branch' || r.status === 'pending_assistant');
  // الفواتير الموحَّدة (تم تجميعها وأُرسلت للإدارة) — تظهر في تبويب "المؤجلة" كبطاقات تأكيد
  const mergedParentRows = rows.filter(
    (r) => r.is_merged_parent === true && r.status === 'pending_assistant'
  );

  // تجميع المؤجلة حسب العميل
  const postponedByCustomer = React.useMemo(() => {
    const map = new Map<string, { customerId: string; customerName: string; items: InvoiceRequestRow[] }>();
    for (const r of postponedRows) {
      const cid = r.customer_id || 'unknown';
      const name = (language === 'fr' && r.customers?.name_fr) ? r.customers.name_fr : (r.customers?.name || '—');
      const existing = map.get(cid);
      if (existing) existing.items.push(r);
      else map.set(cid, { customerId: cid, customerName: name, items: [r] });
    }
    return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
  }, [postponedRows, language]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </Button>
          <h1 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            {t('branch_invoice_approvals.title')}
          </h1>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="w-4 h-4" />
            {t('branch_manual_invoice.new_request')}
          </Button>
        </div>

        {/* شريط شرح دور مدير الفرع كوسيط */}
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">{t('branch_invoice_approvals.role_intro_title')}</p>
            <p className="text-blue-800/90 leading-relaxed">{t('branch_invoice_approvals.role_intro_desc')}</p>
          </div>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="pending" className="gap-2">
              <FileText className="w-4 h-4" />
              {t('branch_invoice_approvals.pending_list')}
              <Badge variant="secondary" className="ml-1">{pendingTabRows.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="postponed" className="gap-2">
              <Clock className="w-4 h-4" />
              المؤجلة
              <Badge variant="secondary" className="ml-1">{postponedRows.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="ready" className="gap-2">
              <Download className="w-4 h-4" />
              {t('branch_invoice_approvals.ready_for_download')}
              <Badge variant="secondary" className="ml-1">{readyRows.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card className="shadow-lg border-blue-200">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-sky-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center justify-between">
                  <span>{t('branch_invoice_approvals.pending_list')}</span>
                  <Badge variant="secondary" className="bg-white text-blue-700">
                    {pendingBranchRows.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {requestsQ.isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                ) : pendingTabRows.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>{t('branch_invoice_approvals.no_pending')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingTabRows.map((r) => {
                      const customerName = language === 'fr' && r.customers?.name_fr
                        ? r.customers.name_fr
                        : r.customers?.name || '—';
                      const productCount = Array.isArray(r.products) ? r.products.length : 0;
                      const isLoadingThis = loadingOrderId === r.id;
                      const isForwarded = r.status === 'pending_assistant';
                      return (
                        <div
                          key={r.id}
                          onClick={() => openOrderDetails(r)}
                          className="border border-blue-100 rounded-lg p-4 bg-white hover:shadow-md hover:border-blue-300 transition cursor-pointer relative group"
                        >
                          {isLoadingThis && (
                            <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-lg z-10">
                              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                            </div>
                          )}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-800">{customerName}</span>
                                {r.invoice_scope === 'private' ? (
                                  <Badge className="bg-amber-100 text-amber-800 border border-amber-300 gap-1 text-[10px]">
                                    <Lock className="w-3 h-3" />
                                    {t('branch_manual_invoice.scope_private')}
                                  </Badge>
                                ) : r.invoice_scope === 'public' ? (
                                  <Badge className="bg-blue-100 text-blue-800 border border-blue-300 gap-1 text-[10px]">
                                    <Globe2 className="w-3 h-3" />
                                    {t('branch_manual_invoice.scope_public')}
                                  </Badge>
                                ) : null}
                                <ArrowUpRight className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition" />
                              </div>
                              {r.customers?.store_name && (
                                <div className="text-sm text-slate-500">{r.customers.store_name}</div>
                              )}
                              <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1 pt-1">
                                <span>
                                  {t('branch_invoice_approvals.sales_rep')}:{' '}
                                  <span className="font-medium text-slate-700">{r.worker?.full_name || '—'}</span>
                                </span>
                                <span>{t('branch_invoice_approvals.products_count')}: {productCount}</span>
                                {r.payment_method && <span>{t('branch_invoice_approvals.payment')}: {r.payment_method}</span>}
                              </div>
                              <div className="text-xs text-slate-400">
                                {new Date(r.created_at).toLocaleString(language === 'ar' ? 'ar' : language)}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {isForwarded ? (
                                r.invoice_file_url ? (
                                  <Button
                                    asChild
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                  >
                                    <a href={r.invoice_file_url} target="_blank" rel="noreferrer" download={r.invoice_file_name || undefined}>
                                      <Download className="w-4 h-4" />
                                      {t('branch_invoice_approvals.download_invoice')}
                                    </a>
                                  </Button>
                                ) : (
                                  <Badge variant="outline" className="border-border bg-muted text-muted-foreground px-3 py-2 gap-1 justify-center">
                                    <Clock3 className="w-4 h-4" />
                                    {t('branch_invoice_approvals.awaiting_final_approval')}
                                  </Badge>
                                )
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => setScopeDialog({ id: r.id, scope: 'private' })}
                                    disabled={approve.isPending}
                                    className="bg-green-600 hover:bg-green-700 gap-1"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    {t('branch_invoice_approvals.forward_to_top')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => postpone.mutate(r.id)}
                                    disabled={postpone.isPending}
                                    className="gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                                  >
                                    <Clock className="w-4 h-4" />
                                    تأجيل
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => reject.mutate(r.id)}
                                    disabled={reject.isPending}
                                    className="gap-1"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    {t('branch_invoice_approvals.reject')}
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="postponed">
            {/* بطاقات الفواتير الموحَّدة (تم تجميعها وأُرسلت للإدارة) */}
            {mergedParentRows.length > 0 && (
              <Card className="shadow-lg border-blue-300 mb-4">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Layers className="w-5 h-5" />
                      الفواتير الموحَّدة المُرسَلة للإدارة
                    </span>
                    <Badge variant="secondary" className="bg-white text-blue-700">{mergedParentRows.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {mergedParentRows.map((r) => {
                    const customerName = language === 'fr' && r.customers?.name_fr
                      ? r.customers.name_fr
                      : r.customers?.name || '—';
                    const itemsCount = Array.isArray(r.products) ? r.products.length : 0;
                    const mergedCount = Array.isArray(r.merged_request_ids) ? r.merged_request_ids.length : 0;
                    return (
                      <div
                        key={r.id}
                        className="border border-blue-200 rounded-lg bg-white p-3 flex items-center justify-between gap-3 flex-wrap"
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-blue-100 text-blue-800 border border-blue-300 gap-1">
                              <Layers className="w-3 h-3" />
                              فاتورة موحَّدة
                            </Badge>
                            <span className="font-semibold text-slate-800 truncate">{customerName}</span>
                          </div>
                          <div className="text-xs text-slate-600">
                            تم تجميع <strong className="text-blue-700">{mergedCount}</strong> فاتورة •{' '}
                            <strong className="text-blue-700">{itemsCount}</strong> منتج •{' '}
                            {new Date(r.created_at).toLocaleString('ar')}
                          </div>
                          {r.payment_method && (
                            <div className="text-xs text-slate-500">
                              طريقة الدفع: <span className="font-medium text-slate-700">{r.payment_method}</span>
                            </div>
                          )}
                        </div>
                        <Badge className="bg-amber-100 text-amber-800 border border-amber-300 gap-1">
                          <Clock3 className="w-3 h-3" />
                          بانتظار اعتماد الإدارة
                        </Badge>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            <Card className="shadow-lg border-amber-200">
              <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-lg">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    الفواتير المؤجلة (مجمّعة حسب العميل)
                  </span>
                  <Badge variant="secondary" className="bg-white text-amber-700">{postponedRows.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {postponedByCustomer.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>لا توجد فواتير مؤجلة</p>
                  </div>
                ) : postponedByCustomer.map(group => {
                  const isOpen = expandedCustomer === group.customerId;
                  return (
                    <div key={group.customerId} className="border border-amber-200 rounded-lg bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedCustomer(isOpen ? null : group.customerId)}
                        className="w-full flex items-center justify-between gap-3 p-3 hover:bg-amber-50 transition"
                      >
                        <div className="flex items-center gap-2 flex-1 text-start">
                          <span className="font-semibold text-slate-800">{group.customerName}</span>
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                            {group.items.length} فاتورة
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMergeFor({
                              customerId: group.customerId,
                              customerName: group.customerName,
                              requests: group.items as PostponedRequest[],
                            });
                          }}
                          className="gap-1 bg-blue-600 hover:bg-blue-700"
                        >
                          <Layers className="w-4 h-4" />
                          تجميع المنتجات
                        </Button>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-amber-700" /> : <ChevronDown className="w-4 h-4 text-amber-700" />}
                      </button>
                      {isOpen && (
                        <div className="border-t border-amber-100 bg-amber-50/40 p-3 space-y-2">
                          {group.items.map(r => (
                            <div key={r.id} className="bg-white border border-amber-100 rounded p-2 flex items-center justify-between gap-2 text-sm">
                              <div className="flex-1">
                                <div className="font-medium">
                                  {r.invoice_number ? `#${r.invoice_number}` : 'بدون رقم'}
                                  <span className="text-xs text-muted-foreground mr-2">
                                    {Array.isArray(r.products) ? r.products.length : 0} منتج
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  المندوب: {r.worker?.full_name || '—'} •{' '}
                                  {new Date(r.created_at).toLocaleDateString('ar')}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setScopeDialog({ id: r.id, scope: 'private' })}
                                className="gap-1 text-green-700 hover:bg-green-50"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                إرسال فردي
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ready">
            <Card className="shadow-lg border-emerald-200">
              <CardHeader className="bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    {t('branch_invoice_approvals.ready_for_download')}
                  </span>
                  <Badge variant="secondary" className="bg-white text-emerald-700">{readyRows.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {readyRows.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Download className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>{t('branch_invoice_approvals.no_pending')}</p>
                  </div>
                ) : readyRows.map((r) => {
                  const customerName = language === 'fr' && r.customers?.name_fr
                    ? r.customers.name_fr
                    : r.customers?.name || '—';
                  return (
                    <div key={r.id} className="border border-emerald-100 rounded-lg p-4 bg-white flex items-center justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="font-semibold text-slate-800">{customerName}</div>
                        {r.customers?.store_name && (
                          <div className="text-sm text-slate-500">{r.customers.store_name}</div>
                        )}
                        <div className="text-xs text-slate-500">
                          {t('branch_invoice_approvals.sales_rep')}: <span className="font-medium text-slate-700">{r.worker?.full_name || '—'}</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {new Date(r.created_at).toLocaleString(language === 'ar' ? 'ar' : language)}
                        </div>
                      </div>
                      <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                        <a href={r.invoice_file_url!} target="_blank" rel="noreferrer" download={r.invoice_file_name || undefined}>
                          <Download className="w-4 h-4" />
                          {t('branch_invoice_approvals.download_invoice')}
                        </a>
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* نافذة تفاصيل الطلبية — نفس المستخدمة في عملاء/منجزات اليوم */}
      <OrderDetailsDialog
        open={!!selectedOrder}
        onOpenChange={(isOpen) => { if (!isOpen) setSelectedOrder(null); }}
        order={selectedOrder}
        hideModifyAction={true}
      />

      {/* نافذة إنشاء فاتورة يدوية من مدير الفرع */}
      <BranchManualInvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* نافذة اختيار نوع الفاتورة قبل التحويل للإدارة العليا */}
      <Dialog open={!!scopeDialog} onOpenChange={(v) => { if (!v) setScopeDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('branch_manual_invoice.choose_scope')}</DialogTitle>
          </DialogHeader>
          {scopeDialog && (
            <RadioGroup
              value={scopeDialog.scope}
              onValueChange={(v) => setScopeDialog({ ...scopeDialog, scope: v as 'public' | 'private' })}
              className="space-y-2"
            >
              <div
                className="flex items-start gap-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/30"
                onClick={() => setScopeDialog({ ...scopeDialog, scope: 'private' })}
              >
                <RadioGroupItem value="private" id="fwd-private" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="fwd-private" className="flex items-center gap-2 font-semibold cursor-pointer">
                    <Lock className="w-4 h-4 text-amber-600" />
                    {t('branch_manual_invoice.scope_private')}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('branch_manual_invoice.scope_private_desc')}
                  </p>
                </div>
              </div>
              <div
                className="flex items-start gap-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/30"
                onClick={() => setScopeDialog({ ...scopeDialog, scope: 'public' })}
              >
                <RadioGroupItem value="public" id="fwd-public" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="fwd-public" className="flex items-center gap-2 font-semibold cursor-pointer">
                    <Globe2 className="w-4 h-4 text-blue-600" />
                    {t('branch_manual_invoice.scope_public')}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('branch_manual_invoice.scope_public_desc')}
                  </p>
                </div>
              </div>
            </RadioGroup>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setScopeDialog(null)} disabled={approve.isPending}>
              {t('common.cancel') || 'إلغاء'}
            </Button>
            <Button
              onClick={() => scopeDialog && approve.mutate(scopeDialog)}
              disabled={approve.isPending}
              className="gap-1 bg-green-600 hover:bg-green-700"
            >
              {approve.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {t('branch_invoice_approvals.forward_to_top')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة تجميع فواتير العميل المؤجلة */}
      {mergeFor && (
        <MergeInvoicesDialog
          open={!!mergeFor}
          onOpenChange={(v) => { if (!v) setMergeFor(null); }}
          customerId={mergeFor.customerId}
          customerName={mergeFor.customerName}
          requests={mergeFor.requests}
        />
      )}
    </div>
  );
};

export default BranchInvoiceApprovals;
