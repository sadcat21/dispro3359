import React, { useState, useMemo } from 'react';
import { Truck, Check, ChevronDown, ChevronUp, Loader2, Package, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useStockConfirmations, StockConfirmation, StockConfirmationItem } from '@/hooks/useStockConfirmations';
import { getProductDisplayName } from '@/utils/productDisplayName';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useAuth } from '@/contexts/AuthContext';

const OPERATION_LABELS: Record<string, string> = {
  load: 'شحن', unload: 'تفريغ', deficit: 'عجز', surplus: 'فائض',
  damaged: 'تالف', review: 'مراجعة', exchange: 'استبدال',
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

interface WorkerVerification {
  [productId: string]: number | '';
}

const StockConfirmationsPopover: React.FC = () => {
  const { user } = useAuth();
  const { pendingCount, confirmations, isLoading, approveConfirmation, rejectConfirmation, refetch } = useStockConfirmations();
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [workerInputs, setWorkerInputs] = useState<WorkerVerification>({});

  useRealtimeSubscription(
    'stock-confirmations-rt',
    [{ table: 'stock_confirmations', filter: user?.id ? `worker_id=eq.${user.id}` : undefined }],
    [['stock-confirmations'], ['stock-confirmations-count']],
    !!user?.id
  );

  const initializeInputs = (conf: StockConfirmation) => {
    const inputs: WorkerVerification = {};
    conf.items.forEach(item => {
      inputs[item.product_id] = '';
    });
    setWorkerInputs(inputs);
  };

  const handleExpand = (conf: StockConfirmation) => {
    if (expandedId === conf.id) {
      setExpandedId(null);
      setWorkerInputs({});
    } else {
      setExpandedId(conf.id);
      initializeInputs(conf);
    }
  };

  const handleVerifyAndSubmit = (conf: StockConfirmation) => {
    // Check if all fields are filled
    const allFilled = conf.items.every(item => {
      const val = workerInputs[item.product_id];
      return val !== '' && val !== undefined;
    });

    if (!allFilled) return;

    // Check for mismatches
    const mismatches: { product_name: string; expected: number; actual: number }[] = [];
    conf.items.forEach(item => {
      const workerQty = Number(workerInputs[item.product_id]) || 0;
      const expectedQty = item.quantity;
      if (Math.abs(workerQty - expectedQty) > 0.001) {
        mismatches.push({
          product_name: getProductDisplayName({ name: item.product_name, app_name: item.product_app_name }),
          expected: expectedQty,
          actual: workerQty,
        });
      }
    });

    if (mismatches.length === 0) {
      // All match → approve
      approveConfirmation.mutate(conf.id, {
        onSuccess: () => {
          setExpandedId(null);
          setWorkerInputs({});
        },
      });
    } else {
      // Mismatch → auto-reject with details
      const mismatchDetails = mismatches.map(m =>
        `${m.product_name}: المسؤول=${fmtQty(m.expected)} العامل=${fmtQty(m.actual)}`
      ).join(' | ');

      rejectConfirmation.mutate(
        { id: conf.id, note: `عدم تطابق الكميات: ${mismatchDetails}` },
        {
          onSuccess: () => {
            setExpandedId(null);
            setWorkerInputs({});
          },
        }
      );
    }
  };

  const renderConfirmation = (conf: StockConfirmation) => {
    const isExpanded = expandedId === conf.id;
    const isAmended = conf.status === 'amended' || !!conf.previous_items;

    const allFilled = conf.items.every(item => {
      const val = workerInputs[item.product_id];
      return val !== '' && val !== undefined;
    });

    // Check current mismatches for visual feedback
    const currentMismatches = isExpanded ? conf.items.filter(item => {
      const val = workerInputs[item.product_id];
      if (val === '' || val === undefined) return false;
      return Math.abs(Number(val) - item.quantity) > 0.001;
    }) : [];

    return (
      <div key={conf.id} className="border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center gap-2 p-2.5 text-start"
          onClick={() => handleExpand(conf)}
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

        {isExpanded && (
          <div className="px-2.5 pb-2.5 space-y-2">
            {conf.amendment_note && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2 text-[10px]">
                <span className="font-bold">ملاحظة التعديل:</span> {conf.amendment_note}
              </div>
            )}

            {/* Previous items comparison for amended */}
            {conf.previous_items && conf.previous_items.length > 0 && (
              <div className="bg-muted/30 rounded p-2 text-[10px]">
                <span className="font-bold text-muted-foreground">الكميات السابقة:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {conf.previous_items.map((prev, i) => (
                    <span key={i} className="line-through text-destructive">
                      {getProductDisplayName({ name: prev.product_name, app_name: prev.product_app_name })}: {fmtQty(prev.quantity)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Product verification table */}
            <div className="border rounded-md overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] gap-0 text-[10px] font-bold bg-muted/70 p-1.5">
                <span>المنتج</span>
                <span className="w-16 text-center">المسؤول</span>
                <span className="w-20 text-center">ما لديك</span>
              </div>
              {conf.items.map((item, idx) => {
                const displayName = getProductDisplayName({ name: item.product_name, app_name: item.product_app_name });
                const workerVal = workerInputs[item.product_id];
                const isFilled = workerVal !== '' && workerVal !== undefined;
                const hasMismatch = isFilled && Math.abs(Number(workerVal) - item.quantity) > 0.001;

                return (
                  <div
                    key={idx}
                    className={`grid grid-cols-[1fr_auto_auto] gap-0 items-center p-1.5 border-t ${
                      hasMismatch ? 'bg-red-50 dark:bg-red-950/20' : ''
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {item.image_url ? (
                        <img src={item.image_url} className="w-7 h-7 rounded object-cover shrink-0" alt="" />
                      ) : (
                        <div className="w-7 h-7 rounded bg-muted flex items-center justify-center shrink-0">
                          <Package className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold truncate leading-tight">{displayName}</p>
                        {(item.gift_quantity || 0) > 0 && (
                          <p className="text-[9px] text-green-600">+{item.gift_quantity} هدية</p>
                        )}
                      </div>
                    </div>
                    <div className="w-16 text-center">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold">
                        {fmtQty(item.quantity)}
                      </Badge>
                    </div>
                    <div className="w-20">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={workerVal}
                        onChange={e => {
                          const val = e.target.value;
                          setWorkerInputs(prev => ({
                            ...prev,
                            [item.product_id]: val === '' ? '' : parseFloat(val),
                          }));
                        }}
                        className={`h-7 text-[11px] text-center px-1 ${
                          hasMismatch ? 'border-destructive bg-red-50 dark:bg-red-950/30 text-destructive font-bold' : ''
                        }`}
                        placeholder="الكمية"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mismatch warning */}
            {currentMismatches.length > 0 && (
              <div className="flex items-start gap-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded p-2 text-[10px] text-destructive">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  يوجد عدم تطابق في {currentMismatches.length} منتج. عند التأكيد سيتم رفض العملية تلقائياً وإرسال التفاصيل للمسؤول.
                </span>
              </div>
            )}

            {/* Submit button */}
            <Button
              size="sm"
              className={`w-full h-9 text-xs font-bold ${
                currentMismatches.length > 0
                  ? 'bg-destructive hover:bg-destructive/90'
                  : 'bg-green-600 hover:bg-green-700'
              } text-white`}
              onClick={() => handleVerifyAndSubmit(conf)}
              disabled={!allFilled || approveConfirmation.isPending || rejectConfirmation.isPending}
            >
              {(approveConfirmation.isPending || rejectConfirmation.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : currentMismatches.length > 0 ? (
                <>
                  <AlertTriangle className="w-4 h-4 me-1" />
                  تأكيد مع إبلاغ عن عدم التطابق
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 me-1" />
                  تأكيد المطابقة - موافقة
                </>
              )}
            </Button>
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
              تأكيد العمليات
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
