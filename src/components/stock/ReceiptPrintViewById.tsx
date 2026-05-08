import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import ReceiptPrintView from '@/components/stock/ReceiptPrintView';
import { aggregateReceiptItemsForEditing } from '@/utils/stockReceipt';

interface Props {
  receiptId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const ReceiptPrintViewById: React.FC<Props> = ({ receiptId, open, onOpenChange }) => {
  const { data } = useQuery({
    queryKey: ['receipt-print-view', receiptId],
    enabled: open && !!receiptId,
    queryFn: async () => {
      const { data: receipt, error: rErr } = await supabase
        .from('stock_receipts')
        .select('*, branches(name)')
        .eq('id', receiptId!)
        .maybeSingle();
      if (rErr) throw rErr;
      const { data: items, error: iErr } = await supabase
        .from('stock_receipt_items')
        .select('*, product:products(id, name, image_url, pieces_per_box)')
        .eq('receipt_id', receiptId!);
      if (iErr) throw iErr;
      return { receipt, items: items || [] };
    },
  });

  if (!open || !data?.receipt) return null;
  const r: any = data.receipt;
  const viewItems: any[] = data.items;

  let meta: any = {};
  try { meta = JSON.parse(r.notes || '{}'); } catch { meta = {}; }

  const agg = aggregateReceiptItemsForEditing(viewItems as any);
  const items = agg.map((a: any) => {
    const prod = viewItems.find((vi: any) => vi.product_id === a.product_id)?.product;
    return {
      product_name: prod?.name || a.product_id,
      new_qty: a.new_quantity,
      comp_qty: a.compensation_quantity,
      comp_offers_qty: a.compensation_offers_quantity,
      pieces_per_box: prod?.pieces_per_box || 20,
      image_url: prod?.image_url,
    };
  });

  return (
    <ReceiptPrintView
      open={open}
      onOpenChange={onOpenChange}
      type={meta.source === 'branch' ? 'transfer' : 'reception'}
      invoiceNumber={r.invoice_number}
      date={r.created_at || r.receipt_date}
      items={items}
      driverInfo={meta}
      notes={meta.text || (typeof r.notes === 'string' && !r.notes.startsWith('{') ? r.notes : null)}
      branchName={r.branches?.name}
      palletCount={r.pallet_count}
      receiptExpenses={r.receipt_expenses}
      expensesDescription={r.expenses_description}
      expensesBreakdown={r.expenses_breakdown}
    />
  );
};

export default ReceiptPrintViewById;