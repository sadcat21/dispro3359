import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Shield } from 'lucide-react';
import { getWilayaCode, getWilayaColor } from '@/lib/algeriaWilayas';
import { useLanguage } from '@/contexts/LanguageContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface BranchRow {
  id: string;
  name: string;
  wilaya: string | null;
}

const BranchWilayaBadges: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const { data: branches } = useQuery({
    queryKey: ['cm-branches-wilayas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, wilaya')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as BranchRow[];
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

  if (!branches || branches.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {branches.map((b) => {
        const code = getWilayaCode(b.wilaya);
        const color = getWilayaColor(code);
        const pending = counts?.get(b.id) || 0;
        return (
          <Tooltip key={b.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate(`/assistant-approvals?branch=${b.id}`)}
                className="relative shrink-0 w-9 h-9 focus:outline-none hover:scale-110 transition-transform"
                aria-label={t('company_manager.open_branch_approvals')}
              >
                <Shield
                  className="w-9 h-9 drop-shadow"
                  fill={color.hex}
                  color={color.hex}
                  strokeWidth={1.5}
                />
                <span className="absolute inset-0 flex items-center justify-center pt-1 text-white text-[11px] font-extrabold leading-none pointer-events-none">
                  {code ?? '?'}
                </span>
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
    </div>
  );
};

export default BranchWilayaBadges;
