import React, { useState } from 'react';
import { Truck, ChevronDown, ChevronUp, Package, Edit, Loader2, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon?: React.ReactNode }> = {
  pending: { label: 'بانتظار التأكيد', color: 'bg-amber-500' },
  amended: { label: 'معدّل - بانتظار التأكيد', color: 'bg-orange-500' },
  approved: { label: 'تمت الموافقة', color: 'bg-green-600', icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected: { label: 'مرفوض - عدم تطابق', color: 'bg-destructive', icon: <AlertTriangle className="w-3 h-3" /> },
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

/** Parse mismatch details from rejection_note */
const parseMismatches = (note: string | null): { product: string; expected: string; actual: string }[] => {
  if (!note || !note.includes('عدم تطابق الكميات')) return [];
  const detailPart = note.replace('عدم تطابق الكميات:', '').trim();
  return detailPart.split(' | ').map(part => {
    const match = part.match(/(.+?):\s*المسؤول=(\S+)\s*العامل=(\S+)/);
    if (match) return { product: match[1].trim(), expected: match[2], actual: match[3] };
    return { product: part, expected: '?', actual: '?' };
  }).filter(m => m.product);
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
    const statusInfo = STATUS_CONFIG[conf.status] || { label: conf.status, color: 'bg-gray-500' };
    const canAmend = conf.status === 'pending' || conf.status === 'rejected';
    const mismatches = parseMismatches(conf.rejection_note);

    return (
      <div key={conf.id} className={`border rounded-lg overflow-hidden ${conf.status === 'rejected' ? 'border-destructive/50' : ''}`}>
        <button
          className={`w-full flex items-center gap-2 p-2.5 text-start ${conf.status === 'rejected' ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`}
          onClick={() => { setExpandedId(isExpanded ? null : conf.id); if (isExpanded) { setEditingId(null); } }}
        >
          <Badge className={`${OPERATION_COLORS[conf.operation_type] || 'bg-gray-600'} text-white text-[10px] px-1.5 py-0`}>
            {OPERATION_LABELS[conf.operation_type] || conf.operation_type}
          </Badge>
          <Badge className={`${statusInfo.color} text-white text-[9px] px-1.5 py-0 flex items-center gap-0.5`}>
            {statusInfo.icon}
            {statusInfo.label}
          </Badge>
          <span className="text-[10px] flex-1 truncate font-semibold">
            {conf.worker?.full_name || 'عامل'}
          </span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {isExpanded && (
          <div className="px-2.5 pb-2.5 space-y-2">
            {/* Mismatch details for rejected */}
            {conf.status === 'rejected' && mismatches.length > 0 && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded p-2 space-y-1">
                <p className="text-[10px] font-bold text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  تفاصيل عدم التطابق:
                </p>
                <div className="border rounded overflow-hidden">
                  <div className="grid grid-cols-3 gap-0 text-[9px] font-bold bg-red-100 dark:bg-red-900/30 p-1">
                    <span>المنتج</span>
                    <span className="text-center">أرسلته</span>
                    <span className="text-center">وجده العامل</span>
                  </div>
                  {mismatches.map((m, i) => (
                    <div key={i} className="grid grid-cols-3 gap-0 text-[10px] p-1 border-t">
                      <span className="truncate font-semibold">{m.product}</span>
                      <span className="text-center">{m.expected}</span>
                      <span className="text-center text-destructive font-bold">{m.actual}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Simple rejection note fallback */}
            {conf.status === 'rejected' && mismatches.length === 0 && conf.rejection_note && (
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
                    className="w-full h-8 text-xs border-amber-500 text-amber-700 hover:bg-amber-50"
                    onClick={() => startEditing(conf)}
                  >
                    <Edit className="w-3.5 h-3.5 me-1" />
                    تعديل الكميات وإعادة إرسال
                  </Button>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground">عدّل الكميات ثم أرسل:</p>
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
                  placeholder="سبب التعديل..."
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
        className="relative flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
        aria-label="متابعة التأكيدات"
      >
        <Truck className="w-4 h-4 text-amber-600" />
        {needsAttentionCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold animate-pulse">
            {needsAttentionCount > 9 ? '9+' : needsAttentionCount}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Truck className="w-5 h-5 text-amber-600" />
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
