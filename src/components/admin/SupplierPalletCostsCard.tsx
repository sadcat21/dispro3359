import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Truck, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import palletSettingsImage from '@/assets/pallet-settings.png';
import { useI18n } from '@/i18n/i18n';

interface Supplier {
  id: string;
  name: string;
  is_active: boolean;
}

interface Row {
  supplier_id: string;
  pallet_cost: number;
  notes: string;
}

export function SupplierPalletCostsCard() {
  const { t } = useI18n();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: sups }, { data: costs }] = await Promise.all([
        supabase.from('suppliers').select('id,name,is_active').eq('is_active', true).order('name'),
        supabase.from('supplier_pallet_costs').select('supplier_id,pallet_cost,notes'),
      ]);
      setSuppliers((sups as Supplier[]) || []);
      const map: Record<string, Row> = {};
      (sups || []).forEach((s: any) => {
        const c = (costs || []).find((x: any) => x.supplier_id === s.id);
        map[s.id] = {
          supplier_id: s.id,
          pallet_cost: c?.pallet_cost ?? 0,
          notes: c?.notes ?? '',
        };
      });
      setRows(map);
      setLoading(false);
    };
    load();
  }, []);

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const saveRow = async (supplierId: string) => {
    setSavingId(supplierId);
    const row = rows[supplierId];
    const { error } = await supabase
      .from('supplier_pallet_costs')
      .upsert(
        { supplier_id: supplierId, pallet_cost: row.pallet_cost, notes: row.notes || null },
        { onConflict: 'supplier_id' }
      );
    setSavingId(null);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('common.saved') || 'تم الحفظ');
    }
  };

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-muted/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-base">
          <img
            src={palletSettingsImage}
            alt="Pallet"
            loading="lazy"
            width={512}
            height={512}
            className="w-10 h-10 object-contain"
          />
          <span className="text-primary font-bold">
            {t('products.pallet_costs_by_supplier') || 'تكلفة الباليت حسب المورّد'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : suppliers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('products.no_suppliers') || 'لا يوجد موردون'}
          </p>
        ) : (
          <div className="space-y-2">
            {suppliers.map((s) => {
              const r = rows[s.id];
              if (!r) return null;
              return (
                <div
                  key={s.id}
                  className="grid grid-cols-1 md:grid-cols-[1fr_140px_1fr_auto] gap-2 items-end border rounded-lg p-3 bg-background/50"
                >
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      {t('products.supplier') || 'المورّد'}
                    </Label>
                    <div className="h-9 px-3 flex items-center text-sm font-medium rounded-md border bg-muted/30">
                      {s.name}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      {t('products.pallet_cost') || 'تكلفة الباليت'}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={r.pallet_cost}
                      onChange={(e) =>
                        updateRow(s.id, { pallet_cost: parseFloat(e.target.value) || 0 })
                      }
                      onFocus={(e) => e.target.select()}
                      className="text-right h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      {t('products.notes') || 'ملاحظات'}
                    </Label>
                    <Input
                      value={r.notes}
                      onChange={(e) => updateRow(s.id, { notes: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => saveRow(s.id)}
                    disabled={savingId === s.id}
                    className="h-9 gap-1"
                  >
                    {savingId === s.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {t('common.save') || 'حفظ'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
