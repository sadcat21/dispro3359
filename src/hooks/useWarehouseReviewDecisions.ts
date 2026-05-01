import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// نخزن قرار المدير داخل حقل notes كـ JSON لتجنّب تعديل المخطط
export interface ReviewItemMeta {
  decision_status: 'auto_approved' | 'pending' | 'approved' | 'charged_to_worker' | 'rejected';
  manager_decision?: 'accept_surplus' | 'reject_surplus' | 'charge_worker' | 'absorb_deficit' | null;
  manager_decision_at?: string | null;
  manager_decision_by?: string | null;
  manager_decision_by_name?: string | null;
  manager_notes?: string | null;
  worker_debt_id?: string | null;
  reviewer_worker_id?: string | null;
  unit_price?: number | null;
}

export const parseMeta = (notes: string | null | undefined): ReviewItemMeta => {
  if (!notes) return { decision_status: 'auto_approved' };
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === 'object' && 'decision_status' in parsed) {
      return parsed as ReviewItemMeta;
    }
  } catch {
    // legacy plain text
  }
  return { decision_status: 'auto_approved' };
};

export const stringifyMeta = (meta: ReviewItemMeta): string => JSON.stringify(meta);

// جلب البنود المعلّقة (الفوارق التي تنتظر قرار المدير)
export const usePendingReviewItems = (branchId?: string | null) => {
  return useQuery({
    queryKey: ['warehouse-pending-review-items', branchId],
    queryFn: async () => {
      let q = supabase
        .from('warehouse_review_items')
        .select(`
          *,
          product:products(id, name, app_name, image_url, pieces_per_box, price_invoice, price_gros, price_super_gros, price_retail),
          session:warehouse_review_sessions!inner(id, branch_id, reviewer_id, created_at, completed_at, reviewer:workers!warehouse_review_sessions_reviewer_id_fkey(id, full_name))
        `)
        .neq('status', 'matched')
        .order('created_at', { ascending: false });

      if (branchId) q = q.eq('session.branch_id', branchId);

      const { data, error } = await q;
      if (error) throw error;

      // فلترة بحسب decision_status من notes
      return (data || []).map((it: any) => ({
        ...it,
        meta: parseMeta(it.notes),
      }));
    },
    enabled: true,
  });
};

// تطبيق قرار المدير
export const useApplyManagerDecision = () => {
  const queryClient = useQueryClient();
  const { workerId, user, activeBranch } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      itemId: string;
      productId: string | null;
      itemType: string;
      currentMeta: ReviewItemMeta;
      decision: 'accept_surplus' | 'reject_surplus' | 'charge_worker' | 'absorb_deficit';
      managerNotes?: string;
      // لخصم العجز على المسؤول
      reviewerWorkerId?: string | null;
      debtAmount?: number;
      debtDescription?: string;
      // كميات لتعديل المخزون
      branchId?: string | null;
      newStockQty?: number | null;
      // تحديث الكميات الفعلية (إذا أعاد المدير المراجعة)
      newActualQuantity?: number | null;
      newStatus?: 'matched' | 'surplus' | 'deficit' | null;
      newBoxesQuantity?: number | null;
      newPiecesQuantity?: number | null;
      newDamagedQuantity?: number | null;
    }) => {
      let workerDebtId: string | null = null;

      // إنشاء دين على مسؤول المخزن إذا تم اختيار charge_worker
      if (params.decision === 'charge_worker' && params.reviewerWorkerId && (params.debtAmount || 0) > 0) {
        const { data: debt, error: debtErr } = await supabase
          .from('worker_debts')
          .insert({
            worker_id: params.reviewerWorkerId,
            amount: params.debtAmount,
            debt_type: 'deficit',
            description: params.debtDescription || 'عجز في مراجعة المخزون',
            branch_id: params.branchId || activeBranch?.id || null,
            created_by: workerId!,
          })
          .select('id')
          .single();
        if (debtErr) throw debtErr;
        workerDebtId = debt.id;
      }

      // تحديد الحالة الجديدة
      let newDecisionStatus: ReviewItemMeta['decision_status'] = 'approved';
      if (params.decision === 'charge_worker') newDecisionStatus = 'charged_to_worker';
      else if (params.decision === 'reject_surplus') newDecisionStatus = 'rejected';

      const newMeta: ReviewItemMeta = {
        ...params.currentMeta,
        decision_status: newDecisionStatus,
        manager_decision: params.decision,
        manager_decision_at: new Date().toISOString(),
        manager_decision_by: workerId,
        manager_decision_by_name: user?.full_name || null,
        manager_notes: params.managerNotes || null,
        worker_debt_id: workerDebtId,
      };

      // إذا تم تعديل الكميات الفعلية من طرف المدير، نحدّثها أيضاً في عنصر المراجعة
      const itemUpdate: any = { notes: stringifyMeta(newMeta) };
      if (params.newActualQuantity !== null && params.newActualQuantity !== undefined) {
        itemUpdate.actual_quantity = params.newActualQuantity;
      }
      if (params.newStatus) itemUpdate.status = params.newStatus;
      if (params.newBoxesQuantity !== null && params.newBoxesQuantity !== undefined) itemUpdate.boxes_quantity = params.newBoxesQuantity;
      if (params.newPiecesQuantity !== null && params.newPiecesQuantity !== undefined) itemUpdate.pieces_quantity = params.newPiecesQuantity;
      if (params.newDamagedQuantity !== null && params.newDamagedQuantity !== undefined) itemUpdate.damaged_quantity = params.newDamagedQuantity;

      const { error: updErr } = await supabase
        .from('warehouse_review_items')
        .update(itemUpdate)
        .eq('id', params.itemId);
      if (updErr) throw updErr;

      // تحديث المخزون عند:
      // - accept_surplus: زيادة المخزون لتعكس الفائض
      // - absorb_deficit: قبول العجز كنقص فعلي
      // - charge_worker: المخزون يُعدّل ليعكس الفعلي (والفرق دين على المسؤول)
      // - reject_surplus: لا نُحدّث المخزون (نبقي المتوقع)
      if (
        params.productId &&
        params.branchId &&
        params.itemType === 'product' &&
        params.newStockQty !== null &&
        params.newStockQty !== undefined &&
        params.decision !== 'reject_surplus'
      ) {
        const { error: stockErr } = await supabase
          .from('warehouse_stock')
          .update({ quantity: params.newStockQty })
          .eq('branch_id', params.branchId)
          .eq('product_id', params.productId);
        if (stockErr) throw stockErr;
      }

      return { workerDebtId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-pending-review-items'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-review-history'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-product-summary'] });
      queryClient.invalidateQueries({ queryKey: ['worker-debts'] });
    },
  });
};
