import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProductOffers } from '@/hooks/useProductOffers';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';
import { Gift, ChevronLeft, ChevronRight } from 'lucide-react';
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

interface ProductShowcaseHeroProps {
  children?: React.ReactNode;
}

const ProductShowcaseHero: React.FC<ProductShowcaseHeroProps> = ({ children }) => {
  const { activeOffers } = useProductOffers();
  const { companyInfo } = useCompanyInfo();
  const [index, setIndex] = useState(0);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

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

          let subtitleParts: SubtitlePart[] = [];
          if (giftQty > 0) {
            const giftQtyText = `${giftQty} ${unitLabel(giftUnit)}`;
            const minQtyText = `${minQty} ${unitLabel(minUnit)}`;
            subtitleParts = [
              { text: 'اشترِ ' },
              { text: minQtyText, highlight: true },
              { text: ' واحصل على ' },
              { text: giftQtyText, highlight: true },
              { text: giftName ? ` ${giftName} هدية` : ' هدية' },
            ];
          } else if (discount > 0) {
            subtitleParts = [
              { text: 'اشترِ ' },
              { text: `${minQty} ${unitLabel(minUnit)}`, highlight: true },
              { text: ' واحصل على خصم ' },
              { text: `${discount}%`, highlight: true },
            ];
          } else if (discountAmt > 0) {
            subtitleParts = [
              { text: 'اشترِ ' },
              { text: `${minQty} ${unitLabel(minUnit)}`, highlight: true },
              { text: ' واحصل على خصم ' },
              { text: `${discountAmt} دج`, highlight: true },
            ];
          } else if (o.description) {
            subtitleParts = [{ text: o.description }];
          }

          list.push({
            title: productName,
            subtitleParts,
            image,
            tierLabel: tiers.length > 1 ? `الشريحة ${idx + 1}/${tiers.length}` : undefined,
            endDate: o.end_date || null,
          });
        });
      });
    return list;
  }, [activeOffers]);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [slides.length, paused]);

  const goNext = () => setIndex((i) => (i + 1) % Math.max(slides.length, 1));
  const goPrev = () => setIndex((i) => (i - 1 + Math.max(slides.length, 1)) % Math.max(slides.length, 1));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    setPaused(true);
    // RTL: swipe right -> previous (visually next in RTL); keep intuitive: right => prev, left => next
    if (dx > 0) goPrev(); else goNext();
  };

  if (enabled === false) {
    // Still render the buttons slot if provided
    return children ? <div className="px-4 mt-2">{children}</div> : null;
  }
  if (slides.length === 0) {
    return children ? <div className="px-4 mt-2">{children}</div> : null;
  }

  const current = slides[index];
  const logo = companyInfo?.company_logo || companyInfo?.company_icon || '';

  return (
    <div
      className="relative h-44 sm:h-52 overflow-hidden select-none"
      dir="rtl"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <style>{`
        @keyframes heroProductCycle {
          0%   { transform: translateX(-120%) scale(0.6); opacity: 0; filter: blur(6px); }
          18%  { transform: translateX(0) scale(1); opacity: 1; filter: blur(0); }
          70%  { transform: translateX(0) scale(1); opacity: 1; filter: blur(0); }
          100% { transform: translateX(120%) scale(0.55); opacity: 0; filter: blur(8px); }
        }
        @keyframes heroTextRise {
          0%   { transform: translateY(18px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
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

      <div className="relative h-full max-w-5xl mx-auto px-4 sm:px-6 flex items-center gap-3 pb-12">
        {/* Right (RTL): offer text */}
        <div className="relative z-20 flex-1 min-w-0">
          <div key={`txt-${index}`} className="animate-[heroTextRise_0.6s_ease-out]">
            <div className="inline-flex items-center gap-1.5 bg-gradient-to-l from-red-700 to-red-500 text-white text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full shadow-md ring-1 ring-white/40 mb-1.5">
              <Gift className="w-3 h-3" />
              <span>عرض خاص</span>
              {current.endDate && (
                <span className="border-r border-white/40 ps-2 pe-0.5 font-semibold whitespace-nowrap">
                  {formatDate(current.endDate)}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <h2 className="text-sm sm:text-lg font-extrabold leading-tight text-foreground line-clamp-1 drop-shadow-sm">
                {current.title}
              </h2>
            </div>
            {current.subtitleParts.length > 0 && (
              <p className="mt-1 text-xs sm:text-sm font-semibold text-foreground/85 line-clamp-2">
                {current.subtitleParts.map((p, i) => (
                  <span key={i} className={p.highlight ? 'text-red-600 font-extrabold' : ''}>
                    {p.text}
                  </span>
                ))}
              </p>
            )}
            {current.tierLabel && (
              <span className="block text-[10px] text-muted-foreground mt-0.5">{current.tierLabel}</span>
            )}
            {slides.length > 1 && (
              <div className="flex gap-1 mt-2">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`الشريحة ${i + 1}`}
                    onClick={() => { setPaused(true); setIndex(i); }}
                    className={`h-1 rounded-full transition-all duration-500 ${
                      i === index ? 'w-6 bg-red-600' : 'w-1.5 bg-foreground/20'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Left (RTL): product image */}
        <div className="relative shrink-0 w-[140px] sm:w-[220px] h-full flex items-center justify-center overflow-visible">
          <div
            key={`product-${index}`}
            className="relative z-10 w-28 sm:w-40 h-28 sm:h-40"
            style={{ animation: `heroProductCycle ${SLIDE_MS}ms cubic-bezier(0.22,1,0.36,1) both` }}
          >
            <img src={current.image!} alt={current.title} className="w-full h-full object-contain drop-shadow-xl" loading="eager" />
          </div>
        </div>
      </div>

      {/* Manual nav arrows — always visible, brand-themed */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label="السابق"
            onClick={() => { setPaused(true); goPrev(); }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 z-40 h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-br from-red-600 to-red-700 text-white flex items-center justify-center shadow-lg ring-2 ring-white/70 active:scale-95 transition-transform"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            type="button"
            aria-label="التالي"
            onClick={() => { setPaused(true); goNext(); }}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 z-40 h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-br from-red-600 to-red-700 text-white flex items-center justify-center shadow-lg ring-2 ring-white/70 active:scale-95 transition-transform"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </>
      )}

      {/* Buttons slot — overlaid at bottom of hero */}
      {children && (
        <div className="absolute bottom-1.5 left-2 right-2 z-30">
          {children}
        </div>
      )}
    </div>
  );
};

export default ProductShowcaseHero;
