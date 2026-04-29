import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, FileText, ArrowLeft, Info, ArrowUpRight, Clock3, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';

interface InvoiceRequestRow {
  id: string;
  order_id: string | null;
  invoice_number: string | null;
  status: string;
  payment_method: string | null;
  whatsapp_contact: string | null;
  created_at: string;
  products: any;
  customers?: { name: string; name_fr?: string | null; store_name?: string | null } | null;
  worker?: { full_name: string } | null;
}

const BranchInvoiceApprovals: React.FC = () => {
  const { t, language } = useLanguage();
  const { activeBranch } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const branchId = activeBranch?.id;

  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);

  const requestsQ = useQuery({
    queryKey: ['branch-invoice-approvals', branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manual_invoice_requests')
        .select(`
          id, order_id, invoice_number, status, payment_method, whatsapp_contact, created_at, products,
          customers!manual_invoice_requests_customer_id_fkey(name, name_fr, store_name),
          worker:workers!manual_invoice_requests_worker_id_fkey(full_name)
        `)
        .eq('branch_id', branchId!)
        .in('status', ['pending_branch', 'pending_assistant'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as InvoiceRequestRow[];
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
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
        .single();
      if (error) throw error;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </Button>
          <h1 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            {t('branch_invoice_approvals.title')}
          </h1>
          <div className="w-20" />
        </div>

        {/* شريط شرح دور مدير الفرع كوسيط */}
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">{t('branch_invoice_approvals.role_intro_title')}</p>
            <p className="text-blue-800/90 leading-relaxed">{t('branch_invoice_approvals.role_intro_desc')}</p>
          </div>
        </div>

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
            ) : rows.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>{t('branch_invoice_approvals.no_pending')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => {
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
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{customerName}</span>
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
                            <Badge variant="outline" className="border-border bg-muted text-muted-foreground px-3 py-2 gap-1 justify-center">
                              <Clock3 className="w-4 h-4" />
                              {t('branch_invoice_approvals.awaiting_final_approval')}
                            </Badge>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                onClick={() => approve.mutate(r.id)}
                                disabled={approve.isPending}
                                className="bg-green-600 hover:bg-green-700 gap-1"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                {t('branch_invoice_approvals.forward_to_top')}
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
      </div>

      {/* نافذة تفاصيل الطلبية — نفس المستخدمة في عملاء/منجزات اليوم */}
      <OrderDetailsDialog
        open={!!selectedOrder}
        onOpenChange={(isOpen) => { if (!isOpen) setSelectedOrder(null); }}
        order={selectedOrder}
        hideModifyAction={true}
      />
    </div>
  );
};

export default BranchInvoiceApprovals;
