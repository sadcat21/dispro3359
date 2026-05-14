import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Gift, Check, X, User, Package } from 'lucide-react';
import { usePendingOfferConfirmations } from '@/hooks/usePendingOfferConfirmations';
import { confirmPendingOffer, rejectPendingOffer } from '@/utils/pendingOfferConfirmations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PendingOfferConfirmation } from '@/types/pendingOffer';

interface Props {
  workerId?: string | null;
  branchId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  onCustomerCountChange?: (count: number) => void;
}

const formatGift = (boxes: number, pieces: number, ppb: number): string => {
  const b = Math.max(0, Number(boxes || 0));
  const p = Math.max(0, Number(pieces || 0));
  const ppbSafe = Math.max(1, Number(ppb || 1));
  const piecesPart = p > 0 ? (p / 100).toFixed(2).split('.')[1] : '00';
  return `${b}.${piecesPart} ص.ق`;
};

const PendingOffersTab: React.FC<Props> = ({ workerId, branchId, dateFrom: _dateFrom, dateTo: _dateTo, onCustomerCountChange }) => {
  // Pending offers are intentionally NOT filtered by date — they remain visible
  // until confirmed/rejected, regardless of when the sale happened.
  const { items, isLoading } = usePendingOfferConfirmations({
    workerId,
    branchId,
    status: 'pending',
  });

  const [openCustomer, setOpenCustomer] = useState<{ id: string; name: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [productImages, setProductImages] = useState<Record<string, string>>({});

  // Visible items (exclude optimistically removed)
  const visibleItems = useMemo(
    () => items.filter((r) => !removedIds.has(r.id)),
    [items, removedIds]
  );

  // Reset removed-ids when fresh data arrives that no longer contains them
  useEffect(() => {
    if (removedIds.size === 0) return;
    const stillHere = new Set(items.map((i) => i.id));
    const next = new Set<string>();
    removedIds.forEach((id) => { if (stillHere.has(id)) next.add(id); });
    if (next.size !== removedIds.size) setRemovedIds(next);
  }, [items, removedIds]);

  // Fetch product images for visible product_ids
  useEffect(() => {
    const ids = Array.from(new Set([
      ...visibleItems.map((r) => r.product_id),
      ...visibleItems.map((r) => r.gift_product_id).filter(Boolean) as string[],
    ])).filter((id) => id && !(id in productImages));
    if (ids.length === 0) return;
    (async () => {
      const { data } = await supabase.from('products').select('id, image_url').in('id', ids);
      if (data) {
        setProductImages((prev) => {
          const next = { ...prev };
          for (const p of data as any[]) next[p.id] = p.image_url || '';
          return next;
        });
      }
    })();
  }, [visibleItems, productImages]);

  // Group by customer
  const grouped = useMemo(() => {
    const map = new Map<string, { customerId: string; customerName: string; rows: PendingOfferConfirmation[] }>();
    for (const r of visibleItems) {
      const key = r.customer_id || `__no_customer__`;
      const name = r.customer_name || 'بدون زبون';
      if (!map.has(key)) map.set(key, { customerId: key, customerName: name, rows: [] });
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values()).sort((a, b) => b.rows.length - a.rows.length);
  }, [visibleItems]);

  useEffect(() => {
    onCustomerCountChange?.(grouped.length);
  }, [grouped.length, onCustomerCountChange]);

  const customerRows = openCustomer
    ? visibleItems.filter((r) => (r.customer_id || '__no_customer__') === openCustomer.id)
    : [];

  // Auto-close dialog when no remaining cards for the open customer
  useEffect(() => {
    if (openCustomer && customerRows.length === 0 && !busyId) {
      setOpenCustomer(null);
    }
  }, [openCustomer, customerRows.length, busyId]);

  const handleConfirm = async (id: string) => {
    setBusyId(id);
    // Optimistically remove the card immediately
    setRemovedIds((prev) => new Set(prev).add(id));
    const res = await confirmPendingOffer(id);
    setBusyId(null);
    if (!res.ok) {
      // Rollback on failure
      setRemovedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.error(res.error || 'فشل تأكيد العرض');
    } else {
      toast.success('تم تأكيد العرض وخصم الكمية من رصيد العامل');
    }
  };

  const handleReject = async (id: string) => {
    setBusyId(id);
    setRemovedIds((prev) => new Set(prev).add(id));
    const res = await rejectPendingOffer(id);
    setBusyId(null);
    if (!res.ok) {
      setRemovedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.error(res.error || 'فشل رفض العرض');
    } else {
      toast.success('تم رفض العرض');
    }
  };

  if (isLoading) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (grouped.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Gift className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">لا توجد عروض بانتظار التأكيد</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 px-1">
        {grouped.map((g) => (
          <button
            key={g.customerId}
            type="button"
            onClick={() => setOpenCustomer({ id: g.customerId, name: g.customerName })}
            className="w-full text-start flex items-center gap-3 p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 hover:shadow-md transition-shadow"
          >
            <div className="shrink-0 w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <User className="w-4 h-4 text-amber-700 dark:text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{g.customerName}</p>
              <p className="text-xs text-muted-foreground">{g.rows.length} عرض بانتظار التأكيد</p>
            </div>
            <Badge variant="secondary" className="shrink-0">{g.rows.length}</Badge>
          </button>
        ))}
      </div>

      <Dialog open={!!openCustomer} onOpenChange={(o) => { if (!o) setOpenCustomer(null); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-600" />
                عروض {openCustomer?.name}
              </span>
              <Badge variant="secondary" className="text-xs font-bold">
                متبقّي: {customerRows.length}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            {customerRows.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">لا توجد عروض</p>
            )}
            {customerRows.map((r) => {
              const img = productImages[r.product_id];
              return (
                <div key={r.id} className="rounded-lg border p-3 space-y-2 animate-in fade-in slide-in-from-top-1">
                  <div className="flex items-start gap-2">
                    {img ? (
                      <img
                        src={img}
                        alt={r.product_name || ''}
                        className="w-12 h-12 rounded-lg object-cover border shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.product_name || 'منتج'}</p>
                      {r.gift_product_name && r.gift_product_id !== r.product_id && (
                        <p className="text-xs text-muted-foreground truncate">هدية: {r.gift_product_name}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-[11px] bg-emerald-50 dark:bg-emerald-950/20">
                          <Gift className="w-3 h-3 ml-1" />
                          {formatGift(r.gift_boxes, r.gift_pieces, r.pieces_per_box)}
                        </Badge>
                        {r.worker_name && (
                          <span className="text-[11px] text-muted-foreground">العامل: {r.worker_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={busyId === r.id}
                      onClick={() => handleConfirm(r.id)}
                    >
                      {busyId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 ml-1" /> تأكيد</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === r.id}
                      onClick={() => handleReject(r.id)}
                    >
                      <X className="w-4 h-4 ml-1" /> رفض
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PendingOffersTab;
