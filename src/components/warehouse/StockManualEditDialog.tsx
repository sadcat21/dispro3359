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
import { useLanguage } from '@/contexts/LanguageContext';
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

const sanitizeDigits = (value: string, maxDigits: number) => value.replace(/\D/g, '').slice(0, maxDigits);

/** Convert a DB-stored B.P value (e.g. 8.05) to {boxes:"8", pieces:"05"} */
const sourceValueToFields = (value: number, piecesPerBox: number): QuantityFields => {
  const parsed = parseBP(String(Math.round(value * 100) / 100), piecesPerBox);
  return {
    boxes: String(parsed.boxes),
    pieces: String(parsed.pieces).padStart(2, '0'),
  };
};

/** Convert {boxes, pieces} fields to a DB B.P number (e.g. 8.05) — NOT fractional boxes */
const fieldsToDbBP = (fields: QuantityFields, piecesPerBox: number): number => {
  const ppb = Math.max(1, Math.round(piecesPerBox));
  const boxesNum = parseInt(sanitizeDigits(fields.boxes, 5) || '0', 10);
  const piecesNum = parseInt(sanitizeDigits(fields.pieces, 3) || '0', 10);
  // normalize overflow pieces into boxes
  const totalPieces = boxesNum * ppb + piecesNum;
  const finalBoxes = Math.floor(totalPieces / ppb);
  const finalPieces = totalPieces % ppb;
  // DB B.P format: integer.pieces (always 2-digit pieces)
  return parseFloat(`${finalBoxes}.${String(finalPieces).padStart(2, '0')}`);
};

const normalizeFields = (fields: QuantityFields, piecesPerBox: number): QuantityFields => {
  const ppb = Math.max(1, Math.round(piecesPerBox));
  const boxesNum = parseInt(sanitizeDigits(fields.boxes, 5) || '0', 10);
  const piecesNum = parseInt(sanitizeDigits(fields.pieces, 3) || '0', 10);
  const totalPieces = boxesNum * ppb + piecesNum;
  const finalBoxes = Math.floor(totalPieces / ppb);
  const finalPieces = totalPieces % ppb;
  return {
    boxes: String(finalBoxes),
    pieces: String(finalPieces).padStart(2, '0'),
  };
};

const StockManualEditDialog: React.FC<StockManualEditDialogProps> = ({
  open, onOpenChange, productId, productName, branchId, piecesPerBox, currentValues,
}) => {
  const queryClient = useQueryClient();
  const { workerId } = useAuth();
  const { t, dir } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const FIELDS = [
    { key: 'remaining', label: t('warehouse.remaining'), color: 'text-primary' },
    { key: 'sold', label: t('warehouse.sold'), color: 'text-blue-600' },
    { key: 'gifts', label: t('warehouse.gifts'), color: 'text-green-600' },
    { key: 'damaged', label: t('warehouse.damaged'), color: 'text-destructive' },
    { key: 'factoryReturn', label: t('warehouse.returned'), color: 'text-violet-600' },
    { key: 'compensation', label: t('warehouse.compensation'), color: 'text-teal-600' },
    { key: 'surplus', label: t('warehouse.surplus'), color: 'text-amber-600' },
    { key: 'deficit', label: t('warehouse.deficit'), color: 'text-destructive' },
  ] as const;

  type FieldKey = typeof FIELDS[number]['key'];

  const [fieldValues, setFieldValues] = useState<Record<string, QuantityFields>>(() => {
    const init: Record<string, QuantityFields> = {};
    for (const f of FIELDS) init[f.key] = { boxes: '0', pieces: '00' };
    return init;
  });

  useEffect(() => {
    if (open) {
      const newVals: Record<string, QuantityFields> = {};
      for (const f of FIELDS) {
        newVals[f.key] = sourceValueToFields((currentValues as any)[f.key] || 0, piecesPerBox);
      }
      setFieldValues(newVals);
      setShowHistory(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentValues, piecesPerBox]);

  const fmt = (v: number) => dbBPDisplay(v, piecesPerBox);

  const handleFieldChange = (key: string, field: 'boxes' | 'pieces', value: string) => {
    setFieldValues(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: sanitizeDigits(value, field === 'boxes' ? 5 : 3) },
    }));
  };

  const handleFieldBlur = (key: string) => {
    setFieldValues(prev => ({
      ...prev,
      [key]: normalizeFields(prev[key], piecesPerBox),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const normalized: Record<string, QuantityFields> = {};
      const newDbValues: Record<string, number> = {};
      for (const f of FIELDS) {
        normalized[f.key] = normalizeFields(fieldValues[f.key], piecesPerBox);
        newDbValues[f.key] = fieldsToDbBP(normalized[f.key], piecesPerBox);
      }

      const changes: Record<string, { from: string; to: string }> = {};
      for (const f of FIELDS) {
        const oldDisplay = fmt((currentValues as any)[f.key] || 0);
        const newDisplay = fmt(newDbValues[f.key]);
        if (oldDisplay !== newDisplay) {
          changes[f.key] = { from: oldDisplay, to: newDisplay };
        }
      }

      if (Object.keys(changes).length === 0) {
        toast.info(t('warehouse.no_changes'));
        onOpenChange(false);
        return;
      }

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
            damaged_quantity: newDbValues.damaged,
            factory_return_quantity: newDbValues.factoryReturn,
            compensation_quantity: newDbValues.compensation,
            quantity: newDbValues.remaining,
          })
          .eq('id', wsRow.id);
      }

      await supabase
        .from('stock_discrepancies')
        .delete()
        .eq('branch_id', branchId)
        .eq('product_id', productId);

      const discrepancyRows: any[] = [];
      if (newDbValues.surplus > 0) {
        discrepancyRows.push({ branch_id: branchId, product_id: productId, discrepancy_type: 'surplus', quantity: newDbValues.surplus });
      }
      if (newDbValues.deficit > 0) {
        discrepancyRows.push({ branch_id: branchId, product_id: productId, discrepancy_type: 'deficit', quantity: newDbValues.deficit });
      }
      if (discrepancyRows.length > 0) {
        await supabase.from('stock_discrepancies').insert(discrepancyRows);
      }

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

      toast.success(t('warehouse.saved'));
      queryClient.invalidateQueries({ queryKey: ['warehouse-product-summary'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-sold-summary'] });
      queryClient.invalidateQueries({ queryKey: ['stock-edit-history'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={dir} className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm">{t('warehouse.manual_edit')} — {productName}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowHistory(!showHistory)}
              title={t('warehouse.edit_history')}
            >
              <History className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {showHistory ? (
          <StockEditHistory productId={productId} branchId={branchId} />
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-[80px_1fr_1fr_auto] gap-2 items-center px-1">
              <span />
              <span className="text-[10px] text-center font-semibold text-muted-foreground">{t('warehouse.boxes')}</span>
              <span className="text-[10px] text-center font-semibold text-muted-foreground">{t('warehouse.pieces')}</span>
              <span className="text-[10px] text-muted-foreground w-16 text-center">{t('warehouse.current')}</span>
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
              {saving ? t('warehouse.saving') : t('warehouse.save_edits')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StockManualEditDialog;
