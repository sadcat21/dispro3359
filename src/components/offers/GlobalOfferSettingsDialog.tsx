import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Settings2, Gift, Sparkles, Calendar, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STAGES = [
  { key: 'worker_loading', label: 'تحميل العامل' },
  { key: 'order_creation', label: 'إنشاء الطلب' },
  { key: 'direct_sale', label: 'البيع المباشر' },
  { key: 'warehouse_sale', label: 'بيع من المستودع' },
];

const GlobalOfferSettingsDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    is_deferred_confirmation: true,
    auto_fill_quantities: true,
    is_mandatory: false,
    showcase_enabled: true,
    scope_stages: ['worker_loading', 'order_creation', 'direct_sale', 'warehouse_sale'] as string[],
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('product_offer_settings')
        .select('*')
        .eq('id', 'global')
        .maybeSingle();
      if (!error && data) {
        setForm({
          is_deferred_confirmation: data.is_deferred_confirmation,
          auto_fill_quantities: data.auto_fill_quantities,
          is_mandatory: data.is_mandatory,
          showcase_enabled: data.showcase_enabled ?? true,
          scope_stages: data.scope_stages || [],
        });
      }
      setLoading(false);
    })();
  }, [open]);

  const toggleStage = (k: string) => {
    setForm((p) => ({
      ...p,
      scope_stages: p.scope_stages.includes(k)
        ? p.scope_stages.filter((s) => s !== k)
        : [...p.scope_stages, k],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('product_offer_settings')
        .update({
          is_deferred_confirmation: form.is_deferred_confirmation,
          auto_fill_quantities: form.auto_fill_quantities,
          is_mandatory: form.is_mandatory,
          scope_stages: form.scope_stages,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'global');
      if (error) throw error;

      // Apply to all existing offers
      const { error: e2 } = await (supabase as any)
        .from('product_offers')
        .update({
          is_deferred_confirmation: form.is_deferred_confirmation,
          auto_fill_quantities: form.auto_fill_quantities,
          is_mandatory: form.is_mandatory,
          scope_stages: form.scope_stages,
        })
        .not('id', 'is', null);
      if (e2) throw e2;

      toast.success('تم حفظ الإعدادات وتطبيقها على كل العروض');
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            إعدادات العروض العامة
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">تنطبق هذه الإعدادات على جميع العروض المتاحة.</p>

            {/* Discount system */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">نظام الخصم</Label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, is_deferred_confirmation: true }))}
                  className={cn(
                    'text-right rounded-xl border-2 p-3 transition-all',
                    form.is_deferred_confirmation
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                      : 'border-border bg-card hover:border-amber-300',
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-semibold">خصم مؤجل</span>
                    </div>
                    {form.is_deferred_confirmation && <Badge variant="secondary" className="text-[10px]">مفعّل</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">تُسجَّل الهدية بانتظار التأكيد</p>
                </button>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, is_deferred_confirmation: false }))}
                  className={cn(
                    'text-right rounded-xl border-2 p-3 transition-all',
                    !form.is_deferred_confirmation
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                      : 'border-border bg-card hover:border-emerald-300',
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-semibold">خصم تلقائي</span>
                    </div>
                    {!form.is_deferred_confirmation && <Badge variant="secondary" className="text-[10px]">مفعّل</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">تُخصم الهدية فوراً</p>
                </button>
              </div>
            </div>

            {/* Toggles */}
            <div className="rounded-xl border divide-y">
              <div className="flex items-center justify-between p-3 gap-3">
                <div>
                  <Label className="text-sm">إدخال تلقائي للكميات عند التفعيل</Label>
                  <p className="text-xs text-muted-foreground">عند الإيقاف، يقوم المستخدم بإدخال الكميات يدوياً</p>
                </div>
                <Switch checked={form.auto_fill_quantities} onCheckedChange={(c) => setForm((p) => ({ ...p, auto_fill_quantities: c }))} />
              </div>
              <div className="flex items-center justify-between p-3 gap-3">
                <div>
                  <Label className="text-sm">تفعيل العرض إجباري</Label>
                  <p className="text-xs text-muted-foreground">عند التفعيل، لا يمكن إتمام العملية دون تفعيل العرض</p>
                </div>
                <Switch checked={form.is_mandatory} onCheckedChange={(c) => setForm((p) => ({ ...p, is_mandatory: c }))} />
              </div>
            </div>

            {/* Scope stages */}
            <div className="rounded-xl border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">مرحلة النطاق — أين يظهر العرض؟</Label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {STAGES.map((s) => (
                  <label key={s.key} className="flex items-center gap-2 rounded-lg border p-2 cursor-pointer hover:bg-muted/30">
                    <Checkbox checked={form.scope_stages.includes(s.key)} onCheckedChange={() => toggleStage(s.key)} />
                    <span className="text-sm">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            حفظ وتطبيق على الكل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GlobalOfferSettingsDialog;
