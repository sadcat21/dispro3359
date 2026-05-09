import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Customer } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, Phone, MapPin, Store, ShoppingCart, Wallet, AlertCircle, CheckCircle2, Footprints, PackageX, X, TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAmount } from '@/utils/formatters';
const formatCurrency = (n: number) => `${formatAmount(n)} دج`;
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useState, useMemo } from 'react';

interface CustomerQuickProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
}

const StatCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  tone?: 'primary' | 'success' | 'danger' | 'warning' | 'neutral';
  className?: string;
}> = ({ icon: Icon, label, value, tone = 'neutral', className }) => {
  const tones: Record<string, string> = {
    primary: 'from-primary/15 to-primary/5 text-primary border-primary/30',
    success: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 border-emerald-500/30',
    danger: 'from-destructive/15 to-destructive/5 text-destructive border-destructive/30',
    warning: 'from-amber-500/15 to-amber-500/5 text-amber-600 border-amber-500/30',
    neutral: 'from-muted to-background text-foreground border-border',
  };
  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl border bg-gradient-to-br p-3 shadow-sm',
      tones[tone],
      className,
    )}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-4 h-4" />
        <span className="text-[11px] font-semibold opacity-80 line-clamp-1">{label}</span>
      </div>
      <div className="text-base font-extrabold leading-tight text-foreground break-all">{value}</div>
    </div>
  );
};

