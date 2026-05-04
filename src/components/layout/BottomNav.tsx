import React from 'react';
import {
  MoreHorizontal,
  Wallet,
  ClipboardList,
  Home,
  Plus,
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

const DEFAULT_ITEMS: BottomNavItem[] = [
  { key: 'more', label: 'More', icon: MoreHorizontal },
  { key: 'finance', label: 'Finance', icon: Wallet },
  { key: 'orders', label: 'Orders', icon: ClipboardList, badge: 11 },
  { key: 'home', label: 'Home', icon: Home },
];

/**
 * BottomNav — Premium floating bottom navbar
 * SVG curved notch + centered FAB. Tailwind only.
 */
const BottomNav: React.FC<BottomNavProps> = ({
  items = DEFAULT_ITEMS,
  activeKey,
  onChange,
  centerIcon: CenterIcon = Plus,
  centerLabel = 'Action',
  onCenterClick,
  className,
}) => {
  const safe = items.slice(0, 4);
  const left = safe.slice(0, 2);
  const right = safe.slice(2, 4);

  const [internal, setInternal] = React.useState(activeKey ?? safe[0]?.key);
  const active = activeKey ?? internal;

  const select = (k: string, cb?: () => void) => {
    setInternal(k);
    onChange?.(k);
    cb?.();
  };

  return (
    <div
      dir="ltr"
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3',
        className,
      )}
      style={{ paddingBottom: `calc(20px + env(safe-area-inset-bottom))` }}
    >
      <nav
        aria-label="Bottom Navigation"
        className="pointer-events-auto relative w-full"
        style={{ maxWidth: 430, height: 74 }}
      >
        {/* SVG curved notch background */}
        <svg
          viewBox="0 0 400 80"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          style={{ filter: 'drop-shadow(0 12px 30px rgba(0,0,0,0.08))' }}
          aria-hidden
        >
          <defs>
            <clipPath id="bn-clip">
              <path d="M28 0 H140 C160 0 170 42 200 42 C230 42 240 0 260 0 H372 Q400 0 400 28 V52 Q400 80 372 80 H28 Q0 80 0 52 V28 Q0 0 28 0 Z" />
            </clipPath>
          </defs>
          <foreignObject x="0" y="0" width="400" height="80" clipPath="url(#bn-clip)">
            <div
              // @ts-expect-error xmlns inside foreignObject
              xmlns="http://www.w3.org/1999/xhtml"
              style={{
                width: '100%',
                height: '100%',
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(18px) saturate(140%)',
                WebkitBackdropFilter: 'blur(18px) saturate(140%)',
              }}
            />
          </foreignObject>
        </svg>

        {/* Items row */}
        <div className="relative flex h-full items-center">
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
          <div className="w-[78px]" aria-hidden />
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

        {/* FAB */}
        <button
          type="button"
          aria-label={centerLabel}
          onClick={onCenterClick}
          className="group absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full text-white transition-transform duration-300 hover:scale-110 active:scale-95"
          style={{
            width: 62,
            height: 62,
            top: -28,
            backgroundColor: '#ff4d4f',
            boxShadow: '0 10px 24px rgba(255,77,79,0.45)',
          }}
        >
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-40"
            style={{ backgroundColor: '#ff4d4f', animationDuration: '2.4s' }}
            aria-hidden
          />
          <CenterIcon size={26} strokeWidth={2.4} className="relative z-10" />
        </button>
      </nav>
    </div>
  );
};

const NavButton: React.FC<{
  item: BottomNavItem;
  isActive: boolean;
  onClick: () => void;
}> = ({ item, isActive, onClick }) => {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative flex h-12 w-12 items-center justify-center transition-transform duration-200 hover:scale-110 active:scale-95',
        isActive && 'scale-[1.08]',
      )}
    >
      <Icon
        size={22}
        strokeWidth={isActive ? 2.2 : 1.8}
        className={cn(
          'transition-colors duration-200',
          isActive ? 'text-red-500' : 'text-gray-500',
        )}
      />
      {item.badge ? (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white shadow">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      ) : null}
    </button>
  );
};

export default BottomNav;
