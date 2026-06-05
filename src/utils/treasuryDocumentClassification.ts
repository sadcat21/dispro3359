export const getDocumentVerification = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  return {};
};

export const resolveReceiptBucket = (
  value: unknown,
  order?: { payment_status?: string | null; payment_method_resolved?: string | null } | null,
): 'cash' | 'doc' => {
  const verification = getDocumentVerification(value);
  if (verification.manager_receipt_bucket === 'cash' || verification.manager_receipt_bucket === 'doc') {
    return verification.manager_receipt_bucket;
  }
  if (verification.paid_by_cash === true) {
    return 'cash';
  }

  if (order?.payment_status === 'cash') {
    return 'cash';
  }

  const resolved = String(order?.payment_method_resolved || '');
  if (resolved.endsWith('_cash')) {
    return 'cash';
  }
  if (resolved.endsWith('_doc')) {
    return 'doc';
  }

  return 'doc';
};

export const isTransferPaidByCash = (value: unknown): boolean => {
  const verification = getDocumentVerification(value);
  return verification.paid_by_cash === true;
};
