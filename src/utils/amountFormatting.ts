export const roundToMaxFraction = (value: unknown, maximumFractionDigits = 4): number => {
  const numericValue = Number(value ?? 0);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  const factor = 10 ** maximumFractionDigits;
  return Math.round(numericValue * factor) / factor;
};

const normalizeLocalizedDigits = (value: string): string => (
  value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٫]/g, '.')
    .replace(/[٬،]/g, ',')
    .replace(/[\s\u00A0\u202F']/g, '')
);

const parseLocalizedDecimal = (value: string): number => {
  if (!value) return 0;

  const lastDot = value.lastIndexOf('.');
  const lastComma = value.lastIndexOf(',');
  const decimalIndex = Math.max(lastDot, lastComma);

  if (decimalIndex === -1) {
    return Number(value.replace(/[.,]/g, '')) || 0;
  }

  const integerPart = value.slice(0, decimalIndex).replace(/[.,]/g, '');
  const fractionPart = value.slice(decimalIndex + 1).replace(/[.,]/g, '');
  return Number(`${integerPart || '0'}.${fractionPart || '0'}`) || 0;
};

export const parseAmountInput = (
  value: unknown,
  options?: { expectedTotal?: number | null; maximumFractionDigits?: number }
): number => {
  const maximumFractionDigits = options?.maximumFractionDigits ?? 4;

  if (typeof value === 'number') {
    return roundToMaxFraction(value, maximumFractionDigits);
  }

  const raw = normalizeLocalizedDigits(String(value ?? ''));
  if (!raw) return 0;

  const decimalValue = parseLocalizedDecimal(raw);
  const groupedValue = Number(raw.replace(/[.,]/g, '')) || 0;
  const expectedTotal = Number(options?.expectedTotal ?? 0);
  const groupedPattern = /^\d{1,3}([.,]\d{3})+$/.test(raw);

  let resolvedValue = decimalValue;

  if (groupedPattern && groupedValue > 0) {
    if (expectedTotal > 0) {
      const decimalDiff = Math.abs(decimalValue - expectedTotal);
      const groupedDiff = Math.abs(groupedValue - expectedTotal);
      if (groupedDiff < decimalDiff) {
        resolvedValue = groupedValue;
      }
    } else {
      resolvedValue = groupedValue;
    }
  }

  return roundToMaxFraction(resolvedValue, maximumFractionDigits);
};

export const formatAmountWithMaxFraction = (value: unknown, maximumFractionDigits = 4): string => (
  roundToMaxFraction(value, maximumFractionDigits).toLocaleString(undefined, {
    maximumFractionDigits,
  })
);

export const toInputAmountValue = (value: unknown, maximumFractionDigits = 4): string => {
  const roundedValue = roundToMaxFraction(value, maximumFractionDigits);

  if (Number.isInteger(roundedValue)) {
    return String(roundedValue);
  }

  return roundedValue.toFixed(maximumFractionDigits).replace(/\.?0+$/, '');
};