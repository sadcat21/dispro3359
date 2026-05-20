import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Factory, MessageCircle, CheckCircle2, FileText } from 'lucide-react';
import { dbBPDisplay } from '@/utils/boxPieceInput';
import FactoryReceiptQuickDialog from '@/components/stock/FactoryReceiptQuickDialog';


interface Props {
  branchId: string;
  branchName?: string;
}

interface ApprovedRequest {
  id: string;
  reference_no: number | null;
  confirmed_at: string | null;
  status: string;
  items: Array<{ name: string; qty: number; ppb: number }>;
  phone: string;
}

const FactoryRequestApprovedBanner: React.FC<Props> = ({ branchId, branchName }) => {
  const qc = useQueryClient();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const { data: requests = [] } = useQuery({
    queryKey: ['factory-request-approved', branchId],
    enabled: !!branchId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<ApprovedRequest[]> => {
      const [{ data: orders }, { data: branch }] = await Promise.all([
        supabase
          .from('factory_orders')
          .select('id, reference_no, confirmed_at, status')
          .eq('branch_id', branchId)
          .eq('order_type', 'factory_request')
          .in('status', ['approved', 'in_production', 'ready_for_delivery'])
          .order('confirmed_at', { ascending: false })
          .limit(5),
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
        id: o.id,
        reference_no: o.reference_no,
        confirmed_at: o.confirmed_at,
        status: o.status,
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

  const openWhatsApp = (req: ApprovedRequest) => {
    const phone = req.phone.replace(/\D/g, '');
    if (!phone) {
      alert('لم يتم تسجيل رقم مندوب المصنع');
      return;
    }
    const lines = [
      `📦 طلب من فرع ${branchName || ''}`.trim(),
      req.reference_no ? `رقم الطلب: #${req.reference_no}` : '',
      '',
      'المنتجات المطلوبة:',
      ...req.items.map((it, i) => `${i + 1}. ${it.name}: ${dbBPDisplay(it.qty, it.ppb)}`),
    ].filter(Boolean);
    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  if (requests.length === 0) return null;

  return (
    <div className="px-2 sm:px-3 pt-2 space-y-2">
      {requests.map(req => (
        <div
          key={req.id}
          className="rounded-xl border-2 border-emerald-300 bg-gradient-to-l from-emerald-50 to-white p-3 flex items-center gap-3 shadow-sm"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-800">
              <Factory className="w-4 h-4" />
              تمت الموافقة على طلبك من المصنع
              {req.reference_no && <span className="text-xs font-normal text-emerald-600">#{req.reference_no}</span>}
            </div>
            <div className="text-[11px] text-emerald-700 truncate">
              {req.items.length} منتج — اضغط على واتساب لإرسال الطلب لمندوب المصنع
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => openWhatsApp(req)}
            className="bg-[#25D366] hover:bg-[#1ebe57] text-white shrink-0 gap-1.5"
          >
            <MessageCircle className="w-4 h-4" />
            واتساب
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReceiptOpen(true)}
            className="border-emerald-400 text-emerald-700 hover:bg-emerald-50 shrink-0 gap-1.5"
          >
            <FileText className="w-4 h-4" />
            وثيقة الاستلام
          </Button>
        </div>
      ))}

      <FactoryReceiptQuickDialog
        open={receiptOpen}
        onOpenChange={(v) => {
          setReceiptOpen(v);
          if (!v) qc.invalidateQueries({ queryKey: ['factory-request-approved', branchId] });
        }}
      />

    </div>
  );
};

export default FactoryRequestApprovedBanner;
