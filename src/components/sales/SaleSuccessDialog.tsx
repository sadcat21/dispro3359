import { CheckCircle2, FileText, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type SalePaymentStatus = 'paid' | 'partial' | 'debt';

export interface SaleSuccessSplitGroup {
  badge: string;
  label: string;
  total: number;
  paidAmount: number;
  remainingDebt: number;
  paymentMethod: string;
  status: SalePaymentStatus;
}

export interface SaleSuccessInfo {
  amount: number;
  customerName: string;
  productNames: string[];
  paymentMethod?: string | null;
  paymentType?: 'with_invoice' | 'without_invoice' | string | null;
  invoiceMethod?: string | null;
  invoiceRequestSent?: boolean | null; // null = unknown / not applicable
  paymentStatus?: SalePaymentStatus | null;
  paidAmount?: number | null;
  remainingAmount?: number | null;
  splitGroups?: SaleSuccessSplitGroup[] | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  info: SaleSuccessInfo | null;
}

const paymentMethodLabel = (m?: string | null) => {
  switch (m) {
    case 'cash': return 'نقداً';
    case 'check': return 'شيك';
    case 'versement': return 'تحويل (Versement)';
    case 'virement': return 'تحويل بنكي (Virement)';
    case 'debt': return 'دين';
    default: return m || '—';
  }
};

export function SaleSuccessDialog({ open, onClose, info }: Props) {
  if (!info) return null;
  const isInvoice1 = info.paymentType === 'with_invoice';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <div className="flex flex-col items-center gap-2 pt-2">
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-center text-xl">تمت العملية بنجاح</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-3 px-2">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">
              {Number(info.amount || 0).toLocaleString()} دج
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
            {info.productNames.length > 0 && (
              <div>
                <div className="text-muted-foreground text-xs mb-1">المنتجات</div>
                <div className="font-medium">{info.productNames.join('، ')}</div>
              </div>
            )}
            <div>
              <div className="text-muted-foreground text-xs mb-1">العميل</div>
              <div className="font-medium">{info.customerName || '—'}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <div className="text-muted-foreground text-xs mb-1">طريقة الدفع</div>
                <div className="font-medium">
                  {paymentMethodLabel(isInvoice1 ? (info.invoiceMethod || info.paymentMethod) : info.paymentMethod)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-1">نوع الفاتورة</div>
                <Badge variant={isInvoice1 ? 'default' : 'secondary'}>
                  {isInvoice1 ? 'فاتورة 1' : 'بدون فاتورة'}
                </Badge>
              </div>
            </div>
            {info.paymentStatus && (
              <div className="pt-1">
                <div className="text-muted-foreground text-xs mb-1">حالة الدفع</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    className={
                      info.paymentStatus === 'paid'
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : info.paymentStatus === 'partial'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-red-100 text-red-800 border border-red-300'
                    }
                  >
                    {info.paymentStatus === 'paid' ? 'دفع كامل' : info.paymentStatus === 'partial' ? 'دفع جزئي' : 'دين كامل'}
                  </Badge>
                  {info.paymentStatus === 'partial' && (
                    <span className="text-xs text-muted-foreground">
                      المدفوع: {Number(info.paidAmount || 0).toLocaleString()} دج · المتبقي: {Number(info.remainingAmount || 0).toLocaleString()} دج
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {info.splitGroups && info.splitGroups.length > 1 && (
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">
                تفصيل الدفع متعدد الفواتير ({info.splitGroups.length})
              </div>
              <div className="space-y-2">
                {info.splitGroups.map((g, idx) => (
                  <div key={idx} className="rounded-md border bg-background p-2 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-[10px]">{g.badge}</Badge>
                        <span className="font-medium">{g.label}</span>
                      </div>
                      <Badge
                        className={
                          g.status === 'paid'
                            ? 'bg-green-100 text-green-800 border border-green-300'
                            : g.status === 'partial'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-red-100 text-red-800 border border-red-300'
                        }
                      >
                        {g.status === 'paid' ? 'مدفوع' : g.status === 'partial' ? 'جزئي' : 'دين'}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>طريقة الدفع: <span className="text-foreground">{paymentMethodLabel(g.paymentMethod)}</span></span>
                      <span>الإجمالي: <span className="text-foreground font-semibold">{Number(g.total).toLocaleString()} دج</span></span>
                    </div>
                    {g.status !== 'paid' && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>المدفوع: <span className="text-foreground">{Number(g.paidAmount).toLocaleString()} دج</span></span>
                        <span>المتبقي: <span className="text-destructive font-semibold">{Number(g.remainingDebt).toLocaleString()} دج</span></span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isInvoice1 && (
            <div
              className={`rounded-lg border p-3 flex items-start gap-2 text-sm ${
                info.invoiceRequestSent
                  ? 'border-green-300 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                  : 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200'
              }`}
            >
              {info.invoiceRequestSent ? (
                <>
                  <FileText className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold">تم إنشاء طلب الفاتورة</div>
                    <div className="text-xs opacity-90">تم إرساله إلى المسؤول للموافقة.</div>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold">لم يتم إنشاء طلب الفاتورة</div>
                    <div className="text-xs opacity-90">يرجى المتابعة مع المسؤول.</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full">حسناً</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
