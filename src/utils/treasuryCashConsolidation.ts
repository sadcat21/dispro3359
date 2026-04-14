export interface CashConsolidationSources {
  cashInvoice1: number;
  stamp: number;
  receiptCash: number;
  cashInvoice2: number;
}

const parseNumericToken = (value: string | undefined): number => {
  if (!value) return 0;
  const normalized = value.replace(/,/g, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const buildCashConsolidationNote = (sources: CashConsolidationSources) =>
  `تجميع كاش → Versement Doc | فاتورة1: ${sources.cashInvoice1} | طابع: ${sources.stamp} | Versement Cash: ${sources.receiptCash} | فاتورة2: ${sources.cashInvoice2}`;

export const parseCashConsolidationNote = (
  notes: string | null | undefined,
  fallbackCashInvoice1WithStamp = 0,
): CashConsolidationSources => {
  const invoice1Match = notes?.match(/فاتورة1:\s*([\d.,]+)/);
  const stampMatch = notes?.match(/طابع:\s*([\d.,]+)/);
  const receiptCashMatch = notes?.match(/Versement Cash:\s*([\d.,]+)/i);
  const cashInvoice2Match = notes?.match(/فاتورة2:\s*([\d.,]+)/);

  if (!invoice1Match && !stampMatch && !receiptCashMatch && !cashInvoice2Match) {
    return {
      cashInvoice1: fallbackCashInvoice1WithStamp,
      stamp: 0,
      receiptCash: 0,
      cashInvoice2: 0,
    };
  }

  return {
    cashInvoice1: parseNumericToken(invoice1Match?.[1]),
    stamp: parseNumericToken(stampMatch?.[1]),
    receiptCash: parseNumericToken(receiptCashMatch?.[1]),
    cashInvoice2: parseNumericToken(cashInvoice2Match?.[1]),
  };
};

export const getCashConsolidationDebitNote = (paymentMethod: string) => {
  if (paymentMethod === 'cash_invoice1') return 'خصم تجميع كاش فاتورة 1 + طابع';
  if (paymentMethod === 'receipt_cash') return 'خصم تجميع Versement Cash';
  if (paymentMethod === 'cash_invoice2') return 'خصم تجميع كاش فاتورة 2';
  return 'خصم تجميع كاش';
};
