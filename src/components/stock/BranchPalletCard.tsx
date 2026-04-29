import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Minus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Props {
  branchId: string;
}

const BranchPalletCard: React.FC<Props> = ({ branchId }) => {
  const { workerId } = useAuth();
  const [quantity, setQuantity] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustNotes, setAdjustNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const handleAdjust = async () => {
    if (adjustAmount <= 0) { toast.error('أدخل كمية صحيحة'); return; }
    if (adjustType === 'subtract' && adjustAmount > quantity) {
      toast.error('الكمية أكبر من الرصيد المتاح'); return;
    }

    setIsSaving(true);
    try {
      const newQty = adjustType === 'add' ? quantity + adjustAmount : quantity - adjustAmount;

      // Upsert branch_pallets
      const { data: existing } = await supabase
        .from('branch_pallets')
        .select('id')
        .eq('branch_id', branchId)
        .maybeSingle();

      if (existing) {
        await supabase.from('branch_pallets').update({ quantity: newQty }).eq('id', existing.id);
      } else {
        await supabase.from('branch_pallets').insert({ branch_id: branchId, quantity: newQty });
      }

      // Log movement
      await supabase.from('pallet_movements').insert({
        branch_id: branchId,
        quantity: adjustType === 'add' ? adjustAmount : -adjustAmount,
        movement_type: adjustType === 'add' ? 'manual_add' : 'manual_subtract',
        notes: adjustNotes || (adjustType === 'add' ? 'إضافة يدوية' : 'خصم يدوي'),
        created_by: workerId,
      });

      setQuantity(newQty);
      setShowDialog(false);
      setAdjustAmount(0);
      setAdjustNotes('');
      toast.success('تم تحديث رصيد الباليطات');
    } catch (e: any) {
      toast.error(e.message || 'خطأ');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return null;

  return (
    <>
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

    </>
  );
};

export default BranchPalletCard;
