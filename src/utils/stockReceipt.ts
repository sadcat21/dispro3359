export type ReceiptSource = 'factory' | 'branch';

export interface ReceiptMeta {
  text?: string;
  source?: ReceiptSource;
  driver_name?: string | null;
  driver_phone?: string | null;
  license_plate?: string | null;
}

export interface ReceiptBreakdown {
  new_qty: number;
  comp_qty: number;
  comp_offers_qty: number;
  item_type: 'new' | 'compensation' | 'compensation_offers';
}

export interface ReceiptBreakdownInput {
  product_id: string;
  new_quantity: number;
  compensation_quantity: number;
  compensation_offers_quantity: number;
}

export const parseReceiptMeta = (raw: string | null | undefined): ReceiptMeta => {
  if (!raw) {
    return { text: '', source: 'factory' };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      text: typeof parsed?.text === 'string' ? parsed.text : '',
      source: parsed?.source === 'branch' ? 'branch' : 'factory',
      driver_name: parsed?.driver_name || null,
      driver_phone: parsed?.driver_phone || null,
      license_plate: parsed?.license_plate || null,
    };
  } catch {
    return { text: raw, source: 'factory' };
  }
};

export const stringifyReceiptMeta = (meta: ReceiptMeta): string => {
  return JSON.stringify({
    text: meta.text || '',
    source: meta.source === 'branch' ? 'branch' : 'factory',
    driver_name: meta.driver_name || null,
    driver_phone: meta.driver_phone || null,
    license_plate: meta.license_plate || null,
  });
};

export const parseReceiptItemBreakdown = (item: {
  quantity?: number | null;
  notes?: string | null;
}): ReceiptBreakdown => {
  const fallbackQty = Number(item.quantity) || 0;

  if (!item.notes) {
    return { new_qty: fallbackQty, comp_qty: 0, comp_offers_qty: 0, item_type: 'new' };
  }

  try {
    const parsed = JSON.parse(item.notes);
    const newQty = Number(parsed?.new_qty ?? 0) || 0;
    const compQty = Number(parsed?.comp_qty ?? 0) || 0;
    const compOffersQty = Number(parsed?.comp_offers_qty ?? 0) || 0;

    if (parsed?.item_type === 'compensation_offers') {
      return { new_qty: 0, comp_qty: 0, comp_offers_qty: compOffersQty || fallbackQty, item_type: 'compensation_offers' };
    }

    if (parsed?.item_type === 'compensation') {
      return { new_qty: 0, comp_qty: compQty || fallbackQty, comp_offers_qty: 0, item_type: 'compensation' };
    }

    if (parsed?.item_type === 'new') {
      return { new_qty: newQty || fallbackQty, comp_qty: 0, comp_offers_qty: 0, item_type: 'new' };
    }

    if (newQty > 0 || compQty > 0 || compOffersQty > 0) {
      return {
        new_qty: newQty,
        comp_qty: compQty,
        comp_offers_qty: compOffersQty,
        item_type: compQty > 0 && newQty === 0 && compOffersQty === 0 ? 'compensation' : compOffersQty > 0 && newQty === 0 && compQty === 0 ? 'compensation_offers' : 'new',
      };
    }
  } catch {
    return { new_qty: fallbackQty, comp_qty: 0, comp_offers_qty: 0, item_type: 'new' };
  }

  return { new_qty: fallbackQty, comp_qty: 0, comp_offers_qty: 0, item_type: 'new' };
};

export const aggregateReceiptItemsForEditing = <T extends {
  product_id: string;
  quantity?: number | null;
  notes?: string | null;
}>(items: T[]) => {
  const grouped = new Map<string, ReceiptBreakdownInput>();

  items.forEach((item) => {
    const breakdown = parseReceiptItemBreakdown(item);
    const existing = grouped.get(item.product_id) || {
      product_id: item.product_id,
      new_quantity: 0,
      compensation_quantity: 0,
      compensation_offers_quantity: 0,
    };

    existing.new_quantity += breakdown.new_qty;
    existing.compensation_quantity += breakdown.comp_qty;
    existing.compensation_offers_quantity += breakdown.comp_offers_qty;
    grouped.set(item.product_id, existing);
  });

  return Array.from(grouped.values());
};

export const buildReceiptItemRows = (
  receiptId: string,
  items: ReceiptBreakdownInput[]
) => {
  return items.flatMap((item) => {
    const rows: Array<{
      receipt_id: string;
      product_id: string;
      quantity: number;
      pallet_quantity: number;
      notes: string;
    }> = [];

    const newQty = Number(item.new_quantity) || 0;
    const compQty = Number(item.compensation_quantity) || 0;
    const compOffersQty = Number(item.compensation_offers_quantity) || 0;

    if (newQty > 0) {
      rows.push({
        receipt_id: receiptId,
        product_id: item.product_id,
        quantity: newQty,
        pallet_quantity: 0,
        notes: JSON.stringify({ item_type: 'new', new_qty: newQty, comp_qty: 0, comp_offers_qty: 0 }),
      });
    }

    if (compQty > 0) {
      rows.push({
        receipt_id: receiptId,
        product_id: item.product_id,
        quantity: compQty,
        pallet_quantity: 0,
        notes: JSON.stringify({ item_type: 'compensation', new_qty: 0, comp_qty: compQty, comp_offers_qty: 0 }),
      });
    }

    if (compOffersQty > 0) {
      rows.push({
        receipt_id: receiptId,
        product_id: item.product_id,
        quantity: compOffersQty,
        pallet_quantity: 0,
        notes: JSON.stringify({ item_type: 'compensation_offers', new_qty: 0, comp_qty: 0, comp_offers_qty: compOffersQty }),
      });
    }

    return rows;
  });
};