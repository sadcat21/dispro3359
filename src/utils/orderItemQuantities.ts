export interface GiftBreakdownInput {
  quantity?: number | null;
  gift_quantity?: number | null;
  gift_pieces?: number | null;
  pieces_per_box?: number | null;
  unit_price?: number | null;
  total_price?: number | null;
  delivered_quantity?: number | null;
  stock_movement_quantity?: number | null;
}

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getGiftTotalPieces = (item: GiftBreakdownInput): number => {
  const piecesPerBox = Math.max(1, toNumber(item.pieces_per_box) || 1);
  const giftBoxes = Math.max(0, toNumber(item.gift_quantity));
  const giftPieces = Math.max(0, toNumber(item.gift_pieces));
  return (giftBoxes * piecesPerBox) + giftPieces;
};

export const getGiftTotalBoxes = (item: GiftBreakdownInput): number => {
  const piecesPerBox = Math.max(1, toNumber(item.pieces_per_box) || 1);
  return getGiftTotalPieces(item) / piecesPerBox;
};

export const getPaidQuantity = (item: GiftBreakdownInput): number => {
  const quantity = Math.max(0, toNumber(item.quantity));
  const giftBoxes = Math.max(0, toNumber(item.gift_quantity));
  const unitPrice = toNumber(item.unit_price);
  const totalPrice = toNumber(item.total_price);

  // The stored order quantity represents sold boxes plus any full-box gifts only.
  // Piece-level gifts are tracked separately in gift_pieces and must not reduce paid boxes.
  if (quantity > 0) {
    return Math.max(0, quantity - giftBoxes);
  }

  if (unitPrice > 0 && totalPrice >= 0) {
    const paidFromAmount = Number((totalPrice / unitPrice).toFixed(3));
    if (Number.isFinite(paidFromAmount) && paidFromAmount >= 0) {
      return paidFromAmount;
    }
  }

  return 0;
};

export const getDeliveredPaidQuantity = (item: GiftBreakdownInput): number => {
  const movementQuantity = item.delivered_quantity ?? item.stock_movement_quantity;
  if (movementQuantity !== undefined && movementQuantity !== null) {
    return Math.max(0, toNumber(movementQuantity));
  }

  return getPaidQuantity(item);
};