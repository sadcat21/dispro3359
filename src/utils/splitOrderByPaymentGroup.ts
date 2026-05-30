import type { PaymentType } from '@/types/database';
import type { InvoicePaymentMethod } from '@/types/stamp';

export interface SplittableItem {
  productId: string;
  quantity: number;
  totalPrice: number;
  itemPaymentType?: PaymentType;
  itemInvoicePaymentMethod?: InvoicePaymentMethod | null;
  itemInvoicePaymentSubType?: 'cash' | 'doc' | null;
  [key: string]: any;
}

export interface PaymentGroupFallback {
  paymentType: PaymentType;
  invoicePaymentMethod: InvoicePaymentMethod | null;
  invoicePaymentSubType: 'cash' | 'doc' | null;
}

export interface PaymentGroup<T extends SplittableItem = SplittableItem> {
  key: string;
  paymentType: PaymentType;
  invoicePaymentMethod: InvoicePaymentMethod | null;
  invoicePaymentSubType: 'cash' | 'doc' | null;
  label: string;
  badge: string; // F1 / F2
  items: T[];
  subtotal: number;
  totalQuantity: number;
}

const INVOICE_LABEL: Record<string, string> = {
  receipt: 'VRST',
  check: 'CHQ',
  cash: 'Cash',
  transfer: 'VIR',
};

export function buildGroupLabel(
  paymentType: PaymentType,
  method: InvoicePaymentMethod | null,
  subType: 'cash' | 'doc' | null,
): { badge: string; label: string } {
  if (paymentType !== 'with_invoice') {
    return { badge: 'F2', label: 'F2 — بدون فاتورة' };
  }
  const m = method ? INVOICE_LABEL[method] || method : '—';
  const s = method === 'receipt' && subType ? (subType === 'cash' ? 'Cash' : 'Doc') : '';
  return {
    badge: 'F1',
    label: `F1 — ${m}${s ? ` ${s}` : ''}`,
  };
}

export function buildPaymentKey(
  paymentType: PaymentType,
  method: InvoicePaymentMethod | null,
  subType: 'cash' | 'doc' | null,
): string {
  return `${paymentType}|${method ?? '-'}|${subType ?? '-'}`;
}

export function splitOrderByPaymentGroup<T extends SplittableItem>(
  items: T[],
  fallback: PaymentGroupFallback,
): PaymentGroup<T>[] {
  const map = new Map<string, PaymentGroup<T>>();
  for (const it of items) {
    const pt = (it.itemPaymentType ?? fallback.paymentType) as PaymentType;
    const im = (it.itemInvoicePaymentMethod !== undefined
      ? it.itemInvoicePaymentMethod
      : fallback.invoicePaymentMethod) as InvoicePaymentMethod | null;
    const is = (it.itemInvoicePaymentSubType !== undefined
      ? it.itemInvoicePaymentSubType
      : fallback.invoicePaymentSubType) as 'cash' | 'doc' | null;
    const key = buildPaymentKey(pt, im, is);
    let g = map.get(key);
    if (!g) {
      const { badge, label } = buildGroupLabel(pt, im, is);
      g = {
        key,
        paymentType: pt,
        invoicePaymentMethod: im,
        invoicePaymentSubType: is,
        badge,
        label,
        items: [],
        subtotal: 0,
        totalQuantity: 0,
      };
      map.set(key, g);
    }
    g.items.push(it);
    g.subtotal += Number(it.totalPrice || 0);
    g.totalQuantity += Number(it.quantity || 0);
  }
  return Array.from(map.values());
}
