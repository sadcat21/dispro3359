/**
 * Detect whether an order item was sold at a custom (Remise) unit price,
 * i.e. its unit_price does not match the catalog default for its
 * price_subtype/payment_type, after converting to the item's pricing_unit.
 */

type AnyRecord = Record<string, any>;

const toNum = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const SUBTYPES = ['retail', 'gros', 'super_gros', 'invoice'] as const;

const perUnitMultiplier = (pricingUnit: string | null | undefined, weightPerBox: number, piecesPerBox: number): number => {
  if (pricingUnit === 'kg') {
    const w = Math.max(0, weightPerBox);
    return w > 0 ? 1 / w : 1;
  }
  if (pricingUnit === 'unit') {
    const p = Math.max(0, piecesPerBox);
    return p > 0 ? 1 / p : 1;
  }
  return 1; // box
};

export interface RemiseItemLike {
  unit_price?: number | null;
  unitPrice?: number | null;
  price_subtype?: string | null;
  payment_type?: string | null;
  pricing_unit?: string | null;
  pricingUnit?: string | null;
  weight_per_box?: number | null;
  pieces_per_box?: number | null;
}

export const isRemiseOrderItem = (
  item: RemiseItemLike | null | undefined,
  product?: AnyRecord | null,
  tolerance = 1,
): boolean => {
  if (!item) return false;
  const unitPrice = toNum(item.unit_price ?? item.unitPrice);
  if (unitPrice <= 0) return false;

  const pricingUnit = item.pricing_unit || item.pricingUnit || product?.pricing_unit || 'box';
  const weightPerBox = toNum(item.weight_per_box ?? product?.weight_per_box);
  const piecesPerBox = toNum(item.pieces_per_box ?? product?.pieces_per_box);
  const multiplier = perUnitMultiplier(pricingUnit, weightPerBox, piecesPerBox);

  const subtype = (item.price_subtype || '').toString().toLowerCase();
  const effectiveSubtype = item.payment_type === 'with_invoice' ? 'invoice' : subtype;

  const candidatePrices: number[] = [];
  if (effectiveSubtype && SUBTYPES.includes(effectiveSubtype as any)) {
    candidatePrices.push(toNum(product?.[`price_${effectiveSubtype}`]) * multiplier);
  } else {
    // Unknown subtype → compare against any catalog tier
    for (const s of SUBTYPES) {
      const p = toNum(product?.[`price_${s}`]) * multiplier;
      if (p > 0) candidatePrices.push(p);
    }
  }

  const valid = candidatePrices.filter((p) => p > 0);
  if (!valid.length) return false;

  // Remise if unit price differs (in either direction) by more than tolerance from every candidate.
  return valid.every((p) => Math.abs(unitPrice - p) > tolerance);
};

export const orderHasRemise = (
  items: Array<RemiseItemLike & { product?: AnyRecord | null }> | null | undefined,
): boolean => {
  if (!items?.length) return false;
  return items.some((it) => isRemiseOrderItem(it, (it as any).product));
};
