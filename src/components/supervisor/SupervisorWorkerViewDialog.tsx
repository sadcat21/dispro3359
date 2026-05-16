import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedWorker } from '@/contexts/SelectedWorkerContext';
import { isAdminRole } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import WorkerSalesSummaryDialog from '@/components/accounting/WorkerSalesSummaryDialog';

import { BarChart3, Package, Loader2, User, Warehouse, Briefcase, Truck, TrendingUp, MapPin } from 'lucide-react';

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
  const { activeBranch, user, role, activeRole } = useAuth();
  const customCode = activeRole?.custom_role_code || null;
  const isAdmin =
    isAdminRole(role) ||
    isAdminRole(activeRole?.role) ||
    customCode === 'internal_supervisor' ||
    customCode === 'external_supervisor';
  const branchId = activeBranch?.id || user?.branch_id || null;
  const navigate = useNavigate();
  const { setSelectedWorker } = useSelectedWorker();
  const [step, setStep] = useState<'worker' | 'action'>('worker');
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const [salesOpen, setSalesOpen] = useState(false);

  const { data: workers = [], isLoading } = useQuery({
    queryKey: ['supervisor-pick-worker-roles', branchId],
    queryFn: async () => {
      if (!branchId) return [] as Array<{ id: string; full_name: string; codes: string[] }>;
      const { data: roles, error } = await supabase
        .from('custom_roles')
        .select('id, code')
        .in('code', ROLE_CODES as unknown as string[]);
      if (error) throw error;
      const roleIds = (roles || []).map((r) => r.id);
      const codeById = new Map((roles || []).map((r) => [r.id, r.code]));
      if (roleIds.length === 0) return [] as Array<{ id: string; full_name: string; codes: string[] }>;

      const { data: wr, error: wrErr } = await supabase
        .from('worker_roles')
        .select('worker_id, custom_role_id, branch_id, is_active')
        .eq('is_active', true)
        .eq('branch_id', branchId)
        .in('custom_role_id', roleIds);
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

      const { data: ws, error: wErr } = await supabase
        .from('workers_safe')
        .select('id, full_name, branch_id, is_active')
        .in('id', workerIds)
        .eq('branch_id', branchId)
        .order('full_name');
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

  const filtered = workers;

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setStep('worker');
      setPicked(null);
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
    { label: 'تتبع العامل', icon: MapPin, path: '/worker-tracking', bg: 'from-sky-500 to-sky-700' },
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
                      className="group relative flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/60 active:scale-[0.98] transition-all duration-200 min-h-[110px] overflow-hidden"
                    >
                      <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/0 via-primary/60 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/10 group-hover:from-primary/20 group-hover:to-primary/10 transition-colors">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-xs font-semibold text-slate-800 text-center line-clamp-2 leading-tight">
                        {w.full_name}
                      </span>
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        {w.codes.map((c) => {
                          const m = roleMeta[c];
                          if (!m) return null;
                          const Icon = m.icon;
                          return (
                            <span key={c} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 text-[9px] font-medium text-slate-700">
                              <Icon className={`w-2.5 h-2.5 ${m.color}`} />
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
          <div className="grid grid-cols-2 gap-2">
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
            {isAdmin && (
              <button
                onClick={() => setSalesOpen(true)}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl text-white bg-gradient-to-br from-emerald-500 to-emerald-700 hover:shadow-lg hover:scale-[1.02] transition-all min-h-[100px] col-span-2"
              >
                <TrendingUp className="w-7 h-7" />
                <span className="text-xs font-bold text-center leading-tight">تجميع المبيعات</span>
              </button>
            )}
          </div>
        )}
      </DialogContent>
      {isAdmin && picked && (
        <WorkerSalesSummaryDialog
          open={salesOpen}
          onOpenChange={setSalesOpen}
          workerId={picked.id}
          workerName={picked.name}
        />
      )}
    </Dialog>
  );
};

export default SupervisorWorkerViewDialog;
