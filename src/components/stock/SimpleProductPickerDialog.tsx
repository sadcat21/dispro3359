import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package, Check, Trash2, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SimpleProductOption {
  id: string;
  name: string;
  image_url?: string | null;
}

interface SimpleProductPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: SimpleProductOption[];
  selectedProductId: string;
  onSelect: (productId: string) => void;
  /** IDs of products already added to the shipment */
  selectedProductIds?: string[];
  /** Called to confirm/finalize the loading */
  onConfirmLoading?: () => void;
  /** Called to remove a product from loading */
  onRemoveProduct?: (productId: string) => void;
  closeOnSelect?: boolean;
  hideHeader?: boolean;
  showCloseButton?: boolean;
}

const SimpleProductPickerDialog: React.FC<SimpleProductPickerDialogProps> = ({
  open,
  onOpenChange,
  products,
  selectedProductId,
  onSelect,
  selectedProductIds = [],
  onConfirmLoading,
  onRemoveProduct,
  closeOnSelect = true,
  hideHeader = false,
  showCloseButton = false,
}) => {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const removableProductId = selectedProductId || selectedProductIds[0] || '';

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSearch(''); }}>
      <DialogContent className={`max-w-md flex flex-col max-h-[85vh] ${hideHeader ? 'pt-12' : ''}`}>
        {showCloseButton && (
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="إغلاق"
            className="absolute start-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {!hideHeader && (
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              {t('stock.product')}
            </DialogTitle>
          </DialogHeader>
        )}
        <div className="relative shrink-0">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('common.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
            {filtered.map(p => {
              const isSelected = selectedProductIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  className={`flex flex-col rounded-lg overflow-hidden text-center transition-all relative bg-card border
                    ${isSelected ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/60'}
                  `}
                  onClick={() => {
                    onSelect(p.id);
                    setSearch('');
                    if (closeOnSelect) onOpenChange(false);
                  }}
                >
                  {/* Image */}
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full aspect-square object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full aspect-square bg-muted flex items-center justify-center">
                      <Package className="w-6 h-6 text-primary/40" />
                    </div>
                  )}
                  {/* Product name */}
                  <div className={`px-1.5 py-1 border-t ${isSelected ? 'bg-primary border-primary' : 'bg-muted/40 border-border'}`}>
                    <span className={`font-medium leading-tight block text-center truncate text-[11px] ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>
                      {p.name}
                    </span>
                  </div>
                  {/* Selected checkmark */}
                  {isSelected && (
                    <div className="absolute top-1 end-1 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-4">
              {t('common.no_results')}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {(onConfirmLoading || onRemoveProduct) && (
          <div className="shrink-0 border-t pt-3 space-y-2">
            {onConfirmLoading && (
              <Button
                className="w-full h-11 text-sm font-bold"
                onClick={onConfirmLoading}
              >
                <Check className="w-4 h-4 me-2" />
                {selectedProductIds.length > 0 ? `تأكيد الشحن (${selectedProductIds.length} منتج)` : 'تأكيد الشحن'}
              </Button>
            )}
            {onRemoveProduct && (
              <Button
                variant="destructive"
                className="w-full h-9 text-xs"
                onClick={() => {
                  onRemoveProduct(removableProductId);
                }}
              >
                <Trash2 className="w-3.5 h-3.5 me-1" />
                حذف المنتج من الشحن
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SimpleProductPickerDialog;
