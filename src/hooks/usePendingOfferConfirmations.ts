import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PendingOfferConfirmation } from '@/types/pendingOffer';

interface Filters {
  workerId?: string | null;
  branchId?: string | null;
  status?: 'pending' | 'confirmed' | 'rejected' | null;
  dateFrom?: string | null; // YYYY-MM-DD (created_at >=)
  dateTo?: string | null;   // YYYY-MM-DD (created_at <=)
}

export function usePendingOfferConfirmations(filters: Filters = {}) {
  const [items, setItems] = useState<PendingOfferConfirmation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      let q = (supabase as any)
        .from('pending_offer_confirmations')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.workerId) q = q.eq('worker_id', filters.workerId);
      if (filters.branchId) q = q.eq('branch_id', filters.branchId);
      if (filters.status) q = q.eq('status', filters.status);
      if (filters.dateFrom) q = q.gte('created_at', `${filters.dateFrom}T00:00:00`);
      if (filters.dateTo) q = q.lte('created_at', `${filters.dateTo}T23:59:59`);

      const { data, error } = await q;
      if (error) throw error;
      setItems((data || []) as PendingOfferConfirmation[]);
    } catch (e) {
      console.error('[usePendingOfferConfirmations] fetch error', e);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters.workerId, filters.branchId, filters.status, filters.dateFrom, filters.dateTo]);

  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2));

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`pending-offers-${instanceIdRef.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_offer_confirmations' }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, filters.workerId, filters.branchId]);

  return { items, isLoading, refetch: fetchData };
}
