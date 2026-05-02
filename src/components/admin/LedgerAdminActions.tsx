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
import { Archive, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

type LedgerKind = 'cash' | 'debt' | 'stock';

const RPC_MAP: Record<LedgerKind, { archive: string; purge: string; label: string }> = {
  cash: { archive: 'archive_cash_movements', purge: 'purge_cash_movements', label: 'حركة الأموال' },
  debt: { archive: 'archive_debt_movements', purge: 'purge_debt_movements', label: 'حركة الديون' },
  stock: { archive: 'archive_stock_movements', purge: 'purge_stock_movements', label: 'حركة المخزون' },
};

interface Props {
  kind: LedgerKind;
  onDone?: () => void;
}

export const LedgerAdminActions: React.FC<Props> = ({ kind, onDone }) => {
  const { role } = useAuth();
  const [busy, setBusy] = useState<'archive' | 'purge' | null>(null);

  // مدير النظام فقط
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
      const { data, error } = await supabase.rpc(cfg.purge as any);
      if (error) throw error;
      const deleted = (data as any)?.deleted ?? 0;
      toast.success(`تم حذف ${deleted} سجل من ${cfg.label}`);
      onDone?.();
    } catch (e: any) {
      toast.error(`فشل الحذف: ${e.message ?? e}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
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

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={busy !== null}>
            {busy === 'purge' ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Trash2 className="h-4 w-4 ml-2" />}
            حذف جميع السجلات
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">⚠️ حذف نهائي لكل سجلات {cfg.label}</AlertDialogTitle>
            <AlertDialogDescription>
              هذا الإجراء <strong>لا يمكن التراجع عنه</strong>. سيتم حذف جميع السجلات نهائياً من قاعدة البيانات
              دون أرشفة. متاح لمدير النظام فقط.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={runPurge}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              نعم، احذف الكل نهائياً
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LedgerAdminActions;
