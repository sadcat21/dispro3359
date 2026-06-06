import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowRight, CheckCircle2, XCircle, Clock, Eye, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import HandoverPrintView from '@/components/treasury/HandoverPrintView';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';

const statusMeta: Record<ApprovalStatus, { label: string; color: string; icon: any }> = {
  pending: { label: 'قيد المراجعة', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: Clock },
  approved: { label: 'موافَق عليه', color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle2 },
  rejected: { label: 'مرفوض', color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle },
};

const HandoverApprovals = () => {
  const navigate = useNavigate();
  const { workerId } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ApprovalStatus>('pending');
  const [selected, setSelected] = useState<any>(null);
  const [decisionNotes, setDecisionNotes] = useState('');

  const { data: handovers, isLoading } = useQuery({
    queryKey: ['handover-approvals', tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manager_handovers')
        .select('*, branch:branches(id, name, wilaya), manager:workers!manager_handovers_manager_id_fkey(id, full_name)')
        .eq('approval_status', tab)
        .order('handover_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: ApprovalStatus; notes: string }) => {
      const { error } = await supabase
        .from('manager_handovers')
        .update({
          approval_status: status,
          approved_at: new Date().toISOString(),
          approved_by: workerId,
          approval_notes: notes || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.status === 'approved' ? 'تمت الموافقة على التسليم' : 'تم رفض التسليم');
      queryClient.invalidateQueries({ queryKey: ['handover-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['manager-handovers'] });
      queryClient.invalidateQueries({ queryKey: ['project-manager-treasury'] });
      queryClient.invalidateQueries({ queryKey: ['manager-treasury'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
      queryClient.invalidateQueries({ queryKey: ['pmt-expenses'] });
      setSelected(null);
      setDecisionNotes('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">موافقات التسليمات</h1>
            <p className="text-sm text-muted-foreground">مراجعة التسليمات المرسلة من مدراء الفروع والموافقة عليها</p>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ApprovalStatus)}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          {(['pending', 'approved', 'rejected'] as const).map((s) => {
            const Icon = statusMeta[s].icon;
            return (
              <TabsTrigger key={s} value={s} className="gap-1.5">
                <Icon className="w-4 h-4" />
                {statusMeta[s].label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-12">جاري التحميل...</div>
          ) : !handovers?.length ? (
            <Card><CardContent className="text-center text-muted-foreground py-12">لا توجد تسليمات</CardContent></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {handovers.map((h: any) => {
                const meta = statusMeta[h.approval_status as ApprovalStatus] || statusMeta.pending;
                return (
                  <Card key={h.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary" />
                          {h.branch?.name || '—'}
                        </CardTitle>
                        <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        المدير: {h.manager?.full_name || '—'} • {format(new Date(h.handover_date), 'PPP', { locale: ar })}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">المبلغ الإجمالي</span>
                        <span className="font-bold text-primary tabular-nums">
                          {Number(h.amount || 0).toLocaleString()} DA
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                        <span>كاش 1: {Number(h.cash_invoice1 || 0).toLocaleString()}</span>
                        <span>كاش 2: {Number(h.cash_invoice2 || 0).toLocaleString()}</span>
                        <span>شيكات: {Number(h.checks_amount || 0).toLocaleString()}</span>
                        <span>وصولات: {Number(h.receipts_amount || 0).toLocaleString()}</span>
                      </div>
                      <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => { setSelected(h); setDecisionNotes(h.approval_notes || ''); }}>
                        <Eye className="w-4 h-4 ml-1" /> معاينة التفاصيل
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setDecisionNotes(''); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل التسليم</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="border rounded-lg p-2 bg-white">
                <HandoverPrintView
                  handoverId={selected.id}
                  handoverDate={selected.handover_date}
                  cashInvoice1={Number(selected.cash_invoice1 || 0)}
                  cashInvoice2={Number(selected.cash_invoice2 || 0)}
                  checksAmount={Number(selected.checks_amount || 0)}
                  receiptsAmount={Number(selected.receipts_amount || 0)}
                  transfersAmount={Number(selected.transfers_amount || 0)}
                  totalAmount={Number(selected.amount || 0)}
                  branchWilaya={selected.branch?.wilaya}
                  deliveryMethod={selected.delivery_method}
                  intermediaryName={selected.intermediary_name}
                  bankTransferReference={selected.bank_transfer_reference}
                  receivedBy={selected.receiver_name}
                  senderName={selected.manager?.full_name}
                  unifiedCash={selected.unified_cash}
                />
              </div>

              <div>
                <Label className="text-sm">ملاحظات القرار (اختياري)</Label>
                <Textarea value={decisionNotes} onChange={(e) => setDecisionNotes(e.target.value)} placeholder="أضف ملاحظات حول القرار..." className="mt-1" />
              </div>

              {selected.approval_status === 'pending' ? (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => decide.mutate({ id: selected.id, status: 'approved', notes: decisionNotes })}
                    disabled={decide.isPending}
                  >
                    <CheckCircle2 className="w-4 h-4 ml-1" /> موافقة
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => decide.mutate({ id: selected.id, status: 'rejected', notes: decisionNotes })}
                    disabled={decide.isPending}
                  >
                    <XCircle className="w-4 h-4 ml-1" /> رفض
                  </Button>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                  <p className="font-medium">
                    الحالة: <span className={selected.approval_status === 'approved' ? 'text-green-700' : 'text-red-700'}>
                      {statusMeta[selected.approval_status as ApprovalStatus]?.label}
                    </span>
                  </p>
                  {selected.approved_at && (
                    <p className="text-xs text-muted-foreground">
                      بتاريخ: {format(new Date(selected.approved_at), 'PPP p', { locale: ar })}
                    </p>
                  )}
                  {selected.approval_notes && (
                    <p className="text-xs">ملاحظات: {selected.approval_notes}</p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => decide.mutate({ id: selected.id, status: 'pending', notes: '' })}
                    disabled={decide.isPending}
                  >
                    إعادة إلى قيد المراجعة
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HandoverApprovals;
