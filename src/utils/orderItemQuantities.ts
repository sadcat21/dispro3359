export interface GiftBreakdownInput {
  quantity?: number | null;
  gift_quantity?: number | null;
  gift_pieces?: number | null;
  pieces_per_box?: number | null;
  unit_price?: number | null;
  total_price?: number | null;
  delivered_quantity?: number | null;
  stock_movement_quantity?: number | null;
  is_unit_sale?: boolean | null;
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

export const toStoredOrderItemQuantity = (
  quantity: number | null | undefined,
  piecesPerBox: number | null | undefined,
  isUnitSale?: boolean | null,
): number => {
  const safeQuantity = Math.max(0, toNumber(quantity));
  const safePiecesPerBox = Math.max(1, toNumber(piecesPerBox) || 1);

  if (isUnitSale) {
    return safeQuantity;
  }

  const boxes = Math.floor(safeQuantity);
  const fractionalBoxes = safeQuantity - boxes;
  const pieces = Math.round(fractionalBoxes * safePiecesPerBox);

  return Number(`${boxes}.${String(Math.max(0, pieces)).padStart(2, '0')}`);
};

export const getPaidQuantity = (item: GiftBreakdownInput): number => {
  const rawQuantity = Math.max(0, toNumber(item.quantity));
  const giftBoxes = Math.max(0, toNumber(item.gift_quantity));
  const unitPrice = toNumber(item.unit_price);
  const totalPrice = toNumber(item.total_price);

  // The stored order quantity represents sold boxes plus any full-box gifts only.
  // Piece-level gifts are tracked separately in gift_pieces and must not reduce paid boxes.
  if (rawQuantity > 0) {
    return Math.max(0, rawQuantity - giftBoxes);
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
  const paidQuantity = getPaidQuantity(item);
  const movementQuantity = item.delivered_quantity ?? item.stock_movement_quantity;
  if (movementQuantity !== undefined && movementQuantity !== null) {
    const deliveredQuantity = Math.max(0, toNumber(movementQuantity));
    return paidQuantity > 0 ? Math.min(paidQuantity, deliveredQuantity) : deliveredQuantity;
  }

  return paidQuantity;
};