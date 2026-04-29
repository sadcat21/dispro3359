import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ShieldCheck } from 'lucide-react';
import { getWilayaCode, getWilayaColor } from '@/lib/algeriaWilayas';
import { useLanguage } from '@/contexts/LanguageContext';

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

  // عدد الموافقات النهائية المعلقة لكل فرع
  const { data: counts } = useQuery({
    queryKey: ['cm-branch-pending-counts'],
    queryFn: async () => {
      const [receipts, invoices] = await Promise.all([
        supabase
          .from('stock_receipts')
          .select('branch_id')
          .eq('status', 'pending_assistant'),
        supabase
          .from('manual_invoice_requests')
          .select('branch_id')
          .eq('status', 'pending_assistant'),
      ]);
      const map = new Map<string, number>();
      const add = (rows: any[] | null) => {
        (rows || []).forEach((r) => {
          if (!r.branch_id) return;
          map.set(r.branch_id, (map.get(r.branch_id) || 0) + 1);
        });
      };
      add(receipts.data);
      add(invoices.data);
      return map;
    },
    refetchInterval: 30_000,
  });

  if (!branches || branches.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {branches.map((b) => {
        const code = getWilayaCode(b.wilaya);
        const color = getWilayaColor(code);
        const pending = counts?.get(b.id) || 0;
        return (
          <button
            key={b.id}
            onClick={() => navigate(`/assistant-approvals?branch=${b.id}`)}
            title={`${b.name}${b.wilaya ? ' — ' + b.wilaya : ''}`}
            className="relative group focus:outline-none"
            aria-label={t('company_manager.open_branch_approvals')}
          >
            <div
              className={`relative w-14 h-16 ${color.bg} ${color.text} flex flex-col items-center justify-center shadow-md ring-2 ${color.ring} ring-offset-1 transition-transform group-hover:scale-105`}
              style={{
                clipPath: 'polygon(50% 0%, 100% 20%, 100% 70%, 50% 100%, 0% 70%, 0% 20%)',
              }}
            >
              <ShieldCheck className="w-4 h-4 opacity-80 -mb-1" />
              <span className="text-lg font-extrabold leading-none">{code ?? '?'}</span>
            </div>
            {pending > 0 && (
              <span className="absolute -top-1 -end-1 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center shadow ring-2 ring-white">
                {pending > 99 ? '99+' : pending}
              </span>
            )}
            <span className="block mt-1 text-[10px] text-slate-700 text-center truncate max-w-[64px]">
              {b.name}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default BranchWilayaBadges;
