import React from 'react';
import {
  MoreHorizontal,
  Wallet,
  ClipboardList,
  Home,
  Plus,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BottomNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  onClick?: () => void;
  /** Tailwind text color class for active state (default: text-red-500) */
  activeColor?: string;
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

// Default items are placeholders; callers should pass localized labels.
const DEFAULT_ITEMS: BottomNavItem[] = [
  { key: 'more', label: 'More', icon: MoreHorizontal },
  { key: 'finance', label: 'Finance', icon: Wallet },
  { key: 'achievements', label: 'Achievements', icon: Trophy, activeColor: 'text-red-500' },
  { key: 'orders', label: 'Orders', icon: ClipboardList, badge: 11 },
];

/**
 * BottomNav — Flat dark SaaS bottom navbar (no curve).
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
  const safe = items.slice(0, 5);
  const [internal, setInternal] = React.useState(activeKey ?? safe[0]?.key);
  const active = activeKey ?? internal;

  const select = (k: string, cb?: () => void) => {
    setInternal(k);
    onChange?.(k);
    cb?.();
  };

  // Split around center button: 2 left + center + up to 3 right.
  const left = safe.slice(0, 2);
  const right = safe.slice(2, 5);

  return (
    <div
      dir="ltr"
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3',
        className,
      )}
      style={{ paddingBottom: `calc(16px + env(safe-area-inset-bottom))` }}
    >
      <nav
        aria-label="Bottom Navigation"
        className="pointer-events-auto flex w-full items-center justify-between rounded-2xl border border-white/5 bg-[#111113] px-2"
        style={{
          maxWidth: 430,
          height: 64,
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        }}
      >
        {left.map((it) => (
          <NavButton
            key={it.key}
            item={it}
            isActive={active === it.key}
            onClick={() => select(it.key, it.onClick)}
          />
        ))}

        <button
          type="button"
          aria-label={centerLabel}
          onClick={onCenterClick}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500 text-white transition-transform duration-200 hover:scale-105 active:scale-95"
          style={{ boxShadow: '0 6px 16px rgba(34,197,94,0.35)' }}
        >
          <CenterIcon size={22} strokeWidth={2.4} />
        </button>

        {right.map((it) => (
          <NavButton
            key={it.key}
            item={it}
            isActive={active === it.key}
            onClick={() => select(it.key, it.onClick)}
          />
        ))}
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
  const isAchievements = item.key === 'achievements';
  const isHome = item.key === 'home';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-200 active:scale-95',
        isAchievements
          ? 'bg-green-500 hover:bg-green-600'
              : isHome
                ? 'bg-green-500 hover:bg-green-600'
              : 'hover:bg-white/5',
      )}
      style={
        isAchievements ? { boxShadow: '0 6px 16px rgba(34,197,94,0.35)' }
        : isHome ? { boxShadow: '0 6px 16px rgba(34,197,94,0.45)' }








        : undefined
      }
    >
      <Icon
        size={22}
        strokeWidth={isActive ? 2.2 : 1.8}
        className={cn(
          'transition-colors duration-200',
          isAchievements
            ? 'text-white'
              : isHome
                ? 'text-white'
              : isActive ? (item.activeColor ?? 'text-red-500') : 'text-gray-400',
        )}
      />
      {item.badge ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      ) : null}
    </button>
  );
};

export default BottomNav;
