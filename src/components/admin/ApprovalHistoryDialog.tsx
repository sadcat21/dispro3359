import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, History, CheckCircle2, XCircle } from 'lucide-react';
import FactoryReceiptQuickDialog from '@/components/stock/FactoryReceiptQuickDialog';
import { useState } from 'react';

export type ApprovalHistoryType = 'factory_in' | 'sector' | 'invoices';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: ApprovalHistoryType;
  title: string;
  branchFilter?: string | null;
}

const statusBadge = (status: string) => {
  const ok = ['approved', 'received'].includes(status);
  return (
    <Badge className={ok ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'}>
      {ok ? <CheckCircle2 className="w-3 h-3 me-1" /> : <XCircle className="w-3 h-3 me-1" />}
      {ok ? 'مقبول' : 'مرفوض'}
    </Badge>
  );
};

const ApprovalHistoryDialog: React.FC<Props> = ({ open, onOpenChange, type, title, branchFilter }) => {
  const [previewReceiptId, setPreviewReceiptId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['approval-history', type, branchFilter],
    enabled: open,
    queryFn: async () => {
      if (type === 'factory_in') {
        let q = supabase
          .from('stock_receipts')
          .select('id, receipt_date, invoice_number, total_items, status, branch_approved_at, branches(name)')
          .in('status', ['approved', 'received', 'rejected'])
          .order('branch_approved_at', { ascending: false })
          .limit(100);
        if (branchFilter) q = q.eq('branch_id', branchFilter);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map((r: any) => ({
          id: r.id,
          status: r.status,
          title: `فاتورة ${r.invoice_number || '—'}`,
          subtitle: `${r.branches?.name || '—'} · ${r.receipt_date} · عناصر ${r.total_items || 0}`,
          date: r.branch_approved_at,
        }));
      }
      if (type === 'sector') {
        let q = supabase
          .from('sector_coverage')
          .select(`id, start_date, end_date, approval_status,
            absent_worker:workers!sector_coverage_absent_worker_id_fkey(full_name),
            substitute_worker:workers!sector_coverage_substitute_worker_id_fkey(full_name),
            sectors!inner(name, branch_id, branches(name))`)
          .in('approval_status', ['approved', 'rejected'])
          .order('updated_at', { ascending: false })
          .limit(100);
        if (branchFilter) q = q.eq('sectors.branch_id', branchFilter);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map((c: any) => ({
          id: c.id,
          status: c.approval_status,
          title: `${c.sectors?.name || '—'}`,
          subtitle: `${c.absent_worker?.full_name || '—'} → ${c.substitute_worker?.full_name || '—'} · ${c.start_date} → ${c.end_date}`,
          date: c.start_date,
        }));
      }
      // invoices
      let q = supabase
        .from('manual_invoice_requests')
        .select('id, invoice_number, status, assistant_approved_at, branch_approved_at, customers(name), branches(name)')
        .in('status', ['approved', 'rejected'])
        .order('assistant_approved_at', { ascending: false })
        .limit(100);
      if (branchFilter) q = q.eq('branch_id', branchFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((i: any) => ({
        id: i.id,
        status: i.status,
        title: `${i.customers?.name || '—'} — ${i.invoice_number || '—'}`,
        subtitle: `${i.branches?.name || '—'}`,
        date: i.assistant_approved_at || i.branch_approved_at,
      }));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[85dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            سجل {title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>لا يوجد سجل بعد</p>
            </div>
          ) : (
            data.map((row) => (
              <Card
                key={row.id}
                className={`border-slate-200 ${type === 'factory_in' ? 'cursor-pointer hover:border-primary hover:shadow-md transition' : ''}`}
                onClick={() => { if (type === 'factory_in') setPreviewReceiptId(row.id); }}
              >
                <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{row.title}</p>
                    <p className="text-xs text-muted-foreground">{row.subtitle}</p>
                    {row.date && <p className="text-[11px] text-muted-foreground">{new Date(row.date).toLocaleString()}</p>}
                  </div>
                  {statusBadge(row.status)}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <ReceiptPrintViewById
          receiptId={previewReceiptId}
          open={!!previewReceiptId}
          onOpenChange={(v) => { if (!v) setPreviewReceiptId(null); }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ApprovalHistoryDialog;