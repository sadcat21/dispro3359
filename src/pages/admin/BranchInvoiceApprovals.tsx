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
import InvoiceRequestDetailsDialog from '@/components/admin/InvoiceRequestDetailsDialog';

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
  const [customerDialog, setCustomerDialog] = useState<{ id: string; name: string } | null>(null);
  const [requestDetails, setRequestDetails] = useState<InvoiceRequestRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkScopeDialog, setBulkScopeDialog] = useState<{ scope: 'public' | 'private' } | null>(null);

  const toggleSelected = (id: string) =>
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const bulkAction = useMutation({
    mutationFn: async ({ ids, action, scope }: { ids: string[]; action: 'forward' | 'reject' | 'postpone'; scope?: 'public' | 'private' }) => {
      for (const id of ids) {
        if (action === 'forward') {
          const { error: updErr } = await supabase
            .from('manual_invoice_requests')
            .update({ invoice_scope: scope } as any)
            .eq('id', id);
          if (updErr) throw updErr;
          const { error } = await (supabase as any).rpc('forward_manual_invoice_request_to_management', { p_request_id: id });
          if (error) throw error;
        } else if (action === 'reject') {
          const { error } = await supabase
            .from('manual_invoice_requests')
            .update({ status: 'rejected' } as any)
            .eq('id', id);
          if (error) throw error;
        } else if (action === 'postpone') {
          const { error } = await supabase
            .from('manual_invoice_requests')
            .update({ status: 'postponed', postponed_at: new Date().toISOString(), postponed_by: workerId } as any)
            .eq('id', id);
          if (error) throw error;
        }
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(`تم تنفيذ الإجراء على ${vars.ids.length} فاتورة`);
      qc.invalidateQueries({ queryKey: ['branch-invoice-approvals'] });
      qc.invalidateQueries({ queryKey: ['branch-customer-pending-branch'] });
      qc.invalidateQueries({ queryKey: ['bm-kpis'] });
      setSelectedIds([]);
      setBulkScopeDialog(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

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
          worker:workers!manual_invoice_requests_worker_id_fkey(full_name),
          order:orders!manual_invoice_requests_order_id_fkey(created_at)
        `)
        .or(orFilter)
        .in('status', ['pending_branch', 'pending_assistant', 'approved', 'postponed']);
      if (error) throw error;
      // ترتيب تنازلي حسب تاريخ إنشاء الطلبية الأصلية (fallback إلى created_at للسجل)
      const rows = (data || []) as any[];
      rows.sort((a, b) => {
        const aT = new Date(a.order?.created_at ?? a.created_at).getTime();
        const bT = new Date(b.order?.created_at ?? b.created_at).getTime();
        return bT - aT;
      });
      return rows as unknown as InvoiceRequestRow[];
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
      toast.success('${t('branch_invoice_approvals.postponed_success')}');
      qc.invalidateQueries({ queryKey: ['branch-invoice-approvals'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // طلبات الفاتورة المعلقة (pending_branch) لعميل محدد — ليحولها مدير الفرع للإدارة
  const customerInvoicesQ = useQuery({
    queryKey: ['branch-customer-pending-branch', customerDialog?.id],
    queryFn: async () => {
      if (!customerDialog) return [];
      const { data, error } = await supabase
        .from('manual_invoice_requests')
        .select('id, order_id, invoice_number, status, payment_method, total_amount, created_at, branch_approved_at, products, whatsapp_contact, invoice_scope, branches(name), order:orders!manual_invoice_requests_order_id_fkey(invoice_payment_method, payment_type, total_amount, created_at)')
        .eq('customer_id', customerDialog.id)
        .eq('status', 'pending_branch')
        .order('branch_approved_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];

      // جلب pieces_per_box و weight_per_box للمنتجات لعرض السعر بصيغة (وزن × سعر/كلغ)
      const productIds = Array.from(new Set(
        rows.flatMap((r) => Array.isArray(r.products) ? r.products.map((p: any) => p.product_id).filter(Boolean) : [])
      ));
      let prodMap: Record<string, { pieces_per_box: number | null; weight_per_box: number | null }> = {};
      if (productIds.length > 0) {
        const { data: prods } = await supabase
          .from('products')
          .select('id, pieces_per_box, weight_per_box')
          .in('id', productIds);
        (prods || []).forEach((p: any) => {
          prodMap[p.id] = { pieces_per_box: p.pieces_per_box, weight_per_box: p.weight_per_box };
        });
      }
      rows.forEach((r) => {
        if (Array.isArray(r.products)) {
          r.products = r.products.map((p: any) => ({
            ...p,
            pieces_per_box: prodMap[p.product_id]?.pieces_per_box ?? null,
            weight_per_box: prodMap[p.product_id]?.weight_per_box ?? null,
          }));
        }
      });
      return rows;
    },
    enabled: !!customerDialog,
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 p-3 sm:p-4">
      <div className="max-w-5xl mx-auto">
        {/* ترويسة مدمجة وعملية */}
        <div className="sticky top-0 z-10 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 mb-3 bg-white/80 backdrop-blur-md border-b border-blue-200">
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 px-2 h-9">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{t('common.back')}</span>
            </Button>
            <h1 className="text-base sm:text-xl font-bold text-blue-900 flex items-center gap-1.5 truncate">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span className="truncate">{t('branch_invoice_approvals.title')}</span>
            </h1>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              size="sm"
              className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-2 sm:px-3"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('branch_manual_invoice.new_request')}</span>
              <span className="sm:hidden text-xs">جديد</span>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 h-auto">
            <TabsTrigger value="pending" className="gap-1 px-1 text-[11px] sm:text-sm whitespace-nowrap">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t('branch_invoice_approvals.tab_pending')}</span>
              <Badge variant="secondary" className="ml-1 px-1 text-[10px]">{pendingTabRows.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="postponed" className="gap-1 px-1 text-[11px] sm:text-sm whitespace-nowrap">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t('branch_invoice_approvals.tab_postponed')}</span>
              <Badge variant="secondary" className="ml-1 px-1 text-[10px]">{postponedRows.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="ready" className="gap-1 px-1 text-[11px] sm:text-sm whitespace-nowrap">
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t('branch_invoice_approvals.tab_ready')}</span>
              <Badge variant="secondary" className="ml-1 px-1 text-[10px]">{readyRows.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Tabs defaultValue="branch_stage" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 h-auto">
                <TabsTrigger value="branch_stage" className="gap-1 px-1 text-[11px] sm:text-sm whitespace-nowrap">
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t('branch_invoice_approvals.tab_branch_stage')}</span>
                  <Badge variant="secondary" className="ml-1 px-1 text-[10px]">{pendingBranchRows.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="final_stage" className="gap-1 px-1 text-[11px] sm:text-sm whitespace-nowrap">
                  <Clock3 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t('branch_invoice_approvals.tab_final_stage')}</span>
                  <Badge variant="secondary" className="ml-1 px-1 text-[10px]">{forwardedRows.length}</Badge>
                </TabsTrigger>
              </TabsList>

              {(['branch_stage', 'final_stage'] as const).map((subTab) => {
                const subRows = subTab === 'branch_stage' ? pendingBranchRows : forwardedRows;
                const headerColor = subTab === 'branch_stage'
                  ? 'from-blue-500 to-sky-600'
                  : 'from-amber-500 to-orange-600';
                const headerBadgeColor = subTab === 'branch_stage' ? 'text-blue-700' : 'text-amber-700';
                const headerTitle = subTab === 'branch_stage'
                  ? "Demandes de l'étape agence"
                  : "En attente de l'approbation finale";
                return (
                  <TabsContent key={subTab} value={subTab}>
                    <Card className="shadow-lg border-blue-200">
                      <CardHeader className={`bg-gradient-to-r ${headerColor} text-white rounded-t-lg`}>
                        <CardTitle className="flex items-center justify-between">
                          <span>{headerTitle}</span>
                          <Badge variant="secondary" className={`bg-white ${headerBadgeColor}`}>
                            {subRows.length}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        {requestsQ.isLoading ? (
                          <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                          </div>
                        ) : subRows.length === 0 ? (
                          <div className="text-center py-12 text-slate-500">
                            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                            <p>{t('branch_invoice_approvals.no_pending')}</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {subRows.map((r) => {
                              const customerName = language === 'fr' && r.customers?.name_fr
                                ? r.customers.name_fr
                                : r.customers?.name || '—';
                              const productCount = Array.isArray(r.products) ? r.products.length : 0;
                              const isLoadingThis = loadingOrderId === r.id;
                              const isForwarded = r.status === 'pending_assistant';

                      return (
                        <div
                          key={r.id}
                          onClick={() => isForwarded ? setRequestDetails(r) : openOrderDetails(r)}
                          className="border border-blue-100 rounded-xl bg-white hover:shadow-md hover:border-blue-300 transition cursor-pointer relative group overflow-hidden"
                        >
                          {isLoadingThis && (
                            <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-xl z-10">
                              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                            </div>
                          )}

                          {/* رأس البطاقة: اسم العميل + الشارات */}
                          <div className="p-3 pb-2 flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {r.customer_id ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCustomerDialog({ id: r.customer_id!, name: customerName });
                                    }}
                                    className="font-bold text-base text-primary hover:underline truncate"
                                    title="عرض كل طلبات الفاتورة المعلقة لهذا العميل"
                                  >
                                    {customerName}
                                  </button>
                                ) : (
                                  <span className="font-bold text-base text-slate-800 truncate">{customerName}</span>
                                )}
                                {r.invoice_scope === 'private' ? (
                                  <Badge className="bg-amber-100 text-amber-800 border border-amber-300 gap-1 text-[10px] px-1.5 py-0">
                                    <Lock className="w-3 h-3" />
                                    {t('branch_manual_invoice.scope_private')}
                                  </Badge>
                                ) : r.invoice_scope === 'public' ? (
                                  <Badge className="bg-blue-100 text-blue-800 border border-blue-300 gap-1 text-[10px] px-1.5 py-0">
                                    <Globe2 className="w-3 h-3" />
                                    {t('branch_manual_invoice.scope_public')}
                                  </Badge>
                                ) : null}
                              </div>
                              {r.customers?.store_name && (
                                <div className="text-xs text-slate-500 mt-0.5 truncate">{r.customers.store_name}</div>
                              )}
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
                          </div>

                          {/* شريط البيانات الوصفية */}
                          <div className="px-3 py-2 bg-slate-50/70 border-y border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <span className="text-slate-400">{t('branch_invoice_approvals.sales_rep')}:</span>
                              <span className="font-semibold text-slate-700">{r.worker?.full_name || '—'}</span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="text-slate-400">{t('branch_invoice_approvals.products_count')}:</span>
                              <span className="font-semibold text-slate-700">{productCount}</span>
                            </span>
                            {r.payment_method && (
                              <span className="inline-flex items-center gap-1">
                                <span className="text-slate-400">{t('branch_invoice_approvals.payment')}:</span>
                                <span className="font-semibold text-slate-700">{r.payment_method}</span>
                              </span>
                            )}
                            <span className="ml-auto text-slate-400 text-[10px]">
                              {new Date(r.created_at).toLocaleString(language === 'ar' ? 'ar' : language)}
                            </span>
                          </div>

                          {/* شريط الإجراءات */}
                          <div className="p-2.5" onClick={(e) => e.stopPropagation()}>
                            {isForwarded ? (
                              r.invoice_file_url ? (
                                <Button
                                  asChild
                                  size="sm"
                                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-9"
                                >
                                  <a href={r.invoice_file_url} target="_blank" rel="noreferrer" download={r.invoice_file_name || undefined}>
                                    <Download className="w-4 h-4" />
                                    {t('branch_invoice_approvals.download_invoice')}
                                  </a>
                                </Button>
                              ) : (
                                <Badge variant="outline" className="w-full border-border bg-muted text-muted-foreground py-2 gap-1.5 justify-center text-xs">
                                  <Clock3 className="w-3.5 h-3.5" />
                                  {t('branch_invoice_approvals.awaiting_final_approval')}
                                </Badge>
                              )
                            ) : (
                              <div className="grid grid-cols-3 gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={() => setScopeDialog({ id: r.id, scope: 'private' })}
                                  disabled={approve.isPending}
                                  className="bg-green-600 hover:bg-green-700 gap-1 h-9 px-1 text-xs"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{t('branch_invoice_approvals.forward_to_top')}</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => postpone.mutate(r.id)}
                                  disabled={postpone.isPending}
                                  className="gap-1 h-9 px-1 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                >
                                  <Clock className="w-3.5 h-3.5 shrink-0" />
                                  <span>{t('branch_invoice_approvals.postpone')}</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => reject.mutate(r.id)}
                                  disabled={reject.isPending}
                                  className="gap-1 h-9 px-1 text-xs"
                                >
                                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>{t('branch_invoice_approvals.reject')}</span>
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                );
              })}
            </Tabs>
          </TabsContent>

          <TabsContent value="postponed">
            <Tabs defaultValue="postponed_list" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 h-auto">
                <TabsTrigger value="postponed_list" className="gap-1 px-1 text-[11px] sm:text-sm whitespace-nowrap">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t('branch_invoice_approvals.tab_postponed_list')}</span>
                  <Badge variant="secondary" className="ml-1 px-1 text-[10px]">{postponedRows.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="merged_sent" className="gap-1 px-1 text-[11px] sm:text-sm whitespace-nowrap">
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t('branch_invoice_approvals.tab_merged_sent')}</span>
                  <Badge variant="secondary" className="ml-1 px-1 text-[10px]">{mergedParentRows.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="merged_sent">
                {mergedParentRows.length === 0 ? (
                  <Card className="shadow-lg border-blue-200">
                    <CardContent className="py-12 text-center text-slate-500">
                      <Layers className="w-12 h-12 mx-auto mb-3 opacity-40" />
                      <p>لا توجد فواتير موحَّدة مُرسَلة للإدارة</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="shadow-lg border-blue-300">
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
                            onClick={() => setRequestDetails(r)}
                            className="border border-blue-200 rounded-xl bg-white overflow-hidden cursor-pointer hover:shadow-md hover:border-blue-400 transition"
                          >
                            <div className="p-3 space-y-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge className="bg-blue-100 text-blue-800 border border-blue-300 gap-1 text-[10px] px-1.5 py-0">
                                  <Layers className="w-3 h-3" />
                                  فاتورة موحَّدة
                                </Badge>
                                <span className="font-bold text-slate-800 truncate">{customerName}</span>
                              </div>
                              <div className="text-[11px] text-slate-600 leading-relaxed">
                                <strong className="text-blue-700">{mergedCount}</strong> فاتورة •{' '}
                                <strong className="text-blue-700">{itemsCount}</strong> منتج
                                {r.payment_method && (
                                  <> • <span className="text-slate-700">{r.payment_method}</span></>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(r.created_at).toLocaleString('ar')}
                              </div>
                            </div>
                            <div className="px-3 pb-2.5">
                              <Badge className="w-full justify-center bg-amber-100 text-amber-800 border border-amber-300 gap-1 py-1.5 text-xs">
                                <Clock3 className="w-3.5 h-3.5" />
                                بانتظار اعتماد الإدارة
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="postponed_list">
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
                        <div key={group.customerId} className="border border-amber-200 rounded-xl bg-white overflow-hidden">
                          <div className="p-2.5 space-y-2">
                            <button
                              type="button"
                              onClick={() => setExpandedCustomer(isOpen ? null : group.customerId)}
                              className="w-full flex items-center gap-2 text-start"
                            >
                              <span className="font-bold text-slate-800 truncate flex-1">{group.customerName}</span>
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0 shrink-0">
                                {group.items.length} فاتورة
                              </Badge>
                              {isOpen ? <ChevronUp className="w-4 h-4 text-amber-700 shrink-0" /> : <ChevronDown className="w-4 h-4 text-amber-700 shrink-0" />}
                            </button>
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
                              className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700 h-9"
                            >
                              <Layers className="w-4 h-4" />
                              تجميع المنتجات
                            </Button>
                          </div>
                          {isOpen && (
                            <div className="border-t border-amber-100 bg-amber-50/40 p-2 space-y-1.5">
                              {group.items.map(r => (
                                <div key={r.id} className="bg-white border border-amber-100 rounded-lg p-2 space-y-1.5">
                                  <div>
                                    <div className="font-semibold text-sm text-slate-800">
                                      {r.invoice_number ? `#${r.invoice_number}` : 'بدون رقم'}
                                      <span className="text-[10px] text-muted-foreground mr-2">
                                        {Array.isArray(r.products) ? r.products.length : 0} منتج
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {r.worker?.full_name || '—'} • {new Date(r.created_at).toLocaleDateString('ar')}
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setScopeDialog({ id: r.id, scope: 'private' })}
                                    className="w-full gap-1 text-green-700 border-green-200 hover:bg-green-50 h-8 text-xs"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
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
            </Tabs>
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
                    <div key={r.id} className="border border-emerald-100 rounded-xl bg-white overflow-hidden">
                      <div className="p-3 space-y-1">
                        <div className="font-bold text-base text-slate-800 truncate">{customerName}</div>
                        {r.customers?.store_name && (
                          <div className="text-xs text-slate-500 truncate">{r.customers.store_name}</div>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 pt-1">
                          <span>
                            <span className="text-slate-400">{t('branch_invoice_approvals.sales_rep')}:</span>{' '}
                            <span className="font-semibold text-slate-700">{r.worker?.full_name || '—'}</span>
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            {new Date(r.created_at).toLocaleString(language === 'ar' ? 'ar' : language)}
                          </span>
                        </div>
                      </div>
                      <div className="p-2.5 pt-0">
                        <Button asChild size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-9">
                          <a href={r.invoice_file_url!} target="_blank" rel="noreferrer" download={r.invoice_file_name || undefined}>
                            <Download className="w-4 h-4" />
                            {t('branch_invoice_approvals.download_invoice')}
                          </a>
                        </Button>
                      </div>
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

      <InvoiceRequestDetailsDialog
        open={!!requestDetails}
        onOpenChange={(o) => { if (!o) setRequestDetails(null); }}
        request={requestDetails}
      />

      {/* نافذة إنشاء فاتورة يدوية من مدير الفرع */}
      <BranchManualInvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* نافذة طلبات الفاتورة المعلقة (مرحلة المدير) لعميل محدد */}
      <Dialog open={!!customerDialog} onOpenChange={(v) => { if (!v) { setCustomerDialog(null); setSelectedIds([]); } }}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              طلبات الفاتورة المعلقة لدى مدير الفرع — {customerDialog?.name}
            </DialogTitle>
          </DialogHeader>
          {customerInvoicesQ.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (customerInvoicesQ.data?.length ?? 0) === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد طلبات معلقة لدى مدير الفرع لهذا العميل</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap border-b pb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4 cursor-pointer"
                    checked={selectedIds.length === customerInvoicesQ.data!.length && customerInvoicesQ.data!.length > 0}
                    onChange={(e) => setSelectedIds(e.target.checked ? customerInvoicesQ.data!.map((r: any) => r.id) : [])}
                  />
                  <span className="text-sm">تحديد الكل ({selectedIds.length}/{customerInvoicesQ.data!.length})</span>
                </div>
                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" disabled={bulkAction.isPending}
                      onClick={() => setBulkScopeDialog({ scope: 'private' })}>
                      <ArrowUpRight className="w-4 h-4" /> إرسال
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 text-amber-700 border-amber-300" disabled={bulkAction.isPending}
                      onClick={() => bulkAction.mutate({ ids: selectedIds, action: 'postpone' })}>
                      <Clock3 className="w-4 h-4" /> تأجيل
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1" disabled={bulkAction.isPending}
                      onClick={() => bulkAction.mutate({ ids: selectedIds, action: 'reject' })}>
                      <XCircle className="w-4 h-4" /> رفض
                    </Button>
                  </div>
                )}
              </div>
              <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-2 mt-2">
                {customerInvoicesQ.data!.map((r: any) => {
                  const pm = r.order?.invoice_payment_method || r.payment_method;
                  const pmLabel: Record<string, string> = {
                    gros: 'جملة (Gros)',
                    super_gros: 'سوبر جملة (Super Gros)',
                    retail: 'تجزئة (Détail)',
                    cash: 'نقدًا',
                    cheque: 'شيك',
                    credit: 'دين',
                  };
                  const pmText = pm ? (pmLabel[pm] || pm) : '—';
                  const pmColor = pm === 'cash' ? 'bg-green-100 text-green-800 border-green-300'
                    : pm === 'cheque' ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : pm === 'credit' ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : 'bg-slate-100 text-slate-800 border-slate-300';
                  const products = Array.isArray(r.products) ? r.products : [];
                  const total = r.total_amount ?? r.order?.total_amount ?? 0;
                  return (
                    <div key={r.id} className="border border-slate-200 rounded-lg bg-white p-3 flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="w-4 h-4 mt-1 cursor-pointer"
                        checked={selectedIds.includes(r.id)}
                        onChange={() => toggleSelected(r.id)}
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{r.branches?.name || '—'}</Badge>
                          <Badge className={`border ${pmColor}`}>طريقة الدفع: {pmText}</Badge>
                          {r.invoice_scope && (
                            <Badge variant="outline" className="gap-1">
                              {r.invoice_scope === 'private' ? <Lock className="w-3 h-3" /> : <Globe2 className="w-3 h-3" />}
                              {r.invoice_scope === 'private' ? 'خاصة' : 'عامة'}
                            </Badge>
                          )}
                          <span className="font-bold text-slate-800 ms-auto">
                            {Number(total).toLocaleString('ar')} دج
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          فاتورة #{r.invoice_number || '—'} • {products.length} منتج •{' '}
                          {new Date(r.order?.created_at || r.branch_approved_at || r.created_at).toLocaleString('ar')}
                        </p>
                        {products.length > 0 && (
                          <div className="bg-slate-50 rounded p-2 space-y-1 max-h-40 overflow-y-auto">
                            {products.map((p: any, i: number) => {
                              const qty = Number(p.quantity || 0);
                              const unitPrice = Number(p.unit_price || 0); // سعر الصندوق
                              const lineTotal = Number(p.total || (qty * unitPrice) || 0);
                              const wpb = Number(p.weight_per_box || 0); // وزن الصندوق (كلغ)
                              const pricePerKg = wpb > 0 ? unitPrice / wpb : 0;
                              return (
                                <div key={i} className="flex items-center justify-between text-xs gap-2">
                                  <span className="truncate font-medium text-slate-700">{p.product_name || p.name || '—'}</span>
                                  <span className="text-muted-foreground whitespace-nowrap">
                                    {wpb > 0 ? (
                                      <>
                                        {qty} × ({wpb} × {pricePerKg.toLocaleString('ar', { maximumFractionDigits: 2 })}) ={' '}
                                      </>
                                    ) : (
                                      <>{qty} × {unitPrice.toLocaleString('ar')} = </>
                                    )}
                                    <strong className="text-slate-900">{lineTotal.toLocaleString('ar', { maximumFractionDigits: 2 })}</strong> دج
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* اختيار نطاق الفاتورة عند الإرسال الجماعي */}
      <Dialog open={!!bulkScopeDialog} onOpenChange={(v) => { if (!v) setBulkScopeDialog(null); }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>اختر نوع الفاتورة للإرسال ({selectedIds.length})</DialogTitle>
          </DialogHeader>
          {bulkScopeDialog && (
            <RadioGroup
              value={bulkScopeDialog.scope}
              onValueChange={(v) => setBulkScopeDialog({ scope: v as 'public' | 'private' })}
              className="space-y-2"
            >
              <div className="flex items-start gap-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/30"
                onClick={() => setBulkScopeDialog({ scope: 'private' })}>
                <RadioGroupItem value="private" id="bulk-private" className="mt-1" />
                <Label htmlFor="bulk-private" className="flex items-center gap-2 font-semibold cursor-pointer">
                  <Lock className="w-4 h-4 text-amber-600" /> {t('branch_manual_invoice.scope_private')}
                </Label>
              </div>
              <div className="flex items-start gap-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/30"
                onClick={() => setBulkScopeDialog({ scope: 'public' })}>
                <RadioGroupItem value="public" id="bulk-public" className="mt-1" />
                <Label htmlFor="bulk-public" className="flex items-center gap-2 font-semibold cursor-pointer">
                  <Globe2 className="w-4 h-4 text-blue-600" /> {t('branch_manual_invoice.scope_public')}
                </Label>
              </div>
            </RadioGroup>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setBulkScopeDialog(null)} disabled={bulkAction.isPending}>إلغاء</Button>
            <Button className="bg-green-600 hover:bg-green-700"
              disabled={bulkAction.isPending}
              onClick={() => bulkScopeDialog && bulkAction.mutate({ ids: selectedIds, action: 'forward', scope: bulkScopeDialog.scope })}>
              {bulkAction.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد الإرسال'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
