type OfferWindow = {
  is_active?: boolean | null;
  start_date?: string | null;
  end_date?: string | null;
};

const toDateOnly = (value: string | null | undefined): Date | null => {
  if (!value) return null;

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
};

export const isOfferCurrentlyActive = (offer: OfferWindow, now = new Date()): boolean => {
  if (offer.is_active === false) return false;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = toDateOnly(offer.start_date);
  const endDate = toDateOnly(offer.end_date);

  return (!startDate || startDate <= today) && (!endDate || endDate >= today);
};

export const filterCurrentlyActiveOffers = <T extends OfferWindow>(offers: T[], now = new Date()): T[] => {
  return offers.filter((offer) => isOfferCurrentlyActive(offer, now));
};