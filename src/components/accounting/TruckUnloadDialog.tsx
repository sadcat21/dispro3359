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
import { Loader2, Package, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getProductDisplayName } from '@/utils/productDisplayName';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (notes: string) => void;
  isPending?: boolean;
  workerId?: string;
}

const TruckUnloadDialog: React.FC<Props> = ({ open, onOpenChange, onConfirm, isPending, workerId }) => {
  const [notes, setNotes] = useState('');

  // Fetch the worker's latest final review loading session and its items
  // (quantities confirmed by the warehouse worker for THIS worker's truck).
  const { data, isLoading } = useQuery({
    queryKey: ['worker-last-review-items', workerId],
    queryFn: async () => {
      if (!workerId) return { session: null, items: [] as any[] };
      const { data: session } = await supabase
        .from('loading_sessions')
        .select('id, created_at, completed_at')
        .eq('worker_id', workerId)
        .eq('status', 'review')
        .eq('is_final', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!session) return { session: null, items: [] as any[] };
      const { data: items } = await supabase
        .from('loading_session_items')
        .select('id, product_id, quantity, product:products(name, app_name, image_url)')
        .eq('session_id', session.id)
        .gt('quantity', 0)
        .order('created_at');
      return { session, items: items || [] };
    },
    enabled: open && !!workerId,
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-600" />
            تفريغ كامل لشاحنة العامل
          </AlertDialogTitle>
          <AlertDialogDescription>
            يجب التحقق من تفريغ كل المنتجات التالية من شاحنة العامل قبل حفظ المراجعة النهائية.
            هذه الكميات مأخوذة من آخر مراجعة نهائية لشحنة العامل (مؤكدة من عامل المخزن).
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-[50vh] overflow-y-auto border rounded-md p-2 my-2 bg-muted/30">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : !data?.session ? (
            <p className="text-sm text-center py-6 text-muted-foreground">
              لا توجد مراجعة نهائية لشحنة هذا العامل.
            </p>
          ) : data.items.length === 0 ? (
            <p className="text-sm text-center py-6 text-muted-foreground">
              لا توجد منتجات بكميات متبقية في آخر مراجعة.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {data.items.map((it: any) => {
                const img = it.product?.image_url;
                return (
                  <div
                    key={it.id}
                    className="flex items-center gap-2 p-2 bg-background border rounded-md"
                  >
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
                      <Badge variant="secondary" className="text-[10px] mt-0.5">
                        {Number(it.quantity)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Textarea
          placeholder="ملاحظات حول التفريغ (اختياري)..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(notes)}
            disabled={isPending}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد التفريغ الكامل وحفظ المراجعة'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default TruckUnloadDialog;
