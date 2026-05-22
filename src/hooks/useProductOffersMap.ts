import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type OfferInfo = {
  offerName: string;
  giftQty: number;
  giftUnit: string;
  minQty: number;
  minUnit: string;
  isMandatory?: boolean;
  tiers: { minQty: number; maxQty: number | null; giftQty: number; giftUnit: string; minUnit?: string }[];
};

/**
 * Fetches active offers for a list of product IDs, filtered by stage scope.
 * Returns a map product_id -> OfferInfo for products with matching offers.
 */
export function useProductOffersMap(productIds: string[], stage: string = 'worker_loading') {
  const [offersMap, setOffersMap] = useState<Record<string, OfferInfo>>({});

  useEffect(() => {
    const ids = Array.from(new Set(productIds.filter(Boolean)));
    if (ids.length === 0) { setOffersMap({}); return; }

    let cancelled = false;
    (async () => {
      const [{ data: offers }, { data: settings }] = await Promise.all([
        supabase
          .from('product_offers')
          .select('id, name, scope_stages, is_mandatory, product_id')
          .in('product_id', ids)
          .eq('is_active', true),
        (supabase as any)
          .from('product_offer_settings')
          .select('stage_settings')
          .eq('id', 'global')
          .maybeSingle(),
      ]);

      const stageCfg = (settings as any)?.stage_settings?.[stage];
      // If showcase is disabled for this stage, do not expose offers here so
      // gift-related UI stays hidden.
      if (stageCfg && stageCfg.showcase_enabled === false) {
        if (!cancelled) setOffersMap({});
        return;
      }
      const stageMandatory = stageCfg ? !!stageCfg.is_mandatory : undefined;

      const matched = (offers || []).filter((o: any) => {
        const stages = o.scope_stages;
        return !stages || stages.length === 0 || stages.includes(stage);
      });
      if (matched.length === 0) { if (!cancelled) setOffersMap({}); return; }


      const offerIds = matched.map((o: any) => o.id);
      const { data: tiers } = await supabase
        .from('product_offer_tiers')
        .select('offer_id, min_quantity, max_quantity, min_quantity_unit, gift_quantity, gift_quantity_unit, gift_type, tier_order')
        .in('offer_id', offerIds)
        .eq('gift_type', 'same_product')
        .order('tier_order', { ascending: true });

      const tiersByOffer: Record<string, any[]> = {};
      (tiers || []).forEach((t: any) => {
        (tiersByOffer[t.offer_id] = tiersByOffer[t.offer_id] || []).push(t);
      });

      const map: Record<string, OfferInfo> = {};
      matched.forEach((o: any) => {
        const ts = tiersByOffer[o.id];
        if (!ts || ts.length === 0) return;
        const first = ts[0];
        map[o.product_id] = {
          offerName: o.name,
          giftQty: first.gift_quantity,
          giftUnit: first.gift_quantity_unit || 'piece',
          minQty: first.min_quantity,
          minUnit: first.min_quantity_unit || 'piece',
          isMandatory: !!o.is_mandatory,
          tiers: ts.map((t: any) => ({
            minQty: t.min_quantity,
            maxQty: t.max_quantity,
            giftQty: t.gift_quantity,
            giftUnit: t.gift_quantity_unit || 'piece',
            minUnit: t.min_quantity_unit || 'piece',
          })),
        };
      });
      if (!cancelled) setOffersMap(map);
    })();

    return () => { cancelled = true; };
  }, [productIds.join('|'), stage]);

  return offersMap;
}
