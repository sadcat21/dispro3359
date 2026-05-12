import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, PackageX, CheckCircle, RefreshCw, History, Truck } from 'lucide-react';

export type WarehouseAction = 'load' | 'unload' | 'review' | 'exchange' | 'history';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerName?: string;
  onSelect: (action: WarehouseAction) => void;
}

const WarehouseActionPickerDialog: React.FC<Props> = ({ open, onOpenChange, workerName, onSelect }) => {
  const pick = (a: WarehouseAction) => { onSelect(a); onOpenChange(false); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Truck className="w-5 h-5 text-primary" />
            عمليات تحميل العامل
          </DialogTitle>
          {workerName && (
            <DialogDescription className="text-xs">
              العامل: <span className="font-bold text-foreground">{workerName}</span>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => pick('load')}
            className="h-16 rounded-xl text-sm font-bold flex-col gap-1 bg-red-600 hover:bg-red-700 text-white"
          >
            <Plus className="w-5 h-5" />
            شحن
          </Button>
          <Button
            variant="outline"
            onClick={() => pick('unload')}
            className="h-16 rounded-xl text-sm flex-col gap-1 border-destructive/40 text-destructive"
          >
            <PackageX className="w-5 h-5" />
            تفريغ
          </Button>
          <Button
            variant="outline"
            onClick={() => pick('review')}
            className="h-16 rounded-xl text-sm flex-col gap-1 border-green-400 text-green-700 bg-green-50/40 dark:bg-green-900/10"
          >
            <CheckCircle className="w-5 h-5" />
            مراجعة
          </Button>
          <Button
            variant="outline"
            onClick={() => pick('exchange')}
            className="h-16 rounded-xl text-sm flex-col gap-1 border-orange-400 text-orange-700 bg-orange-50/40 dark:bg-orange-900/10"
          >
            <RefreshCw className="w-5 h-5" />
            تغيير التالف
          </Button>
        </div>

        <Button
          variant="secondary"
          onClick={() => pick('history')}
          className="w-full h-11 rounded-xl text-sm gap-2"
        >
          <History className="w-4 h-4" />
          سجل الشحنات
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default WarehouseActionPickerDialog;
