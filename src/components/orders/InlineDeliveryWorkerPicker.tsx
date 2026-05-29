import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Worker } from '@/types/database';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';

interface Props {
  customerBranchId: string | null;
  customerSectorId?: string | null;
  defaultWorkerId?: string | null;
  value: string;
  onChange: (value: string) => void;
}

const InlineDeliveryWorkerPicker: React.FC<Props> = ({
  customerBranchId,
  customerSectorId,
  defaultWorkerId,
  value,
  onChange,
}) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [suggestedWorkerId, setSuggestedWorkerId] = useState<string | null>(null);

  useEffect(() => {
    void fetchWorkers();
  }, [customerBranchId]);

  useEffect(() => {
    void fetchSuggestion();
  }, [customerSectorId]);

  const fetchSuggestion = async () => {
    if (!customerSectorId) {
      setSuggestedWorkerId(null);
      return;
    }
    try {
      // Try active coverage first (substitute worker)
      const today = new Date().toISOString().slice(0, 10);
      const { data: cov } = await supabase
        .from('sector_coverage')
        .select('substitute_worker_id, start_date, end_date')
        .eq('sector_id', customerSectorId)
        .eq('is_active', true)
        .lte('start_date', today)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .limit(1)
        .maybeSingle();
      if (cov?.substitute_worker_id) {
        setSuggestedWorkerId(cov.substitute_worker_id);
        return;
      }
      // Fallback to schedule worker
      const { data: sch } = await supabase
        .from('sector_schedules')
        .select('worker_id')
        .eq('sector_id', customerSectorId)
        .limit(1)
        .maybeSingle();
      setSuggestedWorkerId(sch?.worker_id || null);
    } catch (e) {
      setSuggestedWorkerId(null);
    }
  };

  const fetchWorkers = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('worker_roles')
        .select(`worker_id, custom_roles!inner(code)`)
        .in('custom_roles.code', ['delivery_rep', 'warehouse_manager']);
      if (customerBranchId) query = query.eq('branch_id', customerBranchId);
      const { data: roles } = await query;
      const ids = (roles || []).map((r: any) => r.worker_id);
      if (ids.length === 0) {
        setWorkers([]);
        return;
      }
      const { data } = await supabase
        .from('workers')
        .select('*')
        .in('id', ids)
        .eq('is_active', true)
        .order('full_name');
      setWorkers(data || []);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-select suggested worker if nothing chosen yet
  useEffect(() => {
    if (!value && suggestedWorkerId && workers.some(w => w.id === suggestedWorkerId)) {
      onChange(suggestedWorkerId);
    } else if (!value && defaultWorkerId && workers.some(w => w.id === defaultWorkerId)) {
      onChange(defaultWorkerId);
    }
  }, [suggestedWorkerId, defaultWorkerId, workers]);

  const filtered = useMemo(
    () => workers.filter(w =>
      w.full_name.toLowerCase().includes(search.toLowerCase()) ||
      w.username.toLowerCase().includes(search.toLowerCase())
    ),
    [workers, search]
  );

  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">عامل التوصيل</Label>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : workers.length === 0 ? (
        <div className="text-center text-xs text-muted-foreground py-3 border rounded-lg">
          لا يوجد عمال توصيل متاحين
        </div>
      ) : (
        <>
          {workers.length > 6 && (
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="ps-9 h-9"
              />
            </div>
          )}
          <div className="grid grid-cols-4 gap-1.5">
            {filtered.map(w => {
              const isSelected = w.id === value;
              const isSuggested = w.id === suggestedWorkerId;
              const isDefault = w.id === defaultWorkerId;
              return (
                <button
                  type="button"
                  key={w.id}
                  onClick={() => onChange(w.id)}
                  className={`relative flex flex-col items-center justify-center rounded-md border-2 border-primary px-1.5 py-1.5 text-center transition-colors min-h-[44px] ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/10 bg-background'
                  }`}
                >
                  <div className="font-semibold text-[11px] leading-tight w-full break-words line-clamp-2">{w.full_name}</div>
                  {(isSuggested || isDefault) && (
                    <span className={`text-[9px] ${isSelected ? 'text-primary-foreground/80' : 'text-primary'}`}>
                      {isSuggested ? 'مقترح' : 'افتراضي'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default InlineDeliveryWorkerPicker;