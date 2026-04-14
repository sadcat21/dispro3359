import React, { useState, useMemo } from 'react';
import { Truck, Check, ChevronDown, ChevronUp, Loader2, Package, AlertTriangle, Inbox, Send, History, Edit, Scale } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useStockConfirmations, StockConfirmation, StockConfirmationItem } from '@/hooks/useStockConfirmations';
import { useManagerConfirmations } from '@/hooks/useManagerConfirmations';
import { getProductDisplayName } from '@/utils/productDisplayName';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { useStockDisputes } from '@/hooks/useStockDisputes';

const OPERATION_LABELS: Record<string, string> = {
  load: 'شحن', unload: 'تفريغ', deficit: 'عجز', surplus: 'فائض',
  damaged: 'تالف', review: 'مراجعة', exchange: 'استبدال',
};

const OPERATION_COLORS: Record<string, string> = {
  load: 'bg-green-600', unload: 'bg-blue-600', deficit: 'bg-red-600',
  surplus: 'bg-amber-600', damaged: 'bg-orange-600', review: 'bg-purple-600', exchange: 'bg-teal-600',
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'بانتظار التأكيد', color: 'bg-amber-500' },
  amended: { label: 'معدّل', color: 'bg-orange-500' },
  approved: { label: 'تمت الموافقة', color: 'bg-green-600' },
  rejected: { label: 'مرفوض', color: 'bg-destructive' },
  disputed: { label: 'خلاف مرفوع', color: 'bg-purple-600' },
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

const parseMismatches = (note: string | null): { product: string; expected: string; actual: string }[] => {
  if (!note || !note.includes('عدم تطابق الكميات')) return [];
  const detailPart = note.replace('عدم تطابق الكميات:', '').trim();
  return detailPart.split(' | ').map(part => {
    const match = part.match(/(.+?):\s*المسؤول=(\S+)\s*العامل=(\S+)/);
    if (match) return { product: match[1].trim(), expected: match[2], actual: match[3] };
    return { product: part, expected: '?', actual: '?' };
  }).filter(m => m.product);
};

