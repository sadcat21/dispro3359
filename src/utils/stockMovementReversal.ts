import { supabase } from '@/integrations/supabase/client';

export type StockMovementForReversal = {
  product_id: string;
  branch_id?: string | null;
  worker_id?: string | null;
  movement_type: string;
  quantity?: number | null;
  signed_quantity?: number | null;
  from_location_type?: string | null;
  from_location_id?: string | null;
  product?: { pieces_per_box?: number | null } | null;
};

const bpQuantityToPieces = (value: unknown, piecesPerBox: number): number => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric === 0) return 0;
  const sign = numeric < 0 ? -1 : 1;
  const abs = Math.abs(Math.round(numeric * 100) / 100);
  const boxes = Math.floor(abs);
  const pieces = Math.round((abs - boxes) * 100);
  return sign * ((boxes * Math.max(1, piecesPerBox)) + pieces);
};

const piecesToBpQuantity = (pieces: number, piecesPerBox: number): number => {
  const safePieces = Math.max(0, Math.round(pieces));
  const safePpb = Math.max(1, piecesPerBox);
  const boxes = Math.floor(safePieces / safePpb);
  const remainder = safePieces % safePpb;
  return boxes + remainder / 100;
};

const getMovementSignedQuantity = (movement: StockMovementForReversal): number => {
  const signed = Number(movement.signed_quantity);
  if (Number.isFinite(signed) && movement.signed_quantity !== null && movement.signed_quantity !== undefined) {
    return signed;
  }

  const quantity = Number(movement.quantity || 0);
  if (!Number.isFinite(quantity)) return 0;

  if (['delivery', 'modification', 'promo_gift', 'promo_sale'].includes(movement.movement_type)) {
    return -quantity;
  }

  if (['load', 'return', 'receipt', 'exchange'].includes(movement.movement_type)) {
    return quantity;
  }

  return 0;
};

export const restoreStockFromMovements = async (
  movements: StockMovementForReversal[],
  fallbackWorkerId: string | null | undefined,
  fallbackBranchId: string | null | undefined,
  itemPiecesPerBox: Map<string, number>,
) => {
  const reversals = new Map<string, {
    locationType: 'worker' | 'warehouse';
    ownerId: string;
    branchId: string | null;
    productId: string;
    piecesPerBox: number;
    reversePieces: number;
  }>();

  for (const movement of movements) {
    const piecesPerBox = Math.max(
      1,
      Number(movement.product?.pieces_per_box || itemPiecesPerBox.get(movement.product_id) || 1),
    );
    const signedPieces = bpQuantityToPieces(getMovementSignedQuantity(movement), piecesPerBox);
    if (signedPieces === 0) continue;

    const locationType = movement.from_location_type === 'warehouse' ? 'warehouse' : 'worker';
    const ownerId = locationType === 'warehouse'
      ? (movement.from_location_id || movement.branch_id || fallbackBranchId)
      : (movement.worker_id || fallbackWorkerId);
    if (!ownerId) continue;

    const key = `${locationType}|${ownerId}|${movement.product_id}`;
    const existing = reversals.get(key);
    if (existing) {
      existing.reversePieces -= signedPieces;
    } else {
      reversals.set(key, {
        locationType,
        ownerId,
        branchId: movement.branch_id || fallbackBranchId || null,
        productId: movement.product_id,
        piecesPerBox,
        reversePieces: -signedPieces,
      });
    }
  }

  for (const reversal of reversals.values()) {
    if (reversal.reversePieces === 0) continue;

    if (reversal.locationType === 'warehouse') {
      const { data: stockRow, error } = await supabase
        .from('warehouse_stock')
        .select('id, quantity')
        .eq('branch_id', reversal.ownerId)
        .eq('product_id', reversal.productId)
        .maybeSingle();
      if (error) throw error;

      const currentPieces = stockRow ? bpQuantityToPieces(stockRow.quantity, reversal.piecesPerBox) : 0;
      const nextQuantity = piecesToBpQuantity(currentPieces + reversal.reversePieces, reversal.piecesPerBox);
      if (stockRow) {
        const { error: updateError } = await supabase.from('warehouse_stock').update({ quantity: nextQuantity }).eq('id', stockRow.id);
        if (updateError) throw updateError;
      } else if (nextQuantity > 0) {
        const { error: insertError } = await supabase.from('warehouse_stock').insert({
          branch_id: reversal.ownerId,
          product_id: reversal.productId,
          quantity: nextQuantity,
        });
        if (insertError) throw insertError;
      }
      continue;
    }

    const { data: stockRow, error } = await supabase
      .from('worker_stock')
      .select('id, quantity')
      .eq('worker_id', reversal.ownerId)
      .eq('product_id', reversal.productId)
      .maybeSingle();
    if (error) throw error;

    const currentPieces = stockRow ? bpQuantityToPieces(stockRow.quantity, reversal.piecesPerBox) : 0;
    const nextQuantity = piecesToBpQuantity(currentPieces + reversal.reversePieces, reversal.piecesPerBox);
    if (stockRow) {
      const { error: updateError } = await supabase.from('worker_stock').update({ quantity: nextQuantity }).eq('id', stockRow.id);
      if (updateError) throw updateError;
    } else if (nextQuantity > 0) {
      const { error: insertError } = await supabase.from('worker_stock').insert({
        worker_id: reversal.ownerId,
        product_id: reversal.productId,
        branch_id: reversal.branchId,
        quantity: nextQuantity,
      });
      if (insertError) throw insertError;
    }
  }
};