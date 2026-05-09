import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Customer } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, Phone, MapPin, Store, ShoppingCart, Wallet, AlertCircle, CheckCircle2, Footprints, PackageX, X, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAmount } from '@/utils/formatters';
const formatCurrency = (n: number) => `${formatAmount(n)} دج`;

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

      return {
        totalPurchases, totalOrders,
        totalDebt, remainingDebt, paidDebt,
        visitsNoOrder, visitsNoCollection,
      };
    },
  });

  if (!customer) return null;

  const storeName = (language !== 'ar' && (customer as any).store_name_fr) ? (customer as any).store_name_fr : customer.store_name;
  const displayName = (language !== 'ar' && (customer as any).name_fr) ? (customer as any).name_fr : customer.name;
  const initial = (storeName || displayName || '?').charAt(0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto h-[92vh] max-h-[92vh] p-0 gap-0 rounded-3xl overflow-hidden flex flex-col" dir={dir}>
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
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerQuickProfileDialog;