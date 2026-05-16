import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
}

const TruckUnloadDialog: React.FC<Props> = ({ open, onOpenChange, onConfirm, isPending }) => {
  const { activeBranch } = useAuth();
  const [notes, setNotes] = useState('');

  // Fetch latest completed warehouse review session for this branch + its items
  const { data, isLoading } = useQuery({
    queryKey: ['last-warehouse-review-items', activeBranch?.id],
    queryFn: async () => {
      if (!activeBranch?.id) return { session: null, items: [] };
      const { data: session } = await supabase
        .from('warehouse_review_sessions')
        .select('id, completed_at, created_at')
        .eq('branch_id', activeBranch.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (!session) return { session: null, items: [] };
      const { data: items } = await supabase
        .from('warehouse_review_items')
        .select('id, product_id, actual_quantity, product:products(name, app_name)')
        .eq('session_id', session.id)
        .gt('actual_quantity', 0)
        .order('created_at');
      return { session, items: items || [] };
    },
    enabled: open && !!activeBranch?.id,
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
            يجب التحقق من تفريغ كل المنتجات التالية من الشاحنة قبل حفظ المراجعة النهائية.
            هذه الكميات مأخوذة من آخر مراجعة مخزن مكتملة.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-[50vh] overflow-y-auto border rounded-md p-2 my-2 bg-muted/30">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : !data?.session ? (
            <p className="text-sm text-center py-6 text-muted-foreground">
              لا توجد مراجعة مخزن مكتملة لهذا الفرع.
            </p>
          ) : data.items.length === 0 ? (
            <p className="text-sm text-center py-6 text-muted-foreground">
              لا توجد منتجات بكميات متبقية في آخر مراجعة.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {data.items.map((it: any) => (
                <div
                  key={it.id}
                  className="flex items-center gap-2 p-2 bg-background border rounded-md"
                >
                  <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">
                      {getProductDisplayName(it.product || {})}
                    </p>
                    <Badge variant="secondary" className="text-[10px] mt-0.5">
                      {Number(it.actual_quantity)}
                    </Badge>
                  </div>
                </div>
              ))}
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
