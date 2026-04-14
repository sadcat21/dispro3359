import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { TreasurySummary } from '@/hooks/useManagerTreasury';
import CashConsolidationFormDialog from '@/components/treasury/CashConsolidationFormDialog';
import { buildCashConsolidationNote, getCashConsolidationDebitNote } from '@/utils/treasuryCashConsolidation';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: TreasurySummary | undefined;
}

const CashConsolidationDialog = ({ open, onOpenChange, summary }: Props) => {
  const { workerId, activeBranch } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const cashInvoice1Remaining = Math.max((summary?.cash_invoice1 || 0) - (summary?.cash_invoice1_handed || 0), 0);
  const stampRemaining = Math.max(summary?.cash_invoice1_stamp || 0, 0);
  const versementCashRemaining = Math.max((summary?.receipt_cash || 0) - (summary?.receipt_cash_handed || 0), 0);
  const cashInvoice2Remaining = Math.max((summary?.cash_invoice2 || 0) - (summary?.cash_invoice2_handed || 0), 0);

  const handleConsolidate = async ({
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
    if (!customerName.trim()) {
      toast.error('يرجى إدخال اسم العميل');
      return;
    }
    if (invoiceTotal <= 0) {
      toast.error('لا يوجد مبلغ للتجميع');
      return;
    }

    setSaving(true);
    try {
      const entries: any[] = [
        {
          manager_id: workerId!,
          branch_id: activeBranch?.id || null,
          source_type: 'cash_consolidation',
          payment_method: 'bank_receipt',
          amount: invoiceTotal,
          customer_name: customerName.trim(),
          notes: buildCashConsolidationNote(sources),
        },
      ];

      const cashInvoice1WithStamp = sources.cashInvoice1 + sources.stamp;
      if (cashInvoice1WithStamp > 0) {
        entries.push({
          manager_id: workerId!,
          branch_id: activeBranch?.id || null,
          source_type: 'cash_consolidation_debit',
          payment_method: 'cash_invoice1',
          amount: -cashInvoice1WithStamp,
          customer_name: customerName.trim(),
          notes: getCashConsolidationDebitNote('cash_invoice1'),
        });
      }
      if (sources.receiptCash > 0) {
        entries.push({
          manager_id: workerId!,
          branch_id: activeBranch?.id || null,
          source_type: 'cash_consolidation_debit',
          payment_method: 'receipt_cash',
          amount: -sources.receiptCash,
          customer_name: customerName.trim(),
          notes: getCashConsolidationDebitNote('receipt_cash'),
        });
      }
      if (sources.cashInvoice2 > 0) {
        entries.push({
          manager_id: workerId!,
          branch_id: activeBranch?.id || null,
          source_type: 'cash_consolidation_debit',
          payment_method: 'cash_invoice2',
          amount: -sources.cashInvoice2,
          customer_name: customerName.trim(),
          notes: getCashConsolidationDebitNote('cash_invoice2'),
        });
      }

      const { error } = await supabase.from('manager_treasury').insert(entries);
      if (error) throw error;

      toast.success('تم تجميع الكاش وتحويله إلى Versement Doc بنجاح');
      queryClient.invalidateQueries({ queryKey: ['manager-treasury'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-details'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-remaining-counts'] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error('خطأ: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CashConsolidationFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="تجميع الكاش → Versement Doc"
      submitLabel="تجميع وتحويل"
      saving={saving}
      initialCustomerName=""
      initialInvoiceTotal={cashInvoice1Remaining + stampRemaining}
      initialSources={{
        cashInvoice1: cashInvoice1Remaining,
        stamp: stampRemaining,
        receiptCash: 0,
        cashInvoice2: 0,
      }}
      sourceLimits={{
        cashInvoice1: cashInvoice1Remaining,
        stamp: stampRemaining,
        receiptCash: 0,
        cashInvoice2: cashInvoice2Remaining,
      }}
      versementCashWarningAmount={versementCashRemaining}
      onSubmit={handleConsolidate}
    />
  );
};

export default CashConsolidationDialog;
