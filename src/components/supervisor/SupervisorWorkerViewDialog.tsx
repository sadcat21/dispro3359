import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedWorker } from '@/contexts/SelectedWorkerContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BarChart3, Package, Truck, Loader2, Search, ArrowRight } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SupervisorWorkerViewDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { activeBranch } = useAuth();
  const navigate = useNavigate();
  const { setSelectedWorker } = useSelectedWorker();
  const [step, setStep] = useState<'worker' | 'action'>('worker');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);

  const { data: workers = [], isLoading } = useQuery({
    queryKey: ['supervisor-pick-worker', activeBranch?.id],
    queryFn: async () => {
      let q = supabase.from('workers_safe').select('id, full_name, branch_id');
      if (activeBranch?.id) q = q.eq('branch_id', activeBranch.id);
      const { data, error } = await q.order('full_name');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return workers;
    return workers.filter((w: any) => (w.full_name || '').toLowerCase().includes(term));
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
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
            <div className="max-h-[50vh] overflow-y-auto space-y-1">
              {isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-4">لا يوجد عمال</p>
              ) : (
                filtered.map((w: any) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setPicked({ id: w.id, name: w.full_name });
                      setStep('action');
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-right"
                  >
                    <span className="text-sm font-medium text-slate-800">{w.full_name}</span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              onClick={() => go('/my-achievements')}
              className="w-full justify-start gap-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800"
            >
              <BarChart3 className="w-5 h-5" />
              <span>الإنجازات اليومية</span>
            </Button>
            <Button
              onClick={() => go('/my-stock')}
              className="w-full justify-start gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800"
            >
              <Package className="w-5 h-5" />
              <span>رصيد الشحنة</span>
            </Button>
            <Button
              onClick={() => go('/my-deliveries')}
              className="w-full justify-start gap-2 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800"
            >
              <Truck className="w-5 h-5" />
              <span>ملخص التوصيل</span>
            </Button>
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
