import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SetReviewPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string;
  workerName?: string;
}

const SetReviewPinDialog: React.FC<SetReviewPinDialogProps> = ({
  open, onOpenChange, workerId, workerName,
}) => {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (pin.length < 4) {
      toast.error('الكود يجب أن يكون 4 أرقام على الأقل');
      return;
    }
    if (pin !== confirm) {
      toast.error('الكودان غير متطابقين');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('set_worker_review_pin', {
        _worker_id: workerId,
        _pin: pin,
      });
      if (error) throw error;
      toast.success('✅ تم تعيين كود توقيع المراجعة بنجاح');
      setPin(''); setConfirm('');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'فشل تعيين الكود');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            كود توقيع المراجعة النهائية
          </DialogTitle>
          <DialogDescription className="text-xs">
            {workerName ? `للعامل: ${workerName}` : ''} — يُستخدم هذا الكود من قبل العامل للتوقيع على المراجعة النهائية اليومية مع مسؤول المخزن.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">الكود الجديد (4 أرقام أو أكثر)</Label>
            <Input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
              className="h-11 text-center text-xl tracking-widest font-bold"
              placeholder="●●●●"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">تأكيد الكود</Label>
            <Input
              type="password"
              inputMode="numeric"
              value={confirm}
              onChange={e => setConfirm(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
              className="h-11 text-center text-xl tracking-widest font-bold"
              placeholder="●●●●"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={saving || !pin || !confirm}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : <KeyRound className="w-4 h-4 me-1.5" />}
            حفظ الكود
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SetReviewPinDialog;
