import React, { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import RecalibratePreviewDialog, { PreviewRow } from './RecalibratePreviewDialog';

interface Props {
  workerId: string;
  className?: string;
  title?: string;
}

/**
 * Compact bottom-nav button that triggers the truck-balance recalibration flow
 * (preview → confirm → apply). Kept self-contained so it can be dropped into
 * the mobile bottom navigation without leaking state to the layout.
 */
const RecalibrateBalanceButton: React.FC<Props> = ({ workerId, className, title }) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);

  const openPreview = async () => {
    if (!workerId) return;
    setOpen(true);
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        'preview_recalibrate_worker_stock' as any,
        { p_worker_id: workerId },
      );
      if (error) throw error;
      const all = (data as any[]) || [];
      // Hide rows whose computed balance matches current (no correction needed)
      const changed = all.filter(
        (r) => Number(r.current_qty).toFixed(2) !== Number(r.new_qty).toFixed(2),
      );
      // Attach product images
      const ids = Array.from(new Set(changed.map((r) => r.product_id)));
      let imgMap: Record<string, string | null> = {};
      if (ids.length) {
        const { data: prods } = await supabase
          .from('products')
          .select('id,image_url')
          .in('id', ids);
        imgMap = Object.fromEntries((prods || []).map((p: any) => [p.id, p.image_url]));
      }
      setRows(changed.map((r) => ({ ...r, image_url: imgMap[r.product_id] ?? null })) as PreviewRow[]);
    } catch (e: any) {
      toast.error(e?.message || 'فشل تحميل المعاينة');
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!workerId) return;
    setApplying(true);
    try {
      const { data, error } = await supabase.rpc('recalibrate_worker_stock', { p_worker_id: workerId });
      if (error) throw error;
      const changed = (data || []).filter((r: any) => Number(r.old_qty) !== Number(r.new_qty));
      toast.success(`تم تصحيح ${changed.length} منتج من أصل ${(data || []).length}`);
      await qc.invalidateQueries();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'فشل التصحيح');
    } finally {
      setApplying(false);
    }
  };

  const label = title || 'تصحيح رصيد الشاحنة';

  return (
    <>
      <button
        type="button"
        onClick={openPreview}
        disabled={loading || applying}
        aria-label={label}
        title={label}
        className={cn(
          'relative mx-auto flex h-12 w-12 items-center justify-center rounded-lg transition-all active:scale-95',
          'text-amber-500/85 hover:bg-amber-500/10 hover:text-amber-500 disabled:opacity-60',
          className,
        )}
      >
        {loading || applying ? (
          <Loader2 className="h-[23px] w-[23px] animate-spin" />
        ) : (
          <RefreshCw className="h-[23px] w-[23px]" strokeWidth={1.95} />
        )}
      </button>

      <RecalibratePreviewDialog
        open={open}
        onOpenChange={setOpen}
        rows={rows}
        loading={loading}
        applying={applying}
        onConfirm={apply}
      />
    </>
  );
};

export default RecalibrateBalanceButton;
