export const roundToMaxFraction = (value: unknown, maximumFractionDigits = 4): number => {
  const numericValue = Number(value ?? 0);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  const factor = 10 ** maximumFractionDigits;
  return Math.round(numericValue * factor) / factor;
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