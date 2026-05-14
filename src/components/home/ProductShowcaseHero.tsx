import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  fullName?: string | null;
  subtitle?: string;
}

const ProductShowcaseHero: React.FC<Props> = ({ fullName, subtitle }) => {
  const { t } = useLanguage();
  const [images, setImages] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState(0); // toggles transition variant

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
      // shuffle
      for (let i = urls.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [urls[i], urls[j]] = [urls[j], urls[i]];
      }
      setImages(urls);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
      setPhase((p) => (p + 1) % 4);
    }, 3500);
    return () => clearInterval(id);
  }, [images.length]);

  const animClass = [
    'animate-[showcaseZoom_3.6s_ease-out]',
    'animate-[showcasePan_3.6s_ease-out]',
    'animate-[showcaseTilt_3.6s_ease-out]',
    'animate-[showcaseZoomOut_3.6s_ease-out]',
  ][phase];

  return (
    <div className="relative h-44 overflow-hidden bg-gradient-to-l from-primary to-primary/80 [.theme-soft_&]:bg-none [.theme-soft_&]:bg-background">
      <style>{`
        @keyframes showcaseZoom {
          0% { transform: scale(1.4) rotate(-2deg); opacity: 0; filter: blur(12px); }
          25% { opacity: 1; filter: blur(0); }
          100% { transform: scale(1) rotate(0); opacity: 1; filter: blur(0); }
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
      `}</style>

      {/* Image stack */}
      {images.length > 0 && (
        <div key={index} className={`absolute inset-0 ${animClass}`}>
          <img
            src={images[index]}
            alt=""
            className="w-full h-full object-cover"
            loading="eager"
          />
        </div>
      )}

      {/* Dark overlay for legibility */}
      <div className="absolute inset-0 bg-gradient-to-l from-primary/80 via-primary/60 to-primary/90" />

      {/* Text */}
      <div className="relative z-10 p-6 text-primary-foreground h-full flex flex-col justify-center">
        <h2 className="text-xl font-bold mb-1 drop-shadow">
          {t('common.welcome')} {fullName} 👋
        </h2>
        {subtitle && (
          <p className="text-primary-foreground/90 text-sm drop-shadow">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

export default ProductShowcaseHero;
