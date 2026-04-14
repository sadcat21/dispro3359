import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface StockEditHistoryProps {
  productId: string;
  branchId: string;
}

const FIELD_LABELS: Record<string, string> = {
  damaged: 'التالف',
  factoryReturn: 'المسترجع',
  compensation: 'التعويض',
  surplus: 'الفائض',
  deficit: 'العجز',
  remaining: 'المتبقي',
  sold: 'المباع',
  gifts: 'الهدايا',
};

const ALL_FIELDS = ['remaining', 'sold', 'gifts', 'damaged', 'factoryReturn', 'compensation', 'surplus', 'deficit'];

const StockEditHistory: React.FC<StockEditHistoryProps> = ({ productId, branchId }) => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['stock-edit-history', productId, branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*, worker:workers(full_name)')
        .eq('entity_type', 'warehouse_stock_manual_edit')
        .eq('entity_id', productId)
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-4">لا توجد تعديلات سابقة</p>;
  }

  return (
    <ScrollArea className="max-h-[400px]">
      <div className="space-y-4 p-1">
        {logs.map((log) => {
          const details = log.details as any;
          const changes = details?.changes || {};
          const workerName = (log as any).worker?.full_name || 'غير معروف';
          const changedFields = ALL_FIELDS.filter(f => changes[f]);

          if (changedFields.length === 0) return null;

          return (
            <div key={log.id} className="border rounded-lg p-2 space-y-2 text-xs">
              {/* Header: date + worker */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm')}
                </span>
                <Badge variant="outline" className="text-[10px]">{workerName}</Badge>
              </div>

              {/* Mini table: columns = changed fields, rows = before/after */}
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr>
                      <th className="text-[10px] text-muted-foreground p-1 border-b"></th>
                      {changedFields.map(f => (
                        <th key={f} className="text-[10px] font-medium p-1 border-b">
                          {FIELD_LABELS[f] || f}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="text-[10px] text-muted-foreground p-1 border-b font-medium">قبل</td>
                      {changedFields.map(f => (
                        <td key={f} className="p-1 border-b text-destructive font-medium text-[11px]">
                          {changes[f].from}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="text-[10px] text-muted-foreground p-1 font-medium">بعد</td>
                      {changedFields.map(f => (
                        <td key={f} className="p-1 text-[11px] font-medium" style={{ color: 'hsl(var(--primary))' }}>
                          {changes[f].to}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};

export default StockEditHistory;
