import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Settings2, Gift, Sparkles, Calendar, Layers, Truck, ClipboardList, Banknote, Warehouse } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type StageKey = 'worker_loading' | 'order_creation' | 'direct_sale' | 'warehouse_sale';

const STAGES: { key: StageKey; label: string; icon: React.ElementType }[] = [
  { key: 'worker_loading', label: 'تحميل العامل', icon: Truck },
  { key: 'order_creation', label: 'إنشاء الطلب', icon: ClipboardList },
  { key: 'direct_sale', label: 'البيع المباشر', icon: Banknote },
  { key: 'warehouse_sale', label: 'بيع من المستودع', icon: Warehouse },
];

type StageConfig = {
  enabled: boolean;
  auto_fill_quantities: boolean;
  is_mandatory: boolean;
  showcase_enabled: boolean;
};

const defaultStageConfig: StageConfig = {
  enabled: true,
  auto_fill_quantities: true,
  is_mandatory: true,
  showcase_enabled: true,
};

const GlobalOfferSettingsDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDeferred, setIsDeferred] = useState(true);
  const [stageSettings, setStageSettings] = useState<Record<StageKey, StageConfig>>({
    worker_loading: { ...defaultStageConfig },
    order_creation: { ...defaultStageConfig },
    direct_sale: { ...defaultStageConfig },
    warehouse_sale: { ...defaultStageConfig },
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
        setIsDeferred(data.is_deferred_confirmation);
        const stored = (data.stage_settings || {}) as Partial<Record<StageKey, Partial<StageConfig>>>;
        const scopeStages: string[] = data.scope_stages || [];
        const next: Record<StageKey, StageConfig> = {
          worker_loading: { ...defaultStageConfig },
          order_creation: { ...defaultStageConfig },
          direct_sale: { ...defaultStageConfig },
          warehouse_sale: { ...defaultStageConfig },
        };
        (Object.keys(next) as StageKey[]).forEach((k) => {
          const fromStored = stored[k];
          if (fromStored) {
            next[k] = { ...defaultStageConfig, ...fromStored } as StageConfig;
          } else {
            // fallback to legacy global flags
            next[k] = {
              enabled: scopeStages.length === 0 ? true : scopeStages.includes(k),
              auto_fill_quantities: !!data.auto_fill_quantities,
              is_mandatory: !!data.is_mandatory,
              showcase_enabled: data.showcase_enabled ?? true,
            };
          }
        });
        setStageSettings(next);
      }
      setLoading(false);
    })();
  }, [open]);

  const updateStage = (k: StageKey, patch: Partial<StageConfig>) => {
    setStageSettings((p) => ({ ...p, [k]: { ...p[k], ...patch } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const scope_stages = (Object.keys(stageSettings) as StageKey[]).filter((k) => stageSettings[k].enabled);
      // Aggregate fallbacks: true if ANY active stage has it on
      const anyActive = scope_stages.length > 0;
      const agg = {
        auto_fill_quantities: anyActive
          ? scope_stages.some((k) => stageSettings[k].auto_fill_quantities)
          : false,
        is_mandatory: anyActive
          ? scope_stages.some((k) => stageSettings[k].is_mandatory)
          : false,
        showcase_enabled: anyActive
          ? scope_stages.some((k) => stageSettings[k].showcase_enabled)
          : false,
      };

      const { error } = await (supabase as any)
        .from('product_offer_settings')
        .update({
          is_deferred_confirmation: isDeferred,
          ...agg,
          scope_stages,
          stage_settings: stageSettings,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'global');
      if (error) throw error;

      // Propagate aggregate flags + scope to existing offers
      // Note: showcase_enabled lives only on product_offer_settings, not product_offers
      const { showcase_enabled: _ignored, ...offerAgg } = agg;
      const { error: e2 } = await (supabase as any)
        .from('product_offers')
        .update({
          is_deferred_confirmation: isDeferred,
          ...offerAgg,
          scope_stages,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <p className="text-xs text-muted-foreground">لكل مرحلة إعدادات تفعيل خاصة بها.</p>

            {/* Discount system (global) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">نظام الخصم</Label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setIsDeferred(true)}
                  className={cn(
                    'text-right rounded-xl border-2 p-3 transition-all',
                    isDeferred ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-border bg-card hover:border-amber-300',
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-semibold">خصم مؤجل</span>
                    </div>
                    {isDeferred && <Badge variant="secondary" className="text-[10px]">مفعّل</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">تُسجَّل الهدية بانتظار التأكيد</p>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeferred(false)}
                  className={cn(
                    'text-right rounded-xl border-2 p-3 transition-all',
                    !isDeferred ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-border bg-card hover:border-emerald-300',
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-semibold">خصم تلقائي</span>
                    </div>
                    {!isDeferred && <Badge variant="secondary" className="text-[10px]">مفعّل</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">تُخصم الهدية فوراً</p>
                </button>
              </div>
            </div>

            {/* Per-stage settings */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">إعدادات كل مرحلة</Label>
              </div>
              <div className="space-y-3">
                {STAGES.map((s) => {
                  const cfg = stageSettings[s.key];
                  const Icon = s.icon;
                  return (
                    <div key={s.key} className={cn('rounded-xl border-2 p-3 transition-all', cfg.enabled ? 'border-primary/40 bg-primary/5' : 'border-border bg-card opacity-70')}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold">{s.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">{cfg.enabled ? 'مفعّلة' : 'موقفة'}</span>
                          <Switch checked={cfg.enabled} onCheckedChange={(c) => updateStage(s.key, { enabled: c })} />
                        </div>
                      </div>
                      <div className={cn('rounded-lg border divide-y', !cfg.enabled && 'pointer-events-none opacity-50')}>
                        <div className="flex items-center justify-between p-2.5 gap-3">
                          <div>
                            <Label className="text-xs">إدخال تلقائي للكميات</Label>
                            <p className="text-[10px] text-muted-foreground">عند الإيقاف، يُدخل المستخدم الكميات يدوياً</p>
                          </div>
                          <Switch checked={cfg.auto_fill_quantities} onCheckedChange={(c) => updateStage(s.key, { auto_fill_quantities: c })} />
                        </div>
                        <div className="flex items-center justify-between p-2.5 gap-3">
                          <div>
                            <Label className="text-xs">تفعيل العرض إجباري</Label>
                            <p className="text-[10px] text-muted-foreground">لا يمكن إتمام العملية دون تفعيل العرض</p>
                          </div>
                          <Switch checked={cfg.is_mandatory} onCheckedChange={(c) => updateStage(s.key, { is_mandatory: c })} />
                        </div>
                        <div className="flex items-center justify-between p-2.5 gap-3">
                          <div>
                            <Label className="text-xs">عرض معرض العروض</Label>
                            <p className="text-[10px] text-muted-foreground">إظهار شريط العروض المتحرك في هذه المرحلة</p>
                          </div>
                          <Switch checked={cfg.showcase_enabled} onCheckedChange={(c) => updateStage(s.key, { showcase_enabled: c })} />
                        </div>
                      </div>
                    </div>
                  );
                })}
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
