import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTreasurySummary } from '@/hooks/useManagerTreasury';
import { toast } from 'sonner';
import CashConsolidationFormDialog from '@/components/treasury/CashConsolidationFormDialog';
import {
  buildCashConsolidationNote,
  getCashConsolidationDebitNote,
  parseCashConsolidationNote,
} from '@/utils/treasuryCashConsolidation';

interface TreasuryConsolidationEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consolidationId: string | null;
}

const CONSOLIDATION_GROUP_WINDOW_MS = 10000;

type DebitEntry = {
  id: string;
  payment_method: 'cash_invoice1' | 'receipt_cash' | 'cash_invoice2';
  amount: number;
};

const TreasuryConsolidationEditDialog = ({
  open,
  onOpenChange,
  consolidationId,
}: TreasuryConsolidationEditDialogProps) => {
  const { activeBranch } = useAuth();
  const queryClient = useQueryClient();
  const { data: summary } = useTreasurySummary();
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['treasury-consolidation-editor', consolidationId, activeBranch?.id],
    enabled: open && !!consolidationId,
    queryFn: async () => {
      let debitsQuery = supabase
        .from('manager_treasury')
        .select('id, payment_method, amount, created_at, customer_name')
        .eq('source_type', 'cash_consolidation_debit');

      if (activeBranch?.id) {
        debitsQuery = debitsQuery.eq('branch_id', activeBranch.id);
      }

      const [mainResult, debitsResult] = await Promise.all([
        supabase.from('manager_treasury').select('*').eq('id', consolidationId).single(),
        debitsQuery,
      ]);

      if (mainResult.error) throw mainResult.error;
      if (debitsResult.error) throw debitsResult.error;

      const mainEntry = mainResult.data;
      const mainTime = new Date(mainEntry.created_at).getTime();
      const relatedDebits = (debitsResult.data || []).filter((entry: any) => (
        entry.customer_name === mainEntry.customer_name
        && Math.abs(new Date(entry.created_at).getTime() - mainTime) < CONSOLIDATION_GROUP_WINDOW_MS
      )) as DebitEntry[];

      const debitByMethod = relatedDebits.reduce<Partial<Record<DebitEntry['payment_method'], DebitEntry>>>((acc, entry) => {
        if (entry.payment_method === 'cash_invoice1' || entry.payment_method === 'receipt_cash' || entry.payment_method === 'cash_invoice2') {
          acc[entry.payment_method] = entry;
        }
        return acc;
      }, {});

      const initialSources = parseCashConsolidationNote(
        mainEntry.notes,
        Math.abs(Number(debitByMethod.cash_invoice1?.amount || 0)),
      );

      return {
        mainEntry,
        debitByMethod,
        initialSources,
      };
    },
  });

  const versementCashRemaining = Math.max((summary?.receipt_cash || 0) - (summary?.receipt_cash_handed || 0), 0);

  const sourceLimits = useMemo(() => {
    if (!data) return undefined;

    return {
      cashInvoice1: Math.max((summary?.cash_invoice1 || 0) - (summary?.cash_invoice1_handed || 0), 0) + data.initialSources.cashInvoice1,
      stamp: Math.max(summary?.cash_invoice1_stamp || 0, 0) + data.initialSources.stamp,
      receiptCash: 0,
      cashInvoice2: Math.max((summary?.cash_invoice2 || 0) - (summary?.cash_invoice2_handed || 0), 0) + data.initialSources.cashInvoice2,
    };
  }, [data, summary]);

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
    queryClient.invalidateQueries({ queryKey: ['treasury-details'] });
    queryClient.invalidateQueries({ queryKey: ['treasury-remaining-counts'] });
    queryClient.invalidateQueries({ queryKey: ['consolidation-history'] });
    queryClient.invalidateQueries({ queryKey: ['manager-treasury'] });
    queryClient.invalidateQueries({ queryKey: ['treasury-consolidation-editor'] });
  };

  const handleSubmit = async ({
    customerName,
    invoiceTotal,
    sources,
  }: {
    customerName: string;
    invoiceTotal: number;
    sources: {
      cashInvoice1: number;
      stamp: number;
      receiptCash: number;
      cashInvoice2: number;
    };
  }) => {
    if (!data || !consolidationId) return;

    setSaving(true);
    try {
      const desiredDebits = {
        cash_invoice1: Math.max(0, sources.cashInvoice1 + sources.stamp),
        receipt_cash: Math.max(0, sources.receiptCash),
        cash_invoice2: Math.max(0, sources.cashInvoice2),
      };

      const { error: mainError } = await supabase
        .from('manager_treasury')
        .update({
          customer_name: customerName,
          amount: invoiceTotal,
          notes: buildCashConsolidationNote(sources),
        })
        .eq('id', consolidationId);

      if (mainError) throw mainError;

      await Promise.all((Object.entries(desiredDebits) as Array<[keyof typeof desiredDebits, number]>).map(async ([paymentMethod, amount]) => {
        const existingEntry = data.debitByMethod[paymentMethod];

        if (amount <= 0) {
          if (existingEntry?.id) {
            const { error: deleteError } = await supabase
              .from('manager_treasury')
              .delete()
              .eq('id', existingEntry.id);
            if (deleteError) throw deleteError;
          }
          return;
        }

        const payload = {
          customer_name: customerName,
          amount: -Math.abs(amount),
          notes: getCashConsolidationDebitNote(paymentMethod),
        };

        if (existingEntry?.id) {
          const { error: updateError } = await supabase
            .from('manager_treasury')
            .update(payload)
            .eq('id', existingEntry.id);
          if (updateError) throw updateError;
          return;
        }

        const { error: insertError } = await supabase.from('manager_treasury').insert({
          manager_id: data.mainEntry.manager_id,
          branch_id: data.mainEntry.branch_id,
          source_type: 'cash_consolidation_debit',
          payment_method: paymentMethod,
          amount: -Math.abs(amount),
          customer_name: customerName,
          notes: getCashConsolidationDebitNote(paymentMethod),
          created_at: data.mainEntry.created_at,
        });

        if (insertError) throw insertError;
      }));

      toast.success('تم تحديث التجميع بنجاح');
      invalidateQueries();
      onOpenChange(false);
    } catch (submitError: any) {
      toast.error(`خطأ: ${submitError.message || ''}`);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  if (isLoading || !data) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent dir="rtl" className="max-w-sm">
          <div className="py-8 text-center text-sm text-muted-foreground">
            {error ? 'تعذر تحميل بيانات التجميع' : 'جاري تحميل بيانات التجميع...'}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <CashConsolidationFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="تعديل التجميع"
      submitLabel="حفظ التعديلات"
      saving={saving}
      editableSources={false}
      initialCustomerName={data.mainEntry.customer_name || ''}
      initialInvoiceTotal={Number(data.mainEntry.amount || 0)}
      initialSources={{
        ...data.initialSources,
        receiptCash: 0,
      }}
      sourceLimits={sourceLimits}
      versementCashWarningAmount={versementCashRemaining}
      onSubmit={handleSubmit}
    />
  );
};

export default TreasuryConsolidationEditDialog;
