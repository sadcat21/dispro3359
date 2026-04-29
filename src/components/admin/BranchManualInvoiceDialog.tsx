import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Plus, Minus, Trash2, FileText, Lock, Globe2, Send, User, Package } from 'lucide-react';
import { toast } from 'sonner';
import InvoicePaymentMethodSelect from '@/components/orders/InvoicePaymentMethodSelect';
import { InvoicePaymentMethod, INVOICE_PAYMENT_METHODS } from '@/types/stamp';
import CustomerPickerDialog from '@/components/orders/CustomerPickerDialog';
import SimpleProductPickerDialog from '@/components/stock/SimpleProductPickerDialog';
import type { Customer } from '@/types/database';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CartItem {
  productId: string;
  productName: string;
  image_url?: string | null;
  quantity: number;
  unitPrice: number;
}

const BranchManualInvoiceDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { t, language } = useLanguage();
  const { activeBranch, workerId } = useAuth();
  const qc = useQueryClient();

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<InvoicePaymentMethod | null>(null);
  const [invoiceScope, setInvoiceScope] = useState<'public' | 'private'>('private');

  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  // العملاء — نفس الاستعلام المستخدم في النظام
  const customersQ = useQuery({
    queryKey: ['branch-mi-customers', activeBranch?.id],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from('customers')
        .select('*')
        .eq('is_registered', true)
        .eq('status', 'active')
        .order('name');
      if (activeBranch?.id) q = q.eq('branch_id', activeBranch.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Customer[];
    },
  });

  const sectorsQ = useQuery({
    queryKey: ['branch-mi-sectors', activeBranch?.id],
    enabled: open,
    queryFn: async () => {
      let q = supabase.from('sectors').select('*').order('name');
      if (activeBranch?.id) q = q.eq('branch_id', activeBranch.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // المنتجات
  const productsQ = useQuery({
    queryKey: ['branch-mi-products'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, image_url, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const totalAmount = useMemo(
    () => cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
    [cart]
  );

  const updateQty = (productId: string, qty: number) => {
    setCart(prev => {
      if (qty <= 0) return prev.filter(i => i.productId !== productId);
      return prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i);
    });
  };

  const addProduct = (productId: string) => {
    const product = (productsQ.data || []).find((p: any) => p.id === productId);
    if (!product) return;
    setCart(prev => {
      if (prev.some(i => i.productId === productId)) return prev;
      return [...prev, {
        productId: product.id,
        productName: product.name,
        image_url: product.image_url,
        quantity: 1,
        unitPrice: 0,
      }];
    });
  };

  const removeProduct = (productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  const reset = () => {
    setSelectedCustomer(null);
    setCart([]);
    setPaymentMethod(null);
    setInvoiceScope('private');
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!workerId) throw new Error('Worker session missing');
      if (!selectedCustomer) throw new Error('No customer');
      if (cart.length === 0) throw new Error('Empty cart');
      if (!paymentMethod) throw new Error('No payment method');

      const { error } = await supabase.from('manual_invoice_requests').insert({
        customer_id: selectedCustomer.id,
        worker_id: workerId,
        branch_id: activeBranch?.id || null,
        products: cart.map(i => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        payment_method: INVOICE_PAYMENT_METHODS[paymentMethod].label,
        whatsapp_contact: '',
        status: 'pending_assistant',
        invoice_scope: invoiceScope,
        created_by_role: 'branch_admin',
        total_amount: totalAmount,
        branch_approved_by: workerId,
        branch_approved_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('branch_manual_invoice.created_success'));
      qc.invalidateQueries({ queryKey: ['branch-invoice-approvals'] });
      qc.invalidateQueries({ queryKey: ['assistant-invoice-requests'] });
      handleClose(false);
    },
    onError: (e: any) => toast.error(e?.message || 'Error'),
  });

  const canSubmit = !!selectedCustomer && cart.length > 0 && !!paymentMethod;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {t('branch_manual_invoice.title')}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* العميل */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t('branch_manual_invoice.step_customer')}</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => setCustomerPickerOpen(true)}
              >
                <User className="w-4 h-4 me-2 text-primary" />
                {selectedCustomer ? (
                  <div className="text-start flex-1">
                    <div className="font-medium">
                      {language === 'fr' && (selectedCustomer as any).name_fr ? (selectedCustomer as any).name_fr : selectedCustomer.name}
                    </div>
                    {selectedCustomer.store_name && (
                      <div className="text-xs text-muted-foreground">{selectedCustomer.store_name}</div>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">{t('branch_manual_invoice.search_customer')}</span>
                )}
              </Button>
            </div>

            {/* المنتجات */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">{t('branch_manual_invoice.step_products')}</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setProductPickerOpen(true)}>
                  <Plus className="w-4 h-4 me-1" />
                  {t('branch_manual_invoice.search_product')}
                </Button>
              </div>

              {cart.length === 0 ? (
                <div className="border border-dashed rounded-lg py-8 text-center text-sm text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  {t('branch_manual_invoice.no_products') || 'لا توجد منتجات بعد'}
                </div>
              ) : (
                <div className="border rounded-lg divide-y">
                  {cart.map(item => (
                    <div key={item.productId} className="flex items-center gap-2 p-2">
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.productName} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-6 h-6 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="flex-1 text-sm font-medium truncate">{item.productName}</div>
                      <div className="flex items-center gap-1">
                        <Button type="button" size="icon" variant="outline" className="h-7 w-7"
                          onClick={() => updateQty(item.productId, item.quantity - 1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateQty(item.productId, Math.max(1, Number(e.target.value) || 1))}
                          className="h-7 w-14 text-center text-xs"
                        />
                        <Button type="button" size="icon" variant="outline" className="h-7 w-7"
                          onClick={() => updateQty(item.productId, item.quantity + 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        onClick={() => removeProduct(item.productId)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* الدفع */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t('branch_manual_invoice.choose_payment')}</Label>
              <InvoicePaymentMethodSelect value={paymentMethod} onChange={setPaymentMethod} />
            </div>

            {/* النطاق */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t('branch_manual_invoice.choose_scope')}</Label>
              <RadioGroup value={invoiceScope} onValueChange={(v) => setInvoiceScope(v as any)}>
                <div className="flex items-start gap-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/30 transition" onClick={() => setInvoiceScope('private')}>
                  <RadioGroupItem value="private" id="scope-private" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="scope-private" className="flex items-center gap-2 font-semibold cursor-pointer">
                      <Lock className="w-4 h-4 text-amber-600" />
                      {t('branch_manual_invoice.scope_private')}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('branch_manual_invoice.scope_private_desc')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/30 transition" onClick={() => setInvoiceScope('public')}>
                  <RadioGroupItem value="public" id="scope-public" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="scope-public" className="flex items-center gap-2 font-semibold cursor-pointer">
                      <Globe2 className="w-4 h-4 text-blue-600" />
                      {t('branch_manual_invoice.scope_public')}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('branch_manual_invoice.scope_public_desc')}
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter className="flex-row justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="ghost" onClick={() => handleClose(false)} disabled={submit.isPending}>
              {t('branch_manual_invoice.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => submit.mutate()}
              disabled={!canSubmit || submit.isPending}
              className="gap-2"
            >
              {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {t('branch_manual_invoice.send_to_assistant')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة اختيار العميل — نفس الموحّدة في النظام */}
      <CustomerPickerDialog
        open={customerPickerOpen}
        onOpenChange={setCustomerPickerOpen}
        customers={customersQ.data || []}
        sectors={sectorsQ.data || []}
        isLoading={customersQ.isLoading}
        selectedCustomerId={selectedCustomer?.id}
        onSelect={(c) => setSelectedCustomer(c)}
      />

      {/* نافذة اختيار المنتجات — نفس نافذة شحن المخزن */}
      <SimpleProductPickerDialog
        open={productPickerOpen}
        onOpenChange={setProductPickerOpen}
        products={(productsQ.data || []) as any}
        selectedProductId=""
        selectedProductIds={cart.map(i => i.productId)}
        onSelect={addProduct}
        onRemoveProduct={removeProduct}
        closeOnSelect={false}
        showCloseButton
      />
    </>
  );
};

export default BranchManualInvoiceDialog;
