import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Archive, Trash2, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

type LedgerKind = 'cash' | 'debt' | 'stock';
type PurgeScope = 'current' | 'archive' | 'all';

const RPC_MAP: Record<LedgerKind, {
  archive: string;
  purge: Record<PurgeScope, string>;
  label: string;
}> = {
  cash: {
    archive: 'archive_cash_movements',
    purge: { current: 'purge_cash_movements', archive: 'purge_cash_movements_archive', all: 'purge_cash_movements_all' },
    label: 'حركة الأموال',
  },
  debt: {
    archive: 'archive_debt_movements',
    purge: { current: 'purge_debt_movements', archive: 'purge_debt_movements_archive', all: 'purge_debt_movements_all' },
    label: 'حركة الديون',
  },
  stock: {
    archive: 'archive_stock_movements',
    purge: { current: 'purge_stock_movements', archive: 'purge_stock_movements_archive', all: 'purge_stock_movements_all' },
    label: 'حركة المخزون',
  },
};

const SCOPE_LABEL: Record<PurgeScope, string> = {
  current: 'السجلات الحالية فقط',
  archive: 'سجلات الأرشيف فقط',
  all: 'الكل (الحالية + الأرشيف)',
};

interface Props {
  kind: LedgerKind;
  onDone?: () => void;
  showArchive?: boolean;
  onToggleArchive?: () => void;
}

export const LedgerAdminActions: React.FC<Props> = ({ kind, onDone, showArchive, onToggleArchive }) => {
  const { role } = useAuth();
  const [busy, setBusy] = useState<'archive' | 'purge' | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scope, setScope] = useState<PurgeScope>('current');

  if (role !== 'admin') return null;
  const cfg = RPC_MAP[kind];

  const runArchive = async () => {
    try {
      setBusy('archive');
      const { data, error } = await supabase.rpc(cfg.archive as any);
      if (error) throw error;
      const archived = (data as any)?.archived ?? 0;
      toast.success(`تمت أرشفة ${archived} سجل من ${cfg.label}`);
      onDone?.();
    } catch (e: any) {
      toast.error(`فشل الأرشفة: ${e.message ?? e}`);
    } finally {
      setBusy(null);
    }
  };

  const runPurge = async () => {
    try {
      setBusy('purge');
      const { data, error } = await supabase.rpc(cfg.purge[scope] as any);
      if (error) throw error;
      const deleted = (data as any)?.deleted ?? 0;
      toast.success(`تم حذف ${deleted} سجل (${SCOPE_LABEL[scope]}) من ${cfg.label}`);
      setConfirmOpen(false);
      setPurgeOpen(false);
      onDone?.();
    } catch (e: any) {
      toast.error(`فشل الحذف: ${e.message ?? e}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {onToggleArchive && (
        <Button variant={showArchive ? 'default' : 'outline'} size="sm" onClick={onToggleArchive}>
          {showArchive ? <EyeOff className="h-4 w-4 ml-2" /> : <Eye className="h-4 w-4 ml-2" />}
          {showArchive ? 'إخفاء الأرشيف' : 'عرض من الأرشيف'}
        </Button>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="secondary" size="sm" disabled={busy !== null}>
            {busy === 'archive' ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Archive className="h-4 w-4 ml-2" />}
            أرشفة السجلات
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>أرشفة جميع سجلات {cfg.label}؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم نقل كل السجلات الحالية إلى جدول الأرشيف وإفراغ الجدول الأساسي.
              يمكن استرجاع البيانات لاحقاً من الأرشيف. هذا الإجراء متاح لمدير النظام فقط.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={runArchive}>تأكيد الأرشفة</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={purgeOpen} onOpenChange={setPurgeOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={busy !== null}>
            {busy === 'purge' ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Trash2 className="h-4 w-4 ml-2" />}
            حذف السجلات
          </Button>
        </DialogTrigger>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-destructive">حذف سجلات {cfg.label}</DialogTitle>
            <DialogDescription>
              اختر نطاق الحذف. هذا الإجراء لا يمكن التراجع عنه.
            </DialogDescription>
          </DialogHeader>

          <RadioGroup value={scope} onValueChange={(v) => setScope(v as PurgeScope)} className="space-y-2 py-2">
            <div className="flex items-center gap-2 border rounded-md p-3 hover:bg-muted/50">
              <RadioGroupItem value="current" id="scope-current" />
              <Label htmlFor="scope-current" className="cursor-pointer flex-1">
                <div className="font-medium">الحالية فقط</div>
                <div className="text-xs text-muted-foreground">حذف السجلات النشطة فقط دون المساس بالأرشيف</div>
              </Label>
            </div>
            <div className="flex items-center gap-2 border rounded-md p-3 hover:bg-muted/50">
              <RadioGroupItem value="archive" id="scope-archive" />
              <Label htmlFor="scope-archive" className="cursor-pointer flex-1">
                <div className="font-medium">الأرشيف فقط</div>
                <div className="text-xs text-muted-foreground">حذف سجلات الأرشيف فقط</div>
              </Label>
            </div>
            <div className="flex items-center gap-2 border border-destructive/50 rounded-md p-3 hover:bg-destructive/10">
              <RadioGroupItem value="all" id="scope-all" />
              <Label htmlFor="scope-all" className="cursor-pointer flex-1">
                <div className="font-medium text-destructive">الكل</div>
                <div className="text-xs text-muted-foreground">حذف جميع السجلات (الحالية والأرشيف معاً)</div>
              </Label>
            </div>
          </RadioGroup>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPurgeOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={busy !== null}>
              متابعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">⚠️ تأكيد الحذف النهائي</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف <strong>{SCOPE_LABEL[scope]}</strong> من {cfg.label} نهائياً.
              <br />هذا الإجراء <strong>لا يمكن التراجع عنه</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={runPurge}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              نعم، احذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LedgerAdminActions;
