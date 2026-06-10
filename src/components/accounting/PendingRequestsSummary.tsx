import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Store, Phone, MapPin, Trash2, Loader2 } from 'lucide-react';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface Props {
  workerId: string;
  periodStart: string;
  periodEnd: string;
}

interface ReqRow {
  id: string;
  operation_type: string;
  status: string;
  payload: any;
  created_at: string;
}

const toTz = (v: string, isEnd: boolean) => {
  if (v.includes('+') || v.includes('Z')) return v;
  if (v.includes('T')) return `${v}:00+01:00`;
  return isEnd ? `${v}T23:59:59+01:00` : `${v}T00:00:00+01:00`;
};

const PendingRequestsSummary: React.FC<Props> = ({ workerId, periodStart, periodEnd }) => {
  useRealtimeSubscription(
    `session-pending-requests-${workerId || 'none'}`,
    [{ table: 'customer_approval_requests', filter: workerId ? `requested_by=eq.${workerId}` : undefined }],
    [['session-pending-requests', workerId, periodStart, periodEnd]],
    !!workerId && !!periodStart && !!periodEnd,
  );

  const { data: requests, isLoading } = useQuery({
    queryKey: ['session-pending-requests', workerId, periodStart, periodEnd],
    queryFn: async (): Promise<ReqRow[]> => {
      const { data, error } = await (supabase as any)
        .from('customer_approval_requests')
        .select('id, operation_type, status, payload, created_at')
        .eq('requested_by', workerId)
        .eq('status', 'pending')
        .gte('created_at', toTz(periodStart, false))
        .lte('created_at', toTz(periodEnd, true))
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ReqRow[];
    },
    enabled: !!workerId && !!periodStart && !!periodEnd,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return <p className="text-xs text-muted-foreground">لا توجد طلبات معلقة خلال هذه الفترة ✓</p>;
  }

  return (
    <div className="space-y-2">
      <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px]">
        <Clock className="w-3 h-3 ml-1" />
        {requests.length} طلب معلق
      </Badge>

      {requests.map((req) => (
        <Card key={req.id} className="overflow-hidden border-amber-200">
          <div className="h-1 w-full bg-amber-500" />
          <CardContent className="p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <Badge
                variant={req.operation_type === 'delete' ? 'destructive' : 'outline'}
                className="text-[10px] gap-0.5"
              >
                {req.operation_type === 'delete' && <Trash2 className="w-2.5 h-2.5" />}
                {req.operation_type === 'update'
                  ? 'طلب تعديل'
                  : req.operation_type === 'insert'
                  ? 'طلب إضافة'
                  : 'طلب حذف'}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {new Date(req.created_at).toLocaleString('ar-DZ')}
              </span>
            </div>

            <h4 className="text-xs font-semibold flex items-center gap-1.5">
              <Store className="w-3 h-3 text-primary" />
              {req.payload?.store_name || req.payload?.name || req.payload?.customerName || '—'}
            </h4>

            <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
              {req.payload?.phone && (
                <span className="flex items-center gap-0.5">
                  <Phone className="w-2.5 h-2.5" />
                  <span dir="ltr">{req.payload.phone}</span>
                </span>
              )}
              {req.payload?.wilaya && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" />
                  {req.payload.wilaya}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PendingRequestsSummary;
