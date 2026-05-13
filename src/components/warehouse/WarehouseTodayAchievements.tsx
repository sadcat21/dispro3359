import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Truck, ShoppingCart, PackagePlus, ClipboardCheck, Trash2, Lock, Calendar, Eye, Repeat, Landmark, HandCoins, Filter, Gift, Package, X, Search } from 'lucide-react';
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [tempSelectedIds, setTempSelectedIds] = useState<Set<string>>(new Set());
  const [productSearch, setProductSearch] = useState('');

  // قائمة المنتجات لنافذة الفلترة
  const productsQ = useQuery({
    queryKey: ['warehouse-achievements-products', branchId],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, app_name, image_url')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    enabled: filterOpen,
  });

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
        .select(`
          *,
          customer:customer_id(id, name, phone, address),
          order_items(
            id, product_id, quantity, unit_price, total_price, gift_quantity, gift_pieces, pricing_unit,
            product:product_id(id, name, app_name, image_url, price_gros, price_retail, pieces_per_box, pricing_unit)
          )
        `)
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

  // 5) المراجعة النهائية اليوم
  const reviewsQ = useQuery({
    queryKey: ['warehouse-today-reviews', workerId, branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_review_sessions')
        .select('id, status, created_at, completed_at, total_products, total_discrepancies')
        .eq('reviewer_id', workerId!)
        .eq('branch_id', branchId)
        .gte('created_at', todayStart())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!workerId && !!branchId,
  });

  // 6) الاستبدالات اليوم (حركات مخزون من نوع exchange)
  const exchangesQ = useQuery({
    queryKey: ['warehouse-today-exchanges', workerId, branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('id, quantity, notes, status, created_at, products:product_id(name)')
        .eq('movement_type', 'exchange')
        .eq('branch_id', branchId)
        .eq('created_by', workerId!)
        .gte('created_at', todayStart())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!workerId && !!branchId,
  });

  // 7) ديون جديدة أنشأها مدير المخزن اليوم
  const newDebtsQ = useQuery({
    queryKey: ['warehouse-today-new-debts', workerId, branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_debts')
        .select('id, total_amount, remaining_amount, status, created_at, customer:customer_id(name)')
        .eq('worker_id', workerId!)
        .eq('branch_id', branchId)
        .gte('created_at', todayStart())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!workerId && !!branchId,
  });

  // 8) تحصيلات الديون اليوم
  const debtCollectionsQ = useQuery({
    queryKey: ['warehouse-today-debt-collections', workerId, branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('debt_payments')
        .select('id, amount, payment_method, notes, created_at, debt:debt_id(customer:customer_id(name), branch_id)')
        .eq('worker_id', workerId!)
        .gte('created_at', todayStart())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).filter((p: any) => !branchId || p.debt?.branch_id === branchId);
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

  const isLoading = loadingQ.isLoading || ordersQ.isLoading || receiptsQ.isLoading || reviewsQ.isLoading || exchangesQ.isLoading || newDebtsQ.isLoading || debtCollectionsQ.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const allLoadings = loadingQ.data || [];
  const allOrders = ordersQ.data || [];
  const receipts = receiptsQ.data || [];
  const reviews = reviewsQ.data || [];
  const allExchanges = exchangesQ.data || [];
  const newDebts = newDebtsQ.data || [];
  const debtCollections = debtCollectionsQ.data || [];

  const hasFilter = selectedProductIds.size > 0;
  const matchProduct = (pid?: string | null) => !!pid && selectedProductIds.has(pid);
  const orders = hasFilter
    ? allOrders.filter((o: any) => (o.order_items || []).some((it: any) => matchProduct(it.product_id)))
    : allOrders;
  const loadings = hasFilter
    ? allLoadings.filter((s: any) => (s.loading_session_items || []).some((it: any) => matchProduct(it.products?.id ?? it.product_id)))
    : allLoadings;
  const exchanges = hasFilter
    ? allExchanges.filter((ex: any) => matchProduct(ex.products?.id ?? ex.product_id))
    : allExchanges;
  // عند تفعيل فلتر المنتج: نُخفي الأقسام التي لا علاقة لها بالمنتجات
  const visibleReceipts = hasFilter ? [] : receipts;
  const visibleReviews = hasFilter ? [] : reviews;
  const visibleNewDebts = hasFilter ? [] : newDebts;
  const visibleDebtCollections = hasFilter ? [] : debtCollections;
  const totalCount = loadings.length + orders.length + visibleReceipts.length + visibleReviews.length + exchanges.length + visibleNewDebts.length + visibleDebtCollections.length;

  const products = (productsQ.data || []) as any[];
  const filteredProducts = products.filter((p: any) => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.app_name || '').toLowerCase().includes(q);
  });
  const selectedProductsList = products.filter((p: any) => selectedProductIds.has(p.id));

  const openFilter = () => {
    setTempSelectedIds(new Set(selectedProductIds));
    setProductSearch('');
    setFilterOpen(true);
  };
  const applyFilter = () => {
    setSelectedProductIds(new Set(tempSelectedIds));
    setFilterOpen(false);
  };
  const clearFilter = () => {
    setSelectedProductIds(new Set());
    setTempSelectedIds(new Set());
  };
  const toggleTemp = (id: string) => {
    setTempSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-base font-bold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          إنجازات اليوم
          <Badge variant="secondary" className="text-[10px]">{totalCount}</Badge>
        </h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={hasFilter ? 'default' : 'outline'} className="h-8 gap-1" onClick={openFilter}>
            <Filter className="w-3.5 h-3.5" />
            <span className="text-xs">فلترة حسب المنتج</span>
            {hasFilter && <Badge variant="secondary" className="ms-1 text-[10px]">{selectedProductIds.size}</Badge>}
          </Button>
          {hasFilter && (
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={clearFilter} title="مسح الفلتر">
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
          {accountingClosed && (
            <Badge variant="destructive" className="text-[10px] gap-1">
              <Lock className="w-3 h-3" /> جلسة المحاسبة مُغلقة
            </Badge>
          )}
        </div>
      </div>

      {hasFilter && selectedProductsList.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedProductsList.map((p: any) => (
            <Badge key={p.id} variant="secondary" className="text-[10px] gap-1">
              {p.app_name || p.name}
              <button onClick={() => { const n = new Set(selectedProductIds); n.delete(p.id); setSelectedProductIds(n); }}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

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
            const total = Number(o.total_amount || 0);
            const paid = Number(o.paid_amount ?? o.amount_paid ?? 0);
            const remaining = Math.max(0, total - paid);
            const itemsCount = (o.order_items || []).length;
            return (
              <Card key={o.id} className={isPending ? 'border-amber-300' : 'border-primary/30'}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{o.customer?.name || 'بدون زبون'}</div>
                    <div className="text-[10px] text-muted-foreground flex gap-2 flex-wrap mt-0.5">
                      <span className="font-semibold text-foreground">{total.toLocaleString()} د.ج</span>
                      {paid > 0 && <span className="text-emerald-600">مدفوع: {paid.toLocaleString()}</span>}
                      {remaining > 0 && <span className="text-destructive">متبقي: {remaining.toLocaleString()}</span>}
                      <span>{itemsCount} منتج</span>
                      <span>{o.payment_type === 'with_invoice' ? 'بفاتورة' : 'بدون فاتورة'}</span>
                      <span>{format(new Date(o.created_at), 'HH:mm', { locale: ar })}</span>
                    </div>
                  </div>
                  <Badge variant={isPending ? 'outline' : 'default'} className="text-[10px]">
                    {o.status === 'pending_branch' ? 'بانتظار الفرع' :
                     o.status === 'pending_assistant' ? 'بانتظار الإدارة' :
                     o.status === 'delivered' ? 'مُسلّم' : o.status}
                  </Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-primary"
                    onClick={() => setSelectedOrder(o as OrderWithDetails)} title="عرض التفاصيل">
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  {canDelete && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => setDeleting({ type: 'order', id: o.id, label: `طلب ${o.customer?.name || ''}` })}>
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
      {visibleReceipts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <PackagePlus className="w-3 h-3" /> استلامات من المصنع ({visibleReceipts.length})
          </p>
          {visibleReceipts.map((r: any) => {
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

      {/* المراجعة النهائية */}
      {visibleReviews.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <ClipboardCheck className="w-3 h-3" /> المراجعة النهائية ({visibleReviews.length})
          </p>
          {visibleReviews.map((rv: any) => {
            const isCompleted = rv.status === 'completed';
            return (
              <Card key={rv.id} className={isCompleted ? 'border-primary/30' : 'border-amber-300'}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">جلسة مراجعة #{String(rv.id).slice(0, 8)}</div>
                    <div className="text-[10px] text-muted-foreground flex gap-2 flex-wrap">
                      <span>{Number(rv.total_products || 0)} منتج</span>
                      <span>{Number(rv.total_discrepancies || 0)} فرق</span>
                      <span>{format(new Date(rv.created_at), 'HH:mm', { locale: ar })}</span>
                    </div>
                  </div>
                  <Badge className={isCompleted ? 'bg-primary text-primary-foreground' : 'bg-amber-500 text-white'}>
                    {isCompleted ? 'مكتملة' : rv.status}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* الاستبدالات */}
      {exchanges.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Repeat className="w-3 h-3" /> استبدالات ({exchanges.length})
          </p>
          {exchanges.map((ex: any) => (
            <Card key={ex.id} className="border-primary/30">
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{ex.products?.name || 'استبدال'}</div>
                  <div className="text-[10px] text-muted-foreground flex gap-2 flex-wrap">
                    <span>{Number(ex.quantity || 0).toFixed(2)}</span>
                    {ex.notes && <span className="truncate max-w-[180px]">{ex.notes}</span>}
                    <span>{format(new Date(ex.created_at), 'HH:mm', { locale: ar })}</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">{ex.status || 'completed'}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ديون جديدة */}
      {visibleNewDebts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Landmark className="w-3 h-3" /> ديون جديدة ({visibleNewDebts.length})
          </p>
          {visibleNewDebts.map((d: any) => (
            <Card key={d.id} className="border-destructive/30">
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{d.customer?.name || 'بدون زبون'}</div>
                  <div className="text-[10px] text-muted-foreground flex gap-2 flex-wrap">
                    <span className="font-semibold text-destructive">{Number(d.total_amount || 0).toLocaleString()} د.ج</span>
                    {Number(d.remaining_amount || 0) > 0 && <span>متبقي: {Number(d.remaining_amount).toLocaleString()}</span>}
                    <span>{format(new Date(d.created_at), 'HH:mm', { locale: ar })}</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* تحصيل ديون */}
      {visibleDebtCollections.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <HandCoins className="w-3 h-3" /> تحصيل ديون ({visibleDebtCollections.length})
          </p>
          {visibleDebtCollections.map((p: any) => (
            <Card key={p.id} className="border-emerald-300">
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.debt?.customer?.name || 'بدون زبون'}</div>
                  <div className="text-[10px] text-muted-foreground flex gap-2 flex-wrap">
                    <span className="font-semibold text-emerald-600">{Number(p.amount || 0).toLocaleString()} د.ج</span>
                    {p.payment_method && <span>{p.payment_method}</span>}
                    <span>{format(new Date(p.created_at), 'HH:mm', { locale: ar })}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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

      <OrderDetailsDialog
        open={!!selectedOrder}
        onOpenChange={(o) => !o && setSelectedOrder(null)}
        order={selectedOrder}
        hideModifyAction
      />
    </div>
  );
};

export default WarehouseTodayAchievements;
