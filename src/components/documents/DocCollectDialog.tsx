import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileCheck, Banknote, FileText, History } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateDocCollection, useOrderDocCollections } from '@/hooks/useDocumentCollections';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';
import { toast } from 'sonner';
import { loadSmsSettings, buildSmsFromTemplate, openSmsApp } from '@/components/settings/SmsSettingsCard';
import { sendSmsDirectly } from '@/utils/smsHelper';

interface DocCollectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  customerName: string;
  customerPhone?: string | null;
  documentType: string;
  totalAmount: number;
}

const getDocLabel = (type: string) => {
  switch (type) {
    case 'check': return 'Chèque';
    case 'receipt': return 'Versement';
    case 'transfer': return 'Virement';
    default: return type;
  }
};

const fmt = (n: number) => new Intl.NumberFormat('ar-DZ', { maximumFractionDigits: 2 }).format(n);

const DocCollectDialog: React.FC<DocCollectDialogProps> = ({
  open, onOpenChange, orderId, customerName, customerPhone, documentType, totalAmount,
}) => {
  const { workerId, activeBranch } = useAuth();
  const createCollection = useCreateDocCollection();
  const { companyInfo } = useCompanyInfo();
  const { data: history = [] } = useOrderDocCollections(open ? orderId : null);

  const isVersement = documentType === 'receipt';

  const [notes, setNotes] = useState('');
  const [collectionType, setCollectionType] = useState<'cash' | 'doc' | null>(null);
  const [amount, setAmount] = useState<string>('');

  const collectedSoFar = useMemo(
    () => history.reduce((s, c) => s + Number(c.amount || 0), 0),
    [history]
  );
  const remaining = Math.max(0, totalAmount - collectedSoFar);

  useEffect(() => {
    if (open) {
      setNotes('');
      setCollectionType(null);
      setAmount(isVersement ? '' : String(remaining || totalAmount));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  const amountNum = Number(amount) || 0;
  const exceeds = isVersement && amountNum > remaining + 0.01;
  const canSubmit = isVersement
    ? (!!collectionType && amountNum > 0 && !exceeds)
    : true;

  const handleSubmit = async () => {
    if (!workerId) return;
    if (isVersement && !canSubmit) return;

    try {
      const submitAmount = isVersement ? amountNum : totalAmount;
      const submitType = isVersement ? collectionType! : undefined;

      await createCollection.mutateAsync({
        orderId,
        workerId,
        action: 'collected',
        amount: submitAmount,
        collectionType: submitType,
        notes: notes || `تم تحصيل ${getDocLabel(documentType)}${submitType ? ` (${submitType === 'cash' ? 'كاش' : 'وثيقة'})` : ''}`,
      });

      const newTotal = collectedSoFar + submitAmount;
      const isFull = newTotal >= totalAmount - 0.01;
      toast.success(isFull ? 'تم إكمال تحصيل المستند' : `تم تسجيل دفعة. المتبقي: ${fmt(totalAmount - newTotal)} دج`);

      void (async () => {
        try {
          const smsConfig = await loadSmsSettings(activeBranch?.id);
          const opConfig = smsConfig.document_collection;
          if (!opConfig.enabled || opConfig.mode === 'disabled') return;
          if (!customerPhone) return;
          const message = buildSmsFromTemplate(opConfig.template, {
            customer: customerName,
            total: totalAmount.toLocaleString(),
            order_id: orderId.slice(0, 8),
            company: companyInfo?.company_name || '',
            amount: submitAmount.toLocaleString(),
            remaining: String(Math.max(0, totalAmount - newTotal)),
            payment_status: `تحصيل ${getDocLabel(documentType)}`,
          });
          if (opConfig.mode === 'automatic') {
            const sent = await sendSmsDirectly(customerPhone, message);
            if (sent) toast.success('تم إرسال رسالة تأكيد تحصيل المستند');
          } else if (opConfig.mode === 'semi_automatic') {
            openSmsApp(customerPhone, message);
          }
        } catch (smsErr) {
          console.error('[SMS] document_collection error:', smsErr);
        }
      })();

      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md p-4 gap-3 max-h-[90dvh] overflow-y-auto">
        <DialogHeader className="pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileCheck className="w-4 h-4 shrink-0" />
            <span className="truncate">تحصيل مستند - {customerName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-md p-3 text-center space-y-1">
            <p className="text-xs text-muted-foreground">نوع المستند</p>
            <p className="text-lg font-bold text-green-700 dark:text-green-400">{getDocLabel(documentType)}</p>
            <p className="text-sm font-bold">{fmt(totalAmount)} DA</p>
            {isVersement && collectedSoFar > 0 && (
              <div className="text-[11px] text-slate-600 pt-1 border-t border-green-200 mt-2">
                المُحصَّل: <span className="font-bold text-emerald-700">{fmt(collectedSoFar)}</span> دج
                {' • '}
                المتبقي: <span className="font-bold text-rose-700">{fmt(remaining)}</span> دج
              </div>
            )}
          </div>

          {isVersement && history.length > 0 && (
            <div className="rounded-md border bg-slate-50 p-2 space-y-1">
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                <History className="w-3.5 h-3.5" />
                سجل التحصيلات
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {history.map(h => (
                  <div key={h.id} className="flex items-center justify-between text-[11px] bg-white rounded px-2 py-1 border">
                    <div className="flex items-center gap-1.5">
                      {h.collection_type === 'cash' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 gap-1">
                          <Banknote className="w-3 h-3" /> كاش
                        </Badge>
                      ) : h.collection_type === 'doc' ? (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0 gap-1">
                          <FileText className="w-3 h-3" /> وثيقة
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">—</Badge>
                      )}
                      <span className="text-slate-500">
                        {new Date(h.created_at).toLocaleDateString('ar-DZ')}
                      </span>
                    </div>
                    <span className="font-bold text-slate-800">{fmt(Number(h.amount || 0))} دج</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isVersement && (
            <>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-700">نوع التحصيل</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={collectionType === 'cash' ? 'default' : 'outline'}
                    className={`h-10 gap-1.5 ${collectionType === 'cash' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                    onClick={() => setCollectionType('cash')}
                  >
                    <Banknote className="w-4 h-4" />
                    كاش
                  </Button>
                  <Button
                    type="button"
                    variant={collectionType === 'doc' ? 'default' : 'outline'}
                    className={`h-10 gap-1.5 ${collectionType === 'doc' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                    onClick={() => setCollectionType('doc')}
                  >
                    <FileText className="w-4 h-4" />
                    وثيقة
                  </Button>
                </div>
              </div>

              {collectionType && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-700">
                    المبلغ (المتبقي: {fmt(remaining)} دج)
                  </p>
                  <Input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0"
                    className={`text-sm ${exceeds ? 'border-red-500' : ''}`}
                  />
                  {exceeds && (
                    <p className="text-[11px] text-red-600">
                      المبلغ يتجاوز المتبقي
                    </p>
                  )}
                  <button
                    type="button"
                    className="text-[11px] text-blue-600 underline"
                    onClick={() => setAmount(String(remaining))}
                  >
                    تعبئة بكامل المتبقي
                  </button>
                </div>
              )}
            </>
          )}

          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="ملاحظات..."
            className="text-sm resize-none"
          />

          <Button
            className="w-full h-9"
            onClick={handleSubmit}
            disabled={createCollection.isPending || !canSubmit}
          >
            {createCollection.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            تأكيد التحصيل
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocCollectDialog;
