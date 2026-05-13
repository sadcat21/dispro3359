import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Gift, Calendar, Layers, ChevronDown, ChevronUp, Plus, Package, Settings2, CheckCircle2, ArrowLeft, ArrowRight, Sparkles, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { getProductDisplayName } from '@/utils/productDisplayName';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Product, Branch } from '@/types/database';
import { ProductOffer, ProductOfferTier, ProductOfferWithDetails, TierConditions } from '@/types/productOffer';
import { useCustomerTypes, getCustomerTypeColor } from '@/hooks/useCustomerTypes';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import OfferTierCard from './OfferTierCard';
import { isAdminRole } from '@/lib/utils';
import { cn } from '@/lib/utils';
import SimpleProductPickerDialog from '@/components/stock/SimpleProductPickerDialog';

interface CreateOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editOffer?: ProductOfferWithDetails | null;
}

const defaultTier: Omit<ProductOfferTier, 'id' | 'offer_id' | 'created_at'> = {
  min_quantity: 1,
  max_quantity: null,
  min_quantity_unit: 'piece',
  gift_quantity: 1,
  gift_quantity_unit: 'piece',
  gift_type: 'same_product',
  gift_product_id: null,
  discount_percentage: null,
  discount_amount: null,
  discount_prices: null,
  worker_reward_type: 'none',
  worker_reward_amount: 0,
  tier_order: 0,
  is_stackable: false,
  conditions: null,
};

