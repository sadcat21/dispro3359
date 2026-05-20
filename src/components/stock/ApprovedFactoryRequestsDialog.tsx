import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Factory, MessageCircle, FileText, CheckCircle2, Loader2, Info, Clock, User, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { dbBPDisplay } from '@/utils/boxPieceInput';
import FactoryReceiptQuickDialog from '@/components/stock/FactoryReceiptQuickDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  branchName?: string;
}

const ApprovedFactoryRequestsDialog: React.FC<Props> = ({ open, onOpenChange, branchId, branchName }) => {
  const qc = useQueryClient();
  const [receiptOpen, setReceiptOpen] = useState(false);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['branch-approved-factory-requests', branchId],
    enabled: open && !!branchId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [{ data: orders }, { data: branch }] = await Promise.all([
        supabase
          .from('factory_orders')
          .select(`
            id, reference_no, status, notes, created_at,
            branch_approved_at, assistant_approved_at, system_manager_approved_at, confirmed_at,
            creator:created_by ( full_name ),
            branch_approver:branch_approved_by ( full_name ),
            assistant_approver:assistant_approved_by ( full_name ),
            system_approver:system_manager_approved_by ( full_name )
          `)
          .eq('branch_id', branchId)
          .eq('order_type', 'factory_request')
          .in('status', ['approved', 'in_production', 'ready_for_delivery'])
          .order('confirmed_at', { ascending: false }),
        supabase.from('branches').select('factory_sales_phone').eq('id', branchId).maybeSingle(),
      ]);
      if (!orders || orders.length === 0) return [];
      const ids = orders.map((o: any) => o.id);
      const { data: items } = await supabase
        .from('factory_order_items')
        .select('factory_order_id, product_quantity, product:products(name, pieces_per_box)')
        .in('factory_order_id', ids);
      const phone = ((branch as any)?.factory_sales_phone || '').toString();
      return orders.map((o: any) => ({
        ...o,
        phone,
        items: (items || [])
          .filter((it: any) => it.factory_order_id === o.id)
          .map((it: any) => ({
            name: it.product?.name || '',
            qty: Number(it.product_quantity) || 0,
            ppb: it.product?.pieces_per_box || 1,
          })),
      }));
    },
  });

  const openWhatsApp = (req: any) => {
    const phone = (req.phone || '').replace(/\D/g, '');
    if (!phone) { alert('لم يتم تسجيل رقم مندوب المصنع'); return; }
    const lines = [
      `📦 طلب من فرع ${branchName || ''}`.trim(),
      req.reference_no ? `رقم الطلب: #${req.reference_no}` : '',
      '',
      'المنتجات المطلوبة:',
      ...req.items.map((it: any, i: number) => `${i + 1}. ${it.name}: ${dbBPDisplay(it.qty, it.ppb)}`),
    ].filter(Boolean);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-emerald-600" />
            طلبات التموين الموافق عليها
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" /></div>
        ) : requests.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Factory className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>لا توجد طلبات موافق عليها حالياً</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req: any) => (
              <div key={req.id} className="rounded-xl border-2 border-emerald-300 bg-gradient-to-l from-emerald-50 to-white p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-800">تمت الموافقة</span>
                  {req.reference_no && (
                    <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300">#{req.reference_no}</Badge>
                  )}
                  {req.confirmed_at && (
                    <span className="text-xs text-slate-500">{new Date(req.confirmed_at).toLocaleString()}</span>
                  )}
                </div>
                <div className="rounded-lg border border-emerald-200 bg-white p-2 space-y-1">
                  {req.items.map((it: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{it.name}</span>
                      <span className="font-mono font-semibold text-slate-900">{dbBPDisplay(it.qty, it.ppb)}</span>
                    </div>
                  ))}
                </div>
                {req.notes && <p className="text-xs text-slate-600">📝 {req.notes}</p>}
                <div className="flex justify-end gap-2">
                  <Button size="sm" onClick={() => openWhatsApp(req)} className="bg-[#25D366] hover:bg-[#1ebe57] text-white gap-1.5">
                    <MessageCircle className="w-4 h-4" />
                    واتساب
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReceiptOpen(true)}
                    className="border-emerald-400 text-emerald-700 hover:bg-emerald-50 gap-1.5"
                  >
                    <FileText className="w-4 h-4" />
                    وثيقة الاستلام
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <FactoryReceiptQuickDialog
          open={receiptOpen}
          onOpenChange={(v) => {
            setReceiptOpen(v);
            if (!v) qc.invalidateQueries({ queryKey: ['branch-approved-factory-requests', branchId] });
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ApprovedFactoryRequestsDialog;
