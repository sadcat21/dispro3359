import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, FileText, Calendar } from 'lucide-react';

interface ReceiptDetailsDialogProps {
  receiptId: string | null;
  onOpenChange: (open: boolean) => void;
}

const ReceiptDetailsDialog: React.FC<ReceiptDetailsDialogProps> = ({ receiptId, onOpenChange }) => {
  const open = !!receiptId;

  const { data, isLoading } = useQuery({
    queryKey: ['receipt-details', receiptId],
    queryFn: async () => {
      if (!receiptId) return null;
      const { data: receipt, error: rErr } = await supabase
        .from('stock_receipts')
        .select('id, receipt_date, invoice_number, total_items, notes, status, branch_approved_at, branches(name)')
        .eq('id', receiptId)
        .maybeSingle();
      if (rErr) throw rErr;

      const { data: items, error: iErr } = await supabase
        .from('stock_receipt_items')
        .select('id, quantity, pallet_quantity, lot_number, manufacturing_date, manufacturing_time, delivery_date, notes, products(name)')
        .eq('receipt_id', receiptId)
        .order('created_at', { ascending: true });
      if (iErr) throw iErr;

      return { receipt, items: items || [] };
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            تفاصيل استلام المصنع
          </DialogTitle>
          <DialogDescription>
            مراجعة كل البنود قبل الموافقة النهائية
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !data?.receipt ? (
          <p className="text-center py-8 text-muted-foreground">لم يتم العثور على الاستلام</p>
        ) : (
          <div className="space-y-4">
            {/* رأس */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg text-sm">
              <div>
                <span className="text-muted-foreground">الفرع:</span>{' '}
                <span className="font-medium">{(data.receipt as any).branches?.name || '—'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">تاريخ:</span>{' '}
                <span className="font-medium">{data.receipt.receipt_date}</span>
              </div>
              <div className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">رقم الفاتورة:</span>{' '}
                <span className="font-medium">{data.receipt.invoice_number || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">عدد البنود:</span>{' '}
                <Badge variant="secondary">{data.items.length}</Badge>
              </div>
              {data.receipt.branch_approved_at && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">موافقة الفرع:</span>{' '}
                  <span className="font-medium">{new Date(data.receipt.branch_approved_at).toLocaleString()}</span>
                </div>
              )}
              {data.receipt.notes && (
                <div className="col-span-full">
                  <span className="text-muted-foreground">ملاحظات:</span>{' '}
                  <span>{data.receipt.notes}</span>
                </div>
              )}
            </div>

            {/* البنود */}
            <ScrollArea className="max-h-[55vh] pe-2">
              <div className="space-y-2">
                {data.items.length === 0 ? (
                  <p className="text-center py-6 text-muted-foreground text-sm">لا توجد بنود</p>
                ) : (
                  data.items.map((item: any, idx: number) => (
                    <div key={item.id} className="border rounded-lg p-3 bg-card">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">#{idx + 1}</Badge>
                          <span className="font-semibold">{item.products?.name || '—'}</span>
                        </div>
                        <Badge className="bg-primary/10 text-primary border border-primary/30">
                          الكمية: {Number(item.quantity).toFixed(2)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                        {item.pallet_quantity > 0 && (
                          <div><span>منصات: </span><span className="font-medium text-foreground">{item.pallet_quantity}</span></div>
                        )}
                        {item.lot_number && (
                          <div><span>رقم اللوت: </span><span className="font-medium text-foreground">{item.lot_number}</span></div>
                        )}
                        {item.manufacturing_date && (
                          <div><span>تاريخ الإنتاج: </span><span className="font-medium text-foreground">{item.manufacturing_date}</span></div>
                        )}
                        {item.manufacturing_time && (
                          <div><span>ساعة الإنتاج: </span><span className="font-medium text-foreground">{item.manufacturing_time}</span></div>
                        )}
                        {item.delivery_date && (
                          <div><span>تاريخ التسليم: </span><span className="font-medium text-foreground">{item.delivery_date}</span></div>
                        )}
                      </div>
                      {item.notes && (
                        <p className="mt-2 text-xs text-muted-foreground border-t pt-2">{item.notes}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptDetailsDialog;