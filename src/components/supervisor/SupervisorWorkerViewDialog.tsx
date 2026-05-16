import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedWorker } from '@/contexts/SelectedWorkerContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BarChart3, Package, Truck, Loader2, User, Warehouse, Briefcase } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLE_CODES = ['delivery_rep', 'sales_rep', 'warehouse_manager'] as const;

const roleMeta: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  delivery_rep: { label: 'توصيل', icon: Truck, color: 'text-sky-600' },
  sales_rep: { label: 'مبيعات', icon: Briefcase, color: 'text-emerald-600' },
  warehouse_manager: { label: 'مخزن', icon: Warehouse, color: 'text-amber-600' },
};

const SupervisorWorkerViewDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { activeBranch } = useAuth();
  const navigate = useNavigate();
  const { setSelectedWorker } = useSelectedWorker();
  const [step, setStep] = useState<'worker' | 'action'>('worker');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);

  const { data: workers = [], isLoading } = useQuery({
    queryKey: ['supervisor-pick-worker-roles', activeBranch?.id],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from('custom_roles')
        .select('id, code')
        .in('code', ROLE_CODES as unknown as string[]);
      if (error) throw error;
      const roleIds = (roles || []).map((r) => r.id);
      const codeById = new Map((roles || []).map((r) => [r.id, r.code]));
      if (roleIds.length === 0) return [] as Array<{ id: string; full_name: string; codes: string[] }>;

      let wrQuery = supabase
        .from('worker_roles')
        .select('worker_id, custom_role_id, branch_id, is_active')
        .eq('is_active', true)
        .in('custom_role_id', roleIds);
      if (activeBranch?.id) wrQuery = wrQuery.or(`branch_id.eq.${activeBranch.id},branch_id.is.null`);
      const { data: wr, error: wrErr } = await wrQuery;
      if (wrErr) throw wrErr;

      const byWorker = new Map<string, Set<string>>();
      (wr || []).forEach((row: any) => {
        const code = codeById.get(row.custom_role_id);
        if (!code) return;
        if (!byWorker.has(row.worker_id)) byWorker.set(row.worker_id, new Set());
        byWorker.get(row.worker_id)!.add(code);
      });
      const workerIds = Array.from(byWorker.keys());
      if (workerIds.length === 0) return [];

      let wQuery = supabase
        .from('workers_safe')
        .select('id, full_name, branch_id, is_active')
        .in('id', workerIds);
      if (activeBranch?.id) wQuery = wQuery.eq('branch_id', activeBranch.id);
      const { data: ws, error: wErr } = await wQuery.order('full_name');
      if (wErr) throw wErr;

      return (ws || [])
        .filter((w: any) => w.is_active !== false && w.full_name)
        .map((w: any) => ({
          id: w.id as string,
          full_name: w.full_name as string,
          codes: Array.from(byWorker.get(w.id) || []),
        }));
    },
    enabled: open,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return workers;
    return workers.filter((w) => w.full_name.toLowerCase().includes(term));
  }, [workers, search]);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setStep('worker');
      setPicked(null);
      setSearch('');
    }
    onOpenChange(v);
  };

  const go = (path: string) => {
    if (!picked) return;
    setSelectedWorker(picked.id, picked.name);
    handleOpenChange(false);
    if (path === '/my-achievements') {
      navigate(`/my-achievements?worker=${picked.id}&name=${encodeURIComponent(picked.name)}`);
    } else {
      navigate(path);
    }
  };

  const actions = [
    { label: 'الإنجازات اليومية', icon: BarChart3, path: '/my-achievements', bg: 'from-rose-500 to-rose-700' },
    { label: 'رصيد الشحنة', icon: Package, path: '/my-stock', bg: 'from-amber-500 to-amber-700' },
    { label: 'ملخص التوصيل', icon: Truck, path: '/my-deliveries', bg: 'from-sky-500 to-sky-700' },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {step === 'worker' ? 'اختر العامل' : `الإجراء للعامل: ${picked?.name || ''}`}
          </DialogTitle>
        </DialogHeader>

        {step === 'worker' ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن عامل..."
                className="pr-9"
              />
            </div>
            <div className="max-h-[55vh] overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-6">لا يوجد عمال</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {filtered.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => {
                        setPicked({ id: w.id, name: w.full_name });
                        setStep('action');
                      }}
                      className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-slate-200 bg-white hover:border-primary hover:shadow-md transition-all min-h-[90px]"
                    >
                      <User className="w-6 h-6 text-slate-500" />
                      <span className="text-xs font-semibold text-slate-800 text-center line-clamp-2 leading-tight">
                        {w.full_name}
                      </span>
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        {w.codes.map((c) => {
                          const m = roleMeta[c];
                          if (!m) return null;
                          const Icon = m.icon;
                          return (
                            <span key={c} className="inline-flex items-center gap-0.5 text-[9px] text-slate-600">
                              <Icon className={`w-3 h-3 ${m.color}`} />
                              {m.label}
                            </span>
                          );
                        })}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {actions.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.path}
                    onClick={() => go(a.path)}
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl text-white bg-gradient-to-br ${a.bg} hover:shadow-lg hover:scale-[1.02] transition-all min-h-[100px]`}
                  >
                    <Icon className="w-7 h-7" />
                    <span className="text-xs font-bold text-center leading-tight">{a.label}</span>
                  </button>
                );
              })}
            </div>
            <Button
              variant="outline"
              onClick={() => { setPicked(null); setStep('worker'); }}
              className="w-full"
            >
              رجوع لاختيار عامل آخر
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SupervisorWorkerViewDialog;
