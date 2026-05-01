import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { dbBPToBoxes } from '@/utils/boxPieceInput';

export interface MovementRow {
  id: string;
  movement_type: string;
  quantity: number;
  created_at: string;
  notes: string | null;
  /** الإشارة: +1 دخول للمخزن، -1 خروج */
  sign: 1 | -1;
  /** الكمية المحوّلة لصناديق كسرية */
  qtyBoxes: number;
}

const SIGN_MAP: Record<string, 1 | -1> = {
  load: -1,
  delivery: -1,
  receipt: 1,
  return: 1,
};

/**
 * يجلب حركات المنتج في فرع منذ تاريخ معيّن (تاريخ مراجعة مسؤول المخزن).
 * يحسب التغيّر الصافي بصيغة الصناديق الكسرية.
 */
export const useReviewItemMovements = (params: {
  productId?: string | null;
  branchId?: string | null;
  sinceIso?: string | null;
  piecesPerBox?: number;
  enabled?: boolean;
}) => {
  const { productId, branchId, sinceIso, piecesPerBox = 1, enabled = true } = params;

  return useQuery({
    queryKey: ['review-item-movements', productId, branchId, sinceIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('id, movement_type, quantity, created_at, notes, status')
        .eq('product_id', productId!)
        .eq('branch_id', branchId!)
        .gt('created_at', sinceIso!)
        .neq('status', 'rejected')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const rows: MovementRow[] = (data || []).map((m: any) => {
        const sign = SIGN_MAP[m.movement_type] ?? 1;
        const qtyBoxes = dbBPToBoxes(Number(m.quantity || 0), piecesPerBox);
        return {
          id: m.id,
          movement_type: m.movement_type,
          quantity: Number(m.quantity || 0),
          created_at: m.created_at,
          notes: m.notes,
          sign,
          qtyBoxes,
        };
      });

      const netChange = rows.reduce((acc, r) => acc + r.sign * r.qtyBoxes, 0);
      return { rows, netChange };
    },
    enabled: !!productId && !!branchId && !!sinceIso && enabled,
  });
};

export const movementTypeLabel = (t: string): string => {
  switch (t) {
    case 'load': return 'شحن للعامل';
    case 'delivery': return 'تسليم';
    case 'receipt': return 'استلام للمخزن';
    case 'return': return 'مرتجع';
    default: return t;
  }
};