const CustomerQuickProfileDialog: React.FC<CustomerQuickProfileDialogProps> = ({ open, onOpenChange, customer }) => {
  const { dir, language } = useLanguage();
  const [chartMode, setChartMode] = useState<'total' | 'weekly' | 'monthly'>('total');

  const { data, isLoading } = useQuery({
    queryKey: ['customer-quick-profile', customer?.id],
    enabled: open && !!customer?.id,
    queryFn: async () => {
      const cid = customer!.id;
      const [ordersRes, debtsRes, collectionsRes, visitsRes] = await Promise.all([
        supabase.from('orders').select('id,total_amount,status').eq('customer_id', cid),
        supabase.from('customer_debts').select('total_amount,paid_amount,remaining_amount,status').eq('customer_id', cid),
        supabase.from('debt_collections').select('amount_collected').in('debt_id',
          (await supabase.from('customer_debts').select('id').eq('customer_id', cid)).data?.map((d: any) => d.id) || ['00000000-0000-0000-0000-000000000000']
        ),
        supabase.from('visit_tracking').select('operation_type').eq('customer_id', cid),
      ]);

      const orders = ordersRes.data || [];
      const debts = debtsRes.data || [];
      const collections = collectionsRes.data || [];
      const visits = visitsRes.data || [];

      const totalPurchases = orders.reduce((s, o: any) => s + Number(o.total_amount || 0), 0);
      const totalOrders = orders.length;

      const totalDebt = debts.reduce((s, d: any) => s + Number(d.total_amount || 0), 0);
      const remainingDebt = debts.reduce((s, d: any) => s + Number(d.remaining_amount || 0), 0);
      const paidDebt = debts.reduce((s, d: any) => s + Number(d.paid_amount || 0), 0);

      const visitsNoOrder = visits.filter((v: any) => v.operation_type === 'visit').length;
      const visitsNoCollection = visits.filter((v: any) => v.operation_type === 'delivery_visit').length;

      // Products aggregation
      const orderIds = orders.map((o: any) => o.id);
      let productsAgg: { name: string; quantity: number; firstAt: string; lastAt: string }[] = [];
      if (orderIds.length) {
        const { data: items } = await supabase
          .from('order_items')
          .select('product_id, quantity, created_at, products(name)')
          .in('order_id', orderIds);
        const map = new Map<string, { name: string; quantity: number; firstAt: string; lastAt: string }>();
        (items || []).forEach((it: any) => {
          const key = it.product_id || 'unknown';
          const name = it.products?.name || 'منتج';
          const ex = map.get(key);
          const at = it.created_at || new Date().toISOString();
          if (ex) {
            ex.quantity += Number(it.quantity || 0);
            if (at < ex.firstAt) ex.firstAt = at;
            if (at > ex.lastAt) ex.lastAt = at;
          } else {
            map.set(key, { name, quantity: Number(it.quantity || 0), firstAt: at, lastAt: at });
          }
        });
        productsAgg = Array.from(map.values());
      }

      return {
        totalPurchases, totalOrders,
        totalDebt, remainingDebt, paidDebt,
        visitsNoOrder, visitsNoCollection,
        productsAgg,
      };
    },
  });

  if (!customer) return null;

  const storeName = (language !== 'ar' && (customer as any).store_name_fr) ? (customer as any).store_name_fr : customer.store_name;
  const displayName = (language !== 'ar' && (customer as any).name_fr) ? (customer as any).name_fr : customer.name;
  const initial = (storeName || displayName || '?').charAt(0);

  const chartData = useMemo(() => {
    if (!data?.productsAgg) return [];
    const now = Date.now();
    return data.productsAgg.map((p) => {
      const spanDays = Math.max(1, (now - new Date(p.firstAt).getTime()) / (1000 * 60 * 60 * 24));
      const weeks = Math.max(1, spanDays / 7);
      const months = Math.max(1, spanDays / 30);
      const value = chartMode === 'total'
        ? p.quantity
        : chartMode === 'weekly'
          ? +(p.quantity / weeks).toFixed(1)
          : +(p.quantity / months).toFixed(1);
      return { name: p.name.length > 10 ? p.name.slice(0, 10) + '…' : p.name, value };
    }).sort((a, b) => b.value - a.value).slice(0, 12);
  }, [data, chartMode]);

  const barColors = ['hsl(var(--primary))', 'hsl(var(--destructive))', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto h-[92vh] max-h-[92vh] p-0 gap-0 rounded-3xl overflow-hidden flex flex-col [&>button.absolute]:hidden" dir={dir}>
        <DialogHeader className="sr-only">
          <DialogTitle>{storeName || displayName}</DialogTitle>
        </DialogHeader>

        {/* Hero header */}
        <div className="relative bg-gradient-to-br from-primary via-primary to-primary/70 text-primary-foreground px-5 pt-5 pb-8">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 end-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center backdrop-blur"
            aria-label="close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl font-black ring-2 ring-white/30">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-extrabold leading-tight line-clamp-1">{storeName || displayName}</h2>
              {storeName && displayName && (
                <p className="text-sm opacity-90 line-clamp-1">{displayName}</p>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs opacity-95">
                {customer.phone && (
                  <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{customer.phone}</span>
                )}
                {customer.wilaya && (
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{customer.wilaya}</span>
                )}
              </div>
            </div>
          </div>
          {customer.address && (
            <div className="mt-3 text-xs bg-white/15 backdrop-blur rounded-xl px-3 py-2 line-clamp-2">
              <Store className="w-3 h-3 inline-block me-1" />
              {customer.address}
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 -mt-4">
          <div className="bg-background rounded-t-3xl p-4 pt-5 space-y-4">
            {isLoading || !data ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Purchases */}
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-primary" /> المشتريات
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard icon={ShoppingCart} label="حجم المشتريات" value={formatCurrency(data.totalPurchases)} tone="primary" />
                    <StatCard icon={ShoppingCart} label="عدد الطلبات" value={data.totalOrders} tone="neutral" />
                  </div>
                </div>

                {/* Debts */}
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-destructive" /> الديون
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    <StatCard icon={AlertCircle} label="الدين الحالي" value={formatCurrency(data.remainingDebt)} tone="danger" />
                    <StatCard icon={Wallet} label="إجمالي الدين" value={formatCurrency(data.totalDebt)} tone="warning" />
                    <StatCard icon={CheckCircle2} label="المدفوع" value={formatCurrency(data.paidDebt)} tone="success" />
                  </div>
                </div>

                {/* Visits */}
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
                    <Footprints className="w-4 h-4 text-amber-600" /> الزيارات
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard icon={PackageX} label="زيارات بدون طلبية" value={data.visitsNoOrder} tone="warning" />
                    <StatCard icon={Wallet} label="زيارات بدون تحصيل" value={data.visitsNoCollection} tone="warning" />
                  </div>
                </div>

                {/* Products chart */}
                <div>
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-primary" /> المنتجات
                    </h3>
                    <div className="inline-flex bg-muted rounded-full p-0.5 text-[11px] font-bold">
                      {([
                        ['total', 'الإجمالي'],
                        ['weekly', 'أسبوعي'],
                        ['monthly', 'شهري'],
                      ] as const).map(([k, l]) => (
                        <button
                          key={k}
                          onClick={() => setChartMode(k)}
                          className={cn(
                            'px-2.5 py-1 rounded-full transition-all',
                            chartMode === k ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  {chartData.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-6 rounded-2xl bg-muted/40 border border-dashed">
                      لا توجد بيانات منتجات
                    </div>
                  ) : (
                    <div className="rounded-2xl border bg-gradient-to-br from-card to-muted/40 p-2 pt-3 shadow-sm">
                      <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 28)}>
                        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                          <XAxis type="number" hide />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={80}
                            tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                            contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', fontSize: 12 }}
                            formatter={(v: any) => [v, chartMode === 'total' ? 'الكمية' : chartMode === 'weekly' ? 'متوسط/أسبوع' : 'متوسط/شهر']}
                          />
                          <Bar dataKey="value" radius={[6, 6, 6, 6]} barSize={16}>
                            {chartData.map((_, i) => (
                              <Cell key={i} fill={barColors[i % barColors.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerQuickProfileDialog;