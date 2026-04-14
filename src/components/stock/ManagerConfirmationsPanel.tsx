import React, { useState } from 'react';
import { ClipboardCheck, ChevronDown, ChevronUp, Package, Edit, Loader2, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useManagerConfirmations } from '@/hooks/useManagerConfirmations';
import { StockConfirmation, StockConfirmationItem } from '@/hooks/useStockConfirmations';
import { getProductDisplayName } from '@/utils/productDisplayName';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

const OPERATION_LABELS: Record<string, string> = {
  load: 'شحن', unload: 'تفريغ', deficit: 'عجز', surplus: 'فائض',
  damaged: 'تالف', review: 'مراجعة', exchange: 'استبدال',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'بانتظار الموافقة', color: 'bg-amber-500' },
  amended: { label: 'معدّل - بانتظار الموافقة', color: 'bg-orange-500' },
  approved: { label: 'تمت الموافقة', color: 'bg-green-600' },
  rejected: { label: 'مرفوض', color: 'bg-red-600' },
};

const OPERATION_COLORS: Record<string, string> = {
  load: 'bg-green-600', unload: 'bg-blue-600', deficit: 'bg-red-600',
  surplus: 'bg-amber-600', damaged: 'bg-orange-600', review: 'bg-purple-600', exchange: 'bg-teal-600',
};

const fmtQty = (qty: number): string => {
  const boxes = Math.floor(Math.round(qty * 100) / 100);
  const piecePart = Math.round((qty - boxes) * 100);
  if (piecePart > 0) return `${boxes}.${String(piecePart).padStart(2, '0')}`;
  return `${boxes}`;
};

const ManagerConfirmationsPanel: React.FC = () => {
  const { confirmations, isLoading, needsAttentionCount, currentWorkerId, amendConfirmation, refetch } = useManagerConfirmations();
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItems, setEditItems] = useState<StockConfirmationItem[]>([]);
  const [editNote, setEditNote] = useState('');

  useRealtimeSubscription(
    'manager-confirmations-rt',
    [{ table: 'stock_confirmations', filter: currentWorkerId ? `manager_id=eq.${currentWorkerId}` : undefined }],
    [['manager-confirmations']],
    !!currentWorkerId
  );

  const startEditing = (conf: StockConfirmation) => {
    setEditingId(conf.id);
    setEditItems(conf.items.map(i => ({ ...i })));
    setEditNote('');
  };

  const handleSaveAmendment = () => {
    if (!editingId || !editNote.trim()) return;
    amendConfirmation.mutate(
      { confirmationId: editingId, newItems: editItems, note: editNote.trim() },
      { onSuccess: () => { setEditingId(null); setEditItems([]); setEditNote(''); } }
    );
  };

  const updateItemQuantity = (idx: number, newQty: number) => {
    setEditItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: newQty } : item));
  };

  const renderConfirmation = (conf: StockConfirmation) => {
    const isExpanded = expandedId === conf.id;
    const isEditing = editingId === conf.id;
    const statusInfo = STATUS_LABELS[conf.status] || { label: conf.status, color: 'bg-gray-500' };
    const canAmend = conf.status === 'pending' || conf.status === 'rejected';

    return (
      <div key={conf.id} className="border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center gap-2 p-2.5 text-start"
          onClick={() => setExpandedId(isExpanded ? null : conf.id)}
        >
          <Badge className={`${OPERATION_COLORS[conf.operation_type] || 'bg-gray-600'} text-white text-[10px] px-1.5 py-0`}>
            {OPERATION_LABELS[conf.operation_type] || conf.operation_type}
          </Badge>
          <Badge className={`${statusInfo.color} text-white text-[9px] px-1.5 py-0`}>
            {statusInfo.label}
          </Badge>
          <span className="text-[10px] text-muted-foreground flex-1 truncate">
            {conf.worker?.full_name || 'عامل'}
          </span>
          <span className="text-[9px] text-muted-foreground">
            {new Date(conf.created_at).toLocaleDateString('ar-DZ')}
          </span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {isExpanded && (
          <div className="px-2.5 pb-2.5 space-y-2">
            {conf.rejection_note && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded p-2 text-[10px]">
                <span className="font-bold">سبب الرفض:</span> {conf.rejection_note}
              </div>
            )}

            {!isEditing ? (
              <>
                <div className="space-y-1.5">
                  {conf.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                      {item.image_url ? (
                        <img src={item.image_url} className="w-8 h-8 rounded object-cover" alt="" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                          <Package className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">
                          {getProductDisplayName({ name: item.product_name, app_name: item.product_app_name })}
                        </p>
                        <span className="text-[10px] font-semibold">{fmtQty(item.quantity)} صندوق</span>
                        {(item.gift_quantity || 0) > 0 && (
                          <span className="text-[10px] text-green-600 ms-2">+ {item.gift_quantity} هدية</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {canAmend && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs"
                    onClick={() => startEditing(conf)}
                  >
                    <Edit className="w-3.5 h-3.5 me-1" />
                    تعديل وإعادة إرسال
                  </Button>
                )}
              </>
            ) : (
              <div className="space-y-2">
                {editItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">
                        {getProductDisplayName({ name: item.product_name, app_name: item.product_app_name })}
                      </p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.quantity}
                      onChange={e => updateItemQuantity(idx, parseFloat(e.target.value) || 0)}
                      className="w-20 h-7 text-xs text-center"
                    />
                  </div>
                ))}
                <Textarea
                  value={editNote}
                  onChange={e => setEditNote(e.target.value)}
                  placeholder="ملاحظة التعديل..."
                  className="text-xs min-h-[50px]"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs bg-primary"
                    onClick={handleSaveAmendment}
                    disabled={!editNote.trim() || amendConfirmation.isPending}
                  >
                    {amendConfirmation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 me-1" />}
                    إرسال التعديل
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => { setEditingId(null); setEditItems([]); setEditNote(''); }}
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
        aria-label="متابعة التأكيدات"
      >
        <ClipboardCheck className="w-4 h-4 text-primary" />
        {needsAttentionCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {needsAttentionCount > 9 ? '9+' : needsAttentionCount}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="w-5 h-5" />
              متابعة التأكيدات المرسلة
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : confirmations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                لا توجد تأكيدات مرسلة
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

export default ManagerConfirmationsPanel;
