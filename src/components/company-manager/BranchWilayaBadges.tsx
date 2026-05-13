import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Star } from 'lucide-react';
import { getWilayaCode, getWilayaColor } from '@/lib/algeriaWilayas';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Branch } from '@/types/database';

const LONG_PRESS_MS = 450;

const BranchWilayaBadges: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { activeBranch, selectBranch } = useAuth();

  const { data: branches } = useQuery({
    queryKey: ['cm-branches-wilayas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as Branch[];
    },
    staleTime: 60_000,
  });

  const { data: counts } = useQuery({
    queryKey: ['cm-branch-pending-counts'],
    queryFn: async () => {
      const [receipts, invoices, coverage] = await Promise.all([
        supabase.from('stock_receipts').select('branch_id').eq('status', 'pending_assistant'),
        supabase.from('manual_invoice_requests').select('branch_id').eq('status', 'pending_assistant'),
        supabase
          .from('sector_coverage')
          .select('id, sectors!inner(branch_id)')
          .eq('approval_status', 'pending'),
      ]);
      const map = new Map<string, number>();
      const add = (bid: string | null | undefined) => {
        if (!bid) return;
        map.set(bid, (map.get(bid) || 0) + 1);
      };
      (receipts.data || []).forEach((r: any) => add(r.branch_id));
      (invoices.data || []).forEach((r: any) => add(r.branch_id));
      (coverage.data || []).forEach((r: any) => add(r.sectors?.branch_id));
      return map;
    },
    refetchInterval: 15_000,
  });

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const startPress = (branchId: string) => {
    longPressed.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressed.current = true;
      navigate(`/assistant-approvals?branch=${branchId}`);
    }, LONG_PRESS_MS);
  };

  const cancelPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = (branch: Branch) => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    selectBranch(branch);
  };

  if (!branches || branches.length === 0) return null;

  const isAllSelected = !activeBranch;

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {branches.map((b) => {
        const code = getWilayaCode(b.wilaya);
        const color = getWilayaColor(code);
        const pending = counts?.get(b.id) || 0;
        const isSelected = activeBranch?.id === b.id;
        const fillHex = isSelected ? '#dc2626' : color.hex;
        return (
          <Tooltip key={b.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleClick(b)}
                onMouseDown={() => startPress(b.id)}
                onMouseUp={cancelPress}
                onMouseLeave={cancelPress}
                onTouchStart={() => startPress(b.id)}
                onTouchEnd={cancelPress}
                onTouchCancel={cancelPress}
                onContextMenu={(e) => e.preventDefault()}
                className={`relative shrink-0 w-9 h-9 focus:outline-none hover:scale-110 transition-transform ${isSelected ? 'scale-110' : ''}`}
                aria-label={b.name}
                aria-pressed={isSelected}
              >
                <Shield
                  className="w-9 h-9 drop-shadow"
                  fill={fillHex}
                  color={fillHex}
                  strokeWidth={1.5}
                />
                <span className="absolute inset-0 flex items-center justify-center pt-1 text-white text-[11px] font-extrabold leading-none pointer-events-none">
                  {code ?? '?'}
                </span>
                {isSelected && (
                  <Star
                    className="absolute -top-1 -start-1 w-3.5 h-3.5 text-yellow-400 drop-shadow pointer-events-none"
                    fill="currentColor"
                    strokeWidth={1.5}
                  />
                )}
                {pending > 0 && (
                  <span className="absolute -top-1 -end-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center shadow ring-1 ring-white">
                    {pending > 99 ? '99+' : pending}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {b.name}
                {b.wilaya ? ` — ${b.wilaya}` : ''}
                {pending > 0 ? ` · ${pending}` : ''}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}

      {/* All branches badge */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => selectBranch(null)}
            className={`relative shrink-0 w-9 h-9 focus:outline-none hover:scale-110 transition-transform ${isAllSelected ? 'scale-110' : ''}`}
            aria-label={t('branch_selection.all_branches')}
            aria-pressed={isAllSelected}
          >
            <Shield
              className="w-9 h-9 drop-shadow"
              fill={isAllSelected ? '#dc2626' : '#6b7280'}
              color={isAllSelected ? '#dc2626' : '#6b7280'}
              strokeWidth={1.5}
            />
            <Star
              className="absolute inset-0 m-auto w-4 h-4 text-yellow-300 pointer-events-none"
              fill="currentColor"
              strokeWidth={1.5}
            />
            {isAllSelected && (
              <Star
                className="absolute -top-1 -start-1 w-3.5 h-3.5 text-yellow-400 drop-shadow pointer-events-none"
                fill="currentColor"
                strokeWidth={1.5}
              />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{t('branch_selection.all_branches')}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default BranchWilayaBadges;
