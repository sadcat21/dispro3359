import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { User, Users, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface WorkerOption {
  id: string;
  full_name: string;
  role: string | null;
  branch_id: string | null;
}

interface Props {
  value: string | null;          // null => "all workers"
  onChange: (workerId: string | null, workerName: string | null) => void;
  triggerLabel?: string;
  /** Optional filter: only include workers having any of these roles in worker_roles */
  rolesFilter?: string[];
  size?: 'sm' | 'default';
}

export const WorkerPickerDialog: React.FC<Props> = ({ value, onChange, triggerLabel, rolesFilter, size = 'sm' }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const { data: workers = [], isLoading } = useQuery({
    queryKey: ['worker-picker', rolesFilter?.join(',') || 'all'],
    queryFn: async (): Promise<WorkerOption[]> => {
      const { data, error } = await supabase
        .from('workers')
        .select('id, full_name, role, branch_id, is_active')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      let list = (data || []) as any[];
      if (rolesFilter && rolesFilter.length) {
        const { data: wr } = await supabase
          .from('worker_roles')
          .select('worker_id, role')
          .in('role', rolesFilter as any);
        const allowed = new Set((wr || []).map((r: any) => r.worker_id));
        list = list.filter(w => allowed.has(w.id));
      }
      return list.map(w => ({ id: w.id, full_name: w.full_name, role: w.role, branch_id: w.branch_id }));
    },
    enabled: open,
  });

  const selectedName = useMemo(() => {
    if (!value) return null;
    return workers.find(w => w.id === value)?.full_name ?? null;
  }, [value, workers]);

  const filtered = useMemo(() => {
    if (!q.trim()) return workers;
    const s = q.trim().toLowerCase();
    return workers.filter(w => w.full_name?.toLowerCase().includes(s));
  }, [q, workers]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size={size} className="text-xs gap-1.5 h-7">
          {value ? <User className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
          <span>{triggerLabel ?? (value ? `العامل: ${selectedName ?? '...'}` : 'كل العمال')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>اختيار العامل</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث بالاسم..." className="pr-8" />
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1 -mx-1 px-1">
          <button
            type="button"
            className={`w-full text-right p-2.5 rounded-md border flex items-center gap-2 transition-colors ${
              value === null ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
            }`}
            onClick={() => { onChange(null, null); setOpen(false); }}
          >
            <Users className="w-4 h-4" />
            <span className="font-medium text-sm">كل العمال</span>
            {value === null && <Badge variant="secondary" className="ml-auto text-[10px]">الحالي</Badge>}
          </button>

          {isLoading && <p className="text-xs text-muted-foreground py-4 text-center">جاري التحميل...</p>}

          {filtered.map(w => (
            <button
              key={w.id}
              type="button"
              className={`w-full text-right p-2.5 rounded-md border flex items-center gap-2 transition-colors ${
                value === w.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
              }`}
              onClick={() => { onChange(w.id, w.full_name); setOpen(false); }}
            >
              <User className="w-4 h-4" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{w.full_name}</p>
                {w.role && <p className="text-[11px] text-muted-foreground">{w.role}</p>}
              </div>
              {value === w.id && <Badge variant="secondary" className="text-[10px]">الحالي</Badge>}
            </button>
          ))}

          {!isLoading && filtered.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">لا يوجد عمال</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WorkerPickerDialog;
