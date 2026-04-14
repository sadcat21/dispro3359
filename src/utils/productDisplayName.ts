/**
 * Returns the display name for a product.
 * Uses app_name if available, otherwise falls back to the official name.
 */
export const getProductDisplayName = (product: { name: string; app_name?: string | null } | null | undefined): string => {
  if (!product) return '';
  return (product as any).app_name || product.name || '';
};