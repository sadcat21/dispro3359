import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Loader2, ShoppingBag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import SalesHubDialog from '@/components/sales/SalesHubDialog';
import { useIsElementHidden } from '@/hooks/useUIOverrides';
import WorkerTruckStockList from '@/components/stock/WorkerTruckStockList';

const MyStock: React.FC = () => {
  const { t } = useLanguage();
  const { workerId } = useAuth();
  const [showSalesHubDialog, setShowSalesHubDialog] = useState(false);
  const isDirectSaleHidden = useIsElementHidden('button', 'stock_direct_sale');

  const { data: stockItems, isLoading } = useQuery({
    queryKey: ['my-worker-stock', workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_stock')
        .select('*, product:products(*)')
        .eq('worker_id', workerId!)
        .gte('quantity', 0);

      if (error) throw error;
      return data;
    },
    enabled: !!workerId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasStock = stockItems && stockItems.length > 0;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          {t('stock.my_stock')}
        </h2>
        {hasStock && !isDirectSaleHidden && (
          <Button size="sm" onClick={() => setShowSalesHubDialog(true)}>
            <ShoppingBag className="w-4 h-4 ml-1" />
            {t('stock.direct_sale')}
          </Button>
        )}
      </div>

      {!hasStock ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('stock.no_stock')}</p>
          </CardContent>
        </Card>
      ) : (
        <WorkerTruckStockList workerId={workerId!} emptyLabel={t('stock.no_stock')} />
      )}

      <SalesHubDialog
        open={showSalesHubDialog}
        onOpenChange={setShowSalesHubDialog}
        initialTab="direct"
        stockSource="worker"
        stockItems={(stockItems || []).map(s => ({
          id: s.id,
          product_id: s.product_id,
          quantity: s.quantity,
          product: (s as any).product,
        }))}
      />
    </div>
  );
};

export default MyStock;
