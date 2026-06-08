import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown } from 'lucide-react';
import { isRemiseOrderItem } from '@/utils/remise';

interface RemiseSummaryProps {
  workerId: string;
  periodStart: string;
  periodEnd: string;
}

interface RemiseRow {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  catalogPrice: number | null;
}

const fmt = (n: number) => n.toLocaleString();
const fmtQty = (v: number): string => {
  const rounded = Math.round(v * 100) / 100;
  if (rounded === Math.floor(rounded)) return rounded.toString();
  return rounded.toFixed(2).replace(/0+$/, '');
};

const toTz = (v: string, isEnd: boolean) => {
  if (v.includes('+') || v.includes('Z')) return v;
  if (v.includes('T')) return v + ':00+01:00';
  return isEnd ? v + 'T23:59:59+01:00' : v + 'T00:00:00+01:00';
};

const RemiseSummary: React.FC<RemiseSummaryProps> = ({ workerId, periodStart, periodEnd }) => {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['remise-summary', workerId, periodStart, periodEnd],
    queryFn: async (): Promise<RemiseRow[]> => {
      const startTz = toTz(periodStart, false);
      const endTz = toTz(periodEnd, true);

      const { data: movements } = await supabase
        .from('stock_movements')
        .select('order_id')
        .eq('worker_id', workerId)
        .eq('movement_type', 'delivery')
        .eq('status', 'approved')
        .gte('created_at', startTz)
        .lte('created_at', endTz);

      const orderIds = [...new Set((movements || []).map((m) => m.order_id).filter(Boolean))];
      if (!orderIds.length) return [];

      const { data: items } = await supabase
        .from('order_items')
        .select(
          'order_id, product_id, quantity, gift_quantity, unit_price, total_price, price_subtype, payment_type, pricing_unit, weight_per_box, pieces_per_box, product:products(name, price_retail, price_gros, price_super_gros, price_invoice, pricing_unit, weight_per_box, pieces_per_box)'
        )
        .in('order_id', orderIds);

      const rows = new Map<string, RemiseRow>();

      for (const item of items || []) {
        const prod: any = (item as any).product;
        const rawQty = Number(item.quantity || 0);
        const giftQty = Number(item.gift_quantity || 0);
        const paidQty = Math.max(0, rawQty - giftQty);
        if (paidQty <= 0) continue;

        if (!isRemiseOrderItem(item as any, prod)) continue;

        const unitPrice = Number(item.unit_price || 0);
        const totalPrice = Number(item.total_price || 0) || paidQty * unitPrice;
        const productName = prod?.name || 'منتج غير معروف';
        const key = `${productName}::${unitPrice}`;

        // Catalog ref price for the item's effective subtype
        const subtype =
          (item as any).payment_type === 'with_invoice'
            ? 'invoice'
            : (item.price_subtype || '').toString().toLowerCase();
        let catalogPrice: number | null = null;
        if (subtype && prod) {
          const v = Number(prod[`price_${subtype}`] || 0);
          if (v > 0) catalogPrice = v;
        }

        const existing = rows.get(key);
        if (existing) {
          existing.quantity += paidQty;
          existing.total += totalPrice;
        } else {
          rows.set(key, { productName, quantity: paidQty, unitPrice, total: totalPrice, catalogPrice });
        }
      }

      return [...rows.values()].sort((a, b) => b.total - a.total);
    },
    enabled: !!workerId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <p data-empty="true" className="text-center text-muted-foreground py-6 text-sm">لا توجد مبيعات بسعر مخصص (Remise)</p>;
  }

  const totalQty = data.reduce((s, r) => s + r.quantity, 0);
  const totalValue = data.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-2">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="border rounded-xl overflow-hidden">
          <CollapsibleTrigger className="w-full flex items-center gap-2 p-3 hover:bg-muted/30 transition-colors">
            <Badge className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 shrink-0">RMZ</Badge>
            <span className="font-semibold text-sm flex-1 text-start">Remise</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">{fmtQty(totalQty)}</span>
              <span className="text-xs font-bold">{fmt(Math.round(totalValue))} DA</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t px-2 py-1.5 space-y-0.5">
              <div className="grid grid-cols-4 gap-1 text-[10px] text-muted-foreground font-medium pb-1 border-b px-1">
                <span>المنتج</span>
                <span className="text-center">الكمية</span>
                <span className="text-center">السعر</span>
                <span className="text-center">الإجمالي</span>
              </div>
              {data.map((row, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-1 text-xs items-center py-1.5 px-1 border-b border-dashed last:border-0">
                  <span className="truncate">{row.productName}</span>
                  <span className="text-center font-bold">{fmtQty(row.quantity)}</span>
                  <div className="text-center">
                    <span className="text-red-600 font-semibold">{fmt(row.unitPrice)}</span>
                    {row.catalogPrice && (
                      <span className="block text-[9px] text-muted-foreground line-through">{fmt(row.catalogPrice)}</span>
                    )}
                  </div>
                  <span className="text-center font-semibold">{fmt(Math.round(row.total))}</span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
};

export default RemiseSummary;
