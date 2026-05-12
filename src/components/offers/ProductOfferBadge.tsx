import React, { useState, useEffect } from 'react';
import { Gift, Calendar, Users, Sparkles, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getProductDisplayName } from '@/utils/productDisplayName';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useLanguage } from '@/contexts/LanguageContext';
import { ProductOfferWithDetails } from '@/types/productOffer';
import { supabase } from '@/integrations/supabase/client';
import { filterCurrentlyActiveOffers, getProductOfferLookupKey } from '@/utils/productOffers';
import { isOfferActiveInStage, OfferScopeStage } from '@/constants/offerScope';
import { Button } from '@/components/ui/button';
import { format, differenceInDays } from 'date-fns';
import { ar, fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ProductOfferBadgeProps {
  productId: string;
  quantity: number;
  piecesPerBox?: number;
  customerTypes?: string[] | null;
  stage?: OfferScopeStage;
  onGiftCalculated?: (giftPieces: number, offerId?: string) => void;
  onOffersLoadingChange?: (isLoading: boolean) => void;
  onMandatoryUnactivatedChange?: (hasBlocking: boolean) => void;
  prefetchedOffers?: ProductOfferWithDetails[];
  onPrefetchOffers?: (productId: string, customerTypes?: string[] | null) => Promise<ProductOfferWithDetails[]>;
}

const productOfferMemoryCache = new Map<string, ProductOfferWithDetails[]>();
const productOfferPendingRequests = new Map<string, Promise<ProductOfferWithDetails[]>>();

const normalizeProductOffers = (data: any[] | null, customerTypes?: string[] | null): ProductOfferWithDetails[] => {
  const offersWithSortedTiers = (data || []).map((offer: any) => ({
    ...offer,
    tiers: offer.tiers?.sort((a: any, b: any) => a.tier_order - b.tier_order) || [],
  }));

  const normalizedTypes = (customerTypes || []).filter(Boolean);
  const audienceFiltered = offersWithSortedTiers.filter((offer: any) => {
    const allowList: string[] = offer.tiers
      ?.flatMap((t: any) => (t.conditions?.excluded_customer_types as string[] | undefined) || [])
      .filter(Boolean) || [];
    if (allowList.length === 0) return true;
    return normalizedTypes.some((ct) => allowList.includes(ct));
  });

  return filterCurrentlyActiveOffers(audienceFiltered);
};

const fetchProductOffersForBadge = async (productId: string, customerTypes?: string[] | null): Promise<ProductOfferWithDetails[]> => {
  const cacheKey = getProductOfferLookupKey(productId, customerTypes);
  const cachedOffers = productOfferMemoryCache.get(cacheKey);
  if (cachedOffers) return cachedOffers;

  const pendingRequest = productOfferPendingRequests.get(cacheKey);
  if (pendingRequest) return pendingRequest;

  const request = Promise.resolve(
    supabase
      .from('product_offers')
      .select(`
        *,
        product:products!product_offers_product_id_fkey(id, name, app_name),
        gift_product:products!product_offers_gift_product_id_fkey(id, name, app_name),
        tiers:product_offer_tiers(
          id, offer_id, min_quantity, max_quantity, min_quantity_unit,
          gift_quantity, gift_quantity_unit, gift_type, gift_product_id,
          discount_percentage, worker_reward_type, worker_reward_amount, tier_order, conditions,
          gift_product:products(id, name, app_name)
        )
      `)
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('priority', { ascending: false })
  )
    .then(({ data, error }) => {
      if (error) throw error;
      const activeOffers = normalizeProductOffers(data, customerTypes);
      productOfferMemoryCache.set(cacheKey, activeOffers);
      return activeOffers;
    })
    .finally(() => {
      productOfferPendingRequests.delete(cacheKey);
    });

  productOfferPendingRequests.set(cacheKey, request);
  return request;
};

export const preloadProductOffersForBadge = (productId: string, customerTypes?: string[] | null) => {
  return fetchProductOffersForBadge(productId, customerTypes).catch((error) => {
    console.error('Error preloading product offers:', error);
    return [];
  });
};

const ProductOfferBadge: React.FC<ProductOfferBadgeProps> = ({ 
  productId, 
  quantity, 
  piecesPerBox = 1,
  customerTypes,
  stage = 'order_creation',
  onGiftCalculated,
  onOffersLoadingChange,
  onMandatoryUnactivatedChange,
  prefetchedOffers,
  onPrefetchOffers,
}) => {
  const { t, language, dir } = useLanguage();
  const initialCachedOffers = productOfferMemoryCache.get(getProductOfferLookupKey(productId, customerTypes));
  const [offers, setOffers] = useState<ProductOfferWithDetails[]>(prefetchedOffers || initialCachedOffers || []);
  const [isLoading, setIsLoading] = useState(!prefetchedOffers && !initialCachedOffers);
  const [selectedOffer, setSelectedOffer] = useState<ProductOfferWithDetails | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activatedOfferIds, setActivatedOfferIds] = useState<Set<string>>(new Set());

  const dateLocale = language === 'ar' ? ar : language === 'fr' ? fr : enUS;

  useEffect(() => {
    const cacheKey = getProductOfferLookupKey(productId, customerTypes);
    const nextPrefetchedOffers = prefetchedOffers || productOfferMemoryCache.get(cacheKey);

    if (nextPrefetchedOffers) {
      setOffers(nextPrefetchedOffers);
      setIsLoading(false);
      onOffersLoadingChange?.(false);
      return;
    }

    fetchProductOffers();
  }, [productId, JSON.stringify(customerTypes || []), prefetchedOffers]);

  const fetchProductOffers = async () => {
    setIsLoading(true);
    onOffersLoadingChange?.(true);
    try {
      const activeOffers = onPrefetchOffers
        ? await onPrefetchOffers(productId, customerTypes)
        : await fetchProductOffersForBadge(productId, customerTypes);
      setOffers(activeOffers);
    } catch (error) {
      console.error('Error fetching product offers:', error);
    } finally {
      setIsLoading(false);
      onOffersLoadingChange?.(false);
    }
  };

  const getUnitLabel = (unit: string) => {
    return unit === 'box' ? t('offers.unit_box') : t('offers.unit_piece');
  };

  const getGiftText = (offer: ProductOfferWithDetails) => {
    const unitLabel = getUnitLabel(offer.gift_quantity_unit || 'piece');
    if (offer.gift_type === 'same_product') {
      return `${offer.gift_quantity} ${unitLabel} ${t('common.free')}`;
    } else if (offer.gift_type === 'different_product' && offer.gift_product) {
      return `${offer.gift_quantity} ${unitLabel} ${getProductDisplayName(offer.gift_product)}`;
    } else if (offer.gift_type === 'discount') {
      return `${offer.discount_percentage}% ${t('offers.discount')}`;
    }
    return '';
  };

  const getWorkerRewardText = (offer: ProductOfferWithDetails) => {
    if (offer.worker_reward_type === 'none') return null;
    if (offer.worker_reward_type === 'fixed') {
      return `${offer.worker_reward_amount} ${t('currency.dzd')}`;
    }
    return `${offer.worker_reward_amount}%`;
  };

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    const today = new Date();
    const end = new Date(endDate);
    return differenceInDays(end, today);
  };

  // Calculate gift pieces for an offer based on quantity, using tiers if available
  // For multiplier offers with multiple tiers: apply highest tier first, then use remaining qty with lower tiers
  const calculateGiftPieces = (offer: ProductOfferWithDetails, qty: number): number => {
    const tiers = offer.tiers && offer.tiers.length > 0 ? offer.tiers : null;
    
    if (tiers) {
      if (offer.condition_type === 'multiplier') {
        // Sort tiers by min_quantity descending (highest first)
        const sortedTiers = [...tiers].sort((a, b) => b.min_quantity - a.min_quantity);
        let remaining = qty;
        let totalGift = 0;
        
        for (const tier of sortedTiers) {
          if (remaining < tier.min_quantity) continue;
          
          const timesApplied = Math.floor(remaining / tier.min_quantity);
          remaining = remaining % tier.min_quantity;
          
          const giftUnit = tier.gift_quantity_unit || 'piece';
          const giftAmount = timesApplied * tier.gift_quantity;
          totalGift += giftUnit === 'box' ? giftAmount * piecesPerBox : giftAmount;
        }
        return totalGift;
      } else {
        // Range type: find the single matching tier
        for (const tier of [...tiers].sort((a, b) => b.min_quantity - a.min_quantity)) {
          if (qty >= tier.min_quantity && (tier.max_quantity === null || qty <= tier.max_quantity)) {
            const giftUnit = tier.gift_quantity_unit || 'piece';
            return giftUnit === 'box' ? tier.gift_quantity * piecesPerBox : tier.gift_quantity;
          }
        }
        return 0;
      }
    }
    
    // Fallback to offer-level fields
    if (qty < offer.min_quantity) return 0;
    
    const timesApplied = offer.condition_type === 'multiplier'
      ? Math.floor(qty / offer.min_quantity)
      : 1;
    
    const giftPerThreshold = offer.gift_quantity;
    
    if (offer.gift_quantity_unit === 'box') {
      return timesApplied * giftPerThreshold * piecesPerBox;
    }
    
    return timesApplied * giftPerThreshold;
  };

  // Find applicable offers based on quantity (using tiers or offer-level)
  const applicableOffers = offers.filter(offer => {
    const tiers = offer.tiers && offer.tiers.length > 0 ? offer.tiers : null;
    if (tiers) {
      // For multiplier: applicable if qty >= lowest tier min_quantity
      const lowestMin = Math.min(...tiers.map(t => t.min_quantity));
      return quantity >= lowestMin;
    }
    return quantity >= offer.min_quantity && (offer.max_quantity === null || quantity <= offer.max_quantity);
  });

  // Calculate total gift pieces from all applicable offers
  const totalGiftPieces = applicableOffers.reduce((total, offer) => {
    return total + calculateGiftPieces(offer, quantity);
  }, 0);

  // Find the primary applicable offer ID
  const primaryOfferId = applicableOffers.length > 0 ? applicableOffers[0].id : undefined;

  // Notify parent of gift calculation
  useEffect(() => {
    if (onGiftCalculated) {
      onGiftCalculated(totalGiftPieces, primaryOfferId);
    }
  }, [totalGiftPieces, primaryOfferId, onGiftCalculated]);

  const handleOfferClick = (offer: ProductOfferWithDetails) => {
    setSelectedOffer(offer);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-center text-[11px] font-bold text-muted-foreground">
        {t('common.loading') || 'جاري التحقق من العرض...'}
      </div>
    );
  }

  if (offers.length === 0) {
    return null;
  }

  // Render a single offer card
  const renderOfferCard = (offer: ProductOfferWithDetails) => {
    const isApplicable = applicableOffers.includes(offer);
    const daysRemaining = getDaysRemaining(offer.end_date);
    const giftPieces = calculateGiftPieces(offer, quantity);
    const timesApplied = quantity >= offer.min_quantity ? Math.floor(quantity / offer.min_quantity) : 0;
    
    return (
      <div
        key={offer.id}
        onClick={() => handleOfferClick(offer)}
        className={cn(
          "cursor-pointer rounded-lg overflow-hidden ring-1 shadow-sm transition-all",
          isApplicable
            ? "ring-green-500 shadow-green-500/30"
            : "ring-destructive/40"
        )}
      >
        <div
          className="grid w-full text-center divide-x divide-white/20"
          style={{ gridTemplateColumns: '1.4fr 1.4fr 0.9fr' }}
        >
          {/* Col 1: Condition */}
          <div className={cn(
            "@container px-1.5 py-1.5 flex flex-col items-center justify-center gap-0.5 text-white",
            isApplicable ? "bg-green-700" : "bg-destructive"
          )}>
            <div className="font-extrabold leading-tight whitespace-nowrap" style={{ fontSize: 'clamp(8px, 22cqw, 13px)' }}>
              {t('offers.buy')} {offer.min_quantity}+ {getUnitLabel(offer.min_quantity_unit || 'piece')}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wide opacity-80">
              {t('offers.condition') || 'الشرط'}
            </div>
          </div>
          {/* Col 2: Gift */}
          <div className={cn(
            "@container px-1.5 py-1.5 flex flex-col items-center justify-center gap-0.5",
            isApplicable ? "bg-green-50 text-green-800" : "bg-destructive/10 text-destructive"
          )}>
            <div className="font-extrabold leading-tight whitespace-nowrap flex items-center gap-1" style={{ fontSize: 'clamp(8px, 22cqw, 13px)' }}>
              <Gift className="w-3 h-3" />
              {offer.gift_type === 'discount'
                ? `${offer.discount_percentage}%`
                : `+${offer.gift_quantity} ${getUnitLabel(offer.gift_quantity_unit || 'piece')}`}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wide opacity-70">
              {t('common.free') || 'هدية'}
            </div>
          </div>
          {/* Col 3: Days remaining */}
          <div className={cn(
            "@container px-1 py-1.5 flex flex-col items-center justify-center gap-0.5 text-white",
            isApplicable ? "bg-green-600" : "bg-foreground"
          )}>
            <div className="font-extrabold leading-tight whitespace-nowrap" style={{ fontSize: 'clamp(8px, 22cqw, 13px)' }}>
              {daysRemaining === null
                ? '∞'
                : daysRemaining === 0
                  ? t('offers.ends_today')
                  : daysRemaining === 1
                    ? t('offers.ends_tomorrow')
                    : daysRemaining}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wide opacity-70">
              {daysRemaining !== null && daysRemaining > 1 ? (t('offers.days_remaining') || 'يوم') : ''}
              {daysRemaining === null ? (t('offers.available_offer') || '') : ''}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-2 mt-3">
        {/* Show first offer always */}
        {offers.length > 0 && renderOfferCard(offers[0])}
        
        {/* If more than one offer, show collapsible for the rest */}
        {offers.length > 1 && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  {t('offers.hide_other_tiers')}
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  {t('offers.show_other_tiers')} ({offers.length - 1})
                </>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2">
              {offers.slice(1).map(renderOfferCard)}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* Offer Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              {selectedOffer?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedOffer && (
            <div className="space-y-4">
              {/* Condition and Reward */}
              <div className="bg-gradient-to-r from-destructive/10 to-destructive/5 rounded-lg p-4 border border-destructive/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('offers.condition')}</p>
                    <p className="font-bold text-lg">
                      {t('offers.buy')} {selectedOffer.min_quantity}
                      {selectedOffer.max_quantity ? `-${selectedOffer.max_quantity}` : '+'} {getUnitLabel(selectedOffer.min_quantity_unit || 'piece')}
                    </p>
                  </div>
                  <div className="text-2xl">→</div>
                  <div className="text-end">
                    <p className="text-sm text-muted-foreground">{t('offers.get')}</p>
                    <p className="font-bold text-lg text-destructive">
                      {getGiftText(selectedOffer)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Worker Reward */}
              {getWorkerRewardText(selectedOffer) && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <Users className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t('offers.your_reward')}</p>
                    <p className="font-bold text-blue-600">
                      {getWorkerRewardText(selectedOffer)}
                    </p>
                  </div>
                </div>
              )}

              {/* Date Range */}
              {(selectedOffer.start_date || selectedOffer.end_date) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {selectedOffer.start_date && format(new Date(selectedOffer.start_date), 'EEEE dd MMM yyyy', { locale: dateLocale })}
                    {selectedOffer.start_date && selectedOffer.end_date && ' - '}
                    {selectedOffer.end_date && format(new Date(selectedOffer.end_date), 'EEEE dd MMM yyyy', { locale: dateLocale })}
                  </span>
                </div>
              )}

              {/* Description */}
              {selectedOffer.description && (
                <p className="text-sm text-muted-foreground border-t pt-3">
                  {selectedOffer.description}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProductOfferBadge;
