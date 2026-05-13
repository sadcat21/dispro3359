import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Gift, User, Package, Layers, Trash2, Plus, X } from 'lucide-react';
import { getProductDisplayName } from '@/utils/productDisplayName';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Customer } from '@/types/database';
import { toast } from 'sonner';
import { parseBP as parseBPUtil, boxesToBP } from '@/utils/boxPieceInput';
import CustomerPickerDialog from '@/components/orders/CustomerPickerDialog';
import { cn } from '@/lib/utils';

type UnitType = 'box' | 'piece';

type OfferTierOption = {
  id?: string;
  min_quantity: number;
  max_quantity: number | null;
  min_quantity_unit: UnitType;
  gift_quantity: number;
  gift_quantity_unit: UnitType;
  tier_order: number;
};

type OfferOption = {
  id: string;
  name: string;
  condition_type: 'range' | 'multiplier';
  product_id: string;
  branch_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  product?: { id: string; name: string; image_url?: string | null; pieces_per_box?: number | null } | null;
  tiers?: OfferTierOption[];
  min_quantity: number;
  max_quantity: number | null;
  min_quantity_unit: UnitType;
  gift_quantity: number;
  gift_quantity_unit: UnitType;
};

interface CustomerEntry {
  id: string; // unique key for the entry
  customerId: string;
  soldQuantity: string; // B.P format e.g. "8.03"
  giftQuantity: number;
  eligible: boolean;
  timesApplied: number;
}

interface ManualPromoEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCustomerId?: string;
}

const unitLabel = (unit: UnitType) => (unit === 'box' ? 'صندوق' : 'قطعة');

const buildOfferDetail = (tier: OfferTierOption) => {
  const minUnit = tier.min_quantity_unit === 'box' ? 'BOX' : 'PCS';
  const giftUnit = tier.gift_quantity_unit === 'box' ? 'BOX' : 'PCS';
  return `${tier.min_quantity}${minUnit}+${tier.gift_quantity}${giftUnit}`;
};

/**
 * Parse a B.P entry using the central util so it respects pieces_per_box
 * (auto-rolls overflow pieces into boxes per product settings).
 */
const parseBPLocal = (value: string, piecesPerBox: number) => {
  const parsed = parseBPUtil(value, piecesPerBox);
  return {
    boxes: parsed.boxes,
    pieces: parsed.pieces,
    totalBoxes: parsed.totalBoxes,
    totalPieces: parsed.totalPieces,
    /** raw numeric value normalized as B.P (boxes.pieces) ready for DB storage */
    raw: parsed.totalPieces > 0
      ? parseFloat(boxesToBP(parsed.totalBoxes, piecesPerBox))
      : 0,
  };
};

/** Convert a B.P entry to total units (boxes or pieces) honoring product settings */
const bpToTotal = (value: string, unit: UnitType, piecesPerBox: number): number => {
  const parsed = parseBPLocal(value, piecesPerBox);
  return unit === 'piece' ? parsed.totalPieces : parsed.totalBoxes;
};

const computeGift = (
  soldBP: string,
  offer: OfferOption | null,
  tier: OfferTierOption | null,
  piecesPerBox: number,
): { giftQty: number; eligible: boolean; timesApplied: number } => {
  if (!offer || !tier) return { giftQty: 0, eligible: false, timesApplied: 0 };
  const totalSold = bpToTotal(soldBP, tier.min_quantity_unit, piecesPerBox);
  if (totalSold <= 0) return { giftQty: 0, eligible: false, timesApplied: 0 };

  const minQty = Number(tier.min_quantity || 0);
  if (minQty <= 0) return { giftQty: 0, eligible: false, timesApplied: 0 };

  if (offer.condition_type === 'multiplier') {
    const timesApplied = Math.floor(totalSold / minQty);
    return {
      giftQty: timesApplied * Number(tier.gift_quantity || 0),
      eligible: timesApplied > 0,
      timesApplied,
    };
  }

  const inRange = totalSold >= minQty && (tier.max_quantity == null || totalSold <= tier.max_quantity);
  return {
    giftQty: inRange ? Number(tier.gift_quantity || 0) : 0,
    eligible: inRange,
    timesApplied: inRange ? 1 : 0,
  };
};

let entryCounter = 0;
const nextEntryId = () => `entry-${++entryCounter}`;

