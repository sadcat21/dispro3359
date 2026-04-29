import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Search, Plus, Minus, Trash2, FileText, Lock, Globe2, Send } from 'lucide-react';
import { toast } from 'sonner';
import InvoicePaymentMethodSelect from '@/components/orders/InvoicePaymentMethodSelect';
import { InvoicePaymentMethod, INVOICE_PAYMENT_METHODS } from '@/types/stamp';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

type Step = 'customer' | 'products' | 'payment' | 'scope';

const BranchManualInvoiceDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { t, language } = useLanguage();
  const { activeBranch, workerId } = useAuth();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>('customer');
  const [search, setSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<InvoicePaymentMethod | null>(null);
  const [invoiceScope, setInvoiceScope] = useState<'public' | 'private'>('public');

  // العملاء
  const customersQ = useQuery({
    queryKey: ['branch-mi-customers', activeBranch?.id],
    enabled: open && step === 'customer',
    queryFn: async () => {
      let q = supabase
        .from('customers')
        .select('id, name, name_fr, store_name')
        .eq('is_registered', true)
        .eq('status', 'active')
        .order('name');
      if (activeBranch?.id) q = q.eq('branch_id', activeBranch.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // المنتجات
  const productsQ = useQuery({
    queryKey: ['branch-mi-products'],
    enabled: open && step === 'products',
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

  const filteredCustomers = useMemo(() => {
    const list = customersQ.data || [];
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter((c: any) =>
      c.name?.toLowerCase().includes(s) ||
      c.name_fr?.toLowerCase().includes(s) ||
      c.store_name?.toLowerCase().includes(s)
    );
  }, [customersQ.data, search]);

  const filteredProducts = useMemo(() => {
    const list = productsQ.data || [];
    if (!productSearch.trim()) return list;
    const s = productSearch.toLowerCase();
    return list.filter((p: any) => p.name?.toLowerCase().includes(s));
  }, [productsQ.data, productSearch]);

  const getCartQty = (id: string) => cart.find(i => i.productId === id)?.quantity || 0;

  const updateCart = (product: any, qty: number) => {
    setCart(prev => {
      if (qty <= 0) return prev.filter(i => i.productId !== product.id);
      const existing = prev.find(i => i.productId === product.id);
      if (existing) return prev.map(i => i.productId === product.id ? { ...i, quantity: qty } : i);
      return [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitPrice: 0,
      }];
    });
  };

  const totalAmount = useMemo(
    () => cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
    [cart]
  );

  const reset = () => {
    setStep('customer');
    setSearch('');
    setProductSearch('');
    setSelectedCustomer(null);
    setCart([]);
    setPaymentMethod(null);
    setInvoiceScope('public');
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

  const canGoNext = () => {
    if (step === 'customer') return !!selectedCustomer;
    if (step === 'products') return cart.length > 0;
    if (step === 'payment') return !!paymentMethod;
    return true;
  };

  const goNext = () => {
    if (step === 'customer') setStep('products');
    else if (step === 'products') setStep('payment');
    else if (step === 'payment') setStep('scope');
  };

  const goBack = () => {
    if (step === 'products') setStep('customer');
    else if (step === 'payment') setStep('products');
    else if (step === 'scope') setStep('payment');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {t('branch_manual_invoice.title')}
          </DialogTitle>
          {/* Stepper */}
          <div className="flex items-center gap-2 pt-2 text-xs">
            {(['customer', 'products', 'payment', 'scope'] as Step[]).map((s, idx) => (
              <React.Fragment key={s}>
                <Badge variant={step === s ? 'default' : 'outline'} className="capitalize">
                  {idx + 1}. {t(`branch_manual_invoice.step_${s}`)}
                </Badge>
                {idx < 3 && <span className="text-muted-foreground">›</span>}
              </React.Fragment>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* STEP 1: العميل */}
          {step === 'customer' && (
            <div className="space-y-3 h-full flex flex-col">
              <div className="relative">
                <Search className="absolute top-2.5 start-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('branch_manual_invoice.search_customer')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="ps-9"
                />
              </div>
              <ScrollArea className="flex-1 border rounded-lg">
                {customersQ.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {t('branch_manual_invoice.no_customers')}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredCustomers.map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCustomer(c)}
                        className={`w-full text-start p-3 hover:bg-muted transition ${selectedCustomer?.id === c.id ? 'bg-primary/10' : ''}`}
                      >
                        <div className="font-medium text-sm">
                          {language === 'fr' && c.name_fr ? c.name_fr : c.name}
                        </div>
                        {c.store_name && (
                          <div className="text-xs text-muted-foreground">{c.store_name}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {/* STEP 2: المنتجات */}
          {step === 'products' && (
            <div className="space-y-3 h-full flex flex-col">
              <div className="relative">
                <Search className="absolute top-2.5 start-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('branch_manual_invoice.search_product')}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="ps-9"
                />
              </div>
              <ScrollArea className="flex-1 border rounded-lg">
                {productsQ.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2">
                    {filteredProducts.map((p: any) => {
                      const qty = getCartQty(p.id);
                      const selected = qty > 0;
                      return (
                        <div
                          key={p.id}
                          className={`relative border rounded-lg p-2 flex flex-col items-center text-center transition ${selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'}`}
                        >
                          <div className="text-[11px] font-bold text-primary line-clamp-1 w-full">{p.name}</div>
                          <div className="my-1 w-full h-20 flex items-center justify-center bg-muted/30 rounded">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name} className="max-h-full max-w-full object-contain" loading="lazy" />
                            ) : (
                              <FileText className="w-8 h-8 text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="flex items-center gap-1 w-full">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 shrink-0"
                              onClick={() => updateCart(p, Math.max(0, qty - 1))}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input
                              type="number"
                              min={0}
                              value={qty}
                              onChange={(e) => updateCart(p, Math.max(0, Number(e.target.value) || 0))}
                              className="h-7 px-1 text-center text-xs"
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 shrink-0"
                              onClick={() => updateCart(p, qty + 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
              {cart.length > 0 && (
                <div className="border rounded-lg p-2 bg-muted/30">
                  <div className="text-xs font-semibold mb-1.5">
                    {t('branch_manual_invoice.cart')} ({cart.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cart.map(i => (
                      <Badge key={i.productId} variant="secondary" className="gap-1">
                        {i.productName} × {i.quantity}
                        <button onClick={() => updateCart({ id: i.productId, name: i.productName, price: i.unitPrice }, 0)}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs mt-2 text-muted-foreground">
                    {t('branch_manual_invoice.total')}: <strong>{totalAmount.toFixed(2)} DA</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: طريقة الدفع */}
          {step === 'payment' && (
            <div className="space-y-4">
              <Label className="text-sm font-semibold">{t('branch_manual_invoice.choose_payment')}</Label>
              <InvoicePaymentMethodSelect value={paymentMethod} onChange={setPaymentMethod} />
            </div>
          )}

          {/* STEP 4: نوع الفاتورة */}
          {step === 'scope' && (
            <div className="space-y-4">
              <Label className="text-sm font-semibold">{t('branch_manual_invoice.choose_scope')}</Label>
              <RadioGroup value={invoiceScope} onValueChange={(v) => setInvoiceScope(v as any)}>
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
              </RadioGroup>

              {/* ملخص */}
              <div className="border rounded-lg p-3 bg-muted/30 space-y-1.5 text-sm">
                <div className="font-semibold mb-1">{t('branch_manual_invoice.summary')}</div>
                <div>👤 {language === 'fr' && selectedCustomer?.name_fr ? selectedCustomer.name_fr : selectedCustomer?.name}</div>
                <div>📦 {cart.length} {t('branch_manual_invoice.products_count')}</div>
                <div>💰 {paymentMethod && INVOICE_PAYMENT_METHODS[paymentMethod].label}</div>
                <div>💰 {paymentMethod && INVOICE_PAYMENT_METHODS[paymentMethod].label}</div>
                
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between gap-2 pt-3 border-t">
          <div>
            {step !== 'customer' && (
              <Button type="button" variant="outline" onClick={goBack} disabled={submit.isPending}>
                {t('branch_manual_invoice.back')}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => handleClose(false)} disabled={submit.isPending}>
              {t('branch_manual_invoice.cancel')}
            </Button>
            {step !== 'scope' ? (
              <Button type="button" onClick={goNext} disabled={!canGoNext()}>
                {t('branch_manual_invoice.next')}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => submit.mutate()}
                disabled={submit.isPending}
                className="gap-2"
              >
                {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {t('branch_manual_invoice.send_to_assistant')}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BranchManualInvoiceDialog;
