import React, { useState, useMemo } from 'react';
import { Scale, AlertTriangle, CheckCircle, Clock, User, Package, Loader2, History, Inbox } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useStockDisputes, StockDispute } from '@/hooks/useStockDisputes';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

const SESSION_LABELS: Record<string, string> = {
  loading: 'شحن', unloading: 'تفريغ', review: 'مراجعة', exchange: 'استبدال',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'بانتظار الفصل', color: 'bg-amber-500', icon: <Clock className="w-3.5 h-3.5" /> },
  resolved: { label: 'تم الفصل - بانتظار القبول', color: 'bg-blue-500', icon: <Scale className="w-3.5 h-3.5" /> },
  accepted: { label: 'مقبول ومسجّل', color: 'bg-green-600', icon: <CheckCircle className="w-3.5 h-3.5" /> },
};

// ─── Dispute Card ───
const DisputeCard: React.FC<{
  dispute: StockDispute;
  isAdmin: boolean;
  currentWorkerId: string | null;
  onResolve: (disputeId: string, guiltyId: string) => void;
  onAccept: (disputeId: string) => void;
  isResolving: boolean;
  isAccepting: boolean;
}> = ({ dispute, isAdmin, currentWorkerId, onResolve, onAccept, isResolving, isAccepting }) => {
  const statusCfg = STATUS_CONFIG[dispute.status] || STATUS_CONFIG.pending;
  const warehouseName = dispute.warehouse_worker?.full_name || 'مسؤول المخزن';
  const deliveryName = dispute.delivery_worker?.full_name || 'عامل التوصيل';
  const diff = Math.round(Math.abs(dispute.warehouse_qty - dispute.delivery_qty) * 100) / 100;
  const isGuilty = dispute.guilty_worker_id === currentWorkerId;
  const needsAcceptance = dispute.status === 'resolved' && isGuilty && !dispute.guilty_accepted;

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className={`${statusCfg.color} text-white text-[9px] gap-1`}>
            {statusCfg.icon}
            {statusCfg.label}
          </Badge>
          <Badge variant="outline" className="text-[9px]">
            {SESSION_LABELS[dispute.session_type] || dispute.session_type}
          </Badge>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {new Date(dispute.created_at).toLocaleDateString('ar-DZ')}
        </span>
      </div>

      {/* Product */}
      {dispute.product_name && (
        <div className="flex items-center gap-1.5 text-sm">
          <Package className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-medium">{dispute.product_name}</span>
          <Badge variant="destructive" className="text-[9px] mr-auto">فرق: {diff}</Badge>
        </div>
      )}

      {/* Quantities */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className={`rounded-md p-2 text-center border ${dispute.status === 'resolved' && dispute.guilty_worker_id === dispute.warehouse_worker_id ? 'border-destructive bg-destructive/5' : 'border-border'}`}>
          <div className="text-muted-foreground text-[10px] mb-0.5">{warehouseName}</div>
          <div className="font-bold text-base">{dispute.warehouse_qty}</div>
          <div className="text-[10px] text-muted-foreground">مسؤول المخزن</div>
        </div>
        <div className={`rounded-md p-2 text-center border ${dispute.status === 'resolved' && dispute.guilty_worker_id === dispute.delivery_worker_id ? 'border-destructive bg-destructive/5' : 'border-border'}`}>
          <div className="text-muted-foreground text-[10px] mb-0.5">{deliveryName}</div>
          <div className="font-bold text-base">{dispute.delivery_qty}</div>
          <div className="text-[10px] text-muted-foreground">عامل التوصيل</div>
        </div>
      </div>

      {/* Notes */}
      {dispute.notes && (
        <p className="text-[11px] text-muted-foreground bg-muted/50 rounded p-1.5">{dispute.notes}</p>
      )}

      {/* Admin resolve buttons */}
      {isAdmin && dispute.status === 'pending' && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[10px] text-center text-muted-foreground font-medium">اختر الطرف المُخطئ:</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="text-[11px] h-8"
              disabled={isResolving}
              onClick={() => onResolve(dispute.id, dispute.warehouse_worker_id)}
            >
              {isResolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <User className="w-3 h-3" />}
              {warehouseName}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="text-[11px] h-8"
              disabled={isResolving}
              onClick={() => onResolve(dispute.id, dispute.delivery_worker_id)}
            >
              {isResolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <User className="w-3 h-3" />}
              {deliveryName}
            </Button>
          </div>
        </div>
      )}

      {/* Verdict display */}
      {(dispute.status === 'resolved' || dispute.status === 'accepted') && dispute.guilty_worker_id && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-2 text-center">
          <p className="text-[11px] font-medium text-destructive">
            ⚖️ الحكم: على ذمة {dispute.guilty_worker_id === dispute.warehouse_worker_id ? warehouseName : deliveryName}
          </p>
          {dispute.resolver?.full_name && (
            <p className="text-[10px] text-muted-foreground">فصل بواسطة: {dispute.resolver.full_name}</p>
          )}
        </div>
      )}

      {/* Accept button for guilty worker */}
      {needsAcceptance && (
        <Button
          size="sm"
          className="w-full text-xs h-8 bg-amber-600 hover:bg-amber-700"
          disabled={isAccepting}
          onClick={() => onAccept(dispute.id)}
        >
          {isAccepting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
          أوافق على الحكم
        </Button>
      )}

      {/* Accepted status */}
      {dispute.status === 'accepted' && (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md p-1.5 text-center">
          <p className="text-[10px] text-green-700 dark:text-green-400 font-medium">✅ تم القبول والتسجيل</p>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───
const StockDisputesPopover: React.FC = () => {
  const { workerId, activeRole } = useAuth();
  const { disputes, isLoading, pendingCount, resolveDispute, acceptVerdict, refetch } = useStockDisputes();
  const [open, setOpen] = useState(false);
  const isAdmin = activeRole?.role === 'admin' || activeRole?.role === 'branch_admin' || activeRole?.role === 'project_manager';

  useRealtimeSubscription(
    'stock-disputes-rt',
    [{ table: 'stock_disputes' }],
    [['stock-disputes']],
    !!workerId
  );

  const pendingDisputes = useMemo(() =>
    disputes.filter(d => {
      if (isAdmin) return d.status === 'pending';
      // Workers see pending disputes they're involved in + resolved ones awaiting their acceptance
      return (d.status === 'pending' && (d.warehouse_worker_id === workerId || d.delivery_worker_id === workerId)) ||
        (d.status === 'resolved' && d.guilty_worker_id === workerId && !d.guilty_accepted);
    }),
    [disputes, isAdmin, workerId]
  );

  const historyDisputes = useMemo(() =>
    disputes.filter(d => d.status === 'resolved' || d.status === 'accepted'),
    [disputes]
  );

  const handleResolve = (disputeId: string, guiltyId: string) => {
    resolveDispute.mutate({ disputeId, guiltyWorkerId: guiltyId });
  };

  const handleAccept = (disputeId: string) => {
    acceptVerdict.mutate(disputeId);
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); refetch(); }}
        className="relative flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        aria-label="خلافات المخزون"
      >
        <Scale className="w-4 h-4 text-white" />
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Scale className="w-5 h-5 text-primary" />
              خلافات المخزون
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="pending" className="w-full" dir="rtl">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="pending" className="text-xs gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {isAdmin ? 'بانتظار الفصل' : 'معلقة'}
                {pendingDisputes.length > 0 && (
                  <Badge className="bg-destructive text-white text-[9px] px-1 py-0 h-4 min-w-4">{pendingDisputes.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs gap-1">
                <History className="w-3.5 h-3.5" />
                السجل
              </TabsTrigger>
            </TabsList>

            <div className="max-h-[60vh] overflow-y-auto mt-2 space-y-2">
              <TabsContent value="pending" className="mt-0 space-y-2">
                {isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : pendingDisputes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Scale className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    لا توجد خلافات معلقة
                  </div>
                ) : (
                  pendingDisputes.map(d => (
                    <DisputeCard
                      key={d.id}
                      dispute={d}
                      isAdmin={isAdmin}
                      currentWorkerId={workerId}
                      onResolve={handleResolve}
                      onAccept={handleAccept}
                      isResolving={resolveDispute.isPending}
                      isAccepting={acceptVerdict.isPending}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-0 space-y-2">
                {isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : historyDisputes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    لا يوجد سجل
                  </div>
                ) : (
                  historyDisputes.map(d => (
                    <DisputeCard
                      key={d.id}
                      dispute={d}
                      isAdmin={isAdmin}
                      currentWorkerId={workerId}
                      onResolve={handleResolve}
                      onAccept={handleAccept}
                      isResolving={resolveDispute.isPending}
                      isAccepting={acceptVerdict.isPending}
                    />
                  ))
                )}
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StockDisputesPopover;