const ManualPromoEntryDialog: React.FC<ManualPromoEntryDialogProps> = ({
  open,
  onOpenChange,
  initialCustomerId,
}) => {
  const { workerId, activeBranch } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [offers, setOffers] = useState<OfferOption[]>([]);

  // Step 1: Product + Offer + Tier selection
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [selectedTierId, setSelectedTierId] = useState('');
  const [notes, setNotes] = useState('');

  // Step 2: Multiple customer entries
  const [customerEntries, setCustomerEntries] = useState<CustomerEntry[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Derived data
  const productOptions = useMemo(() => {
    const seen = new Set<string>();
    return offers
      .filter((offer) => {
        if (!offer.product?.id || !offer.product?.name) return false;
        if (seen.has(offer.product.id)) return false;
        seen.add(offer.product.id);
        return true;
      })
      .map((offer) => ({
        id: offer.product!.id,
        name: offer.product!.name,
        image_url: offer.product!.image_url || null,
        pieces_per_box: offer.product!.pieces_per_box || 1,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [offers]);

  const selectedProduct = useMemo(
    () => productOptions.find((p) => p.id === selectedProductId),
    [productOptions, selectedProductId],
  );

  const piecesPerBox = selectedProduct?.pieces_per_box || 1;

  const productOffers = useMemo(
    () => offers.filter((offer) => offer.product_id === selectedProductId),
    [offers, selectedProductId],
  );

  const selectedOffer = useMemo(
    () => productOffers.find((offer) => offer.id === selectedOfferId) || null,
    [productOffers, selectedOfferId],
  );

  const availableTiers = useMemo(() => {
    if (!selectedOffer) return [];
    const sorted = [...(selectedOffer.tiers || [])].sort((a, b) => a.tier_order - b.tier_order);
    if (sorted.length > 0) return sorted;
    return [{
      min_quantity: selectedOffer.min_quantity,
      max_quantity: selectedOffer.max_quantity,
      min_quantity_unit: selectedOffer.min_quantity_unit,
      gift_quantity: selectedOffer.gift_quantity,
      gift_quantity_unit: selectedOffer.gift_quantity_unit,
      tier_order: 0,
    } as OfferTierOption];
  }, [selectedOffer]);

  const selectedTier = useMemo(
    () => availableTiers.find((tier) => (tier.id || `tier-${tier.tier_order}`) === selectedTierId) || null,
    [availableTiers, selectedTierId],
  );

  // Filter customers for search
  const filteredCustomers = useMemo(() => {
    const usedIds = new Set(customerEntries.map((e) => e.customerId));
    let filtered = customers.filter((c) => !usedIds.has(c.id));
    if (customerSearch.trim()) {
      const q = customerSearch.trim().toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.store_name?.toLowerCase().includes(q),
      );
    }
    return filtered.slice(0, 50);
  }, [customers, customerEntries, customerSearch]);

  // Fetch data
  useEffect(() => {
    if (!open) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        let customersQuery = supabase
          .from('customers')
          .select('*')
          .eq('status', 'active')
          .order('name');

        if (activeBranch?.id) {
          customersQuery = customersQuery.eq('branch_id', activeBranch.id);
        }

        const offersQuery = supabase
          .from('product_offers')
          .select(`
            id, name, condition_type, product_id, branch_id, start_date, end_date,
            min_quantity, max_quantity, min_quantity_unit, gift_quantity, gift_quantity_unit,
            product:products!product_offers_product_id_fkey(id, name, image_url, pieces_per_box),
            tiers:product_offer_tiers(id, min_quantity, max_quantity, min_quantity_unit, gift_quantity, gift_quantity_unit, tier_order)
          `)
          .eq('is_active', true)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false });

        const [{ data: customersData, error: customersError }, { data: offersData, error: offersError }] = await Promise.all([
          customersQuery,
          offersQuery,
        ]);

        if (customersError) throw customersError;
        if (offersError) throw offersError;

        const branchFilteredOffers = (offersData || []).filter((offer: any) => {
          if (!activeBranch?.id) return true;
          return !offer.branch_id || offer.branch_id === activeBranch.id;
        });

        const dateFilteredOffers = branchFilteredOffers.filter((offer: any) => {
          const startOk = !offer.start_date || offer.start_date <= today;
          const endOk = !offer.end_date || offer.end_date >= today;
          return startOk && endOk;
        });

        setCustomers((customersData || []) as Customer[]);
        setOffers(dateFilteredOffers as any);
      } catch (error) {
        console.error('Error fetching manual promo data:', error);
        toast.error('فشل تحميل بيانات تسجيل العروض اليدوية');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [open, activeBranch?.id, today]);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setSelectedProductId('');
    setSelectedOfferId('');
    setSelectedTierId('');
    setNotes('');
    setCustomerEntries([]);
    setCustomerSearch('');
    setShowCustomerSearch(false);

    if (initialCustomerId) {
      setCustomerEntries([{
        id: nextEntryId(),
        customerId: initialCustomerId,
        soldQuantity: '',
        giftQuantity: 0,
        eligible: false,
        timesApplied: 0,
      }]);
    }
  }, [open, initialCustomerId]);

  // Auto-select first offer when product changes
  useEffect(() => {
    if (!selectedProductId) {
      setSelectedOfferId('');
      setSelectedTierId('');
      return;
    }
    const firstOffer = productOffers[0];
    setSelectedOfferId(firstOffer?.id || '');
  }, [selectedProductId, productOffers]);

  // Auto-select first tier when offer changes
  useEffect(() => {
    if (!selectedOffer) {
      setSelectedTierId('');
      return;
    }
    const firstTier = availableTiers[0];
    setSelectedTierId(firstTier ? (firstTier.id || `tier-${firstTier.tier_order}`) : '');
  }, [selectedOffer, availableTiers]);

  // Recompute gift for all entries when tier/offer changes
  useEffect(() => {
    if (!selectedOffer || !selectedTier) return;
    setCustomerEntries((prev) =>
      prev.map((entry) => {
        const result = computeGift(entry.soldQuantity, selectedOffer, selectedTier, piecesPerBox);
        return { ...entry, ...result, giftQuantity: result.giftQty };
      }),
    );
  }, [selectedOffer, selectedTier, piecesPerBox]);

  const addCustomer = useCallback((customer: Customer) => {
    setCustomerEntries((prev) => [
      ...prev,
      {
        id: nextEntryId(),
        customerId: customer.id,
        soldQuantity: '',
        giftQuantity: 0,
        eligible: false,
        timesApplied: 0,
      },
    ]);
    setCustomerSearch('');
    setShowCustomerSearch(false);
  }, []);

  const removeCustomerEntry = useCallback((entryId: string) => {
    setCustomerEntries((prev) => prev.filter((e) => e.id !== entryId));
  }, []);

  const updateSoldQuantity = useCallback(
    (entryId: string, value: string) => {
      setCustomerEntries((prev) =>
        prev.map((entry) => {
          if (entry.id !== entryId) return entry;
          const result = computeGift(value, selectedOffer, selectedTier, piecesPerBox);
          return {
            ...entry,
            soldQuantity: value,
            giftQuantity: result.giftQty,
            eligible: result.eligible,
            timesApplied: result.timesApplied,
          };
        }),
      );
    },
    [selectedOffer, selectedTier, piecesPerBox],
  );

  const getCustomerName = useCallback(
    (customerId: string) => customers.find((c) => c.id === customerId)?.name || '—',
    [customers],
  );

  const validEntries = customerEntries.filter((e) => e.customerId && e.eligible && e.giftQuantity > 0);

  const handleSave = async () => {
    if (!workerId) {
      toast.error('تعذر تحديد العامل الحالي');
      return;
    }
    if (!selectedProductId || !selectedOffer || !selectedTier) {
      toast.error('يرجى اختيار المنتج والعرض والشريحة');
      return;
    }
    if (validEntries.length === 0) {
      toast.error('لا يوجد عملاء مؤهلين للعرض');
      return;
    }

    setIsSaving(true);
    try {
      const detail = buildOfferDetail(selectedTier);
      const payloads = validEntries.map((entry) => {
        const parsedSold = parseBPLocal(entry.soldQuantity, piecesPerBox);
        return {
          worker_id: workerId,
          customer_id: entry.customerId,
          product_id: selectedProductId,
          vente_quantity: parsedSold.raw,
          gratuite_quantity: entry.giftQuantity,
          gift_quantity_unit: selectedTier.gift_quantity_unit || 'piece',
          offer_id: selectedOffer.id,
          offer_tier_id: selectedTier.id || null,
          offer_detail: detail,
          notes: notes.trim() || null,
        };
      });

      const { error } = await supabase.from('promos').insert(payloads as any);
      if (error) throw error;

      toast.success(`تم تسجيل ${validEntries.length} عرض يدوي بنجاح`);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving manual promo:', error);
      toast.error(error.message || 'فشل حفظ تسجيل العروض');
    } finally {
      setIsSaving(false);
    }
  };

  const tierSelected = !!selectedTier;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0" dir="rtl">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            تسجيل عروض/هدايا يدويًا
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-4 space-y-3 pb-3">
              {/* Product image grid */}
              <div className="space-y-1">
                <Label className="flex items-center gap-1.5 text-xs"><Package className="w-3.5 h-3.5" /> المنتج *</Label>
                {productOptions.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-4 border rounded-md">
                    لا توجد منتجات بعروض نشطة
                  </div>
                ) : (
                  <ScrollArea className="max-h-48 border rounded-md">
                    <div className="grid grid-cols-3 gap-2 p-2">
                      {productOptions.map((product) => {
                        const active = product.id === selectedProductId;
                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => setSelectedProductId(product.id)}
                            className={cn(
                              'flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 bg-card transition-all text-center',
                              active ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/40',
                            )}
                          >
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt=""
                                className="w-full aspect-square object-cover rounded"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full aspect-square rounded bg-muted flex items-center justify-center">
                                <Package className="w-6 h-6 text-muted-foreground/50" />
                              </div>
                            )}
                            <span className="text-[10px] font-medium leading-tight line-clamp-2">
                              {getProductDisplayName(product)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Offer */}
              <div className="space-y-1">
                <Label className="text-xs">العرض *</Label>
                <Select value={selectedOfferId} onValueChange={setSelectedOfferId} disabled={!selectedProductId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="اختر العرض" />
                  </SelectTrigger>
                  <SelectContent>
                    {productOffers.map((offer) => (
                      <SelectItem key={offer.id} value={offer.id}>{offer.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tier */}
              <div className="space-y-1">
                <Label className="flex items-center gap-1.5 text-xs"><Layers className="w-3.5 h-3.5" /> الشريحة *</Label>
                <Select value={selectedTierId} onValueChange={setSelectedTierId} disabled={!selectedOffer}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="اختر الشريحة" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTiers.map((tier) => {
                      const key = tier.id || `tier-${tier.tier_order}`;
                      return (
                        <SelectItem key={key} value={key}>
                          شريحة {tier.tier_order + 1}: {tier.min_quantity} {unitLabel(tier.min_quantity_unit)} → +{tier.gift_quantity} {unitLabel(tier.gift_quantity_unit)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selectedOffer && selectedTier && (
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">{selectedOffer.condition_type === 'multiplier' ? 'مضاعف' : 'مدى'}</Badge>
                  <Badge variant="secondary" className="text-xs">
                    {selectedTier.min_quantity} {unitLabel(selectedTier.min_quantity_unit)} → +{selectedTier.gift_quantity} {unitLabel(selectedTier.gift_quantity_unit)}
                  </Badge>
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="border-t" />

            {/* Customer entries section */}
            <div className="flex-1 overflow-hidden flex flex-col px-4 pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-1.5 text-xs font-semibold">
                  <User className="w-3.5 h-3.5" />
                  العملاء ({customerEntries.length})
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  disabled={!tierSelected}
                  onClick={() => setShowCustomerSearch(true)}
                >
                  <Plus className="w-3 h-3" /> إضافة عميل
                </Button>
              </div>

              {/* Customer picker dialog (same as order creation) */}
              <CustomerPickerDialog
                open={showCustomerSearch}
                onOpenChange={setShowCustomerSearch}
                customers={customers.filter((c) => !customerEntries.some((e) => e.customerId === c.id))}
                onSelect={(customer) => {
                  addCustomer(customer);
                  setShowCustomerSearch(false);
                }}
              />

              {/* Customer entries list */}
              <ScrollArea className="flex-1 -mx-4 px-4">
                {customerEntries.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    {tierSelected ? 'اضغط "إضافة عميل" لبدء التسجيل' : 'اختر المنتج والعرض والشريحة أولاً'}
                  </div>
                ) : (
                  <div className="space-y-2 pb-2">
                    {customerEntries.map((entry) => (
                      <div key={entry.id} className="border rounded-lg p-2.5 space-y-2 bg-card">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate flex-1">{getCustomerName(entry.customerId)}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeCustomerEntry(entry.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <Label className="text-[10px] text-muted-foreground">الكمية المباعة (B.P)</Label>
                            <Input
                              value={entry.soldQuantity}
                              onChange={(e) => updateSoldQuantity(entry.id, e.target.value)}
                              placeholder="مثال: 8.03"
                              className="h-8 text-sm"
                              dir="ltr"
                            />
                          </div>
                          <div className="w-24 text-center">
                            <Label className="text-[10px] text-muted-foreground">الهدية</Label>
                            <div className={`h-8 flex items-center justify-center rounded-md text-sm font-bold ${entry.eligible ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              {entry.giftQuantity > 0
                                ? `${entry.giftQuantity} ${unitLabel(selectedTier?.gift_quantity_unit || 'piece')}`
                                : '—'}
                            </div>
                          </div>
                        </div>
                        {entry.soldQuantity && !entry.eligible && (
                          <p className="text-[10px] text-destructive">الكمية لا تحقق شروط الشريحة</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Notes + actions */}
            <div className="border-t px-4 py-3 space-y-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات (اختياري)..."
                rows={1}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  إلغاء
                </Button>
                <Button className="flex-1 gap-1" onClick={handleSave} disabled={isSaving || validEntries.length === 0}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                  حفظ ({validEntries.length})
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ManualPromoEntryDialog;
