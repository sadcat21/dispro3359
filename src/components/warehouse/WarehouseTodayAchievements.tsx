import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Truck, ShoppingCart, PackagePlus, ClipboardCheck, Trash2, Lock, Calendar, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import type { OrderWithDetails } from '@/types/database';

interface Props {
  branchId: string;
}

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export const WarehouseTodayAchievements: React.FC<Props> = ({ branchId }) => {
  const { workerId } = useAuth();
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState<{ type: string; id: string; label: string } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);

  // 1) جلسات الشحن اليوم
  const loadingQ = useQuery({
    queryKey: ['warehouse-today-loadings', workerId, branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loading_sessions')
        .select('id, status, created_at, completed_at, worker_id, workers:worker_id(full_name), loading_session_items(id, quantity, products:product_id(name))')
        .eq('manager_id', workerId!)
        .eq('branch_id', branchId)
        .gte('created_at', todayStart())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!workerId && !!branchId,
  });

  // 2) البيع المباشر اليوم (طلبيات أنشأها المخزني)
  const ordersQ = useQuery({
    queryKey: ['warehouse-today-orders', workerId, branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, created_at, total_amount, payment_type, customers:customer_id(name)')
        .eq('created_by', workerId!)
        .eq('branch_id', branchId)
        .gte('created_at', todayStart())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!workerId && !!branchId,
  });

  // 3) استلامات اليوم
  const receiptsQ = useQuery({
    queryKey: ['warehouse-today-receipts', workerId, branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_receipts')
        .select('id, status, created_at, total_quantity:stock_receipt_items(quantity)')
        .eq('created_by', workerId!)
        .eq('branch_id', branchId)
        .gte('created_at', todayStart())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!workerId && !!branchId,
  });

  // 4) جلسات المحاسبة اليوم — لتحديد ما إذا كانت الجلسة قد أُغلقت
  const accountingQ = useQuery({
    queryKey: ['warehouse-today-accounting', workerId, branchId],
    queryFn: async () => {
      const { data } = await supabase
        .from('accounting_sessions')
        .select('id, status, created_at')
        .eq('branch_id', branchId)
        .gte('created_at', todayStart());
      return data || [];
    },
    enabled: !!workerId && !!branchId,
  });

  const accountingClosed = (accountingQ.data || []).some((s: any) => s.status === 'completed' || s.status === 'closed');

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      if (deleting.type === 'loading') {
        // حذف بنود ثم الجلسة (فقط إذا لم تُؤكَّد)
        await supabase.from('loading_session_items').delete().eq('session_id', deleting.id);
        const { error } = await supabase.from('loading_sessions').delete().eq('id', deleting.id).neq('status', 'completed');
        if (error) throw error;
      } else if (deleting.type === 'order') {
        await supabase.from('order_items').delete().eq('order_id', deleting.id);
        const { error } = await supabase.from('orders').delete().eq('id', deleting.id);
        if (error) throw error;
      } else if (deleting.type === 'receipt') {
        await supabase.from('stock_receipt_items').delete().eq('receipt_id', deleting.id);
        const { error } = await supabase.from('stock_receipts').delete().eq('id', deleting.id);
        if (error) throw error;
      }
      toast.success('تم الحذف');
      qc.invalidateQueries({ queryKey: ['warehouse-today-loadings'] });
      qc.invalidateQueries({ queryKey: ['warehouse-today-orders'] });
      qc.invalidateQueries({ queryKey: ['warehouse-today-receipts'] });
      qc.invalidateQueries({ queryKey: ['warehouse-stock'] });
    } catch (e: any) {
      toast.error(e.message || 'تعذّر الحذف');
    } finally {
      setDeleting(null);
    }
  };

  const isLoading = loadingQ.isLoading || ordersQ.isLoading || receiptsQ.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const loadings = loadingQ.data || [];
  const orders = ordersQ.data || [];
  const receipts = receiptsQ.data || [];
  const totalCount = loadings.length + orders.length + receipts.length;

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          إنجازات اليوم
          <Badge variant="secondary" className="text-[10px]">{totalCount}</Badge>
        </h3>
        {accountingClosed && (
          <Badge variant="destructive" className="text-[10px] gap-1">
            <Lock className="w-3 h-3" /> جلسة المحاسبة مُغلقة
          </Badge>
        )}
      </div>

      {totalCount === 0 && (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">لا توجد إنجازات اليوم بعد</CardContent></Card>
      )}

      {/* جلسات الشحن */}
      {loadings.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Truck className="w-3 h-3" /> شحنات للعمال ({loadings.length})
          </p>
          {loadings.map((s: any) => {
            const itemCount = s.loading_session_items?.length || 0;
            const totalQty = (s.loading_session_items || []).reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0);
            const isCompleted = s.status === 'completed';
            return (
              <Card key={s.id} className={isCompleted ? 'border-primary/30' : 'border-amber-300'}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{s.workers?.full_name || '—'}</div>
                    <div className="text-[10px] text-muted-foreground flex gap-2 flex-wrap">
                      <span>{itemCount} منتج</span>
                      <span>{totalQty.toFixed(2)} صندوق</span>
                      <span>{format(new Date(s.created_at), 'HH:mm', { locale: ar })}</span>
                    </div>
                  </div>
                  <Badge className={isCompleted ? 'bg-primary text-primary-foreground' : 'bg-amber-500 text-white'}>
                    {isCompleted ? 'مؤكّدة' : 'مفتوحة'}
                  </Badge>
                  {!isCompleted && !accountingClosed && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => setDeleting({ type: 'loading', id: s.id, label: `شحنة ${s.workers?.full_name}` })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* البيع المباشر */}
      {orders.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <ShoppingCart className="w-3 h-3" /> بيع مباشر ({orders.length})
          </p>
          {orders.map((o: any) => {
            const isPending = o.status === 'pending_branch' || o.status === 'pending_assistant';
            const canDelete = isPending && !accountingClosed;
            return (
              <Card key={o.id} className={isPending ? 'border-amber-300' : 'border-primary/30'}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{o.customers?.name || 'بدون زبون'}</div>
                    <div className="text-[10px] text-muted-foreground flex gap-2 flex-wrap">
                      <span>{Number(o.total_amount || 0).toLocaleString()} د.ج</span>
                      <span>{o.payment_type === 'with_invoice' ? 'بفاتورة' : 'بدون فاتورة'}</span>
                      <span>{format(new Date(o.created_at), 'HH:mm', { locale: ar })}</span>
                    </div>
                  </div>
                  <Badge variant={isPending ? 'outline' : 'default'} className="text-[10px]">
                    {o.status === 'pending_branch' ? 'بانتظار الفرع' :
                     o.status === 'pending_assistant' ? 'بانتظار الإدارة' :
                     o.status === 'delivered' ? 'مُسلّم' : o.status}
                  </Badge>
                  {canDelete && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => setDeleting({ type: 'order', id: o.id, label: `طلب ${o.customers?.name}` })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* الاستلامات */}
      {receipts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <PackagePlus className="w-3 h-3" /> استلامات من المصنع ({receipts.length})
          </p>
          {receipts.map((r: any) => {
            const totalQty = (r.total_quantity || []).reduce((s: number, it: any) => s + Number(it.quantity || 0), 0);
            const isPending = r.status === 'pending' || r.status === 'pending_branch' || r.status === 'pending_assistant';
            return (
              <Card key={r.id} className={isPending ? 'border-amber-300' : 'border-primary/30'}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">استلام #{String(r.id).slice(0, 8)}</div>
                    <div className="text-[10px] text-muted-foreground flex gap-2 flex-wrap">
                      <span>{totalQty.toFixed(2)} صندوق</span>
                      <span>{format(new Date(r.created_at), 'HH:mm', { locale: ar })}</span>
                    </div>
                  </div>
                  <Badge variant={isPending ? 'outline' : 'default'} className="text-[10px]">{r.status}</Badge>
                  {isPending && !accountingClosed && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => setDeleting({ type: 'receipt', id: r.id, label: `استلام #${String(r.id).slice(0, 8)}` })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف: <strong>{deleting?.label}</strong>. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WarehouseTodayAchievements;
