import React from 'react';
import { motion } from 'framer-motion';
import { Home, LayoutGrid, Wallet, User, Repeat2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BottomNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
}

export interface BottomNavProps {
  items?: BottomNavItem[];
  activeKey?: string;
  onChange?: (key: string) => void;
  centerIcon?: LucideIcon;
  centerLabel?: string;
  onCenterClick?: () => void;
  className?: string;
}

const DEFAULT_ITEMS: BottomNavItem[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'categories', label: 'Categories', icon: LayoutGrid },
  { key: 'wallet', label: 'Wallet', icon: Wallet },
  { key: 'profile', label: 'Profile', icon: User },
];

/**
 * BottomNav — شريط تنقل سفلي عائم وفخم بأسلوب 2025
 * - Floating + حواف دائرية كبيرة + Shadow ناعم
 * - زر مركزي بارز للخارج مع Curved Notch (SVG)
 * - 4 عناصر جانبية (2 + 2)
 * - متوافق Mobile-first + Safe Area Insets
 * - Framer Motion: scale / fade / hover-tap
 */
const BottomNav: React.FC<BottomNavProps> = ({
  items = DEFAULT_ITEMS,
  activeKey,
  onChange,
  centerIcon: CenterIcon = Repeat2,
  centerLabel = 'Action',
  onCenterClick,
  className,
}) => {
  const safeItems = items.slice(0, 4);
  const left = safeItems.slice(0, 2);
  const right = safeItems.slice(2, 4);
  const [internalActive, setInternalActive] = React.useState(activeKey ?? safeItems[0]?.key);
  const active = activeKey ?? internalActive;

  const handleSelect = (key: string) => {
    setInternalActive(key);
    onChange?.(key);
  };

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center',
        'px-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
        className,
      )}
    >
      <motion.nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="pointer-events-auto relative w-full max-w-md"
        aria-label="Bottom Navigation"
      >
        {/* خلفية الشريط مع Notch منحني عبر SVG mask */}
        <div className="relative">
          <NavShape />

          {/* العناصر */}
          <div className="relative flex h-[68px] items-center justify-between px-3">
            <div className="flex flex-1 items-center justify-around">
              {left.map((item) => (
                <NavButton
                  key={item.key}
                  item={item}
                  isActive={active === item.key}
                  onClick={() => {
                    handleSelect(item.key);
                    item.onClick?.();
                  }}
                />
              ))}
            </div>

            {/* مساحة فارغة تحت الزر المركزي */}
            <div className="w-20" aria-hidden />

            <div className="flex flex-1 items-center justify-around">
              {right.map((item) => (
                <NavButton
                  key={item.key}
                  item={item}
                  isActive={active === item.key}
                  onClick={() => {
                    handleSelect(item.key);
                    item.onClick?.();
                  }}
                />
              ))}
            </div>
          </div>

          {/* الزر المركزي العائم */}
          <motion.button
            type="button"
            onClick={onCenterClick}
            aria-label={centerLabel}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className={cn(
              'absolute left-1/2 -top-7 -translate-x-1/2',
              'flex h-16 w-16 items-center justify-center rounded-full',
              'bg-primary text-primary-foreground',
              'shadow-[0_10px_30px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)]',
              'ring-4 ring-background',
              'transition-colors',
            )}
          >
            <CenterIcon className="h-6 w-6" strokeWidth={2.2} />
          </motion.button>
        </div>
      </motion.nav>
    </div>
  );
};

/* ---------- زر فرعي ---------- */
const NavButton: React.FC<{
  item: BottomNavItem;
  isActive: boolean;
  onClick: () => void;
}> = ({ item, isActive, onClick }) => {
  const Icon = item.icon;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.08 }}
      transition={{ type: 'spring', stiffness: 350, damping: 20 }}
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
      className="relative flex h-12 w-12 flex-col items-center justify-center"
    >
      <motion.span
        initial={false}
        animate={{
          color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
          scale: isActive ? 1.1 : 1,
        }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.2 : 1.6} />
      </motion.span>

      {/* نقطة دلالية تحت الأيقونة النشطة */}
      <motion.span
        initial={false}
        animate={{ opacity: isActive ? 1 : 0, scale: isActive ? 1 : 0.4 }}
        transition={{ duration: 0.25 }}
        className="mt-1 h-1 w-1 rounded-full bg-primary"
      />
    </motion.button>
  );
};

/* ---------- شكل الخلفية مع Notch منحني ---------- */
const NavShape: React.FC = () => {
  // Notch بسيط ودقيق عبر SVG، يعطي إحساس Premium
  return (
    <svg
      viewBox="0 0 380 80"
      preserveAspectRatio="none"
      className={cn(
        'absolute inset-0 h-full w-full',
        'drop-shadow-[0_12px_30px_rgba(15,23,42,0.10)]',
      )}
      aria-hidden
    >
      <defs>
        <linearGradient id="bn-bg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--card)" />
          <stop offset="100%" stopColor="var(--background)" />
        </linearGradient>
      </defs>
      <path
        fill="url(#bn-bg)"
        stroke="color-mix(in oklab, var(--border) 70%, transparent)"
        strokeWidth="1"
        d="
          M30,4
          H155
          C165,4 168,18 178,24
          C184,27.5 196,27.5 202,24
          C212,18 215,4 225,4
          H350
          C365,4 376,15 376,30
          V58
          C376,71 365,76 350,76
          H30
          C15,76 4,71 4,58
          V30
          C4,15 15,4 30,4
          Z
        "
      />
    </svg>
  );
};

export default BottomNav;
