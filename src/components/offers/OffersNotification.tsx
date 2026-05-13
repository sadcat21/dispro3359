import React, { useState, useEffect, useCallback } from 'react';
import { Gift, Package, Calendar, Users, Clock, Sparkles, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getProductDisplayName } from '@/utils/productDisplayName';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/contexts/LanguageContext';
import { ProductOfferWithDetails, ProductOfferTierWithDetails } from '@/types/productOffer';
import { supabase } from '@/integrations/supabase/client';
import { filterCurrentlyActiveOffers } from '@/utils/productOffers';
import { format } from 'date-fns';
import { ar, fr, enUS } from 'date-fns/locale';

const OffersNotification: React.FC = () => {
  const { t, language, dir } = useLanguage();
  const [offers, setOffers] = useState<ProductOfferWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<ProductOfferWithDetails | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const dateLocale = language === 'ar' ? ar : language === 'fr' ? fr : enUS;

  const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const frenchDays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const englishDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const getDayName = (date: Date) => {
    const dayIndex = date.getDay();
    if (language === 'ar') return arabicDays[dayIndex];
    if (language === 'fr') return frenchDays[dayIndex];
    return englishDays[dayIndex];
  };

  const formatDateWithDay = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayName = getDayName(date);
    const formattedDate = format(date, 'dd MMM yyyy', { locale: dateLocale });
    return `${dayName}، ${formattedDate}`;
  };

  const fetchActiveOffers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('product_offers')
        .select(`
          *,
          product:products!product_offers_product_id_fkey(id, name, app_name, image_url),
          gift_product:products!product_offers_gift_product_id_fkey(id, name, app_name, image_url),
          branch:branches(id, name)
        `)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) throw error;

      // Fetch tiers for all offers
      const offerIds = (data || []).map(o => o.id);
      let tiersMap: Record<string, ProductOfferTierWithDetails[]> = {};
      
      if (offerIds.length > 0) {
        const { data: tiersData } = await supabase
          .from('product_offer_tiers')
          .select('*, gift_product:products!product_offer_tiers_gift_product_id_fkey(id, name)')
          .in('offer_id', offerIds)
          .order('tier_order', { ascending: true });
        
        (tiersData || []).forEach((tier: any) => {
          if (!tiersMap[tier.offer_id]) tiersMap[tier.offer_id] = [];
          tiersMap[tier.offer_id].push(tier);
        });
      }

      const offersWithTiers = (data || []).map(offer => ({
        ...offer,
        tiers: tiersMap[offer.id] || [],
      }));

      setOffers(filterCurrentlyActiveOffers(offersWithTiers));
    } catch (error) {
      console.error('Error fetching offers:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveOffers();
    const baseChannelName = 'product_offers_changes';
    const existing = (supabase as any).getChannels?.()?.find((ch: any) => ch.topic === `realtime:${baseChannelName}`);
    if (existing) {
      supabase.removeChannel(existing);
    }

    const channel = supabase
      .channel(`${baseChannelName}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_offers' }, () => fetchActiveOffers())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchActiveOffers]);

  const getUnitLabel = (unit: string) => {
    return unit === 'box' ? t('offers.unit_box') : t('offers.unit_piece');
  };

  const getGiftText = (offer: { gift_type: string; gift_quantity: number; gift_quantity_unit?: string | null; gift_product?: { name: string } | null; discount_percentage?: number | null }) => {
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

  const handleOfferClick = (offer: ProductOfferWithDetails) => {
    setSelectedOffer(offer);
    setIsPopoverOpen(false);
    setIsDialogOpen(true);
  };

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getDaysRemainingBadge = (daysRemaining: number | null) => {
    if (daysRemaining === null) {
      return (
        <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200">
          <Sparkles className="w-3 h-3" />∞
        </Badge>
      );
    }
    if (daysRemaining === 0) {
      return (<Badge variant="destructive" className="text-xs animate-pulse gap-1"><Clock className="w-3 h-3" />0</Badge>);
    }
    if (daysRemaining <= 3) {
      return (<Badge variant="destructive" className="text-xs gap-1"><Clock className="w-3 h-3" />{daysRemaining}</Badge>);
    }
    return (<Badge variant="secondary" className="text-xs gap-1"><Clock className="w-3 h-3" />{daysRemaining}</Badge>);
  };

  return (
    <>
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative w-8 h-8 bg-emerald-500/10 hover:bg-emerald-500/20">
            <Gift className="w-4 h-4 text-emerald-500" />
            {offers.length > 0 && (
              <Badge className="absolute -top-1 -end-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                {offers.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(96vw,24rem)] max-w-[96vw] p-0 h-[min(82dvh,42rem)] overflow-hidden flex flex-col" align="end" dir={dir}>
          <div className="shrink-0 p-3 border-b bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-t-lg">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              <span className="font-semibold">{t('offers.available')}</span>
              <Badge variant="secondary" className="ms-auto bg-white/20 text-white border-0">{offers.length}</Badge>
            </div>
          </div>
          
          <ScrollArea className="flex-1 min-h-0">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">{t('common.loading')}</div>
            ) : offers.length === 0 ? (
              <div className="p-6 text-center">
                <Gift className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-sm font-medium text-muted-foreground">{t('offers.no_active_offers')}</p>
              </div>
            ) : (
              <div className="divide-y">
                {offers.map((offer, index) => {
                  const daysRemaining = getDaysRemaining(offer.end_date);
                  const isEndingSoon = daysRemaining !== null && daysRemaining <= 3;
                  const hasTiers = offer.tiers && offer.tiers.length > 0;
                  const productImage = (offer.product as any)?.image_url;

                  // Varied accent colors per offer
                  const accentColors = [
                    'from-violet-500 to-purple-600',
                    'from-blue-500 to-cyan-500',
                    'from-amber-500 to-orange-500',
                    'from-rose-500 to-pink-500',
                    'from-teal-500 to-emerald-500',
                    'from-indigo-500 to-blue-600',
                  ];
                  const accent = isEndingSoon
                    ? 'from-red-500 to-orange-500'
                    : accentColors[index % accentColors.length];

                  return (
                    <button
                      key={offer.id}
                      className={`w-full p-3 text-start hover:bg-muted/50 transition-colors ${isEndingSoon ? 'bg-destructive/5' : ''}`}
                      onClick={() => handleOfferClick(offer)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Product image or icon */}
                        {productImage ? (
                          <img
                            src={productImage}
                            alt={offer.product?.name || ''}
                            className="w-11 h-11 rounded-xl object-cover flex-shrink-0 border"
                          />
                        ) : (
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${accent}`}>
                            <Gift className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-start justify-between gap-1">
                            <p className="font-semibold text-sm truncate flex-1 min-w-0">{offer.name}</p>
                            <div className="shrink-0">{getDaysRemainingBadge(daysRemaining)}</div>
                          </div>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <Package className="w-3 h-3" />{getProductDisplayName(offer.product)}
                          </p>
                          
                          {hasTiers ? (
                            <div className="space-y-1">
                              {offer.tiers!.map((tier, idx) => (
                                <div key={tier.id || idx} className="flex flex-wrap gap-1">
                                  <Badge variant="outline" className="text-[10px] bg-primary/5">
                                    {t('offers.buy')} {tier.min_quantity}{tier.max_quantity ? `-${tier.max_quantity}` : '+'} {getUnitLabel(tier.min_quantity_unit || 'piece')}
                                  </Badge>
                                  <Badge className={`text-[10px] text-white border-0 bg-gradient-to-r ${accent}`}>
                                    → {getGiftText(tier as any)}
                                  </Badge>
                                </div>
                              ))}
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Layers className="w-3 h-3" />
                                <span>{offer.tiers!.length} شرائح</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              <Badge variant="outline" className="text-xs bg-primary/5">
                                {t('offers.buy')} {offer.min_quantity}+ {getUnitLabel(offer.min_quantity_unit || 'piece')}
                              </Badge>
                              <Badge className={`text-xs text-white border-0 bg-gradient-to-r ${accent}`}>
                                → {getGiftText(offer)}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md" dir={dir}>
          <DialogHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground -m-6 mb-0 p-4 rounded-t-lg">
            <DialogTitle className="flex items-center gap-2 text-primary-foreground">
              <Gift className="w-5 h-5" />{selectedOffer?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedOffer && (
            <div className="space-y-4 pt-2">
              <div className="flex justify-center">
                {getDaysRemainingBadge(getDaysRemaining(selectedOffer.end_date))}
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                {(selectedOffer.product as any)?.image_url ? (
                  <img
                    src={(selectedOffer.product as any).image_url}
                    alt={selectedOffer.product?.name || ''}
                    className="w-12 h-12 rounded-lg object-cover border"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{getProductDisplayName(selectedOffer.product)}</p>
                  <p className="text-xs text-muted-foreground">{t('offers.product')}</p>
                </div>
              </div>

              {/* Show all tiers if available */}
              {selectedOffer.tiers && selectedOffer.tiers.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-primary" />
                    شرائح العرض ({selectedOffer.tiers.length})
                  </p>
                  {selectedOffer.tiers.map((tier, idx) => (
                    <div key={tier.id || idx} className="bg-muted/50 rounded-lg p-3 border">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">الشريحة {idx + 1}</p>
                          <p className="font-bold text-sm">
                            {t('offers.buy')} {tier.min_quantity}{tier.max_quantity ? `-${tier.max_quantity}` : '+'} {getUnitLabel(tier.min_quantity_unit || 'piece')}
                          </p>
                        </div>
                        <div className="text-lg text-primary">→</div>
                        <div className="text-end">
                          <p className="text-xs text-muted-foreground">{t('offers.get')}</p>
                          <p className="font-bold text-sm text-primary">
                            {getGiftText(tier as any)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-muted/50 rounded-lg p-4 border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('offers.condition')}</p>
                      <p className="font-bold text-lg">
                        {t('offers.buy')} {selectedOffer.min_quantity}{selectedOffer.max_quantity ? `-${selectedOffer.max_quantity}` : '+'} {getUnitLabel(selectedOffer.min_quantity_unit || 'piece')}
                      </p>
                    </div>
                    <div className="text-2xl text-primary">→</div>
                    <div className="text-end">
                      <p className="text-sm text-muted-foreground">{t('offers.get')}</p>
                      <p className="font-bold text-lg text-primary">
                        {getGiftText(selectedOffer)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {getWorkerRewardText(selectedOffer) && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Users className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t('offers.your_reward')}</p>
                    <p className="font-bold text-blue-600 dark:text-blue-400">{getWorkerRewardText(selectedOffer)}</p>
                  </div>
                </div>
              )}

              {(selectedOffer.start_date || selectedOffer.end_date) && (
                <div className="flex items-center gap-2 text-sm p-3 bg-muted/50 rounded-lg">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {selectedOffer.start_date && formatDateWithDay(selectedOffer.start_date)}
                    {selectedOffer.start_date && selectedOffer.end_date && ' - '}
                    {selectedOffer.end_date && formatDateWithDay(selectedOffer.end_date)}
                  </span>
                </div>
              )}

              {selectedOffer.description && (
                <p className="text-sm text-muted-foreground border-t pt-3">{selectedOffer.description}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OffersNotification;
