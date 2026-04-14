import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { parseBP, dbBPDisplay } from '@/utils/boxPieceInput';
import { useAuth } from '@/contexts/AuthContext';
import { History } from 'lucide-react';
import StockEditHistory from './StockEditHistory';

interface StockManualEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  branchId: string;
  piecesPerBox: number;
  currentValues: {
    gifts: number;
    damaged: number;
    factoryReturn: number;
    compensation: number;
    surplus: number;
    deficit: number;
    sold: number;
    remaining?: number;
  };
}

const FIELDS = [
  { key: 'remaining', label: 'المتبقي', color: 'text-primary' },
  { key: 'sold', label: 'المباع', color: 'text-blue-600' },
  { key: 'gifts', label: 'الهدايا', color: 'text-green-600' },
  { key: 'damaged', label: 'التالف', color: 'text-destructive' },
  { key: 'factoryReturn', label: 'المسترجع', color: 'text-violet-600' },
  { key: 'compensation', label: 'التعويض', color: 'text-teal-600' },
  { key: 'surplus', label: 'الفائض', color: 'text-amber-600' },
  { key: 'deficit', label: 'العجز', color: 'text-destructive' },
] as const;

type FieldKey = typeof FIELDS[number]['key'];

/** Normalize a B.P value string using piecesPerBox rules */
const normalizeBP = (raw: string, ppb: number): string => {
  const parsed = parseBP(raw, ppb);
  return parsed.display;
};

const StockManualEditDialog: React.FC<StockManualEditDialogProps> = ({
  open, onOpenChange, productId, productName, branchId, piecesPerBox, currentValues,
}) => {
  const queryClient = useQueryClient();
  const { workerId } = useAuth();
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [values, setValues] = useState<Record<FieldKey, string>>({
    damaged: '0', factoryReturn: '0', compensation: '0',
    surplus: '0', deficit: '0', remaining: '0', sold: '0', gifts: '0',
  });

  useEffect(() => {
    if (open) {
      const toDisplay = (v: number) => dbBPDisplay(v, piecesPerBox);
      setValues({
        damaged: toDisplay(currentValues.damaged || 0),
        factoryReturn: toDisplay(currentValues.factoryReturn || 0),
        compensation: toDisplay(currentValues.compensation || 0),
        surplus: toDisplay(currentValues.surplus || 0),
        deficit: toDisplay(currentValues.deficit || 0),
        remaining: toDisplay(currentValues.remaining || 0),
        sold: toDisplay(currentValues.sold || 0),
        gifts: toDisplay(currentValues.gifts || 0),
      });
      setShowHistory(false);
    }
  }, [open, currentValues, piecesPerBox]);

  const fmt = (v: number) => dbBPDisplay(v, piecesPerBox);

  /** On blur, normalize the value (e.g. 46.20 with ppb=20 → 47) */
  const handleBlur = (key: FieldKey) => {
    setValues(prev => ({
      ...prev,
      [key]: normalizeBP(prev[key], piecesPerBox),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Normalize all values first
      const normalized: Record<FieldKey, string> = { ...values };
      for (const f of FIELDS) {
        normalized[f.key] = normalizeBP(values[f.key], piecesPerBox);
      }

      // Build changes log
      const changes: Record<string, { from: string; to: string }> = {};
      for (const f of FIELDS) {
        const oldDisplay = fmt((currentValues as any)[f.key] || 0);
        const newDisplay = normalized[f.key];
        if (oldDisplay !== newDisplay) {
          changes[f.key] = { from: oldDisplay, to: newDisplay };
        }
      }

      if (Object.keys(changes).length === 0) {
        toast.info('لا توجد تغييرات');
        onOpenChange(false);
        return;
      }

      // Update warehouse_stock
      const { data: wsRow } = await supabase
        .from('warehouse_stock')
        .select('id')
        .eq('branch_id', branchId)
        .eq('product_id', productId)
        .single();

      if (wsRow) {
        await supabase
          .from('warehouse_stock')
          .update({
            damaged_quantity: parseBP(normalized.damaged, piecesPerBox).totalBoxes,
            factory_return_quantity: parseBP(normalized.factoryReturn, piecesPerBox).totalBoxes,
            compensation_quantity: parseBP(normalized.compensation, piecesPerBox).totalBoxes,
            quantity: parseBP(normalized.remaining, piecesPerBox).totalBoxes,
          })
          .eq('id', wsRow.id);
      }

      // Update stock_discrepancies
      await supabase
        .from('stock_discrepancies')
        .delete()
        .eq('branch_id', branchId)
        .eq('product_id', productId);

      const newSurplus = parseBP(normalized.surplus, piecesPerBox).totalBoxes;
      const newDeficit = parseBP(normalized.deficit, piecesPerBox).totalBoxes;
      const discrepancyRows: any[] = [];
      if (newSurplus > 0) {
        discrepancyRows.push({ branch_id: branchId, product_id: productId, discrepancy_type: 'surplus', quantity: newSurplus });
      }
      if (newDeficit > 0) {
        discrepancyRows.push({ branch_id: branchId, product_id: productId, discrepancy_type: 'deficit', quantity: newDeficit });
      }
      if (discrepancyRows.length > 0) {
        await supabase.from('stock_discrepancies').insert(discrepancyRows);
      }

      // Log changes
      if (workerId) {
        await supabase.from('activity_logs').insert({
          worker_id: workerId,
          action_type: 'manual_stock_edit',
          entity_type: 'warehouse_stock_manual_edit',
          entity_id: productId,
          branch_id: branchId,
          details: { product_name: productName, changes },
        });
      }

      toast.success('تم حفظ التعديلات');
      queryClient.invalidateQueries({ queryKey: ['warehouse-product-summary'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-sold-summary'] });
      queryClient.invalidateQueries({ queryKey: ['stock-edit-history'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm">تعديل يدوي — {productName}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowHistory(!showHistory)}
              title="سجل التعديلات"
            >
              <History className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {showHistory ? (
          <StockEditHistory productId={productId} branchId={branchId} />
        ) : (
          <div className="space-y-3">
            {FIELDS.map(f => (
              <div key={f.key} className="flex items-center gap-3">
                <Label className={`w-20 text-xs shrink-0 ${f.color}`}>{f.label}</Label>
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    dir="ltr"
                    type="text"
                    inputMode="decimal"
                    className="text-left [direction:ltr] h-9"
                    value={values[f.key]}
                    onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                    onBlur={() => handleBlur(f.key)}
                  />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    الحالي: {fmt((currentValues as any)[f.key] || 0)}
                  </span>
                </div>
              </div>
            ))}
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StockManualEditDialog;
