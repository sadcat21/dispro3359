import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Loader2, Trash2, Search, Package } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { WarehouseStockItem } from '@/hooks/useWarehouseStock';

interface StockEmptyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseStock: WarehouseStockItem[];
  branchId: string | undefined;
  onComplete: () => void;
}

const StockEmptyDialog: React.FC<StockEmptyDialogProps> = ({
  open, onOpenChange, warehouseStock, branchId, onComplete
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resetAll, setResetAll] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');

  const filteredStock = useMemo(() => {
    if (!search.trim()) return warehouseStock;
    return warehouseStock.filter(s => s.product?.name?.includes(search));
  }, [warehouseStock, search]);

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredStock.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStock.map(s => s.id)));
    }
  };

  const handleEmpty = async () => {
    if (selectedIds.size === 0) {
      toast.error('اختر منتجات أولاً');
      return;
    }
    if (!branchId) return;

    setIsSaving(true);
    try {
      const selected = warehouseStock.filter(s => selectedIds.has(s.id));

      for (const item of selected) {
        if (resetAll) {
          await supabase
            .from('warehouse_stock')
            .update({ quantity: 0, damaged_quantity: 0, factory_return_quantity: 0, compensation_quantity: 0 })
            .eq('id', item.id);
        } else {
          await supabase
            .from('warehouse_stock')
            .update({ quantity: 0 })
            .eq('id', item.id);
        }
      }

      // If resetAll, also clear related discrepancies
      if (resetAll) {
        const productIds = selected.map(s => s.product_id);
        await supabase
          .from('stock_discrepancies')
          .delete()
          .eq('branch_id', branchId)
          .in('product_id', productIds);
      }

      toast.success(`تم تفريغ ${selected.length} منتج بنجاح`);
      onComplete();
      onOpenChange(false);
      setSelectedIds(new Set());
      setResetAll(false);
      setSearch('');
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            تفريغ المخزون
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reset all option */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-destructive/5">
            <Label htmlFor="reset-all" className="text-sm cursor-pointer">
              تصفير جميع القيم (تالف، هدايا، مرتجع، تعويض، فائض/عجز)
            </Label>
            <Switch id="reset-all" checked={resetAll} onCheckedChange={setResetAll} />
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث عن منتج..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>

          {/* Select all */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={filteredStock.length > 0 && selectedIds.size === filteredStock.length}
              onCheckedChange={toggleAll}
            />
            <Label htmlFor="select-all" className="text-sm cursor-pointer">
              تحديد الكل ({filteredStock.length})
            </Label>
          </div>

          {/* Product list */}
          <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
            {filteredStock.map(item => (
              <label
                key={item.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={() => toggleItem(item.id)}
                />
                <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm truncate">{item.product?.name}</span>
                <span className="text-sm font-bold text-primary tabular-nums">{item.quantity}</span>
              </label>
            ))}
            {filteredStock.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-4">لا توجد منتجات</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="destructive"
            onClick={handleEmpty}
            disabled={isSaving || selectedIds.size === 0}
            className="w-full"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            تفريغ {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StockEmptyDialog;
