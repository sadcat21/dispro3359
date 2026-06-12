import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Store, UserRound, CheckCircle2, AlertCircle, Search as SearchIcon, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import CustomerPickerDialog from '@/components/orders/CustomerPickerDialog';
import WorkerPickerDialog from '@/components/stock/WorkerPickerDialog';
import type { Customer, Sector } from '@/types/database';
import {
  useTreasuryResolutions,
  useAddTreasuryResolution,
  useDeleteTreasuryResolution,
  type SplitResolutionType,
} from '@/hooks/useTreasurySplitResolutions';

interface Props {
  entry: any | null;
  onClose: () => void;
  onRequestInvestigation: (entry: any) => void;
}

interface OptionDef {
  key: SplitResolutionType;
  label: string;
  requires: 'customer' | 'worker' | 'none';
  surplusOnly?: boolean;
  deficitOnly?: boolean;
}

const OPTIONS: OptionDef[] = [
  { key: 'customer_repayment', label: 'استرداد من عميل', requires: 'customer', deficitOnly: true },
  { key: 'credit_to_customer', label: 'رصيد لحساب عميل', requires: 'customer', surplusOnly: true },
  { key: 'worker_debt', label: 'تحويل لدين العامل الأصلي', requires: 'none' },
  { key: 'worker_acknowledged', label: 'العامل أقرّ بالفرق', requires: 'none' },
  { key: 'manager_approved_writeoff', label: 'شطب باعتماد المدير', requires: 'none' },
  { key: 'tolerance_writeoff', label: 'فرق بسيط — تجاوز', requires: 'none' },
  { key: 'deduct_from_reward', label: 'خصم من المكافأة', requires: 'none' },
  { key: 'offset_against_return', label: 'مقاصّة مع مرتجع (انتظار)', requires: 'none' },
  { key: 'carry_forward', label: 'ترحيل للجلسة القادمة', requires: 'none' },
  { key: 'split_writeoff_debt', label: 'تقاسم: شطب + دين', requires: 'none' },
  { key: 'investigation', label: 'فتح ملف متابعة', requires: 'none' },
];


const TYPE_LABEL: Record<SplitResolutionType, string> = Object.fromEntries(
  OPTIONS.map((o) => [o.key, o.label]),
) as any;
TYPE_LABEL['investigation'] = 'فتح ملف متابعة';
TYPE_LABEL['split_writeoff_debt'] = 'تقاسم: شطب + دين';

const fmt = (n: number) => n.toLocaleString();

const useBranchCustomers = (branchId: string | null | undefined, enabled: boolean) =>
  useQuery({
    enabled,
    queryKey: ['split-customers', branchId ?? null],
    queryFn: async () => {
      let cq: any = supabase.from('customers').select('*').eq('status', 'active').order('name');
      let sq: any = supabase.from('sectors').select('*').order('name');
      if (branchId) {
        cq = cq.eq('branch_id', branchId);
        sq = sq.eq('branch_id', branchId);
      }
      const [c, s] = await Promise.all([cq, sq]);
      return {
        customers: (c.data ?? []) as Customer[],
        sectors: (s.data ?? []) as Sector[],
      };
    },
  });

