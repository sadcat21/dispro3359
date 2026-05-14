import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProductOffers } from '@/hooks/useProductOffers';
import { Sparkles, Gift, Tag } from 'lucide-react';

const ProductShowcaseHero: React.FC = () => {
  const { activeOffers, isLoading } = useProductOffers();
  const [images, setImages] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState(0);
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await (supabase as any)
        .from('product_offer_settings')
        .select('showcase_enabled')
        .eq('id', 'global')
        .maybeSingle();
      if (!alive) return;
      setEnabled(data?.showcase_enabled ?? true);
    })();
    const channel = (supabase as any)
      .channel('offer-settings-showcase')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'product_offer_settings', filter: 'id=eq.global' },
        (payload: any) => setEnabled(payload?.new?.showcase_enabled ?? true))
      .subscribe();
    return () => { alive = false; (supabase as any).removeChannel(channel); };
  }, []);

  // Build slides from active offers
  const slides = useMemo(() => {
    const list: { title: string; subtitle: string; image: string | null; tierLabel?: string }[] = [];
    (activeOffers || [])
      .filter((o: any) => o?.product?.name)
      .forEach((o: any) => {
        const productName = o.product?.name || '';
        const image = o.product?.image_url || null;
        const tiers = (o.tiers && o.tiers.length > 0) ? o.tiers : [o];

        tiers.forEach((t: any, idx: number) => {
          const giftName = t?.gift_product?.name || o.gift_product?.name || null;
          const giftQty = Number(t?.gift_quantity || 0);
          const giftUnit = t?.gift_quantity_unit || '';
          const minQty = Number(t?.min_quantity || 0);
          const minUnit = t?.min_quantity_unit || '';
          const discount = Number(t?.discount_percentage || 0);
          const discountAmt = Number(t?.discount_amount || 0);

          let detail = '';
          if (giftName && giftQty > 0) {
            detail = `🎁 اشترِ ${minQty} ${unitLabel(minUnit)} واحصل على ${giftQty} ${unitLabel(giftUnit)} ${giftName} مجاناً`;
          } else if (giftQty > 0) {
            detail = `🎁 ${minQty} ${unitLabel(minUnit)} + ${giftQty} ${unitLabel(giftUnit)} هدية`;
          } else if (discount > 0) {
            detail = `🔥 خصم ${discount}% عند شراء ${minQty} ${unitLabel(minUnit)}`;
          } else if (discountAmt > 0) {
            detail = `🔥 خصم ${discountAmt} دج عند شراء ${minQty} ${unitLabel(minUnit)}`;
          } else {
            detail = o.description || productName;
          }

          list.push({
            title: o.name || productName,
            subtitle: detail,
            image,
            tierLabel: tiers.length > 1 ? `الشريحة ${idx + 1} من ${tiers.length}` : undefined,
          });
        });
      });
    return list;
  }, [activeOffers]);

  // Fetch fallback product images for the background
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('image_url')
        .not('image_url', 'is', null)
        .limit(40);
      if (!alive) return;
      const urls = (data || [])
        .map((r: any) => r.image_url as string)
        .filter(Boolean);
      for (let i = urls.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [urls[i], urls[j]] = [urls[j], urls[i]];
      }
      setImages(urls);
    })();
    return () => { alive = false; };
  }, []);

  // Build the cycling list (offers preferred, fallback to product images)
  const cycle = slides.length > 0
    ? slides
    : images.map((img) => ({ title: 'إدارة الطلبيات', subtitle: 'عروض حصرية قادمة', product: '', image: img }));

  useEffect(() => {
    if (cycle.length < 2) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % cycle.length);
      setPhase((p) => (p + 1) % 4);
    }, 4000);
    return () => clearInterval(id);
  }, [cycle.length]);

  const animClass = [
    'animate-[showcaseZoom_4.1s_ease-out]',
    'animate-[showcasePan_4.1s_ease-out]',
    'animate-[showcaseTilt_4.1s_ease-out]',
    'animate-[showcaseZoomOut_4.1s_ease-out]',
  ][phase];

  const current = cycle[index];

  return (
    <div className="relative h-44 overflow-hidden bg-gradient-to-l from-primary to-primary/80 [.theme-soft_&]:bg-none [.theme-soft_&]:bg-background">
      <style>{`
        @keyframes showcaseZoom {
          0% { transform: scale(1.4) rotate(-2deg); opacity: 0; filter: blur(12px); }
          25% { opacity: 1; filter: blur(0); }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes showcasePan {
          0% { transform: translateX(15%) scale(1.2); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translateX(0) scale(1.05); opacity: 1; }
        }
        @keyframes showcaseTilt {
          0% { transform: scale(1.3) rotate(4deg); opacity: 0; filter: brightness(1.5); }
          30% { opacity: 1; filter: brightness(1); }
          100% { transform: scale(1.05) rotate(0); opacity: 1; }
        }
        @keyframes showcaseZoomOut {
          0% { transform: scale(0.7); opacity: 0; filter: blur(8px); }
          30% { opacity: 1; filter: blur(0); }
          100% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes textSlideUp {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {current?.image && (
        <div key={`bg-${index}`} className={`absolute inset-0 ${animClass}`}>
          <img src={current.image} alt="" className="w-full h-full object-cover" loading="eager" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-l from-primary/85 via-primary/65 to-primary/90" />

      <div key={`txt-${index}`} className="relative z-10 p-5 text-primary-foreground h-full flex flex-col justify-center animate-[textSlideUp_0.6s_ease-out]">
        {(current as any)?.tierLabel && (
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-semibold tracking-wider opacity-90">
              {(current as any).tierLabel}
            </span>
          </div>
        )}
        <h2 className="text-lg font-bold mb-1 line-clamp-1 drop-shadow">
          {current?.title || 'إدارة الطلبيات'}
        </h2>
        <p className="text-primary-foreground/95 text-sm line-clamp-2 drop-shadow">
          {isLoading && !current ? 'جاري تحميل العروض...' : (current?.subtitle || '')}
        </p>
        {cycle.length > 1 && (
          <div className="flex gap-1 mt-2">
            {cycle.slice(0, 6).map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all duration-500 ${
                  i === index % 6 ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const unitLabel = (u?: string) => {
  if (u === 'box') return 'صندوق';
  if (u === 'piece') return 'قطعة';
  return u || '';
};

export default ProductShowcaseHero;
