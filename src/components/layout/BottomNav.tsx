import React from 'react';
import { motion } from 'framer-motion';
import {
  MoreHorizontal,
  Wallet,
  ClipboardList,
  Home,
  Repeat2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BottomNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
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

const FAB_SIZE = 62; // px
const NAV_HEIGHT = 72; // px
const NOTCH_RADIUS = FAB_SIZE / 2 + 6; // breathing room around FAB
const NAV_RADIUS = 28;

const DEFAULT_ITEMS: BottomNavItem[] = [
  { key: 'more', label: 'More', icon: MoreHorizontal },
  { key: 'finance', label: 'Finance', icon: Wallet },
  { key: 'orders', label: 'Orders', icon: ClipboardList },
  { key: 'home', label: 'Home', icon: Home },
];

const INACTIVE = '#444444';
const ACTIVE = '#ff4d4f';

/**
 * BottomNav — Premium SaaS floating bottom navbar
 * Glassmorphism + curved notch + centered FAB.
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

  const [internal, setInternal] = React.useState(activeKey ?? safeItems[0]?.key);
  const active = activeKey ?? internal;

  const select = (k: string, cb?: () => void) => {
    setInternal(k);
    onChange?.(k);
    cb?.();
  };

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center',
        className,
      )}
      style={{
        paddingBottom: `calc(18px + env(safe-area-inset-bottom))`,
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      <motion.nav
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        aria-label="Bottom Navigation"
        className="pointer-events-auto relative w-full max-w-md"
        style={{ height: NAV_HEIGHT }}
      >
        {/* Glass + notch background */}
        <NavBackground />

        {/* Items */}
        <div
          className="relative flex h-full items-center justify-between"
          style={{ paddingLeft: 24, paddingRight: 24 }}
        >
          <div className="flex flex-1 items-center justify-around">
            {left.map((it) => (
              <NavButton
                key={it.key}
                item={it}
                isActive={active === it.key}
                onClick={() => select(it.key, it.onClick)}
              />
            ))}
          </div>

          {/* FAB reservation slot */}
          <div style={{ width: FAB_SIZE + 24 }} aria-hidden />

          <div className="flex flex-1 items-center justify-around">
            {right.map((it) => (
              <NavButton
                key={it.key}
                item={it}
                isActive={active === it.key}
                onClick={() => select(it.key, it.onClick)}
              />
            ))}
          </div>
        </div>

        {/* Floating Action Button — overlaps navbar by 45% */}
        <motion.button
          type="button"
          aria-label={centerLabel}
          onClick={onCenterClick}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 380, damping: 18 }}
          className="absolute left-1/2 flex items-center justify-center rounded-full text-white"
          style={{
            width: FAB_SIZE,
            height: FAB_SIZE,
            top: -FAB_SIZE * 0.45,
            transform: 'translateX(-50%)',
            backgroundColor: ACTIVE,
            boxShadow: '0 8px 24px rgba(255,77,79,0.45)',
          }}
        >
          {/* Pulse ring */}
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: ACTIVE }}
            animate={{ opacity: [0.45, 0, 0.45], scale: [1, 1.5, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
            aria-hidden
          />
          <CenterIcon size={26} strokeWidth={2.2} className="relative z-10" />
        </motion.button>
      </motion.nav>
    </div>
  );
};

/* ---------- Nav button ---------- */
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
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.9 }}
      animate={{ scale: isActive ? 1.08 : 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 20 }}
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
      className="relative flex h-12 w-12 items-center justify-center"
    >
      <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} color={isActive ? ACTIVE : INACTIVE} />
      {item.badge ? (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
          style={{ backgroundColor: ACTIVE }}
        >
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      ) : null}
    </motion.button>
  );
};

/* ---------- Glassmorphism background with curved notch (SVG) ---------- */
const NavBackground: React.FC = () => {
  const W = 400;
  const H = NAV_HEIGHT;
  const r = NAV_RADIUS;
  const nr = NOTCH_RADIUS;
  const cx = W / 2;

  // Smooth notch using cubic curves (no sharp edges)
  const notchHalf = nr + 14;
  const path = `
    M ${r},0
    H ${cx - notchHalf}
    C ${cx - notchHalf + 14},0 ${cx - nr - 2},${nr} ${cx - nr},${nr}
    A ${nr},${nr} 0 0 0 ${cx + nr},${nr}
    C ${cx + nr + 2},${nr} ${cx + notchHalf - 14},0 ${cx + notchHalf},0
    H ${W - r}
    Q ${W},0 ${W},${r}
    V ${H - r}
    Q ${W},${H} ${W - r},${H}
    H ${r}
    Q 0,${H} 0,${H - r}
    V ${r}
    Q 0,0 ${r},0
    Z
  `;

  return (
    <div
      className="absolute inset-0"
      style={{
        filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.08))',
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        className="block"
        aria-hidden
      >
        <defs>
          <clipPath id="bn-clip">
            <path d={path} />
          </clipPath>
        </defs>
        {/* Glass fill */}
        <foreignObject x="0" y="0" width={W} height={H} clipPath="url(#bn-clip)">
          <div
            // @ts-expect-error xmlns inside foreignObject
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              width: '100%',
              height: '100%',
              background: 'rgba(255,255,255,0.78)',
              backdropFilter: 'blur(18px) saturate(140%)',
              WebkitBackdropFilter: 'blur(18px) saturate(140%)',
            }}
          />
        </foreignObject>
        <path
          d={path}
          fill="none"
          stroke="rgba(15,23,42,0.06)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
};

export default BottomNav;
