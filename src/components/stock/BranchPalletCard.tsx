import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  branchId: string;
}

const BranchPalletCard: React.FC<Props> = ({ branchId }) => {
  const [quantity, setQuantity] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPallets = useCallback(async () => {
    const { data } = await supabase
      .from('branch_pallets')
      .select('quantity')
      .eq('branch_id', branchId)
      .maybeSingle();
    setQuantity(data?.quantity || 0);
    setIsLoading(false);
  }, [branchId]);

  useEffect(() => { fetchPallets(); }, [fetchPallets]);

  if (isLoading) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🪵</span>
          <div>
            <div className="text-xs text-muted-foreground">رصيد الباليطات</div>
            <div className="text-xl font-bold text-amber-700 dark:text-amber-400">{quantity}</div>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground text-left max-w-[140px]">
          يُحدَّث تلقائياً عبر الاستلام والمراجعة فقط
        </div>
      </CardContent>
    </Card>
  );
};

export default BranchPalletCard;
