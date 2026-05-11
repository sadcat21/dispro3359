/**
 * Normalize a customer's type info into a string array of Arabic type keys.
 * Handles both new `customer_types` (jsonb array) and legacy `customer_type`
 * (comma-separated string).
 */
export const getCustomerTypesArray = (customer: any | null | undefined): string[] => {
  if (!customer) return [];
  const fromJsonb = customer.customer_types;
  if (Array.isArray(fromJsonb) && fromJsonb.length) {
    return fromJsonb.filter(Boolean);
  }
  if (typeof customer.customer_type === 'string' && customer.customer_type) {
    return customer.customer_type.split(',').map((s: string) => s.trim()).filter(Boolean);
  }
  return [];
};
