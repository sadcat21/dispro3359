import React, { useState } from 'react';
import { Truck, Check, X, ChevronDown, ChevronUp, Loader2, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useStockConfirmations, StockConfirmation, StockConfirmationItem } from '@/hooks/useStockConfirmations';
import { getProductDisplayName } from '@/utils/productDisplayName';

const OPERATION_LABELS: Record<string, string> = {
  load: 'شحن',
  unload: 'تفريغ',
  deficit: 'عجز',
  surplus: 'فائض',
  damaged: 'تالف',
  review: 'مراجعة',
  exchange: 'استبدال',
};

const OPERATION_COLORS: Record<string, string> = {
  load: 'bg-green-600',
  unload: 'bg-blue-600',
  deficit: 'bg-red-600',
  surplus: 'bg-amber-600',
  damaged: 'bg-orange-600',
  review: 'bg-purple-600',
  exchange: 'bg-teal-600',
};

const fmtQty = (qty: number, ppb: number = 20): string => {
  const boxes = Math.floor(Math.round(qty * 100) / 100);
  const piecePart = Math.round((qty - boxes) * 100);
  if (piecePart > 0) return `${boxes}.${String(piecePart).padStart(2, '0')}`;
  return `${boxes}`;
};

const StockConfirmationsPopover: React.FC = () => {
  const { pendingCount, confirmations, isLoading, approveConfirmation, rejectConfirmation, refetch } = useStockConfirmations();
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const handleApprove = (id: string) => {
    approveConfirmation.mutate(id);
  };

  const handleReject = (id: string) => {
    if (!rejectNote.trim()) return;
    rejectConfirmation.mutate({ id, note: rejectNote.trim() }, {
      onSuccess: () => {
        setRejectingId(null);
        setRejectNote('');
      },
    });
  };

  const renderItems = (items: StockConfirmationItem[], previousItems?: StockConfirmationItem[] | null) => {
    const prevMap = new Map<string, StockConfirmationItem>();
    if (previousItems) {
      previousItems.forEach(item => prevMap.set(item.product_id, item));
    }

    return (
      <div className="space-y-1.5 mt-2">
        {items.map((item, idx) => {
          const displayName = getProductDisplayName({ name: item.product_name, app_name: item.product_app_name });
          const prev = prevMap.get(item.product_id);
          return (
            <div key={idx} className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
              {item.image_url ? (
                <img src={item.image_url} className="w-8 h-8 rounded object-cover" alt="" />
              ) : (
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                  <Package className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{displayName}</p>
                <div className="flex items-center gap-2 text-[10px]">
                  {prev && (
                    <span className="text-destructive line-through">
                      {fmtQty(prev.quantity)}
                    </span>
                  )}
                  <span className="font-semibold">{fmtQty(item.quantity)} صندوق</span>
                  {(item.gift_quantity || 0) > 0 && (
                    <span className="text-green-600">+ {item.gift_quantity} هدية</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderConfirmation = (conf: StockConfirmation) => {
    const isExpanded = expandedId === conf.id;
    const isRejecting = rejectingId === conf.id;
    const isAmended = conf.status === 'amended' || !!conf.previous_items;

    return (
      <div key={conf.id} className="border rounded-lg overflow-hidden">
        {/* Header */}
        <button
          className="w-full flex items-center gap-2 p-2.5 text-start"
          onClick={() => setExpandedId(isExpanded ? null : conf.id)}
        >
          <Badge className={`${OPERATION_COLORS[conf.operation_type] || 'bg-gray-600'} text-white text-[10px] px-1.5 py-0`}>
            {OPERATION_LABELS[conf.operation_type] || conf.operation_type}
          </Badge>
          {isAmended && (
            <Badge variant="outline" className="text-[9px] border-amber-500 text-amber-600">معدّل</Badge>
          )}
          <span className="text-[10px] text-muted-foreground flex-1 truncate">
            {conf.manager?.full_name || 'مسؤول المخزن'}
          </span>
          <span className="text-[9px] text-muted-foreground">
            {new Date(conf.created_at).toLocaleDateString('ar-DZ')}
          </span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="px-2.5 pb-2.5 space-y-2">
            {conf.amendment_note && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2 text-[10px]">
                <span className="font-bold">ملاحظة التعديل:</span> {conf.amendment_note}
              </div>
            )}

            {renderItems(conf.items, conf.previous_items)}

            {/* Actions */}
            {!isRejecting ? (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleApprove(conf.id)}
                  disabled={approveConfirmation.isPending}
                >
                  {approveConfirmation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 me-1" />
                  )}
                  موافقة
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1 h-8 text-xs"
                  onClick={() => setRejectingId(conf.id)}
                >
                  <X className="w-3.5 h-3.5 me-1" />
                  رفض
                </Button>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <Textarea
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  placeholder="سبب الرفض..."
                  className="text-xs min-h-[60px]"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 h-8 text-xs"
                    onClick={() => handleReject(conf.id)}
                    disabled={!rejectNote.trim() || rejectConfirmation.isPending}
                  >
                    {rejectConfirmation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'تأكيد الرفض'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => { setRejectingId(null); setRejectNote(''); }}
                  >
                    إلغاء
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); refetch(); }}
        className="relative flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
        aria-label="تأكيد العمليات"
      >
        <Truck className="w-4 h-4 text-primary" />
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Truck className="w-5 h-5" />
              العمليات المعلقة
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : confirmations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                لا توجد عمليات معلقة
              </div>
            ) : (
              confirmations.map(renderConfirmation)
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StockConfirmationsPopover;
