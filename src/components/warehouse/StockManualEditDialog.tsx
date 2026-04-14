import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { parseBP, dbBPDisplay, boxesToBP } from '@/utils/boxPieceInput';
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

interface QuantityFields {
  boxes: string;
  pieces: string;
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

const sanitizeDigits = (value: string, maxDigits: number) => value.replace(/\D/g, '').slice(0, maxDigits);

const quantityToFields = (quantity: number, piecesPerBox: number): QuantityFields => {
  const display = dbBPDisplay(quantity, piecesPerBox);
  const parsed = parseBP(display, piecesPerBox);
  return {
    boxes: String(parsed.boxes),
    pieces: String(parsed.pieces).padStart(2, '0'),
  };
};

const fieldsToQuantity = (fields: QuantityFields, piecesPerBox: number): number => {
  const boxes = sanitizeDigits(fields.boxes, 5) || '0';
  const pieces = sanitizeDigits(fields.pieces, 3) || '0';
  return parseBP(`${boxes}.${pieces}`, piecesPerBox).totalBoxes;
};

const normalizeFields = (fields: QuantityFields, piecesPerBox: number): QuantityFields => {
  const qty = fieldsToQuantity(fields, piecesPerBox);
  return quantityToFields(qty, piecesPerBox);
};

const StockManualEditDialog: React.FC<StockManualEditDialogProps> = ({
  open, onOpenChange, productId, productName, branchId, piecesPerBox, currentValues,
}) => {
  const queryClient = useQueryClient();
  const { workerId } = useAuth();
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<FieldKey, QuantityFields>>(() => {
    const init: Record<string, QuantityFields> = {};
    for (const f of FIELDS) init[f.key] = { boxes: '0', pieces: '00' };
    return init as Record<FieldKey, QuantityFields>;
  });

  useEffect(() => {
    if (open) {
      const newVals: Record<string, QuantityFields> = {};
      for (const f of FIELDS) {
        newVals[f.key] = quantityToFields((currentValues as any)[f.key] || 0, piecesPerBox);
      }
      setFieldValues(newVals as Record<FieldKey, QuantityFields>);
      setShowHistory(false);
    }
  }, [open, currentValues, piecesPerBox]);

  const fmt = (v: number) => dbBPDisplay(v, piecesPerBox);

  const handleFieldChange = (key: FieldKey, field: 'boxes' | 'pieces', value: string) => {
    setFieldValues(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: sanitizeDigits(value, field === 'boxes' ? 5 : 3) },
    }));
  };

  const handleFieldBlur = (key: FieldKey) => {
    setFieldValues(prev => ({
      ...prev,
      [key]: normalizeFields(prev[key], piecesPerBox),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Normalize all values first
      const normalized: Record<FieldKey, QuantityFields> = { ...fieldValues };
      for (const f of FIELDS) {
        normalized[f.key] = normalizeFields(fieldValues[f.key], piecesPerBox);
      }

      // Build changes log
      const changes: Record<string, { from: string; to: string }> = {};
      for (const f of FIELDS) {
        const oldDisplay = fmt((currentValues as any)[f.key] || 0);
        const newDisplay = boxesToBP(fieldsToQuantity(normalized[f.key], piecesPerBox), piecesPerBox);
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
            damaged_quantity: fieldsToQuantity(normalized.damaged, piecesPerBox),
            factory_return_quantity: fieldsToQuantity(normalized.factoryReturn, piecesPerBox),
            compensation_quantity: fieldsToQuantity(normalized.compensation, piecesPerBox),
            quantity: fieldsToQuantity(normalized.remaining, piecesPerBox),
          })
          .eq('id', wsRow.id);
      }

      // Update stock_discrepancies
      await supabase
        .from('stock_discrepancies')
        .delete()
        .eq('branch_id', branchId)
        .eq('product_id', productId);

      const newSurplus = fieldsToQuantity(normalized.surplus, piecesPerBox);
      const newDeficit = fieldsToQuantity(normalized.deficit, piecesPerBox);
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
      <DialogContent dir="rtl" className="max-w-md">
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
          <div className="space-y-2.5">
            {/* Header */}
            <div className="grid grid-cols-[80px_1fr_1fr_auto] gap-2 items-center px-1">
              <span />
              <span className="text-[10px] text-center font-semibold text-muted-foreground">الصندوق</span>
              <span className="text-[10px] text-center font-semibold text-muted-foreground">القطع</span>
              <span className="text-[10px] text-muted-foreground w-16 text-center">الحالي</span>
            </div>

            {FIELDS.map(f => (
              <div key={f.key} className="grid grid-cols-[80px_1fr_1fr_auto] gap-2 items-center">
                <Label className={`text-xs shrink-0 font-semibold ${f.color}`}>{f.label}</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  className="h-9 text-center font-bold [font-variant-numeric:tabular-nums]"
                  value={fieldValues[f.key].boxes}
                  onChange={e => handleFieldChange(f.key, 'boxes', e.target.value)}
                  onBlur={() => handleFieldBlur(f.key)}
                  placeholder="0"
                />
                <Input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  className="h-9 text-center font-bold [font-variant-numeric:tabular-nums]"
                  value={fieldValues[f.key].pieces}
                  onChange={e => handleFieldChange(f.key, 'pieces', e.target.value)}
                  onBlur={() => handleFieldBlur(f.key)}
                  placeholder="00"
                />
                <span className="text-[10px] text-muted-foreground w-16 text-center whitespace-nowrap">
                  {fmt((currentValues as any)[f.key] || 0)}
                </span>
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
