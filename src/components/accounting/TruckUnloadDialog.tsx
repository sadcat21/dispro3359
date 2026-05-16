import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Package, Truck, CheckCircle2, AlertTriangle, PackageX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getProductDisplayName } from '@/utils/productDisplayName';
import EmptyTruckDialog from './EmptyTruckDialog';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (notes: string) => void;
  isPending?: boolean;
  workerId?: string;
}

const TruckUnloadDialog: React.FC<Props> = ({ open, onOpenChange, onConfirm, isPending, workerId }) => {
  const [notes, setNotes] = useState('');
  const [emptyOpen, setEmptyOpen] = useState(false);

  // Live shipment balance for this worker (worker_stock).
  // The manager can only save the accounting session when this balance is empty.
  const { data, isLoading } = useQuery({
    queryKey: ['worker-shipment-balance', workerId],
    queryFn: async () => {
      if (!workerId) return [] as any[];
      const { data: items } = await supabase
        .from('worker_stock')
        .select('id, product_id, quantity, product:products(name, app_name, image_url)')
        .eq('worker_id', workerId)
        .gt('quantity', 0)
        .order('updated_at', { ascending: false });
      return items || [];
    },
    enabled: open && !!workerId,
    refetchOnWindowFocus: true,
  });

  const isEmpty = !isLoading && (data?.length ?? 0) === 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-600" />
            رصيد شحنة العامل
          </AlertDialogTitle>
          <AlertDialogDescription className="sr-only">رصيد شحنة العامل</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-[50vh] overflow-y-auto border rounded-md p-2 my-2 bg-muted/30">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center py-8 text-green-600">
              <CheckCircle2 className="w-10 h-10 mb-2" />
              <p className="text-sm font-medium">رصيد الشحنة فارغ — تم تفريغ الشاحنة بالكامل</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-1 pb-2 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4" />
                لا يزال لدى العامل {data!.length} منتج بكميات متبقية. لا يمكن الحفظ.
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {data!.map((it: any) => {
                  const img = it.product?.image_url;
                  return (
                    <div key={it.id} className="flex items-center gap-2 p-2 bg-background border rounded-md">
                      {img ? (
                        <img
                          src={img}
                          alt={getProductDisplayName(it.product || {})}
                          className="w-10 h-10 rounded object-cover shrink-0 border"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0 border">
                          <Package className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">
                          {getProductDisplayName(it.product || {})}
                        </p>
                        <Badge variant="destructive" className="text-[10px] mt-0.5">
                          {Number(it.quantity)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {workerId && (
          <EmptyTruckDialog
            workerId={workerId}
            open={emptyOpen}
            onOpenChange={setEmptyOpen}
          />
        )}

        {isEmpty && (
          <Textarea
            placeholder="ملاحظات حول التفريغ (اختياري)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>إلغاء</AlertDialogCancel>
          {isEmpty ? (
            <AlertDialogAction
              onClick={() => onConfirm(notes)}
              disabled={isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد التفريغ وحفظ المحاسبة'}
            </AlertDialogAction>
          ) : (
            workerId && (
              <Button
                variant="destructive"
                onClick={() => setEmptyOpen(true)}
                disabled={isPending || isLoading}
              >
                <PackageX className="w-4 h-4 ml-2" />
                تفريغ الشاحنة الآن (المدير)
              </Button>
            )
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default TruckUnloadDialog;
