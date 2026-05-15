import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProductOffers } from '@/hooks/useProductOffers';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';
import { Gift } from 'lucide-react';
import heroBg from '@/assets/hero-offers-bg.jpg';

type SubtitlePart = { text: string; highlight?: boolean };
type Slide = {
  title: string;
  subtitleParts: SubtitlePart[];
  image: string | null;
  tierLabel?: string;
  endDate?: string | null;
};

const formatDate = (d?: string | null) => {
  if (!d) return '';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('ar-DZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return ''; }
};

const unitLabel = (u?: string) => {
  if (u === 'box') return 'صندوق';
  if (u === 'piece') return 'قطعة';
  return u || '';
};

const SLIDE_MS = 4000;

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

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [];
    (activeOffers || [])
      .filter((o: any) => o?.product?.name && o?.product?.image_url)
      .forEach((o: any) => {
        const productName = o.product.name as string;
        const image = o.product.image_url as string;
        const tiers = (o.tiers && o.tiers.length > 0) ? o.tiers : [o];
        tiers.forEach((t: any, idx: number) => {
          const giftName = t?.gift_product?.name || o.gift_product?.name || null;
          const giftQty = Number(t?.gift_quantity || 0);
          const giftUnit = t?.gift_quantity_unit || '';
          const minQty = Number(t?.min_quantity || 0);
          const minUnit = t?.min_quantity_unit || '';
          const discount = Number(t?.discount_percentage || 0);
          const discountAmt = Number(t?.discount_amount || 0);

          let subtitle = '';
          if (giftQty > 0) {
            const giftLabel = giftName ? `${giftQty} ${unitLabel(giftUnit)} ${giftName}` : `${giftQty} ${unitLabel(giftUnit)}`;
            subtitle = `اشترِ ${minQty} ${unitLabel(minUnit)} واحصل على ${giftLabel} هدية`;
          } else if (discount > 0) {
            subtitle = `اشترِ ${minQty} ${unitLabel(minUnit)} واحصل على خصم ${discount}%`;
          } else if (discountAmt > 0) {
            subtitle = `اشترِ ${minQty} ${unitLabel(minUnit)} واحصل على خصم ${discountAmt} دج`;
          } else {
            subtitle = o.description || '';
          }

          list.push({
            title: `PROM: ${productName}`,
            subtitle,
            image,
            tierLabel: tiers.length > 1 ? `الشريحة ${idx + 1}/${tiers.length}` : undefined,
          });
        });
      });
    return list;
  }, [activeOffers]);

  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [slides.length]);

  if (enabled === false) return null;
  if (slides.length === 0) return null;

  const current = slides[index];
  const prev = slides[(index - 1 + slides.length) % slides.length];
  const next = slides[(index + 1) % slides.length];
  const logo = companyInfo?.company_logo || companyInfo?.company_icon || '';

  return (
    <div className="relative h-52 sm:h-60 overflow-hidden" dir="rtl">
      <style>{`
        @keyframes heroDepthLoop {
          0%   { transform: translateZ(-500px) scale(0.25) rotateY(-10deg); opacity: 0; filter: blur(16px); }
          25%  { opacity: 1; filter: blur(0); }
          55%  { transform: translateZ(0) scale(1) rotateY(0); opacity: 1; filter: blur(0); }
          85%  { transform: translateZ(80px) scale(1.08) rotateY(6deg); opacity: 1; filter: blur(0); }
          100% { transform: translateZ(200px) scale(1.25) rotateY(10deg); opacity: 0; filter: blur(8px); }
        }
        @keyframes heroSideFloat {
          0%, 100% { transform: translateY(-50%) scale(0.85); opacity: 0.35; }
          50%      { transform: translateY(-55%) scale(0.9);  opacity: 0.55; }
        }
        @keyframes heroTextRise {
          0%   { transform: translateY(18px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .hero-stage { perspective: 1000px; transform-style: preserve-3d; }
      `}</style>

      {/* Brand-identity background */}
      <img src={heroBg} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-l from-white/30 via-white/40 to-white/10" />

      {/* Logo integrated as large faded brand watermark */}
      {logo && (
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[170%] w-auto max-w-none object-contain opacity-25 pointer-events-none select-none"
        />
      )}

      <div className="relative h-full max-w-5xl mx-auto px-4 sm:px-6 flex items-center gap-3">
        {/* Right (RTL): offer text */}
        <div className="relative z-20 flex-1 min-w-0">
          {logo && (
            <img
              src={logo}
              alt={companyInfo?.company_name || ''}
              className="h-8 sm:h-10 w-auto max-w-[55%] object-contain mb-2 drop-shadow-sm"
            />
          )}
          <div key={`txt-${index}`} className="animate-[heroTextRise_0.6s_ease-out]">
            <div className="inline-flex items-center gap-1.5 bg-red-600 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded mb-1">
              <Gift className="w-3 h-3" />
              عرض خاص
            </div>
            <h2 className="text-sm sm:text-lg font-extrabold leading-tight text-foreground line-clamp-1 drop-shadow-sm">
              {current.title}
            </h2>
            {current.subtitle && (
              <p className="mt-1 text-xs sm:text-sm font-semibold text-foreground/85 line-clamp-2">
                {current.subtitle}
              </p>
            )}
            {current.tierLabel && (
              <span className="block text-[10px] text-muted-foreground mt-0.5">{current.tierLabel}</span>
            )}
            {slides.length > 1 && (
              <div className="flex gap-1 mt-2">
                {slides.slice(0, 6).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 rounded-full transition-all duration-500 ${
                      i === index % 6 ? 'w-6 bg-red-600' : 'w-1.5 bg-foreground/20'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Left (RTL): 3D depth product stage with continuous loop */}
        <div className="hero-stage relative shrink-0 w-[160px] sm:w-[280px] h-full flex items-center justify-center">
          {prev?.image && (
            <div
              className="absolute left-0 top-1/2 w-16 sm:w-24 h-16 sm:h-24 overflow-hidden"
              style={{
                animation: 'heroSideFloat 3.5s ease-in-out infinite',
                transform: 'translateY(-50%) scale(0.85)',
                filter: 'blur(2px)',
              }}
            >
              <img src={prev.image} alt="" className="w-full h-full object-contain p-1.5" />
            </div>
          )}
          {next?.image && (
            <div
              className="absolute right-0 top-1/2 w-16 sm:w-24 h-16 sm:h-24 overflow-hidden"
              style={{
                animation: 'heroSideFloat 3.5s ease-in-out infinite',
                animationDelay: '1.5s',
                transform: 'translateY(-50%) scale(0.85)',
                filter: 'blur(2px)',
              }}
            >
              <img src={next.image} alt="" className="w-full h-full object-contain p-1.5" />
            </div>
          )}
          <div
            key={`center-${index}`}
            className="relative z-10 w-28 sm:w-40 h-28 sm:h-40 overflow-visible"
            style={{ animation: `heroDepthLoop ${SLIDE_MS}ms cubic-bezier(0.22,1,0.36,1) infinite` }}
          >
            <img src={current.image!} alt={current.title} className="w-full h-full object-contain p-2" loading="eager" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductShowcaseHero;