// ─── Incoming Tab: Items the current user needs to act on ───
const IncomingTab: React.FC<{
  confirmations: StockConfirmation[];
  isLoading: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string, note: string) => void;
  isPending: boolean;
}> = ({ confirmations, isLoading, onApprove, onReject, isPending }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [workerInputs, setWorkerInputs] = useState<WorkerVerification>({});

  const handleExpand = (conf: StockConfirmation) => {
    if (expandedId === conf.id) {
      setExpandedId(null);
      setWorkerInputs({});
    } else {
      setExpandedId(conf.id);
      const inputs: WorkerVerification = {};
      conf.items.forEach(item => { inputs[item.product_id] = ''; });
      setWorkerInputs(inputs);
    }
  };

  const handleVerifyAndSubmit = (conf: StockConfirmation) => {
    const allFilled = conf.items.every(item => {
      const val = workerInputs[item.product_id];
      return val !== '' && val !== undefined;
    });
    if (!allFilled) return;

    const mismatches: { product_name: string; expected: number; actual: number }[] = [];
    conf.items.forEach(item => {
      const workerQty = Number(workerInputs[item.product_id]) || 0;
      if (Math.abs(workerQty - item.quantity) > 0.001) {
        mismatches.push({
          product_name: getProductDisplayName({ name: item.product_name, app_name: item.product_app_name }),
          expected: item.quantity,
          actual: workerQty,
        });
      }
    });

    if (mismatches.length === 0) {
      onApprove(conf.id);
      setExpandedId(null);
      setWorkerInputs({});
    } else {
      const mismatchDetails = mismatches.map(m =>
        `${m.product_name}: المسؤول=${fmtQty(m.expected)} العامل=${fmtQty(m.actual)}`
      ).join(' | ');
      onReject(conf.id, `عدم تطابق الكميات: ${mismatchDetails}`);
      setExpandedId(null);
      setWorkerInputs({});
    }
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (confirmations.length === 0) return <div className="text-center py-8 text-muted-foreground text-sm">لا توجد عمليات واردة</div>;

  return (
    <div className="space-y-2">
      {confirmations.map(conf => {
        const isExpanded = expandedId === conf.id;
        const isAmended = conf.status === 'amended' || !!conf.previous_items;
        const allFilled = isExpanded && conf.items.every(item => {
          const val = workerInputs[item.product_id];
          return val !== '' && val !== undefined;
        });
        const currentMismatches = isExpanded ? conf.items.filter(item => {
          const val = workerInputs[item.product_id];
          if (val === '' || val === undefined) return false;
          return Math.abs(Number(val) - item.quantity) > 0.001;
        }) : [];

        return (
          <div key={conf.id} className="border rounded-lg overflow-hidden">
            <button className="w-full flex items-center gap-2 p-2.5 text-start" onClick={() => handleExpand(conf)}>
              <Badge className={`${OPERATION_COLORS[conf.operation_type] || 'bg-gray-600'} text-white text-[10px] px-1.5 py-0`}>
                {OPERATION_LABELS[conf.operation_type] || conf.operation_type}
              </Badge>
              {isAmended && <Badge variant="outline" className="text-[9px] border-amber-500 text-amber-600">معدّل</Badge>}
              <span className="text-[10px] text-muted-foreground flex-1 truncate">{conf.manager?.full_name || 'مسؤول المخزن'}</span>
              <span className="text-[9px] text-muted-foreground">{new Date(conf.created_at).toLocaleDateString('ar-DZ')}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {isExpanded && (
              <div className="px-2.5 pb-2.5 space-y-2">
                {conf.amendment_note && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2 text-[10px]">
                    <span className="font-bold">ملاحظة التعديل:</span> {conf.amendment_note}
                  </div>
                )}
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
                      <div key={idx} className={`grid grid-cols-[1fr_auto_auto] gap-0 items-center p-1.5 border-t ${hasMismatch ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
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
                            {(item.gift_quantity || 0) > 0 && <p className="text-[9px] text-green-600">+{item.gift_quantity} هدية</p>}
                          </div>
                        </div>
                        <div className="w-16 text-center">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold">{fmtQty(item.quantity)}</Badge>
                        </div>
                        <div className="w-20">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={workerVal}
                            onChange={e => {
                              const val = e.target.value;
                              setWorkerInputs(prev => ({ ...prev, [item.product_id]: val === '' ? '' : parseFloat(val) }));
                            }}
                            className={`h-7 text-[11px] text-center px-1 ${hasMismatch ? 'border-destructive bg-red-50 dark:bg-red-950/30 text-destructive font-bold' : ''}`}
                            placeholder="الكمية"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {currentMismatches.length > 0 && (
                  <div className="flex items-start gap-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded p-2 text-[10px] text-destructive">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>يوجد عدم تطابق في {currentMismatches.length} منتج. عند التأكيد سيتم رفض العملية تلقائياً.</span>
                  </div>
                )}

                <Button
                  size="sm"
                  className={`w-full h-9 text-xs font-bold ${currentMismatches.length > 0 ? 'bg-destructive hover:bg-destructive/90' : 'bg-green-600 hover:bg-green-700'} text-white`}
                  onClick={() => handleVerifyAndSubmit(conf)}
                  disabled={!allFilled || isPending}
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : currentMismatches.length > 0 ? (
                    <><AlertTriangle className="w-4 h-4 me-1" />تأكيد مع إبلاغ عن عدم التطابق</>
                  ) : (
                    <><Check className="w-4 h-4 me-1" />تأكيد المطابقة - موافقة</>
                  )}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Outgoing Tab: Items sent by this user, showing status ───
const OutgoingTab: React.FC<{
  confirmations: StockConfirmation[];
  isLoading: boolean;
  onAmend: (id: string, items: StockConfirmationItem[], note: string) => void;
  isAmending: boolean;
  allowAmend?: boolean;
  onRaiseDispute?: (conf: StockConfirmation) => void;
}> = ({ confirmations, isLoading, onAmend, isAmending, allowAmend = true, onRaiseDispute }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItems, setEditItems] = useState<StockConfirmationItem[]>([]);
  const [editNote, setEditNote] = useState('');
  const editingOriginal = editingId ? confirmations.find(conf => conf.id === editingId) : null;
  const hasEditedChanges = editingOriginal
    ? editingOriginal.items.some((originalItem, idx) => Math.abs((editItems[idx]?.quantity ?? originalItem.quantity) - originalItem.quantity) > 0.001)
    : false;

  const startEditing = (conf: StockConfirmation) => {
    setEditingId(conf.id);
    setEditItems(conf.items.map(i => ({ ...i })));
    setEditNote('');
  };

  const handleSaveAmendment = () => {
    if (!allowAmend || !editingId || !hasEditedChanges) return;
    onAmend(editingId, editItems, editNote.trim() || 'تم تعديل الكميات بعد رفض العامل');
    setEditingId(null);
    setEditItems([]);
    setEditNote('');
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (confirmations.length === 0) return <div className="text-center py-8 text-muted-foreground text-sm">لا توجد عمليات صادرة</div>;

  return (
    <div className="space-y-2">
      {confirmations.map(conf => {
        const isExpanded = expandedId === conf.id;
        const isEditing = editingId === conf.id;
        const statusInfo = STATUS_CONFIG[conf.status] || { label: conf.status, color: 'bg-gray-500' };
        const canAmend = allowAmend && (conf.status === 'pending' || conf.status === 'rejected');
        const mismatches = parseMismatches(conf.rejection_note);

        return (
          <div key={conf.id} className={`border rounded-lg overflow-hidden ${conf.status === 'rejected' ? 'border-destructive/50' : ''}`}>
            <button
              className={`w-full flex items-center gap-2 p-2.5 text-start ${conf.status === 'rejected' ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`}
              onClick={() => { setExpandedId(isExpanded ? null : conf.id); if (isExpanded) setEditingId(null); }}
            >
              <Badge className={`${OPERATION_COLORS[conf.operation_type] || 'bg-gray-600'} text-white text-[10px] px-1.5 py-0`}>
                {OPERATION_LABELS[conf.operation_type] || conf.operation_type}
              </Badge>
              <Badge className={`${statusInfo.color} text-white text-[9px] px-1.5 py-0`}>{statusInfo.label}</Badge>
              <span className="text-[10px] flex-1 truncate font-semibold">{conf.worker?.full_name || conf.manager?.full_name || ''}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {isExpanded && (
              <div className="px-2.5 pb-2.5 space-y-2">
                {conf.status === 'rejected' && mismatches.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded p-2 space-y-1">
                    <p className="text-[10px] font-bold text-destructive flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />تفاصيل عدم التطابق:
                    </p>
                    <div className="border rounded overflow-hidden">
                      <div className="grid grid-cols-3 gap-0 text-[9px] font-bold bg-red-100 dark:bg-red-900/30 p-1">
                        <span>المنتج</span><span className="text-center">أرسلته</span><span className="text-center">وجده العامل</span>
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
                            <p className="text-xs font-bold truncate">{getProductDisplayName({ name: item.product_name, app_name: item.product_app_name })}</p>
                            <span className="text-[10px] font-semibold">{fmtQty(item.quantity)} صندوق</span>
                            {(item.gift_quantity || 0) > 0 && <span className="text-[10px] text-green-600 ms-2">+ {item.gift_quantity} هدية</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    {canAmend && (
                      <Button size="sm" variant="outline" className="w-full h-8 text-xs border-amber-500 text-amber-700 hover:bg-amber-50" onClick={() => startEditing(conf)}>
                        <Edit className="w-3.5 h-3.5 me-1" />تعديل الكميات وإعادة إرسال
                      </Button>
                    )}
                    {conf.status === 'rejected' && onRaiseDispute && (
                      <Button size="sm" variant="outline" className="w-full h-8 text-xs border-primary text-primary hover:bg-primary/10" onClick={() => onRaiseDispute(conf)}>
                        <Scale className="w-3.5 h-3.5 me-1" />رفع خلاف للمدير
                      </Button>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-muted-foreground">عدّل الكميات ثم أرسل:</p>
                    {editItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{getProductDisplayName({ name: item.product_name, app_name: item.product_app_name })}</p>
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.quantity}
                          onChange={e => setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: parseFloat(e.target.value) || 0 } : it))}
                          className="w-20 h-7 text-xs text-center"
                        />
                      </div>
                    ))}
                    <Textarea value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="سبب التعديل (اختياري)..." className="text-xs min-h-[50px]" />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 h-8 text-xs bg-primary" onClick={handleSaveAmendment} disabled={!hasEditedChanges || isAmending}>
                        {isAmending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 me-1" />}إرسال التعديل
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setEditingId(null); setEditItems([]); setEditNote(''); }}>إلغاء</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── History Tab ───
const HistoryTab: React.FC<{ confirmations: StockConfirmation[]; isLoading: boolean }> = ({ confirmations, isLoading }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (confirmations.length === 0) return <div className="text-center py-8 text-muted-foreground text-sm">لا يوجد سجل</div>;

  return (
    <div className="space-y-2">
      {confirmations.map(conf => {
        const isExpanded = expandedId === conf.id;
        const statusInfo = STATUS_CONFIG[conf.status] || { label: conf.status, color: 'bg-gray-500' };
        return (
          <div key={conf.id} className="border rounded-lg overflow-hidden">
            <button className="w-full flex items-center gap-2 p-2.5 text-start" onClick={() => setExpandedId(isExpanded ? null : conf.id)}>
              <Badge className={`${OPERATION_COLORS[conf.operation_type] || 'bg-gray-600'} text-white text-[10px] px-1.5 py-0`}>
                {OPERATION_LABELS[conf.operation_type] || conf.operation_type}
              </Badge>
              <Badge className={`${statusInfo.color} text-white text-[9px] px-1.5 py-0`}>{statusInfo.label}</Badge>
              <span className="text-[10px] flex-1 truncate">{conf.worker?.full_name || conf.manager?.full_name || ''}</span>
              <span className="text-[9px] text-muted-foreground">{new Date(conf.created_at).toLocaleDateString('ar-DZ')}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {isExpanded && (
              <div className="px-2.5 pb-2.5 space-y-1.5">
                {conf.rejection_note && (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded p-2 text-[10px]">
                    <span className="font-bold">ملاحظة:</span> {conf.rejection_note}
                  </div>
                )}
                {conf.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-muted/50 rounded-md p-1.5">
                    {item.image_url ? (
                      <img src={item.image_url} className="w-7 h-7 rounded object-cover" alt="" />
                    ) : (
                      <div className="w-7 h-7 rounded bg-muted flex items-center justify-center"><Package className="w-3.5 h-3.5 text-muted-foreground" /></div>
                    )}
                    <p className="text-[10px] font-bold truncate flex-1">{getProductDisplayName({ name: item.product_name, app_name: item.product_app_name })}</p>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold">{fmtQty(item.quantity)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Component ───
const StockConfirmationsPopover: React.FC = () => {
  const workerHook = useStockConfirmations();
  const managerHook = useManagerConfirmations();
  const { activeRole, workerId: currentWorkerId, activeBranch } = useAuth();
  const { createDispute } = useStockDisputes();
  const [open, setOpen] = useState(false);
  const isWarehouseManager = activeRole?.custom_role_code === 'warehouse_manager';

  useRealtimeSubscription(
    'stock-confirmations-rt',
    [{ table: 'stock_confirmations', filter: workerHook.workerId ? `worker_id=eq.${workerHook.workerId}` : undefined }],
    [['stock-confirmations'], ['stock-confirmations-count']],
    !!workerHook.workerId
  );

  useRealtimeSubscription(
    'manager-confirmations-rt',
    [{ table: 'stock_confirmations', filter: managerHook.currentWorkerId ? `manager_id=eq.${managerHook.currentWorkerId}` : undefined }],
    [['manager-confirmations']],
    !!managerHook.currentWorkerId
  );

  const incomingConfirmations = useMemo(() => {
    const source = isWarehouseManager
      ? (managerHook.confirmations || []).filter(c => c.status === 'rejected')
      : (workerHook.confirmations || []).filter(c => c.status === 'pending' || c.status === 'amended');

    return [...source].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [isWarehouseManager, managerHook.confirmations, workerHook.confirmations]);

  const outgoingConfirmations = useMemo(() => {
    const source = isWarehouseManager
      ? (managerHook.confirmations || []).filter(c => c.status === 'pending' || c.status === 'amended')
      : (workerHook.confirmations || []).filter(c => c.status === 'rejected');

    return [...source].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [isWarehouseManager, managerHook.confirmations, workerHook.confirmations]);

  const historyConfirmations = useMemo(() => {
    const source = isWarehouseManager ? (managerHook.confirmations || []) : (workerHook.confirmations || []);

    return source
      .filter(c => c.status === 'approved' || c.status === 'rejected' || c.status === 'disputed')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [isWarehouseManager, managerHook.confirmations, workerHook.confirmations]);

  const totalBadge = isWarehouseManager ? managerHook.needsAttentionCount : workerHook.pendingCount;

  const handleApprove = (id: string) => {
    workerHook.approveConfirmation.mutate(id);
  };

  const handleReject = (id: string, note: string) => {
    workerHook.rejectConfirmation.mutate({ id, note });
  };

  const handleAmend = (id: string, items: StockConfirmationItem[], note: string) => {
    managerHook.amendConfirmation.mutate({ confirmationId: id, newItems: items, note });
  };

  const handleRaiseDispute = async (conf: StockConfirmation) => {
    if (!currentWorkerId) return;

    // Mark the confirmation as 'disputed' so it moves to history
    const { supabase } = await import('@/integrations/supabase/client');
    await supabase
      .from('stock_confirmations')
      .update({ status: 'disputed' } as any)
      .eq('id', conf.id);

    // Parse mismatches from rejection note to create individual disputes
    const mismatches = parseMismatches(conf.rejection_note);
    if (mismatches.length === 0) {
      createDispute.mutate({
        branch_id: conf.branch_id || activeBranch?.id,
        warehouse_worker_id: conf.manager_id,
        delivery_worker_id: conf.worker_id,
        session_type: conf.operation_type,
        session_id: conf.source_session_id || undefined,
        warehouse_qty: conf.items.reduce((s, i) => s + i.quantity, 0),
        delivery_qty: 0,
        notes: conf.rejection_note || 'خلاف على عملية ' + (OPERATION_LABELS[conf.operation_type] || conf.operation_type),
      });
    } else {
      const firstItem = conf.items[0];
      const firstMismatch = mismatches[0];
      createDispute.mutate({
        branch_id: conf.branch_id || activeBranch?.id,
        warehouse_worker_id: conf.manager_id,
        delivery_worker_id: conf.worker_id,
        session_type: conf.operation_type,
        session_id: conf.source_session_id || undefined,
        product_id: firstItem?.product_id,
        product_name: firstMismatch.product,
        warehouse_qty: parseFloat(firstMismatch.expected) || 0,
        delivery_qty: parseFloat(firstMismatch.actual) || 0,
        notes: `خلاف على: ${mismatches.map(m => `${m.product}: المخزن=${m.expected} التوصيل=${m.actual}`).join(' | ')}`,
      });
    }

    // Refresh confirmations lists
    workerHook.refetch();
    managerHook.refetch();
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); workerHook.refetch(); managerHook.refetch(); }}
        className="relative flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        aria-label="تأكيد العمليات"
      >
        <Truck className="w-4 h-4 text-white" />
        {totalBadge > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {totalBadge > 9 ? '9+' : totalBadge}
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

          <Tabs defaultValue="incoming" className="w-full" dir="rtl">
            <TabsList className="grid w-full grid-cols-3 h-9">
              <TabsTrigger value="incoming" className="text-xs gap-1">
                <Inbox className="w-3.5 h-3.5" />
                الوارد
                {incomingConfirmations.length > 0 && (
                  <Badge className="bg-destructive text-white text-[9px] px-1 py-0 h-4 min-w-4">{incomingConfirmations.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="outgoing" className="text-xs gap-1">
                <Send className="w-3.5 h-3.5" />
                الصادر
                {outgoingConfirmations.length > 0 && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 min-w-4">{outgoingConfirmations.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs gap-1">
                <History className="w-3.5 h-3.5" />
                السجل
              </TabsTrigger>
            </TabsList>

            <div className="max-h-[55vh] overflow-y-auto mt-2">
              <TabsContent value="incoming" className="mt-0">
                {isWarehouseManager ? (
                  <OutgoingTab
                    confirmations={incomingConfirmations}
                    isLoading={managerHook.isLoading}
                    onAmend={handleAmend}
                    isAmending={managerHook.amendConfirmation.isPending}
                    allowAmend
                    onRaiseDispute={handleRaiseDispute}
                  />
                ) : (
                  <IncomingTab
                    confirmations={incomingConfirmations}
                    isLoading={workerHook.isLoading}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    isPending={workerHook.approveConfirmation.isPending || workerHook.rejectConfirmation.isPending}
                  />
                )}
              </TabsContent>
              <TabsContent value="outgoing" className="mt-0">
                <OutgoingTab
                  confirmations={outgoingConfirmations}
                  isLoading={isWarehouseManager ? managerHook.isLoading : workerHook.isLoading}
                  onAmend={handleAmend}
                  isAmending={managerHook.amendConfirmation.isPending}
                  allowAmend={isWarehouseManager}
                  onRaiseDispute={handleRaiseDispute}
                />
              </TabsContent>
              <TabsContent value="history" className="mt-0">
                <HistoryTab
                  confirmations={historyConfirmations}
                  isLoading={isWarehouseManager ? managerHook.isLoading : workerHook.isLoading}
                />
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StockConfirmationsPopover;
