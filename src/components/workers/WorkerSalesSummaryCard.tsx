import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { TrendingUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface WorkerSalesSummaryCardProps {
  onOpenSalesSummary?: () => void;
}

const WorkerSalesSummaryCard: React.FC<WorkerSalesSummaryCardProps> = ({ onOpenSalesSummary }) => {
  const { workerId } = useAuth();
  const { t } = useLanguage();

  const { data, isLoading } = useQuery({
    queryKey: ['worker-since-session-sales-summary', workerId],
    queryFn: async () => {
      // Find last completed accounting session for this worker
      const { data: lastSession } = await supabase
        .from('accounting_sessions')
        .select('completed_at, period_end')
        .eq('worker_id', workerId!)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const sinceTs = lastSession?.completed_at || lastSession?.period_end || null;

      // Get delivered movements since last session (or all if none)
      let movementsQuery = supabase
        .from('stock_movements')
        .select('order_id')
        .eq('worker_id', workerId!)
        .eq('movement_type', 'delivery')
        .eq('status', 'approved');
      if (sinceTs) movementsQuery = movementsQuery.gte('created_at', sinceTs);
      const { data: movements } = await movementsQuery;

      const orderIds = Array.from(new Set((movements || []).map(m => m.order_id).filter(Boolean)));
      if (orderIds.length === 0) return { totalSales: 0, paidAmount: 0, newDebts: 0, orderCount: 0 };

      const { data: orders } = await supabase
        .from('orders')
        .select('id, total_amount, payment_status, partial_amount')
        .in('id', orderIds)
        .eq('status', 'delivered');

      if (!orders || orders.length === 0) return { totalSales: 0, paidAmount: 0, newDebts: 0, orderCount: 0 };

      let totalSales = 0;
      let paidAmount = 0;
      let newDebts = 0;

      for (const o of orders) {
        const total = Number(o.total_amount || 0);
        totalSales += total;

        if (o.payment_status === 'cash' || o.payment_status === 'paid') {
          paidAmount += total;
        } else if (o.payment_status === 'partial') {
          const partial = Number(o.partial_amount || 0);
          paidAmount += partial;
          newDebts += total - partial;
        } else if (o.payment_status === 'credit' || o.payment_status === 'pending') {
          newDebts += total;
        } else if (o.payment_status === 'check') {
          paidAmount += total;
        }
      }

      return { totalSales, paidAmount, newDebts, orderCount: orders.length };
    },
    enabled: !!workerId,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  if (isLoading) {
    return (
      <div className="px-4 mt-3">
        <Button variant="outline" disabled className="w-full h-12">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </Button>
      </div>
    );
  }

  if (!data || data.orderCount === 0) return null;

  return (
    <div className="px-4 mt-3">
      <Button
        onClick={onOpenSalesSummary}
        className="w-full h-12 gap-2 font-bold border border-primary/20 bg-gradient-to-br from-background to-muted/30 text-foreground hover:shadow-md"
        variant="outline"
      >
        <TrendingUp className="w-4 h-4 text-primary" />
        <span>ملخص المبيعات</span>
        <Badge variant="secondary" className="text-[10px] ms-1">
          {data.orderCount}
        </Badge>
      </Button>
    </div>
  );
};

export default WorkerSalesSummaryCard;
