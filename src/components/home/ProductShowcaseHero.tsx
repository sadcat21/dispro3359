import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProductOffers } from '@/hooks/useProductOffers';
import { Gift } from 'lucide-react';

type Slide = {
  title: string;
  subtitle: string;
  image: string | null;
  tierLabel?: string;
};

const unitLabel = (u?: string) => {
  if (u === 'box') return 'صندوق';
  if (u === 'piece') return 'قطعة';
  return u || '';
};

const ProductShowcaseHero: React.FC = () => {
  const { activeOffers, isLoading } = useProductOffers();
  const [fallbackImages, setFallbackImages] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
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

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [];
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
            detail = `${minQty} ${unitLabel(minUnit)} + ${giftQty} ${unitLabel(giftUnit)} ${giftName} هدية`;
          } else if (giftQty > 0) {
            detail = `${minQty} ${unitLabel(minUnit)} + ${giftQty} ${unitLabel(giftUnit)} هدية`;
          } else if (discount > 0) {
            detail = `خصم ${discount}% عند شراء ${minQty} ${unitLabel(minUnit)}`;
          } else if (discountAmt > 0) {
            detail = `خصم ${discountAmt} دج عند شراء ${minQty} ${unitLabel(minUnit)}`;
          } else {
            detail = o.description || productName;
          }

          list.push({
            title: `PROM: ${productName}`,
            subtitle: detail,
            image,
            tierLabel: tiers.length > 1 ? `الشريحة ${idx + 1}/${tiers.length}` : undefined,
          });
        });
      });
    return list;
  }, [activeOffers]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('image_url')
        .not('image_url', 'is', null)
        .limit(20);
      if (!alive) return;
      setFallbackImages((data || []).map((r: any) => r.image_url).filter(Boolean));
    })();
    return () => { alive = false; };
  }, []);

  const cycle: Slide[] = slides.length > 0
    ? slides
    : fallbackImages.map((img) => ({ title: 'عروض حصرية قادمة', subtitle: '', image: img }));

  useEffect(() => {
    if (cycle.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % cycle.length), 3500);
    return () => clearInterval(id);
  }, [cycle.length]);

  if (enabled === false) return null;

  const current = cycle[index];
  const prev = cycle[(index - 1 + cycle.length) % cycle.length];
  const next = cycle[(index + 1) % cycle.length];

  return (
    <div
      className="relative h-48 sm:h-56 overflow-hidden bg-gradient-to-br from-red-600 via-red-500 to-red-700 [.theme-soft_&]:from-primary [.theme-soft_&]:via-primary [.theme-soft_&]:to-primary"
      dir="rtl"
    >
      <style>{`
        @keyframes heroDepthIn {
          0%   { transform: translateZ(-400px) scale(0.3) rotateY(-8deg); opacity: 0; filter: blur(14px); }
          40%  { opacity: 1; filter: blur(0); }
          100% { transform: translateZ(0) scale(1) rotateY(0); opacity: 1; filter: blur(0); }
        }
        @keyframes heroSideFade {
          0%   { opacity: 0; transform: scale(0.7); }
          100% { opacity: 0.35; transform: scale(1); }
        }
        @keyframes heroTextRise {
          0%   { transform: translateY(18px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .hero-stage { perspective: 900px; transform-style: preserve-3d; }
      `}</style>

      {/* soft radial glow background */}
      <div className="absolute inset-0 opacity-40 mix-blend-overlay"
        style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, rgba(255,255,255,0.6), transparent 55%)' }} />

      <div className="relative h-full max-w-5xl mx-auto px-4 sm:px-6 flex items-center">
        {/* Text — right side in RTL */}
        <div key={`txt-${index}`} className="relative z-20 flex-1 min-w-0 text-white animate-[heroTextRise_0.6s_ease-out]">
          {current?.tierLabel && (
            <span className="inline-block text-[10px] font-semibold tracking-wider bg-white/15 backdrop-blur px-2 py-0.5 rounded mb-1">
              {current.tierLabel}
            </span>
          )}
          <h2 className="text-base sm:text-2xl font-extrabold leading-tight drop-shadow-md line-clamp-2">
            {current?.title || 'عروض حصرية'}
          </h2>
          {current?.subtitle && (
            <p className="mt-1.5 text-xs sm:text-sm font-medium text-white/95 line-clamp-2 flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{isLoading && !current ? 'جاري تحميل العروض...' : current.subtitle}</span>
            </p>
          )}
          {cycle.length > 1 && (
            <div className="flex gap-1 mt-2.5">
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

        {/* 3D depth stage — left side */}
        <div className="hero-stage relative shrink-0 w-[150px] sm:w-[260px] h-full flex items-center justify-center">
          {/* Side previous (back-left) */}
          {prev?.image && (
            <div
              key={`prev-${index}`}
              className="absolute left-0 top-1/2 w-16 sm:w-24 h-16 sm:h-24 -translate-y-1/2 rounded-xl overflow-hidden bg-white/90 shadow-lg ring-1 ring-white/30 animate-[heroSideFade_0.7s_ease-out_forwards]"
              style={{ transform: 'translateY(-50%) translateX(-30%) scale(0.8)', filter: 'blur(2px)' }}
            >
              <img src={prev.image} alt="" className="w-full h-full object-contain p-1.5" />
            </div>
          )}

          {/* Side next (back-right) */}
          {next?.image && (
            <div
              key={`next-${index}`}
              className="absolute right-0 top-1/2 w-16 sm:w-24 h-16 sm:h-24 -translate-y-1/2 rounded-xl overflow-hidden bg-white/90 shadow-lg ring-1 ring-white/30 animate-[heroSideFade_0.7s_ease-out_forwards]"
              style={{ transform: 'translateY(-50%) translateX(30%) scale(0.8)', filter: 'blur(2px)' }}
            >
              <img src={next.image} alt="" className="w-full h-full object-contain p-1.5" />
            </div>
          )}

          {/* Featured center — comes from depth */}
          {current?.image ? (
            <div
              key={`center-${index}`}
              className="relative z-10 w-28 sm:w-40 h-28 sm:h-40 rounded-2xl bg-white shadow-2xl ring-2 ring-white/60 overflow-hidden animate-[heroDepthIn_0.9s_cubic-bezier(0.22,1,0.36,1)]"
            >
              <img src={current.image} alt={current.title} className="w-full h-full object-contain p-2" loading="eager" />
            </div>
          ) : (
            <div className="relative z-10 w-28 sm:w-40 h-28 sm:h-40 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Gift className="w-10 h-10 text-white/80" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductShowcaseHero;
