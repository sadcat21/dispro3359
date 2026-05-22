import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { StockConfirmation, StockConfirmationItem } from './useStockConfirmations';

export const useManagerConfirmations = () => {
  const { workerId: currentWorkerId, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const isReady = !isAuthLoading && isAuthenticated && !!currentWorkerId;

  const confirmationsQuery = useQuery({
    queryKey: ['manager-confirmations', currentWorkerId],
    queryFn: async () => {
      if (!currentWorkerId) return [];
      const { data, error } = await supabase
        .from('stock_confirmations')
        .select(`
          *,
          manager:workers!stock_confirmations_manager_id_fkey(full_name),
          worker:workers!stock_confirmations_worker_id_fkey(full_name)
        `)
        .eq('manager_id', currentWorkerId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      const confirmations = (data || []) as unknown as StockConfirmation[];
      const productIds = [...new Set(confirmations.flatMap(c => (c.items || []).map(i => i.product_id)))];
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, app_name, image_url')
          .in('id', productIds);
        if (products) {
          const productMap = new Map(products.map(p => [p.id, p]));
          confirmations.forEach(c => {
            c.items = (c.items || []).map(item => {
              const prod = productMap.get(item.product_id);
              if (prod) {
                item.product_app_name = item.product_app_name || prod.app_name;
                item.image_url = item.image_url || prod.image_url;
              }
              return item;
            });
          });
        }
      }
      return confirmations;
    },
    enabled: isReady,
  });

  const needsAttentionCount = (confirmationsQuery.data || []).filter(
    c => c.status === 'rejected'
  ).length;

  const amendConfirmation = useMutation({
    mutationFn: async ({
      confirmationId,
      newItems,
      note,
    }: {
      confirmationId: string;
      newItems: StockConfirmationItem[];
      note: string;
    }) => {
      if (!currentWorkerId) throw new Error('تعذر تحديد مسؤول المخزن الحالي');

      const { data: original, error: fetchErr } = await supabase
        .from('stock_confirmations')
        .select('*')
        .eq('id', confirmationId)
        .eq('manager_id', currentWorkerId)
        .maybeSingle();
      if (fetchErr || !original) throw fetchErr || new Error('لم يتم العثور على العملية');

      const orig = original as any;

      if (orig.frozen_at) {
        throw new Error('العملية مجمّدة من طرف عامل التوصيل — اطلب منه فك التجميد أولاً');
      }

      const { error } = await supabase
        .from('stock_confirmations')
        .update({
          items: newItems as any,
          previous_items: orig.items,
          amendment_note: note,
          status: 'amended',
          rejection_note: null,
          responded_at: null,
        } as any)
        .eq('id', confirmationId)
        .eq('manager_id', currentWorkerId);
      if (error) throw error;

      // Sync the underlying loading_session_items so that the worker's
      // approval (which reads from loading_session_items via RPC) reflects
      // the amended quantities — not the original ones.
      if (orig.operation_type === 'load' && orig.source_session_id) {
        const { data: existingItems, error: existingErr } = await supabase
          .from('loading_session_items')
          .select('id, product_id')
          .eq('session_id', orig.source_session_id);
        if (existingErr) throw existingErr;

        const existingMap = new Map((existingItems || []).map((item: any) => [item.product_id, item]));
        const nextProductIds = new Set((newItems || []).map((item: any) => item.product_id));
        const removedIds = (existingItems || [])
          .filter((item: any) => !nextProductIds.has(item.product_id))
          .map((item: any) => item.id);

        if (removedIds.length > 0) {
          const { error: deleteErr } = await supabase
            .from('loading_session_items')
            .delete()
            .in('id', removedIds);
          if (deleteErr) throw deleteErr;
        }

        for (const it of newItems as any[]) {
          const existingRow = existingMap.get(it.product_id);
          if (existingRow) {
            const { error: updErr } = await supabase
              .from('loading_session_items')
              .update({
                quantity: it.quantity,
                gift_quantity: it.gift_quantity ?? 0,
                gift_unit: it.gift_unit ?? 'piece',
              })
              .eq('id', existingRow.id);
            if (updErr) throw updErr;
          } else {
            const { error: insertErr } = await supabase
              .from('loading_session_items')
              .insert({
                session_id: orig.source_session_id,
                product_id: it.product_id,
                quantity: it.quantity,
                gift_quantity: it.gift_quantity ?? 0,
                gift_unit: it.gift_unit ?? 'piece',
              });
            if (insertErr) throw insertErr;
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-confirmations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-confirmations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-confirmations-count'] });
      toast.success('تم تعديل العملية وإعادة إرسالها للعامل');
    },
    onError: (err: any) => toast.error(err?.message || 'فشل التعديل'),
  });

  const cancelConfirmation = useMutation({
    mutationFn: async ({ confirmationId, note }: { confirmationId: string; note?: string }) => {
      if (!currentWorkerId) throw new Error('تعذر تحديد مسؤول المخزن الحالي');
      const { error } = await supabase
        .from('stock_confirmations')
        .update({
          status: 'cancelled',
          amendment_note: note || 'تم إلغاء الشحن من قِبل مسؤول المخزن',
          responded_at: new Date().toISOString(),
        } as any)
        .eq('id', confirmationId)
        .eq('manager_id', currentWorkerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-confirmations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-confirmations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-confirmations-count'] });
      toast.success('تم إلغاء الشحن وإبلاغ الطرفين');
    },
    onError: (err: any) => toast.error(err?.message || 'فشل إلغاء الشحن'),
  });

  return {
    confirmations: confirmationsQuery.data || [],
    isLoading: isAuthLoading || confirmationsQuery.isLoading,
    needsAttentionCount,
    currentWorkerId,
    amendConfirmation,
    cancelConfirmation,
    refetch: () => confirmationsQuery.refetch(),
  };
};
