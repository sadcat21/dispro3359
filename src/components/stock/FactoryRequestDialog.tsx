import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Plus, Trash2, Loader2, Factory, Phone } from 'lucide-react';
import BoxPieceInput from '@/components/ui/BoxPieceInput';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Product } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import SimpleProductPickerDialog from './SimpleProductPickerDialog';

interface RequestItem {
  product_id: string;
  product_quantity: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  products: Product[];
  onSuccess?: () => void;
}

const FactoryRequestDialog: React.FC<Props> = ({ open, onOpenChange, branchId, products, onSuccess }) => {
  const { workerId } = useAuth();
  const [items, setItems] = useState<RequestItem[]>([{ product_id: '', product_quantity: 0 }]);
  const [notes, setNotes] = useState('');
  const [salesPhone, setSalesPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open && branchId) {
      setItems([{ product_id: '', product_quantity: 0 }]);
      setNotes('');
      supabase
        .from('branches')
        .select('factory_sales_phone')
        .eq('id', branchId)
        .maybeSingle()
        .then(({ data }) => setSalesPhone((data as any)?.factory_sales_phone || ''));
    }
  }, [open, branchId]);

  const addItem = () => setItems(p => [...p, { product_id: '', product_quantity: 0 }]);
  const removeItem = (i: number) => items.length > 1 && setItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof RequestItem, value: any) =>
    setItems(p => p.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'اختر منتج';

  const handleSave = async () => {
    const validItems = items.filter(i => i.product_id && i.product_quantity > 0);
    if (validItems.length === 0) {
      toast.error('أضف منتجاً واحداً على الأقل');
      return;
    }
    if (!salesPhone.trim()) {
      toast.error('أدخل رقم هاتف مندوب المصنع');
      return;
    }

    setIsSaving(true);
    try {
      // Save phone on branch for next time
      await supabase.from('branches').update({ factory_sales_phone: salesPhone.trim() } as any).eq('id', branchId);

      // Create order: skip branch_manager stage (creator is branch manager) → goes to assistant directly
      const { data: order, error: orderError } = await supabase
        .from('factory_orders')
        .insert({
          order_type: 'factory_request',
          branch_id: branchId,
          status: 'pending_assistant_gm',
          notes: notes || null,
          created_by: workerId,
          branch_approved_by: workerId,
          branch_approved_at: new Date().toISOString(),
        } as any)
        .select()
        .single();
      if (orderError) throw orderError;

      const orderItems = validItems.map(i => ({
        factory_order_id: order!.id,
        product_id: i.product_id,
        product_quantity: i.product_quantity,
        pallet_quantity: 0,
      }));
      const { error: itemsError } = await supabase.from('factory_order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      toast.success('تم إرسال الطلب — بانتظار موافقة المساعد ثم مدير النظام');
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message || 'خطأ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-blue-600" />
            طلب من المصنع
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            اختر المنتجات والكميات المطلوبة من المصنع. سيتم تصعيد الطلب للمساعد ثم مدير النظام للموافقة.
          </p>

          <div className="border rounded-lg p-3 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1.5">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-emerald-700" />
              رقم هاتف مندوب المصنع (للواتساب)
            </Label>
            <Input
              type="tel"
              value={salesPhone}
              onChange={e => setSalesPhone(e.target.value)}
              placeholder="مثال: 213555123456"
              className="text-sm h-9 text-left"
              dir="ltr"
            />
          </div>

          <Label className="text-xs font-semibold text-muted-foreground">المنتجات المطلوبة</Label>
          {items.map((item, index) => (
            <div key={index} className="border rounded-lg p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex-1 flex items-center gap-1.5 text-sm border rounded px-2 py-1.5 hover:bg-accent transition-colors"
                  onClick={() => setPickerIndex(index)}
                >
                  <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className={item.product_id ? 'text-foreground truncate' : 'text-muted-foreground'}>
                    {item.product_id ? getProductName(item.product_id) : 'اختر منتج'}
                  </span>
                </button>
                {items.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeItem(index)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                )}
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">الكمية المطلوبة (صندوق.قطعة)</Label>
                <BoxPieceInput
                  value={item.product_quantity}
                  onChange={val => updateItem(index, 'product_quantity', val)}
                  piecesPerBox={products.find(p => p.id === item.product_id)?.pieces_per_box || 1}
                  className="text-center text-sm h-8"
                  min={0}
                />
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" className="w-full" onClick={addItem}>
            <Plus className="w-4 h-4 ml-1" />
            إضافة منتج
          </Button>

          <div>
            <Label className="text-xs">ملاحظات</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} className="text-right" />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-700">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            إرسال الطلب للموافقة
          </Button>
        </DialogFooter>
      </DialogContent>

      <SimpleProductPickerDialog
        open={pickerIndex !== null}
        onOpenChange={(o) => { if (!o) setPickerIndex(null); }}
        products={products.map(p => ({ id: p.id, name: p.name, image_url: p.image_url }))}
        selectedProductId={pickerIndex !== null ? items[pickerIndex]?.product_id || '' : ''}
        onSelect={(productId) => {
          if (pickerIndex !== null) updateItem(pickerIndex, 'product_id', productId);
        }}
      />
    </Dialog>
  );
};

export default FactoryRequestDialog;
