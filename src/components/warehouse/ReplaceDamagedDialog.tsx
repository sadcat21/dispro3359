import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Warehouse, User, Trash2, Plus, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SimpleProductPickerDialog from '@/components/stock/SimpleProductPickerDialog';
import { parseBP, boxesToBP } from '@/utils/boxPieceInput';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

type SourceKind = 'warehouse' | 'worker';
interface Source { kind: SourceKind; id: string | null; label: string; }

interface ProductRow { id: string; name: string; image_url: string | null; pieces_per_box: number; }
interface StockRow { id: string; product_id: string; quantity: number; damaged_quantity?: number; }
interface DamageItem { product_id: string; boxes: number; pieces: number; }

// DB B.P format: decimal part = pieces. Convert via parseBP.
const dbToTotalPieces = (qty: number, ppb: number) =>
  parseBP(Number(qty || 0).toFixed(2), ppb).totalPieces;
const totalPiecesToDb = (totalPieces: number, ppb: number) => {
  const safe = Math.max(0, Math.round(totalPieces));
  const fractionalBoxes = safe / Math.max(1, ppb);
  return parseFloat(boxesToBP(fractionalBoxes, ppb)) || 0;
};

const ReplaceDamagedDialog: React.FC<Props> = ({ open, onOpenChange, onSaved }) => {
  const { activeBranch, activeRole, workerId } = useAuth();
  const branchId = activeBranch?.id || activeRole?.branch_id || null;

  const [step, setStep] = useState<'source' | 'list'>('source');
  const [source, setSource] = useState<Source | null>(null);
  const [items, setItems] = useState<DamageItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [qtyProductId, setQtyProductId] = useState<string | null>(null);
  const [qtyBoxes, setQtyBoxes] = useState('');
  const [qtyPieces, setQtyPieces] = useState('');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('source'); setSource(null); setItems([]);
      setPickerOpen(false); setQtyProductId(null); setQtyBoxes(''); setQtyPieces('');
    }
  }, [open]);

  // Load workers list for current branch
  useEffect(() => {
    if (!open || !branchId) return;
    (async () => {
      const { data: roles } = await supabase
        .from('worker_roles').select('worker_id').eq('branch_id', branchId);
      const ids = [...new Set((roles || []).map(r => r.worker_id))];
      if (!ids.length) { setWorkers([]); return; }
      const { data } = await supabase.from('workers')
        .select('id, full_name, username').in('id', ids).eq('is_active', true).order('full_name');
      setWorkers((data || []).map(w => ({ id: w.id, name: w.full_name || w.username })));
    })();
  }, [open, branchId]);

  // Load stock + products for selected source
  useEffect(() => {
    if (!source || !branchId) return;
    (async () => {
      let stockRows: StockRow[] = [];
      if (source.kind === 'warehouse') {
        const { data } = await supabase.from('warehouse_stock')
          .select('id, product_id, quantity, damaged_quantity')
          .eq('branch_id', branchId).gt('quantity', 0);
        stockRows = (data || []) as StockRow[];
      } else if (source.id) {
        const { data } = await supabase.from('worker_stock')
          .select('id, product_id, quantity')
          .eq('worker_id', source.id).gt('quantity', 0);
        stockRows = (data || []) as StockRow[];
      }
      setStocks(stockRows);
      const productIds = stockRows.map(s => s.product_id);
      if (!productIds.length) { setProducts([]); return; }
      const { data: prods } = await supabase.from('products')
        .select('id, name, image_url, pieces_per_box').in('id', productIds);
      setProducts((prods || []) as ProductRow[]);
    })();
  }, [source, branchId]);

  const productById = useMemo(() => {
    const m = new Map<string, ProductRow>();
    products.forEach(p => m.set(p.id, p));
    return m;
  }, [products]);
  const stockByProduct = useMemo(() => {
    const m = new Map<string, StockRow>();
    stocks.forEach(s => m.set(s.product_id, s));
    return m;
  }, [stocks]);

  const pickProduct = (id: string) => {
    setQtyProductId(id); setQtyBoxes(''); setQtyPieces(''); setPickerOpen(false);
  };

  const saveItemQty = () => {
    if (!qtyProductId) return;
    const b = Math.max(0, parseInt(qtyBoxes || '0', 10) || 0);
    const p = Math.max(0, parseInt(qtyPieces || '0', 10) || 0);
    if (b === 0 && p === 0) { toast.error('أدخل كمية صحيحة'); return; }
    const ppb = productById.get(qtyProductId)?.pieces_per_box || 1;
    const totalPieces = b * ppb + p;
    const stock = stockByProduct.get(qtyProductId);
    const available = stock ? dbToTotalPieces(stock.quantity, ppb) : 0;
    if (totalPieces > available) {
      toast.error(`الكمية المطلوبة تتجاوز المتاح (${boxesToBP(available / ppb, ppb)})`);
      return;
    }
    setItems(prev => {
      const filtered = prev.filter(x => x.product_id !== qtyProductId);
      return [...filtered, { product_id: qtyProductId, boxes: b, pieces: p }];
    });
    setQtyProductId(null); setQtyBoxes(''); setQtyPieces('');
    setPickerOpen(true);
  };

  const removeItem = (pid: string) => setItems(prev => prev.filter(i => i.product_id !== pid));

  const confirmAll = async () => {
    if (!branchId || !source || items.length === 0) {
      toast.error('لا توجد منتجات للاستبدال'); return;
    }
    setSaving(true);
    try {
      for (const it of items) {
        const prod = productById.get(it.product_id);
        const ppb = prod?.pieces_per_box || 1;
        const totalPieces = it.boxes * ppb + it.pieces;
        const stock = stockByProduct.get(it.product_id);
        if (!stock) continue;

        // Deduct from source
        const srcCur = dbToTotalPieces(stock.quantity, ppb);
        const newSrc = totalPiecesToDb(Math.max(0, srcCur - totalPieces), ppb);
        const srcTable = source.kind === 'warehouse' ? 'warehouse_stock' : 'worker_stock';
        await supabase.from(srcTable).update({ quantity: newSrc }).eq('id', stock.id);

        // Increase warehouse damaged_quantity (the replaced items are now damaged stock)
        const { data: wsRow } = await supabase.from('warehouse_stock')
          .select('id, damaged_quantity').eq('branch_id', branchId)
          .eq('product_id', it.product_id).maybeSingle();
        if (wsRow) {
          const curDamagedPieces = dbToTotalPieces(Number(wsRow.damaged_quantity || 0), ppb);
          const newDamaged = totalPiecesToDb(curDamagedPieces + totalPieces, ppb);
          await supabase.from('warehouse_stock').update({ damaged_quantity: newDamaged }).eq('id', wsRow.id);
        } else {
          await supabase.from('warehouse_stock').insert({
            branch_id: branchId,
            product_id: it.product_id,
            quantity: 0,
            damaged_quantity: totalPiecesToDb(totalPieces, ppb),
          });
        }

        // Movement log: damaged replacement is an exchange, not a normal return to warehouse.
        // Normal returns are added to the remaining stock summary; exchanges must not be.
        const movementQty = totalPiecesToDb(totalPieces, ppb);
        await supabase.from('stock_movements').insert({
          product_id: it.product_id,
          branch_id: branchId,
          quantity: movementQty,
          signed_quantity: -movementQty,
          movement_type: 'exchange',
          status: 'approved',
          created_by: workerId!,
          worker_id: source.kind === 'worker' ? source.id : workerId!,
          notes: `استبدال تالف من ${source.label}`,
          return_reason: 'damaged',
          from_location_type: source.kind === 'warehouse' ? 'warehouse' : 'worker',
          from_location_id: source.kind === 'worker' ? source.id : null,
          to_location_type: 'damaged',
          reason: 'damaged_replacement',
        });
      }
      toast.success('تم تسجيل التالف بنجاح');
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error('فشل الحفظ: ' + (e?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  // ---- UI ----
  return (
    <>
      <Dialog open={open && step === 'source'} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>اختر مصدر التالف</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full h-14 justify-start gap-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800"
              onClick={() => { setSource({ kind: 'warehouse', id: null, label: 'مخزن الفرع' }); setStep('list'); setPickerOpen(true); }}
            >
              <Warehouse className="w-5 h-5" /> مخزن الفرع
            </Button>
            <div className="text-xs font-semibold text-muted-foreground pt-2">الموظفون</div>
            <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
              {workers.map(w => (
                <Button key={w.id} variant="outline" className="h-12 justify-start gap-2"
                  onClick={() => { setSource({ kind: 'worker', id: w.id, label: w.name }); setStep('list'); setPickerOpen(true); }}>
                  <User className="w-4 h-4" /> <span className="truncate text-xs">{w.name}</span>
                </Button>
              ))}
              {workers.length === 0 && (
                <div className="col-span-2 text-center text-sm text-muted-foreground py-3">لا يوجد موظفون</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open && step === 'list'} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>استبدال تالف — {source?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">المنتجات التالفة ({items.length})</span>
              <Button size="sm" variant="secondary" onClick={() => setPickerOpen(true)}>
                <Plus className="w-4 h-4 me-1" /> إضافة منتج
              </Button>
            </div>
            <div className="space-y-1.5 max-h-[45vh] overflow-y-auto">
              {items.map(it => {
                const p = productById.get(it.product_id);
                return (
                  <div key={it.product_id} className="flex items-center gap-2 p-2 rounded border bg-card">
                    {p?.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-9 h-9 rounded object-cover" />
                    ) : <div className="w-9 h-9 rounded bg-muted" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{p?.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {it.boxes} صندوق + {it.pieces} قطعة
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeItem(it.product_id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
              {items.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-6">لم تتم إضافة منتجات بعد</div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setStep('source'); setItems([]); }}>رجوع</Button>
              <Button className="flex-1" disabled={saving || items.length === 0} onClick={confirmAll}>
                <Check className="w-4 h-4 me-1" /> تأكيد
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product picker reused */}
      <SimpleProductPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        products={products.map(p => ({ id: p.id, name: p.name, image_url: p.image_url }))}
        selectedProductId=""
        selectedProductIds={items.map(i => i.product_id)}
        onSelect={pickProduct}
      />

      {/* Quantity dialog */}
      <Dialog open={!!qtyProductId} onOpenChange={(v) => { if (!v) { setQtyProductId(null); setPickerOpen(true); } }}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {productById.get(qtyProductId || '')?.name}
            </DialogTitle>
          </DialogHeader>
          {qtyProductId && (() => {
            const ppb = productById.get(qtyProductId)?.pieces_per_box || 1;
            const stock = stockByProduct.get(qtyProductId);
            const availPieces = stock ? dbToTotalPieces(stock.quantity, ppb) : 0;
            return (
              <div className="space-y-3">
                <div className="text-[11px] text-muted-foreground text-center">
                  المتاح: {boxesToBP(availPieces / ppb, ppb)} (صندوق.قطعة) — قطع/صندوق: {ppb}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">صناديق</Label>
                    <Input type="number" inputMode="numeric" min={0} value={qtyBoxes}
                      onChange={(e) => setQtyBoxes(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label className="text-xs">قطع</Label>
                    <Input type="number" inputMode="numeric" min={0} max={ppb - 1} value={qtyPieces}
                      onChange={(e) => setQtyPieces(e.target.value)} placeholder="0" />
                  </div>
                </div>
                <Button className="w-full" onClick={saveItemQty}>
                  <Check className="w-4 h-4 me-1" /> حفظ والعودة لاختيار منتج آخر
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReplaceDamagedDialog;