import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Gift, Check, X, User, Package, History } from 'lucide-react';
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

const formatQty = (boxes: number, pieces: number): string => {
  const b = Math.max(0, Number(boxes || 0));
  const p = Math.max(0, Number(pieces || 0));
  const piecesPart = p > 0 ? p.toString().padStart(2, '0') : '00';
  return `${b}.${piecesPart} ص.ق`;
};

const formatQtyPlain = (boxes: number, pieces: number): string => {
  const b = Math.max(0, Number(boxes || 0));
  const p = Math.max(0, Number(pieces || 0));
  const piecesPart = p > 0 ? p.toString().padStart(2, '0') : '00';
  return `${b}.${piecesPart}`;
};

const PendingOffersTab: React.FC<Props> = ({ workerId, branchId, dateFrom: _dateFrom, dateTo: _dateTo, onCustomerCountChange }) => {
  // Fetch ALL statuses so customer cards keep history (confirmed/rejected) and
  // still surface any pending items that need action.
  const { items, isLoading } = usePendingOfferConfirmations({
    workerId,
    branchId,
  });

  const [openCustomer, setOpenCustomer] = useState<{ id: string; name: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [productImages, setProductImages] = useState<Record<string, string>>({});
  const [customerStores, setCustomerStores] = useState<Record<string, string>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<PendingOfferConfirmation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);


  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      let q = (supabase as any)
        .from('pending_offer_confirmations')
        .select('*')
        .in('status', ['confirmed', 'rejected'])
        .order('updated_at', { ascending: false })
        .limit(200);
      if (workerId) q = q.eq('worker_id', workerId);
      if (branchId) q = q.eq('branch_id', branchId);
      const { data } = await q;
      setHistoryItems((data || []) as PendingOfferConfirmation[]);
    } finally {
      setHistoryLoading(false);
    }
  };


  const visibleItems = items;


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

  // Fetch store names for customers
  useEffect(() => {
    const ids = Array.from(new Set(
      visibleItems.map((r) => r.customer_id).filter(Boolean) as string[]
    )).filter((id) => !(id in customerStores));
    if (ids.length === 0) return;
    (async () => {
      const { data } = await supabase.from('customers').select('id, store_name').in('id', ids);
      if (data) {
        setCustomerStores((prev) => {
          const next = { ...prev };
          for (const c of data as any[]) next[c.id] = c.store_name || '';
          return next;
        });
      }
    })();
  }, [visibleItems, customerStores]);

  // Group by customer (include all statuses so the card stays as a record).
  const grouped = useMemo(() => {
    const map = new Map<string, { customerId: string; customerName: string; rows: PendingOfferConfirmation[]; pendingCount: number }>();
    for (const r of visibleItems) {
      const key = r.customer_id || `__no_customer__`;
      const name = r.customer_name || 'بدون زبون';
      if (!map.has(key)) map.set(key, { customerId: key, customerName: name, rows: [], pendingCount: 0 });
      const g = map.get(key)!;
      g.rows.push(r);
      if (r.status === 'pending') g.pendingCount++;
    }
    return Array.from(map.values()).sort((a, b) => {
      if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
      return b.rows.length - a.rows.length;
    });
  }, [visibleItems]);

  // Report only customers that actually have pending offers (drives the top badge).
  const pendingCustomerCount = useMemo(
    () => grouped.filter((g) => g.pendingCount > 0).length,
    [grouped]
  );

  useEffect(() => {
    onCustomerCountChange?.(pendingCustomerCount);
  }, [pendingCustomerCount, onCustomerCountChange]);

  const customerRows = openCustomer
    ? visibleItems.filter((r) => (r.customer_id || '__no_customer__') === openCustomer.id)
    : [];

  const handleConfirm = async (id: string) => {
    setBusyId(id);
    const res = await confirmPendingOffer(id);
    setBusyId(null);
    if (!res.ok) toast.error(res.error || 'فشل تأكيد العرض');
    else toast.success('تم تأكيد العرض وخصم الكمية من رصيد العامل');
  };

  const handleReject = async (id: string) => {
    setBusyId(id);
    const res = await rejectPendingOffer(id);
    setBusyId(null);
    if (!res.ok) toast.error(res.error || 'فشل رفض العرض');
    else toast.success('تم رفض العرض');
  };


  const historyButton = (
    <div className="flex justify-end px-1 mb-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => { setHistoryOpen(true); loadHistory(); }}
      >
        <History className="w-4 h-4 ml-1" />
        السجل
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const emptyState = (
    <div className="py-8 text-center text-muted-foreground">
      <Gift className="w-10 h-10 mx-auto mb-2 opacity-40" />
      <p className="text-sm">لا توجد عروض بانتظار التأكيد</p>
    </div>
  );

  return (
    <>
      {historyButton}
      {grouped.length === 0 ? emptyState : (
        <div className="space-y-2 px-1">
          {grouped.map((g) => {
            const hasPending = g.pendingCount > 0;
            return (
              <button
                key={g.customerId}
                type="button"
                onClick={() => setOpenCustomer({ id: g.customerId, name: g.customerName })}
                className={`w-full text-start flex items-center gap-3 p-3 rounded-lg border hover:shadow-md transition-shadow ${
                  hasPending
                    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900'
                    : 'bg-muted/30 border-border'
                }`}
              >
                <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                  hasPending ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-muted'
                }`}>
                  <User className={`w-4 h-4 ${hasPending ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  {customerStores[g.customerId] ? (
                    <>
                      <p className="text-sm font-bold truncate">{customerStores[g.customerId]}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{g.customerName}</p>
                    </>
                  ) : (
                    <p className="text-sm font-bold truncate">{g.customerName}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {hasPending
                      ? `${g.pendingCount} بانتظار التأكيد • ${g.rows.length} إجمالي`
                      : `${g.rows.length} عرض — تمت المعالجة`}
                  </p>
                </div>
                {hasPending ? (
                  <Badge className="shrink-0 bg-amber-500 text-white">{g.pendingCount}</Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0">{g.rows.length}</Badge>
                )}
              </button>
            );
          })}
        </div>
      )}


      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              سجل العروض
            </DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : historyItems.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">لا يوجد سجل</p>
          ) : (
            <div className="space-y-2 mt-2">
              {historyItems.map((r) => {
                const isConfirmed = r.status === 'confirmed';
                return (
                  <div
                    key={r.id}
                    className={`rounded-lg border p-3 ${isConfirmed
                      ? 'bg-green-50 border-green-300 dark:bg-green-950/20 dark:border-green-900'
                      : 'bg-red-50 border-red-300 dark:bg-red-950/20 dark:border-red-900'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.product_name || 'منتج'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {r.customer_name || 'بدون زبون'}{r.worker_name ? ` • ${r.worker_name}` : ''}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold">
                          <span className="px-2 py-0.5 rounded bg-muted">
                            {formatQtyPlain(r.purchased_boxes, r.purchased_pieces)}
                          </span>
                          <span className="text-muted-foreground">+</span>
                          <span className="px-2 py-0.5 rounded bg-red-600 text-white inline-flex items-center gap-1">
                            <Gift className="w-3 h-3" />
                            {formatQtyPlain(r.gift_boxes, r.gift_pieces)}
                          </span>
                        </div>
                      </div>
                      <Badge
                        className={`shrink-0 ${isConfirmed ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
                      >
                        {isConfirmed ? 'مؤكد' : 'مرفوض'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>



      <Dialog open={!!openCustomer} onOpenChange={(o) => { if (!o) setOpenCustomer(null); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-start justify-between gap-2 ps-8">
              <span className="flex items-start gap-2 min-w-0">
                <Gift className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <span className="flex flex-col min-w-0 text-right">
                  <span className="text-base font-bold truncate">
                    {(openCustomer && customerStores[openCustomer.id]) || openCustomer?.name || 'بدون زبون'}
                  </span>
                  {openCustomer && customerStores[openCustomer.id] && (
                    <span className="text-xs font-normal text-muted-foreground truncate">
                      {openCustomer.name}
                    </span>
                  )}
                </span>
              </span>
              <Badge variant="secondary" className="text-xs font-bold shrink-0">
                بانتظار: {customerRows.filter((r) => r.status === 'pending').length} / {customerRows.length}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            {customerRows.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">لا توجد عروض</p>
            )}
            {customerRows.map((r) => {
              const img = productImages[r.product_id];
              const isPending = r.status === 'pending';
              const isConfirmed = r.status === 'confirmed';
              const isRejected = r.status === 'rejected';
              const cardCls = isPending
                ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900'
                : isConfirmed
                  ? 'border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-900'
                  : 'border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-900';
              return (
                <div key={r.id} className={`rounded-lg border p-3 space-y-2 animate-in fade-in slide-in-from-top-1 ${cardCls}`}>
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
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium truncate">{r.product_name || 'منتج'}</p>
                        {isConfirmed && <Badge className="bg-green-600 text-white shrink-0">مؤكد</Badge>}
                        {isRejected && <Badge className="bg-red-600 text-white shrink-0">مرفوض</Badge>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap text-xs font-semibold">
                        <span className="px-2 py-0.5 rounded bg-muted text-foreground">
                          {formatQtyPlain(r.purchased_boxes, r.purchased_pieces)}
                        </span>
                        <span className="text-muted-foreground">+</span>
                        <span className="px-3 py-1 rounded-md bg-red-600 text-white text-sm font-extrabold inline-flex items-center gap-1.5 shadow-sm">
                          <Gift className="w-4 h-4" />
                          {formatQtyPlain(r.gift_boxes, r.gift_pieces)}
                          <span className="text-[10px] font-bold opacity-90">(PROMO)</span>
                        </span>
                      </div>
                      {r.gift_product_name && r.gift_product_id !== r.product_id && (
                        <p className="text-[11px] text-muted-foreground truncate mt-1">
                          المنتج المُهدى: {r.gift_product_name}
                        </p>
                      )}
                      {r.worker_name && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">العامل: {r.worker_name}</p>
                      )}
                    </div>
                  </div>
                  {isPending && (
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
                  )}
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