const CreateOfferDialog: React.FC<CreateOfferDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
  editOffer,
}) => {
  const { t, dir } = useLanguage();
  const { workerId, role } = useAuth();
  const isAdmin = isAdminRole(role);

  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [activeTierTab, setActiveTierTab] = useState(0);
  const productSelectedRef = useRef(false);
  const { customerTypes } = useCustomerTypes();

  // Form state - offer level
  const [formData, setFormData] = useState({
    product_id: '',
    name: '',
    description: '',
    condition_type: 'multiplier' as 'range' | 'multiplier',
    is_stackable: false,
    is_auto_apply: true,
    start_date: '',
    end_date: '',
    is_active: true,
    priority: 0,
    branch_id: null as string | null,
    scope_stages: ['worker_loading', 'order_creation', 'direct_sale', 'warehouse_sale'] as string[],
    auto_fill_quantities: true,
    is_mandatory: false,
    is_deferred_confirmation: false,
  });

  // Target audience (offer-level conditions, applied to all tiers on save)
  const [audience, setAudience] = useState<TierConditions>({});

  // Tiers state
  const [tiers, setTiers] = useState<ProductOfferTier[]>([{ ...defaultTier, tier_order: 0 }]);

  // Load edit offer data after products are loaded
  const loadEditOfferData = () => {
    if (editOffer) {
      setFormData({
        product_id: editOffer.product_id,
        name: editOffer.name,
        description: editOffer.description || '',
        condition_type: (editOffer.condition_type as 'range' | 'multiplier') || 'range',
        is_stackable: editOffer.is_stackable,
        is_auto_apply: editOffer.is_auto_apply,
        start_date: editOffer.start_date || '',
        end_date: editOffer.end_date || '',
        is_active: editOffer.is_active,
        priority: editOffer.priority,
        branch_id: editOffer.branch_id,
        scope_stages: (editOffer as any).scope_stages || ['worker_loading', 'order_creation', 'direct_sale', 'warehouse_sale'],
        auto_fill_quantities: (editOffer as any).auto_fill_quantities ?? true,
        is_mandatory: (editOffer as any).is_mandatory ?? false,
        is_deferred_confirmation: (editOffer as any).is_deferred_confirmation ?? false,
      });
      
      // Load existing tiers or use legacy single tier
      if (editOffer.tiers && editOffer.tiers.length > 0) {
        setTiers(editOffer.tiers.map((tier, index) => ({
          ...tier,
          tier_order: index,
        })));
        // Audience conditions are shared across tiers — read from first tier
        setAudience((editOffer.tiers[0]?.conditions as TierConditions) || {});
      } else {
        // Legacy: convert old single-tier data
        setTiers([{
          min_quantity: editOffer.min_quantity,
          max_quantity: editOffer.max_quantity,
          min_quantity_unit: editOffer.min_quantity_unit || 'piece',
          gift_quantity: editOffer.gift_quantity,
          gift_quantity_unit: editOffer.gift_quantity_unit || 'piece',
          gift_type: editOffer.gift_type,
          gift_product_id: editOffer.gift_product_id,
          discount_percentage: editOffer.discount_percentage,
          discount_amount: editOffer.discount_amount,
          discount_prices: (editOffer as any).discount_prices || null,
          worker_reward_type: editOffer.worker_reward_type,
          worker_reward_amount: editOffer.worker_reward_amount,
          tier_order: 0,
          is_stackable: false,
        }]);
        setAudience({});
      }
    }
  };

  useEffect(() => {
    if (open) {
      const loadData = async () => {
        await fetchProducts();
        if (isAdmin) await fetchBranches();
        
        if (editOffer) {
          loadEditOfferData();
        } else {
          resetForm();
          productSelectedRef.current = false;
          setProductPickerOpen(true);
        }
      };
      loadData();
    }
  }, [open, editOffer]);

  const resetForm = () => {
    setFormData({
      product_id: '',
      name: '',
      description: '',
      condition_type: 'multiplier',
      is_stackable: false,
      is_auto_apply: true,
      start_date: '',
      end_date: '',
      is_active: true,
      priority: 0,
      branch_id: null,
      scope_stages: ['worker_loading', 'order_creation', 'direct_sale', 'warehouse_sale'],
      auto_fill_quantities: true,
      is_mandatory: false,
      is_deferred_confirmation: false,
    });
    setTiers([{ ...defaultTier, tier_order: 0 }]);
    setAudience({});
    setStep(1);
    setShowAdvanced(false);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name');
    let list: any[] = data || [];
    if (editOffer?.product_id && !list.find((p: any) => p.id === editOffer.product_id)) {
      const { data: extra } = await supabase
        .from('products')
        .select('*')
        .eq('id', editOffer.product_id)
        .maybeSingle();
      if (extra) list = [extra, ...list];
    }
    setProducts(list);
  };

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('name');
    setBranches(data || []);
  };

  const getProductName = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product?.name || '';
  };

  const getFinalOfferName = () => {
    if (formData.name.trim()) {
      return formData.name.trim();
    }
    const productName = getProductName(formData.product_id);
    return productName ? `PROM: ${productName}` : '';
  };

  // Tier management
  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    const newTier: ProductOfferTier = {
      ...defaultTier,
      min_quantity: (lastTier?.max_quantity || lastTier?.min_quantity || 0) + 1,
      tier_order: tiers.length,
    };
    setTiers([...tiers, newTier]);
  };

  const updateTier = (index: number, updates: Partial<ProductOfferTier>) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], ...updates };
    setTiers(newTiers);
  };

  const deleteTier = (index: number) => {
    if (tiers.length <= 1) return;
    const newTiers = tiers.filter((_, i) => i !== index).map((tier, i) => ({
      ...tier,
      tier_order: i,
    }));
    setTiers(newTiers);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.product_id) {
      toast.error(t('offers.select_product'));
      return;
    }

    if (tiers.length === 0) {
      toast.error(t('offers.add_tier'));
      return;
    }

    setIsLoading(true);
    try {
      // First tier data for legacy compatibility
      const firstTier = tiers[0];
      
      const offerData = {
        product_id: formData.product_id,
        name: getFinalOfferName(),
        description: formData.description.trim() || null,
        condition_type: formData.condition_type,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        is_stackable: formData.is_stackable,
        is_auto_apply: formData.is_auto_apply,
        is_active: formData.is_active,
        priority: formData.priority,
        branch_id: formData.branch_id,
        scope_stages: formData.scope_stages,
        auto_fill_quantities: formData.auto_fill_quantities,
        is_mandatory: formData.is_mandatory,
        is_deferred_confirmation: formData.is_deferred_confirmation,
        // Legacy fields from first tier
        min_quantity: firstTier.min_quantity,
        max_quantity: firstTier.max_quantity,
        min_quantity_unit: firstTier.min_quantity_unit,
        gift_quantity: firstTier.gift_quantity,
        gift_quantity_unit: firstTier.gift_quantity_unit,
        gift_type: firstTier.gift_type,
        gift_product_id: firstTier.gift_product_id,
        discount_percentage: firstTier.discount_percentage,
        discount_amount: firstTier.discount_amount,
        discount_prices: firstTier.discount_prices || null,
        worker_reward_type: firstTier.worker_reward_type,
        worker_reward_amount: firstTier.worker_reward_amount,
      } as any;

      let offerId: string;

      if (editOffer) {
        const { error } = await supabase
          .from('product_offers')
          .update(offerData)
          .eq('id', editOffer.id);
        if (error) throw error;
        offerId = editOffer.id;

        // Delete old tiers
        await supabase
          .from('product_offer_tiers')
          .delete()
          .eq('offer_id', offerId);
      } else {
        const { data, error } = await supabase
          .from('product_offers')
          .insert({ ...offerData, created_by: workerId })
          .select('id')
          .single();
        if (error) throw error;
        offerId = data.id;
      }

      // Insert all tiers
      if (tiers.length > 0) {
        const tiersData = tiers.map((tier, index) => ({
          offer_id: offerId,
          min_quantity: tier.min_quantity,
          max_quantity: tier.max_quantity,
          min_quantity_unit: tier.min_quantity_unit,
          gift_quantity: tier.gift_quantity,
          gift_quantity_unit: tier.gift_quantity_unit,
          gift_type: tier.gift_type,
          gift_product_id: tier.gift_product_id,
          discount_percentage: tier.discount_percentage,
          discount_amount: tier.discount_amount,
          discount_prices: tier.discount_prices || null,
          worker_reward_type: tier.worker_reward_type,
          worker_reward_amount: tier.worker_reward_amount,
          tier_order: index,
          is_stackable: tier.is_stackable ?? false,
          conditions: (Object.keys(audience).length > 0 ? audience : tier.conditions) || null,
        }));

        const { error: tiersError } = await supabase
          .from('product_offer_tiers')
          .insert(tiersData as any);
        if (tiersError) throw tiersError;
      }

      toast.success(editOffer ? t('offers.updated') : t('offers.created'));
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving offer:', error);
      toast.error(error.message || t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { id: 1, label: t('offers.product') || 'Product', icon: Package },
    { id: 2, label: t('offers.tiers') || 'Tiers', icon: Layers },
    { id: 3, label: t('offers.settings') || 'Settings', icon: Settings2 },
    { id: 4, label: dir === 'rtl' ? 'الجمهور' : 'Target', icon: Users, optional: true },
    { id: 5, label: t('offers.summary') || t('common.review') || 'Summary', icon: CheckCircle2 },
  ];

  const canGoNext = () => {
    if (step === 1) return !!formData.product_id;
    if (step === 2) return tiers.length > 0;
    return true;
  };

  const goNext = () => setStep((s) => Math.min(5, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const selectedProduct = products.find((p) => p.id === formData.product_id) || null;



  const showMainDialog = open && (!!editOffer || !!formData.product_id);

  return (
    <>
      <SimpleProductPickerDialog
        open={productPickerOpen}
        onOpenChange={(o) => {
          setProductPickerOpen(o);
          if (!o && !productSelectedRef.current && !editOffer) {
            onOpenChange(false);
          }
        }}
        products={products.map(p => ({ id: p.id, name: getProductDisplayName(p), image_url: (p as any).image_url ?? null }))}
        selectedProductId={formData.product_id}
        onSelect={(id) => {
          productSelectedRef.current = true;
          setFormData({ ...formData, product_id: id });
          if (!editOffer) setStep(2);
        }}
      />
    <Dialog open={showMainDialog} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] p-0 flex flex-col overflow-hidden gap-0 rounded-xl" dir={dir}>
        {/* Neutral header */}
        <DialogHeader className="px-3 sm:px-5 py-3 sm:py-4 border-b bg-background space-y-3">
          <DialogTitle className="flex items-center gap-2 text-sm sm:text-base font-semibold">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0">
              <Gift className="w-4 h-4" />
            </div>
            {editOffer ? t('offers.edit') : t('offers.create')}
          </DialogTitle>

          {/* Stepper */}
          <div className="-mx-1 px-1 overflow-x-auto">
            <div className="flex items-center gap-1 w-max min-w-full">
              {steps.map((s) => {
                const isActive = step === s.id;
                const isDone = step > s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => (isDone || isActive ? setStep(s.id) : null)}
                    className={cn(
                      'rounded-full text-[10px] sm:text-[11px] font-medium transition-colors px-2 py-1 border shrink-0 whitespace-nowrap',
                      isActive && 'bg-foreground text-background border-foreground',
                      isDone && 'bg-muted text-foreground border-border hover:bg-muted/70',
                      !isActive && !isDone && 'bg-background text-muted-foreground border-border'
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 space-y-4">
            {/* Step 1: Product */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('offers.product')} *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start h-12 px-2 gap-2"
                    onClick={() => setProductPickerOpen(true)}
                  >
                    {selectedProduct ? (
                      <>
                        {(selectedProduct as any).image_url ? (
                          <img
                            src={(selectedProduct as any).image_url}
                            alt={selectedProduct.name}
                            className="w-9 h-9 rounded-md object-cover border"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center border">
                            <Package className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 text-start">
                          <div className="text-sm font-medium truncate">{getProductDisplayName(selectedProduct)}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {selectedProduct.pieces_per_box} {t('offers.unit_piece_short')} / {t('offers.unit_box_short')}
                          </div>
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground text-sm">{t('offers.select_product')}</span>
                    )}
                  </Button>
                </div>


                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between h-8 px-2">
                      <span className="text-xs text-muted-foreground">{t('offers.advanced_options')}</span>
                      {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <Label className="text-xs">{t('offers.custom_name')}</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder={formData.product_id ? `PROM: ${getProductName(formData.product_id)}` : t('offers.name_placeholder')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">{t('offers.description')}</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder={t('offers.description_placeholder')}
                        rows={2}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* Step 2: Tiers / Periods */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('offers.condition_type')}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={cn(
                        'rounded-md border px-2 py-1.5 text-start transition-colors',
                        formData.condition_type === 'range'
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border bg-background hover:bg-muted/50'
                      )}
                      onClick={() => setFormData({ ...formData, condition_type: 'range' })}
                    >
                      <div className="text-xs font-medium">{t('offers.range')}</div>
                      <div className="text-[10px] opacity-70 leading-tight">{t('offers.range_hint')}</div>
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'rounded-md border px-2 py-1.5 text-start transition-colors',
                        formData.condition_type === 'multiplier'
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border bg-background hover:bg-muted/50'
                      )}
                      onClick={() => setFormData({ ...formData, condition_type: 'multiplier' })}
                    >
                      <div className="text-xs font-medium">{t('offers.multiplier')}</div>
                      <div className="text-[10px] opacity-70 leading-tight">{t('offers.multiplier_hint')}</div>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium">{t('offers.quantity_tiers')}</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{tiers.length} {t('offers.tier')}</Badge>
                      <Button
                        type="button"
                        size="icon"
                        aria-label={t('offers.add_tier')}
                        className="h-7 w-7 shrink-0 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        onClick={() => {
                          addTier();
                          setActiveTierTab(tiers.length);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <Tabs
                    value={String(Math.min(activeTierTab, tiers.length - 1))}
                    onValueChange={(v) => setActiveTierTab(parseInt(v) || 0)}
                    dir={dir}
                  >
                    <TabsList className="h-auto grid grid-cols-3 gap-1 bg-muted/40 p-1 w-full">
                      {tiers.map((tier, index) => {
                        const unitShort = (u: string) => (u === 'box' ? 'BOX' : 'PCS');
                        const minPart = tier.max_quantity && tier.max_quantity !== tier.min_quantity
                          ? `${tier.min_quantity}-${tier.max_quantity}`
                          : `${tier.min_quantity}`;
                        const giftPart = tier.gift_type === 'discount_percentage' && tier.discount_percentage
                          ? `${tier.discount_percentage}%`
                          : tier.gift_type === 'discount_amount' && tier.discount_amount
                          ? `-${tier.discount_amount}`
                          : `${tier.gift_quantity} ${unitShort(tier.gift_quantity_unit)}`;
                        const condPart = `Buy ${minPart} ${unitShort(tier.min_quantity_unit)}`;
                        return (
                          <TabsTrigger
                            key={index}
                            value={String(index)}
                            dir="ltr"
                            className="p-0 h-7 w-full rounded-full overflow-hidden border border-border data-[state=active]:ring-2 data-[state=active]:ring-destructive"
                          >
                            <span className="flex items-stretch h-full w-full text-[10px] font-bold tracking-wide" dir="ltr">
                              <span className="bg-foreground text-background px-2 py-1 flex-1 flex items-center justify-center">{condPart}</span>
                              <span className="bg-destructive text-destructive-foreground px-2 py-1 flex-1 flex items-center justify-center">{giftPart}</span>
                            </span>
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>

                    {tiers.map((tier, index) => (
                      <TabsContent key={index} value={String(index)} className="mt-3">
                        <OfferTierCard
                          tier={tier}
                          tierIndex={index}
                          products={products}
                          selectedProduct={products.find(p => p.id === formData.product_id) || null}
                          onUpdate={updateTier}
                          onDelete={(i) => {
                            deleteTier(i);
                            setActiveTierTab(Math.max(0, i - 1));
                          }}
                          canDelete={tiers.length > 1}
                          conditionType={formData.condition_type}
                        />
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>
              </div>
            )}

            {/* Step 3: Settings */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {t('offers.start_date')}
                    </Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {t('offers.end_date')}
                    </Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('offers.priority')}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">{t('offers.priority_hint')}</p>
                </div>

                {isAdmin && branches.length > 0 && (
                  <div className="space-y-2">
                    <Label>{t('offers.branch')}</Label>
                    <Select
                      value={formData.branch_id || 'all'}
                      onValueChange={(value) => setFormData({ ...formData, branch_id: value === 'all' ? null : value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('offers.all_branches')}</SelectItem>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1 pt-1 rounded-lg border divide-y">
                  <div className="flex items-center justify-between p-3">
                    <div>
                      <Label className="text-sm">{t('offers.is_stackable')}</Label>
                      <p className="text-xs text-muted-foreground">{t('offers.stackable_hint')}</p>
                    </div>
                    <Switch
                      checked={formData.is_stackable}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_stackable: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <div>
                      <Label className="text-sm">{t('offers.is_auto_apply')}</Label>
                      <p className="text-xs text-muted-foreground">{t('offers.auto_apply_hint')}</p>
                    </div>
                    <Switch
                      checked={formData.is_auto_apply}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_auto_apply: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <div>
                      <Label className="text-sm">{t('offers.is_active')}</Label>
                    </div>
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <div>
                      <Label className="text-sm">إدخال تلقائي للكميات عند التفعيل</Label>
                      <p className="text-xs text-muted-foreground">عند الإيقاف، يقوم المستخدم بإدخال الكميات يدوياً</p>
                    </div>
                    <Switch
                      checked={formData.auto_fill_quantities}
                      onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, auto_fill_quantities: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <div>
                      <Label className="text-sm">تفعيل العرض إجباري</Label>
                      <p className="text-xs text-muted-foreground">عند التفعيل، لا يمكن إتمام العملية دون تفعيل العرض</p>
                    </div>
                    <Switch
                      checked={formData.is_mandatory || formData.is_deferred_confirmation}
                      disabled={formData.is_deferred_confirmation}
                      onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_mandatory: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 rounded">
                    <div>
                      <Label className="text-sm">عرض مؤجل التأكيد</Label>
                      <p className="text-xs text-muted-foreground">عند التفعيل، تُسجَّل الهدية في "العروض بانتظار التأكيد" ولا تُخصم من رصيد العامل حتى يُؤكَّد العرض (يصبح العرض إجبارياً تلقائياً)</p>
                    </div>
                    <Switch
                      checked={formData.is_deferred_confirmation}
                      onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_deferred_confirmation: checked, is_mandatory: checked ? true : prev.is_mandatory }))}
                    />
                  </div>
                </div>

                {/* Scope Stages */}
                <div className="space-y-2 rounded-lg border p-3">
                  <Label className="text-sm font-medium">مرحلة النطاق — أين يظهر العرض؟</Label>
                  <p className="text-xs text-muted-foreground">حدد المراحل التي يمكن للعرض الظهور والتفاعل معها</p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {[
                      { key: 'worker_loading', label: 'تحميل العامل' },
                      { key: 'order_creation', label: 'إنشاء الطلب' },
                      { key: 'direct_sale', label: 'البيع المباشر' },
                      { key: 'warehouse_sale', label: 'بيع من المستودع' },
                    ].map((stage) => {
                      const checked = formData.scope_stages.includes(stage.key);
                      return (
                        <label
                          key={stage.key}
                          className={`flex items-center gap-2 rounded-md border p-2 cursor-pointer text-sm ${checked ? 'bg-primary/10 border-primary' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setFormData((prev) => {
                                const next = e.target.checked
                                  ? [...prev.scope_stages, stage.key]
                                  : prev.scope_stages.filter((s) => s !== stage.key);
                                return { ...prev, scope_stages: next };
                              });
                            }}
                          />
                          {stage.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Target Audience (optional) */}
            {step === 4 && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">{t('offers.target_audience')}</Label>
                    <Badge variant="secondary" className="text-[10px]">{t('common.optional')}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('offers.target_audience_hint')}</p>
                </div>

                {/* Invoice Type */}
                <AudienceFilterCard
                  title={t('offers.invoice_types_label')}
                  selected={audience.invoice_types}
                  onChange={(next) => setAudience({ ...audience, invoice_types: next })}
                  options={[
                    { value: 'facture_1', label: t('offers.invoice_1') || 'فاتورة 1' },
                    { value: 'facture_2', label: t('offers.invoice_2') || 'فاتورة 2' },
                  ]}
                  allLabel={t('offers.all_by_default')}
                />

                {/* Pricing Types */}
                <AudienceFilterCard
                  title={t('offers.pricing_types_label')}
                  selected={audience.pricing_types}
                  onChange={(next) => setAudience({ ...audience, pricing_types: next })}
                  options={[
                    { value: 'retail', label: t('offers.retail') || 'التجزئة' },
                    { value: 'gros', label: t('offers.gros') || 'الجملة (غرو)' },
                    { value: 'super_gros', label: t('offers.super_gros') || 'سبر غرو' },
                  ]}
                  allLabel={t('offers.all_by_default')}
                />

                {/* Payment Methods */}
                <AudienceFilterCard
                  title={t('offers.payment_methods_label')}
                  selected={audience.payment_methods}
                  onChange={(next) => setAudience({ ...audience, payment_methods: next })}
                  options={[
                    { value: 'cash', label: t('offers.cash') || 'كاش' },
                    { value: 'check', label: t('offers.check') || 'شيك' },
                    { value: 'versement', label: 'فيرسمو' },
                    { value: 'virement', label: 'فيرمو' },
                  ]}
                  allLabel={t('offers.all_by_default')}
                />

                {/* Customer Types */}
                <AudienceFilterCard
                  title={t('offers.excluded_customer_types')}
                  description={t('offers.excluded_customer_types_hint')}
                  selected={audience.excluded_customer_types}
                  onChange={(next) => setAudience({ ...audience, excluded_customer_types: next })}
                  options={customerTypes.map((ct, i) => {
                    const color = getCustomerTypeColor(ct.short, i, ct);
                    return { value: ct.ar, label: ct.ar, dotColor: color.bg, title: ct.description };
                  })}
                  allLabel={t('offers.all_by_default')}
                />

                {/* Allow Debt */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="text-sm">{t('offers.allow_debt_label')}</Label>
                    {audience.allow_debt === false && (
                      <p className="text-[10px] text-destructive">{t('offers.no_debt_warning')}</p>
                    )}
                  </div>
                  <Switch
                    checked={audience.allow_debt !== false}
                    onCheckedChange={(checked) =>
                      setAudience({ ...audience, allow_debt: checked ? undefined : false })
                    }
                  />
                </div>

                <p className="text-[11px] text-muted-foreground">
                  💡 {t('offers.target_audience_default_hint')}
                </p>
              </div>
            )}

            {/* Step 5: Summary */}
            {step === 5 && (
              <div className="space-y-3">
                <div className="rounded-lg border p-3 space-y-2 text-xs">
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t('offers.product')}</span><span className="font-medium">{getProductName(formData.product_id)}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t('offers.condition_type')}</span><span className="font-medium">{formData.condition_type === 'range' ? t('offers.range') : t('offers.multiplier')}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t('offers.tiers')}</span><span className="font-medium">{tiers.length}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t('offers.priority')}</span><span className="font-medium">{formData.priority}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t('offers.is_stackable')}</span><span className="font-medium">{formData.is_stackable ? '✓' : '—'}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t('offers.is_auto_apply')}</span><span className="font-medium">{formData.is_auto_apply ? '✓' : '—'}</span></div>
                  {(audience.excluded_customer_types?.length || audience.invoice_types?.length || audience.pricing_types?.length || audience.payment_methods?.length || audience.allow_debt === false) ? (
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t('offers.target_audience')}</span><span className="font-medium">✓</span></div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {/* Footer with stepper navigation */}
          <div className="p-3 sm:p-4 border-t shrink-0 bg-background flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={goBack}
              disabled={step === 1 || isLoading}
              className="gap-1 h-9 px-2 sm:px-3"
            >
              <ArrowRight className={cn('w-4 h-4', dir === 'ltr' && 'rotate-180')} />
              <span className="text-xs sm:text-sm">{t('common.back') || 'Back'}</span>
            </Button>
            <div className="flex-1 text-center text-[11px] sm:text-xs text-muted-foreground">
              {step} / {steps.length}
            </div>
            {step < 5 ? (
              <Button
                type="button"
                size="sm"
                onClick={goNext}
                disabled={!canGoNext()}
                className="gap-1 h-9 px-2 sm:px-3"
              >
                <span className="text-xs sm:text-sm">{t('common.next') || 'Next'}</span>
                <ArrowLeft className={cn('w-4 h-4', dir === 'ltr' && 'rotate-180')} />
              </Button>
            ) : (
              <Button type="submit" size="sm" disabled={isLoading} className="gap-1 h-9 px-2 sm:px-3">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs sm:text-sm">{t('common.loading')}</span>
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4" />
                    <span className="text-xs sm:text-sm">{editOffer ? t('common.save') : t('offers.create')}</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
};

interface AudienceOption {
  value: string;
  label: string;
  dotColor?: string;
  title?: string;
}

interface AudienceFilterCardProps {
  title: string;
  description?: string;
  allLabel: string;
  selected: string[] | undefined;
  onChange: (next: string[] | undefined) => void;
  options: AudienceOption[];
  variant?: 'default' | 'destructive';
}

const AudienceFilterCard: React.FC<AudienceFilterCardProps> = ({
  title,
  description,
  allLabel,
  selected,
  onChange,
  options,
  variant = 'default',
}) => {
  // Switch ON (default) = applies to all. Switch OFF = restrict to chosen options.
  // We use `selected === undefined` to represent "all".
  const isAll = selected === undefined;
  const list = selected || [];

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-card">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <Label className="text-xs font-medium">{title}</Label>
          {description && <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>}
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {isAll || list.length === 0 ? `· ${allLabel}` : `· ${list.length} محدد`}
          </p>
        </div>
        <Switch
          checked={isAll}
          onCheckedChange={(checked) => onChange(checked ? undefined : [])}
        />
      </div>

      {!isAll && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {options.map((opt) => {
            const checked = list.includes(opt.value);
            const activeCls = variant === 'destructive'
              ? 'border-destructive bg-destructive/10 text-destructive'
              : 'bg-foreground text-background border-foreground';
            return (
              <button
                key={opt.value}
                type="button"
                title={opt.title}
                onClick={() => {
                  const next = checked ? list.filter(v => v !== opt.value) : [...list, opt.value];
                  onChange(next);
                }}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-md border transition-colors flex items-center gap-1.5',
                  checked ? activeCls : 'bg-background hover:bg-muted/50 border-border'
                )}
              >
                {opt.dotColor && (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.dotColor }} />
                )}
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CreateOfferDialog;
