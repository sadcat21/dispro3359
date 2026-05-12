export const OFFER_SCOPE_STAGES = [
  'worker_loading',
  'order_creation',
  'direct_sale',
  'warehouse_sale',
] as const;

export type OfferScopeStage = typeof OFFER_SCOPE_STAGES[number];

export const OFFER_SCOPE_STAGE_LABELS_AR: Record<OfferScopeStage, string> = {
  worker_loading: 'تحميل العامل',
  order_creation: 'إنشاء الطلب',
  direct_sale: 'البيع المباشر',
  warehouse_sale: 'بيع من المستودع',
};

export const isOfferActiveInStage = (
  offer: { scope_stages?: string[] | null } | null | undefined,
  stage: OfferScopeStage,
): boolean => {
  if (!offer) return false;
  const stages = offer.scope_stages;
  if (!stages || stages.length === 0) return true; // legacy: visible everywhere
  return stages.includes(stage);
};