const SplitResolveDialog: React.FC<Props> = ({ entry, onClose, onRequestInvestigation }) => {
  const { workerId, activeBranch } = useAuth();
  const { data: splits = [], isLoading } = useTreasuryResolutions(entry?.id);
  const add = useAddTreasuryResolution();
  const del = useDeleteTreasuryResolution();

  const total = Math.abs(Number(entry?.amount || 0));
  const used = useMemo(() => splits.reduce((s, r) => s + Number(r.amount || 0), 0), [splits]);
  const remaining = Math.max(0, total - used);

  // Draft row
  const [draftType, setDraftType] = useState<SplitResolutionType>('manager_approved_writeoff');
  const [draftAmount, setDraftAmount] = useState<string>('');
  const [draftParty, setDraftParty] = useState<{ id: string; label: string; type: 'customer' | 'worker' } | null>(null);
  const [draftNotes, setDraftNotes] = useState('');

  const [customerOpen, setCustomerOpen] = useState(false);
  const [workerOpen, setWorkerOpen] = useState(false);
  const [peerPickerOpen, setPeerPickerOpen] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);


  const isSurplus = entry?.source_type === 'accounting_surplus' || entry?.source_type === 'customer_surplus';
  const { data: custData } = useBranchCustomers(activeBranch?.id ?? entry?.branch_id ?? null, !!entry);

  const branchWorkersQ = useQuery({
    enabled: !!entry,
    queryKey: ['split-workers', entry?.branch_id ?? null],
    queryFn: async () => {
      let q = supabase.from('workers').select('id, full_name').eq('is_active', true).order('full_name');
      if (entry?.branch_id) q = q.eq('branch_id', entry.branch_id);
      const { data } = await q;
      return (data ?? []) as { id: string; full_name: string }[];
    },
  });

  // Live status of peer cash handovers for this treasury entry (for badges)
  const peerHandoversQ = useQuery({
    enabled: !!entry?.id,
    queryKey: ['treasury-peer-handovers', entry?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('peer_cash_handovers')
        .select('split_id, status, response_note, responded_at')
        .eq('treasury_id', entry!.id);
      if (error) throw error;
      return data as Array<{ split_id: string; status: 'pending' | 'approved' | 'rejected'; response_note: string | null; responded_at: string | null }>;
    },
  });
  const peerBySplit = useMemo(() => {
    const m: Record<string, { status: string; response_note: string | null }> = {};
    (peerHandoversQ.data ?? []).forEach((h) => { m[h.split_id] = h; });
    return m;
  }, [peerHandoversQ.data]);

  // Original worker who caused the deficit (via the accounting session), not the accountant
  const originalWorkerQ = useQuery({
    enabled: !!entry?.session_id,
    queryKey: ['split-session-worker', entry?.session_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('accounting_sessions')
        .select('worker_id, workers:worker_id(id, full_name)')
        .eq('id', entry!.session_id)
        .maybeSingle();
      return (data as any)?.workers ?? null;
    },
  });
  const originalWorkerId: string | null = (originalWorkerQ.data as any)?.id ?? entry?.worker_id ?? null;
  const originalWorkerName: string =
    (originalWorkerQ.data as any)?.full_name ||
    (branchWorkersQ.data ?? []).find((w) => w.id === originalWorkerId)?.full_name ||
    'العامل الأصلي';

  const availableOptions = OPTIONS.filter((o) => {
    if (o.surplusOnly && !isSurplus) return false;
    if (o.deficitOnly && isSurplus) return false;
    return true;
  });

  const currentOpt = OPTIONS.find((o) => o.key === draftType);
  const needsCustomer = currentOpt?.requires === 'customer';
  const needsWorker = currentOpt?.requires === 'worker';
  const isPeerHandover = draftType === 'peer_cash_handover';
  const senderWorkerId = entry?.worker_id || entry?.manager_id || null;
  const senderBalance = remaining; // ما تبقّى من الفائض = رصيد قابل للتسليم

  const reset = () => {
    setDraftAmount('');
    setDraftParty(null);
    setDraftNotes('');
  };

  const canAdd = () => {
    const a = Number(draftAmount);
    if (!(a > 0)) return false;
    if (a > remaining + 0.005) return false;
    if (needsCustomer && (!draftParty || draftParty.type !== 'customer')) return false;
    if (needsWorker && (!draftParty || draftParty.type !== 'worker')) return false;
    return true;
  };

  const handleAdd = async () => {
    if (!entry) return;
    if (draftType === 'investigation') {
      onClose();
      onRequestInvestigation(entry);
      return;
    }
    await add.mutateAsync({
      treasury_id: entry.id,
      resolution_type: draftType,
      amount: Number(draftAmount),
      party_type: draftParty?.type ?? null,
      party_id: draftParty?.id ?? null,
      party_label: draftParty?.label ?? null,
      notes: draftNotes || null,
      resolved_by: workerId || null,
      sender_worker_id: entry?.worker_id || entry?.manager_id || null,
    });
    reset();
  };

  if (!entry) return null;

  return (
    <>
      <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تسوية الفرق ({fmt(total)} DA)</DialogTitle>
          </DialogHeader>

          {/* Progress */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span>الإجمالي: <b dir="ltr">{fmt(total)} DA</b></span>
              <span>المُسوّى: <b className="text-emerald-700" dir="ltr">{fmt(used)} DA</b></span>
              <span>المتبقّي: <b className={remaining > 0 ? 'text-amber-700' : 'text-emerald-700'} dir="ltr">{fmt(remaining)} DA</b></span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full transition-all', remaining === 0 ? 'bg-emerald-500' : 'bg-amber-500')}
                style={{ width: `${Math.min(100, (used / total) * 100)}%` }}
              />
            </div>
            {remaining > 0 && used > 0 && (
              <p className="text-[11px] text-amber-700 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> تسوية جزئية — يبقى القيد <b>مفتوحًا</b> حتى تغطية الباقي.
              </p>
            )}
            {remaining === 0 && used > 0 && (
              <p className="text-[11px] text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> اكتمل التغطية — تم إغلاق القيد تلقائيًا.
              </p>
            )}
          </div>

          {/* Existing splits */}
          {splits.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">السطور المُسجّلة</Label>
              <ScrollArea className="max-h-44">
                <div className="space-y-1.5 pr-1">
                  {splits.map((r) => {
                    const peer = r.resolution_type === 'peer_cash_handover' ? peerBySplit[r.id] : undefined;
                    return (
                    <div key={r.id} dir="rtl" className="flex items-center gap-2 rounded-md border p-2 text-xs bg-card">
                      <Badge variant="outline" className="text-[10px] shrink-0">{TYPE_LABEL[r.resolution_type] || r.resolution_type}</Badge>
                      {r.party_label && (
                        <span className="text-muted-foreground flex items-center gap-1 truncate flex-1 min-w-0">
                          {r.party_type === 'customer' ? <Store className="w-3 h-3 shrink-0" /> : <UserRound className="w-3 h-3 shrink-0" />}
                          <span className="truncate">{r.party_label}</span>
                        </span>
                      )}
                      {!r.party_label && <span className="flex-1" />}
                      <span className="font-bold shrink-0" dir="ltr">{fmt(Number(r.amount))} DA</span>
                      {peer && (
                        <Badge
                          variant={peer.status === 'approved' ? 'default' : peer.status === 'rejected' ? 'destructive' : 'secondary'}
                          className="text-[10px] gap-1 shrink-0"
                        >
                          {peer.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                          {peer.status === 'approved' ? 'أكّد الزميل الاستلام' : peer.status === 'rejected' ? 'رفض الزميل' : 'بانتظار تأكيد الزميل'}
                        </Badge>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => del.mutate({ id: r.id, treasury_id: entry.id })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0 text-foreground"
                        onClick={() => {
                          setDraftType(r.resolution_type as SplitResolutionType);
                          setDraftAmount(String(r.amount));
                          setDraftParty(
                            r.party_id && r.party_type
                              ? { id: r.party_id, label: r.party_label || '', type: r.party_type as 'customer' | 'worker' }
                              : null
                          );
                          setDraftNotes(r.notes || '');
                          del.mutate({ id: r.id, treasury_id: entry.id });
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Add row form */}
          {remaining > 0 && (
            <div className="rounded-lg border-2 border-dashed border-primary/30 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">إضافة سطر تسوية</Label>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs bg-red-600 text-white hover:bg-red-700"
                  onClick={() => setDraftAmount(String(remaining))}
                >
                  استخدم كامل المتبقّي ({fmt(remaining)})
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">نوع التسوية</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-9 justify-between text-xs"
                    onClick={() => setTypePickerOpen(true)}
                  >
                    <span className="truncate">
                      {draftType === 'customer_repayment' && draftParty
                        ? draftParty.label
                        : draftType === 'worker_debt'
                        ? `دين على: ${(branchWorkersQ.data ?? []).find((w) => w.id === (entry?.worker_id || entry?.manager_id))?.full_name || 'العامل الأصلي'}`
                        : TYPE_LABEL[draftType] || 'اختر النوع'}
                    </span>
                    <Plus className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  </Button>
                </div>


                <div className="space-y-1 col-span-1">
                  <Label className="text-xs">المبلغ (≤ {fmt(remaining)})</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={draftAmount}
                    onChange={(e) => setDraftAmount(e.target.value)}
                    max={remaining}
                    className="h-9"
                  />
                </div>
              </div>

              {needsWorker && (
                <div className="space-y-1">
                  <Label className="text-xs">العامل</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => {
                        if (isPeerHandover) setPeerPickerOpen(true);
                        else setWorkerOpen(true);
                      }}
                    >
                      <UserRound className="w-3.5 h-3.5" />
                      {draftParty ? 'تغيير' : 'اختيار'}
                    </Button>
                    {draftParty ? (
                      <span className="text-xs font-medium">{draftParty.label}</span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">لم يُختر بعد</span>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">ملاحظة (اختياري)</Label>
                <Textarea
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  rows={2}
                  placeholder="سبب أو تفصيل هذا السطر..."
                  className="text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="flex-1 gap-1"
                  disabled={!canAdd() || add.isPending}
                  onClick={handleAdd}
                >
                  <Plus className="w-4 h-4" />
                  {draftType === 'investigation' ? 'فتح ملف متابعة' : 'إضافة السطر'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={async () => {
                    if (canAdd()) {
                      await handleAdd();
                    }
                    onClose();
                  }}
                >
                  حفظ
                </Button>
              </div>
            </div>
          )}

        </DialogContent>
      </Dialog>

      <CustomerPickerDialog
        open={customerOpen}
        onOpenChange={setCustomerOpen}
        customers={custData?.customers ?? []}
        sectors={custData?.sectors ?? []}
        onSelect={(c) => {
          setDraftParty({ id: c.id, label: c.store_name || c.name, type: 'customer' });
          setCustomerOpen(false);
        }}
      />

      <WorkerPickerDialog
        open={workerOpen}
        onOpenChange={setWorkerOpen}
        workers={(branchWorkersQ.data ?? []).map((w) => ({ ...w, username: '' })) as any}
        selectedWorkerId=""
        onSelect={(id) => {
          const w = (branchWorkersQ.data ?? []).find((x) => x.id === id);
          if (w) setDraftParty({ id: w.id, label: w.full_name, type: 'worker' });
          setWorkerOpen(false);
        }}
        hideStatusBadge
      />

      <Dialog open={typePickerOpen} onOpenChange={setTypePickerOpen}>
        <DialogContent dir="rtl" className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>اختر نوع التسوية</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {availableOptions.map((o) => {
              const selected = draftType === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => {
                    setDraftType(o.key);
                    setDraftParty(null);
                    setTypePickerOpen(false);
                    if (o.requires === 'customer') setCustomerOpen(true);
                    else if (o.key === 'peer_cash_handover') setPeerPickerOpen(true);
                    else if (o.requires === 'worker') setWorkerOpen(true);
                  }}
                  className={cn(
                    'rounded-lg border p-3 text-right text-xs font-medium transition-all',
                    selected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                      : 'border-border hover:border-primary/40 hover:bg-muted/40',
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={peerPickerOpen} onOpenChange={setPeerPickerOpen}>
        <DialogContent dir="rtl" className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تسليم نقدية لزميل</DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/40 p-3 mb-3 space-y-1">
            <div className="text-xs text-muted-foreground">رصيدك النقدي المتاح للتسليم</div>
            <div className={cn('text-xl font-bold', senderBalance > 0 ? 'text-emerald-700' : 'text-destructive')}>
              {fmt(senderBalance)} DA
            </div>
            {senderBalance <= 0 && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> لا يمكن التسليم: رصيدك صفر.
              </p>
            )}
            {senderBalance > 0 && (
              <p className="text-[11px] text-muted-foreground">
                لا يمكن تسليم مبلغ أكبر من رصيدك. المبلغ الحالي في النموذج: <b>{fmt(Number(draftAmount) || 0)} DA</b>
              </p>
            )}
          </div>

          {senderBalance <= 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              لا يمكن اختيار زميل بدون رصيد.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(branchWorkersQ.data ?? [])
                .filter((w) => w.id !== senderWorkerId)
                .map((w) => {
                  const selected = draftParty?.type === 'worker' && draftParty.id === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        setDraftParty({ id: w.id, label: w.full_name, type: 'worker' });
                        setPeerPickerOpen(false);
                      }}
                      className={cn(
                        'rounded-lg border p-3 text-center text-xs font-medium transition-all flex flex-col items-center gap-1',
                        selected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                          : 'border-border hover:border-primary/40 hover:bg-muted/40',
                      )}
                    >
                      <UserRound className="w-5 h-5 text-primary" />
                      <span className="line-clamp-2">{w.full_name}</span>
                    </button>
                  );
                })}
              {(branchWorkersQ.data ?? []).filter((w) => w.id !== senderWorkerId).length === 0 && (
                <p className="col-span-2 text-center text-sm text-muted-foreground py-6">
                  لا يوجد زملاء في نفس الفرع
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPeerPickerOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
};

export default SplitResolveDialog;
