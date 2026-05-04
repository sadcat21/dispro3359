import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateTarget, useUpdateTarget, METRIC_LABELS, PERIOD_LABELS, type WorkerTarget, type TargetMetric, type TargetPeriod } from '@/hooks/useWorkerTargets';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: WorkerTarget | null;
}

export const TargetFormDialog: React.FC<Props> = ({ open, onOpenChange, initial }) => {
  const create = useCreateTarget();
  const update = useUpdateTarget();

  const { data: workers } = useQuery({
    queryKey: ['workers-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('workers').select('id, full_name').eq('is_active', true).order('full_name');
      if (error) throw error;
      return data as { id: string; full_name: string }[];
    },
  });

  const [form, setForm] = useState({
    name: '',
    description: '',
    metric_type: 'sales_amount' as TargetMetric,
    period_type: 'monthly' as TargetPeriod,
    target_value: 0,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    worker_id: '' as string,
    reward_amount: 0,
    penalty_amount: 0,
    min_achievement_pct: 100,
    bonus_per_extra_unit: 0,
    is_active: true,
    notes: '',
  });

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name,
        description: initial.description ?? '',
        metric_type: initial.metric_type,
        period_type: initial.period_type,
        target_value: Number(initial.target_value),
        start_date: initial.start_date,
        end_date: initial.end_date,
        worker_id: initial.worker_id ?? '',
        reward_amount: Number(initial.reward_amount),
        penalty_amount: Number(initial.penalty_amount),
        min_achievement_pct: Number(initial.min_achievement_pct),
        bonus_per_extra_unit: Number(initial.bonus_per_extra_unit),
        is_active: initial.is_active,
        notes: initial.notes ?? '',
      });
    }
  }, [initial]);

  const handleSubmit = async () => {
    const payload = {
      ...form,
      worker_id: form.worker_id || null,
      description: form.description || null,
      notes: form.notes || null,
    };
    if (initial) {
      await update.mutateAsync({ id: initial.id, ...payload });
    } else {
      await create.mutateAsync(payload as any);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{initial ? 'تعديل هدف' : 'إنشاء هدف جديد'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="md:col-span-2">
            <Label>اسم الهدف *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="مثال: مبيعات شهر يناير" />
          </div>

          <div>
            <Label>نوع المقياس *</Label>
            <Select value={form.metric_type} onValueChange={v => setForm({ ...form, metric_type: v as TargetMetric })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(METRIC_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>الفترة *</Label>
            <Select value={form.period_type} onValueChange={v => setForm({ ...form, period_type: v as TargetPeriod })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PERIOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>القيمة المستهدفة *</Label>
            <Input type="number" min={0} value={form.target_value} onChange={e => setForm({ ...form, target_value: Number(e.target.value) })} />
          </div>

          <div>
            <Label>العامل (اتركه فارغاً للجميع)</Label>
            <Select value={form.worker_id || 'all'} onValueChange={v => setForm({ ...form, worker_id: v === 'all' ? '' : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع العمال</SelectItem>
                {workers?.map(w => <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>تاريخ البداية *</Label>
            <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          </div>

          <div>
            <Label>تاريخ النهاية *</Label>
            <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          </div>

          <div className="md:col-span-2 border-t pt-3 mt-2">
            <h4 className="font-semibold mb-2 text-sm">💰 الحوافز</h4>
          </div>

          <div>
            <Label>مبلغ المكافأة (د.ج)</Label>
            <Input type="number" min={0} value={form.reward_amount} onChange={e => setForm({ ...form, reward_amount: Number(e.target.value) })} />
          </div>

          <div>
            <Label>مبلغ الخصم عند العجز (د.ج)</Label>
            <Input type="number" min={0} value={form.penalty_amount} onChange={e => setForm({ ...form, penalty_amount: Number(e.target.value) })} />
          </div>

          <div>
            <Label>الحد الأدنى لتحقيق المكافأة (%)</Label>
            <Input type="number" min={1} max={200} value={form.min_achievement_pct} onChange={e => setForm({ ...form, min_achievement_pct: Number(e.target.value) })} />
          </div>

          <div>
            <Label>مكافأة إضافية لكل وحدة فوق الهدف</Label>
            <Input type="number" min={0} value={form.bonus_per_extra_unit} onChange={e => setForm({ ...form, bonus_per_extra_unit: Number(e.target.value) })} />
          </div>

          <div className="md:col-span-2">
            <Label>ملاحظات</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>

          <div className="md:col-span-2 flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
            <Label>مفعّل</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={!form.name || form.target_value <= 0 || create.isPending || update.isPending}>
            {initial ? 'حفظ التعديلات' : 'إنشاء'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
