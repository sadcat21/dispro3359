import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProductOffers } from '@/hooks/useProductOffers';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';
import { Gift } from 'lucide-react';
import heroBg from '@/assets/hero-offers-bg.jpg';

type Slide = {
  title: string;
  image: string | null;
  tierLabel?: string;
};

const ProductShowcaseHero: React.FC = () => {
  const { activeOffers } = useProductOffers();
  const { companyInfo } = useCompanyInfo();
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

  // Only products that actually have an active offer + an image
  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [];
    (activeOffers || [])
      .filter((o: any) => o?.product?.name && o?.product?.image_url)
      .forEach((o: any) => {
        const productName = o.product.name as string;
        const image = o.product.image_url as string;
        const tiers = (o.tiers && o.tiers.length > 0) ? o.tiers : [o];
        tiers.forEach((_t: any, idx: number) => {
          list.push({
            title: `PROM: ${productName}`,
            image,
            tierLabel: tiers.length > 1 ? `الشريحة ${idx + 1}/${tiers.length}` : undefined,
          });
        });
      });
    return list;
  }, [activeOffers]);

  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 3500);
    return () => clearInterval(id);
  }, [slides.length]);

  if (enabled === false) return null;
  if (slides.length === 0) return null;

  const current = slides[index];
  const prev = slides[(index - 1 + slides.length) % slides.length];
  const next = slides[(index + 1) % slides.length];
  const logo = companyInfo?.company_logo || companyInfo?.company_icon || '';

  return (
    <div className="relative h-48 sm:h-56 overflow-hidden bg-white" dir="rtl">
      <style>{`
        @keyframes heroDepthIn {
          0%   { transform: translateZ(-400px) scale(0.3) rotateY(-8deg); opacity: 0; filter: blur(14px); }
          40%  { opacity: 1; filter: blur(0); }
          100% { transform: translateZ(0) scale(1) rotateY(0); opacity: 1; filter: blur(0); }
        }
        @keyframes heroSideFade {
          0%   { opacity: 0; transform: translateY(-50%) scale(0.7); }
          100% { opacity: 0.45; transform: translateY(-50%) scale(1); }
        }
        @keyframes heroTextRise {
          0%   { transform: translateY(18px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .hero-stage { perspective: 900px; transform-style: preserve-3d; }
      `}</style>

      {/* AI-generated premium background */}
      <img
        src={heroBg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Soft white wash for product/text legibility */}
      <div className="absolute inset-0 bg-gradient-to-l from-white/40 via-white/55 to-white/75" />

      {/* Bottom accent line */}
      <div className="absolute bottom-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      <div className="relative h-full max-w-5xl mx-auto px-4 sm:px-6 flex items-center gap-3">
        {/* Right: company logo + offer label (RTL) */}
        <div className="relative z-20 flex-1 min-w-0 flex flex-col items-start gap-2">
          {logo ? (
            <img
              src={logo}
              alt={companyInfo?.company_name || ''}
              className="h-10 sm:h-14 w-auto max-w-[60%] object-contain drop-shadow-sm"
            />
          ) : (
            <span className="text-base sm:text-xl font-extrabold text-foreground tracking-tight">
              {companyInfo?.company_name || ''}
            </span>
          )}
          <div key={`txt-${index}`} className="animate-[heroTextRise_0.6s_ease-out] min-w-0 w-full">
            <div className="inline-flex items-center gap-1.5 bg-red-600 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded">
              <Gift className="w-3 h-3" />
              عرض خاص
            </div>
            <h2 className="mt-1 text-sm sm:text-lg font-extrabold leading-tight text-foreground line-clamp-2">
              {current.title}
            </h2>
            {current.tierLabel && (
              <span className="text-[10px] text-muted-foreground">{current.tierLabel}</span>
            )}
            {slides.length > 1 && (
              <div className="flex gap-1 mt-2">
                {slides.slice(0, 6).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 rounded-full transition-all duration-500 ${
                      i === index % 6 ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Left: 3D depth product stage (RTL) */}
        <div className="hero-stage relative shrink-0 w-[160px] sm:w-[280px] h-full flex items-center justify-center">
          {prev?.image && (
            <div
              key={`prev-${index}`}
              className="absolute left-0 top-1/2 w-16 sm:w-24 h-16 sm:h-24 rounded-xl overflow-hidden bg-white shadow-md ring-1 ring-black/5 animate-[heroSideFade_0.7s_ease-out_forwards]"
              style={{ transform: 'translateY(-50%) translateX(-20%) scale(0.85)', filter: 'blur(2px)' }}
            >
              <img src={prev.image} alt="" className="w-full h-full object-contain p-1.5" />
            </div>
          )}
          {next?.image && (
            <div
              key={`next-${index}`}
              className="absolute right-0 top-1/2 w-16 sm:w-24 h-16 sm:h-24 rounded-xl overflow-hidden bg-white shadow-md ring-1 ring-black/5 animate-[heroSideFade_0.7s_ease-out_forwards]"
              style={{ transform: 'translateY(-50%) translateX(20%) scale(0.85)', filter: 'blur(2px)' }}
            >
              <img src={next.image} alt="" className="w-full h-full object-contain p-1.5" />
            </div>
          )}
          <div
            key={`center-${index}`}
            className="relative z-10 w-28 sm:w-40 h-28 sm:h-40 rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden animate-[heroDepthIn_0.9s_cubic-bezier(0.22,1,0.36,1)]"
          >
            <img src={current.image!} alt={current.title} className="w-full h-full object-contain p-2" loading="eager" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductShowcaseHero;
