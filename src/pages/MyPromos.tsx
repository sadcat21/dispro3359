import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PromoWithDetails, Customer, Product } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Package, Calendar, User, Loader2, Search, Pencil, Trash2, Activity, Plus, Store, Gift, ShoppingCart, Phone, CalendarRange } from 'lucide-react';
import AddPromoDialog from '@/components/promo/AddPromoDialog';
import { format } from 'date-fns';
import { ar, fr, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import { useLogActivity, useMyActivityLogs } from '@/hooks/useActivityLogs';
import { ACTION_TYPES, ENTITY_TYPES } from '@/types/activityLog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import PermissionGate from '@/components/auth/PermissionGate';
import { useIsElementHidden } from '@/hooks/useUIOverrides';
import { isOfferCurrentlyActive } from '@/utils/productOffers';
import { useWorkerFrozenStatus } from '@/hooks/useWorkerFrozenStatus';
import FrozenWorkerBadge from '@/components/workers/FrozenWorkerBadge';
import { useAccountingDateRange } from '@/hooks/useAccountingDateRange';

type OfferSnapshot = {
  id: string;
  product_id: string;
  name: string;
  min_quantity: number | null;
  min_quantity_unit: 'box' | 'piece' | null;
  gift_quantity: number | null;
  gift_quantity_unit: 'box' | 'piece' | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean | null;
  priority: number | null;
};

const getDateLocale = (language: string) => {
  switch (language) {
    case 'fr': return fr;
    case 'en': return enUS;
    default: return ar;
  }
};

// Format pieces as box.pieces (b.p) — e.g. 25 pieces with ppb=20 → "1.05"
const formatBP = (pieces: number, piecesPerBox: number | null | undefined): string => {
  const ppb = Number(piecesPerBox || 0);
  const p = Number(pieces || 0);
  if (!ppb || ppb <= 1) return `${p}.00`;
  const boxes = Math.floor(p / ppb);
  const rem = p % ppb;
  return `${boxes}.${String(rem).padStart(2, '0')}`;
};

// Format a stored "pieces" value according to a unit (box/piece) defined by the offer
const formatByUnit = (
  storedPieces: number,
  unit: 'box' | 'piece' | string | null | undefined,
  piecesPerBox: number | null | undefined,
): string => {
  const ppb = Number(piecesPerBox || 0);
  const p = Number(storedPieces || 0);
  if (unit === 'box' && ppb > 1) {
    // عرض بالصناديق إذا كان كاملاً، وإلا بصيغة b.p
    if (p % ppb === 0) return String(p / ppb);
    return formatBP(p, ppb);
  }
  // قطعة: نعرض الرقم كما هو
  return String(p);
};

const unitLabel = (u: 'box' | 'piece' | string | null | undefined) =>
  u === 'box' ? 'صندوق' : 'قطعة';

const MyPromosContent: React.FC = () => {
  const [deletePromo, setDeletePromo] = useState<PromoWithDetails | null>(null);
  const { workerId, activeBranch } = useAuth();
  const { data: frozenStatus } = useWorkerFrozenStatus(workerId);
  const isFrozen = !!frozenStatus?.isFrozen;
  const { t, language } = useLanguage();
  const [promos, setPromos] = useState<PromoWithDetails[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<OfferSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Accounting Filtering — same logic as /my-achievements
  const today = format(new Date(), 'yyyy-MM-dd');
  const [periodFrom, setPeriodFrom] = useState<string>(today);
  const [periodTo, setPeriodTo] = useState<string>(today);
  const [showPeriodDialog, setShowPeriodDialog] = useState(false);
  const { lowerBound, upperBound, isLoading: boundsLoading } = useAccountingDateRange(workerId, periodFrom, periodTo);

  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoWithDetails | null>(null);
  const [editVente, setEditVente] = useState(0);
  const [editGratuite, setEditGratuite] = useState(0);
  const [editCustomer, setEditCustomer] = useState('');
  const [editProduct, setEditProduct] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Add promo dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailGroup, setDetailGroup] = useState<{ promos: PromoWithDetails[]; offer: any; ppb: number; productName: string; productImage: string | null; offerDescription: string; totalSaleBP: string; totalGiftBP: string } | null>(null);

  const logActivity = useLogActivity();
  const { data: myLogs } = useMyActivityLogs();

  // UI override checks — معطّلة بناءً على طلب المستخدم: العمال يمكنهم العرض فقط
  const isAddPromoHidden = true;
  const isEditPromoHidden = true;
  const isDeletePromoHidden = true;

  useEffect(() => {
    if (workerId && !boundsLoading) {
      fetchData();
    }
  }, [workerId, activeBranch, lowerBound, upperBound, boundsLoading]);

  const fetchData = async () => {
    try {
      const [promosRes, customersRes, productsRes, offersRes] = await Promise.all([
        supabase
          .from('promos')
          .select(`*, customer:customers(*), product:products(*), offer:product_offers(id, name, min_quantity_unit, gift_quantity_unit, min_quantity, gift_quantity), order:orders(status)`)
          .eq('worker_id', workerId)
          .gte('created_at', lowerBound)
          .lte('created_at', upperBound)
          .order('promo_date', { ascending: false }),
        supabase.from('customers').select('*').order('name'),
        supabase.from('products').select('*').eq('is_active', true).order('sort_order', { ascending: true }).order('name'),
        supabase
          .from('product_offers')
          .select('id, product_id, name, min_quantity, min_quantity_unit, gift_quantity, gift_quantity_unit, start_date, end_date, is_active, priority')
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false }),
      ]);

      if (promosRes.error) throw promosRes.error;
      if (customersRes.error) throw customersRes.error;
      if (productsRes.error) throw productsRes.error;

      // Hide promos that are tied to an order which has NOT been delivered yet
      // (e.g. just-created orders that are still pending/assigned).
      promosRes.data = (promosRes.data || []).filter((p: any) =>
        !p.order_id || !p.order || p.order.status === 'delivered'
      );

      // Load first tier per offer (tiers are source of truth for units/quantities)
      const allOfferIds = Array.from(new Set([
        ...((offersRes.data || []).map((o: any) => o.id)),
        ...((promosRes.data || []).map((p: any) => p.offer?.id).filter(Boolean)),
      ]));
      let tiersByOffer: Record<string, any> = {};
      if (allOfferIds.length > 0) {
        const { data: tiersData } = await supabase
          .from('product_offer_tiers')
          .select('offer_id, min_quantity, min_quantity_unit, gift_quantity, gift_quantity_unit, tier_order')
          .in('offer_id', allOfferIds)
          .order('tier_order', { ascending: true });
        (tiersData || []).forEach((t: any) => {
          if (!tiersByOffer[t.offer_id]) tiersByOffer[t.offer_id] = t;
        });
      }
      const applyTier = (o: any) => {
        if (!o) return o;
        const t = tiersByOffer[o.id];
        if (!t) return o;
        return {
          ...o,
          min_quantity: t.min_quantity ?? o.min_quantity,
          min_quantity_unit: t.min_quantity_unit ?? o.min_quantity_unit,
          gift_quantity: t.gift_quantity ?? o.gift_quantity,
          gift_quantity_unit: t.gift_quantity_unit ?? o.gift_quantity_unit,
        };
      };

      const promosWithTiers = (promosRes.data || []).map((p: any) => ({
        ...p,
        offer: applyTier(p.offer),
      }));
      setPromos(promosWithTiers as PromoWithDetails[]);
      if (customersRes.data) setCustomers(customersRes.data);
      if (productsRes.data) setProducts(productsRes.data);
      setOffers(((offersRes.data || []) as any[]).map(applyTier) as OfferSnapshot[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('stats.load_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (promo: PromoWithDetails) => {
    setEditingPromo(promo);
    setEditVente(promo.vente_quantity);
    setEditGratuite(promo.gratuite_quantity);
    setEditCustomer(promo.customer_id);
    setEditProduct(promo.product_id);
    setEditNotes(promo.notes || '');
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPromo) return;
    if (isFrozen) {
      toast.error('لا يمكن تعديل عروض الأسعار - الحساب مجمَّد بسبب عجز غير مسدَّد');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('promos')
        .update({
          vente_quantity: editVente,
          gratuite_quantity: editGratuite,
          customer_id: editCustomer,
          product_id: editProduct,
          notes: editNotes || null,
        })
        .eq('id', editingPromo.id);

      if (error) throw error;

      // Log activity
      await logActivity.mutateAsync({
        actionType: 'update',
        entityType: 'promo',
        entityId: editingPromo.id,
        details: {
          [t('common.sale_quantity')]: editVente,
          [t('common.free_quantity')]: editGratuite,
        },
      });

      toast.success(t('common.operation_updated'));
      setShowEditDialog(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (promo: PromoWithDetails) => {
    if (isFrozen) {
      toast.error('لا يمكن حذف عروض الأسعار - الحساب مجمَّد بسبب عجز غير مسدَّد');
      return;
    }

    try {
      const { error } = await supabase
        .from('promos')
        .delete()
        .eq('id', promo.id);

      if (error) throw error;

      // Log activity
      await logActivity.mutateAsync({
        actionType: 'delete',
        entityType: 'promo',
        entityId: promo.id,
        details: {
          [t('print.customer')]: promo.customer?.name,
          [t('products.name')]: promo.product?.name,
        },
      });

      toast.success(t('common.operation_deleted'));
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Filter promos based on search query
  const filteredPromos = useMemo(() => {
    if (!searchQuery.trim()) return promos;
    
    const query = searchQuery.toLowerCase();
    return promos.filter((promo) => 
      promo.customer?.name?.toLowerCase().includes(query) ||
      promo.product?.name?.toLowerCase().includes(query) ||
      promo.customer?.wilaya?.toLowerCase().includes(query) ||
      promo.notes?.toLowerCase().includes(query)
    );
  }, [promos, searchQuery]);

  const totalVente = useMemo(() => 
    filteredPromos.reduce((sum, p) => sum + p.vente_quantity, 0), 
    [filteredPromos]
  );
  
  const totalGratuite = useMemo(() => 
    filteredPromos.reduce((sum, p) => sum + p.gratuite_quantity, 0), 
    [filteredPromos]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <FrozenWorkerBadge workerId={workerId} />
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-l from-primary to-primary/80 text-primary-foreground">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-primary-foreground/80 text-sm">{t('common.sales')}</p>
              <p className="text-3xl font-bold">{totalVente}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-l from-green-600 to-green-500 text-white">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-white/80 text-sm">{t('common.free')}</p>
              <p className="text-3xl font-bold">{totalGratuite}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add New Promo Button */}
      {!isAddPromoHidden && (
        <Button 
          onClick={() => setShowAddDialog(true)} 
          className="w-full gap-2"
          size="lg"
        >
          <Plus className="w-5 h-5" />
          {t('promos.add_new')}
        </Button>
      )}

      {/* Tabs */}
      <Tabs defaultValue="promos" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="promos">{t('common.my_operations')}</TabsTrigger>
          <TabsTrigger value="activity">{t('common.events')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="promos" className="space-y-4 mt-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('common.search_placeholder')}
              className="pr-10 text-right"
            />
          </div>

          {/* Promos List */}
          <div>
            <h3 className="text-lg font-bold mb-3">{t('common.promo_record')} ({filteredPromos.length})</h3>
            
            {filteredPromos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{searchQuery ? t('common.no_results') : t('common.no_promos')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  // Group promos by product_id, preserving original order (latest first)
                  const groups: { key: string; promos: typeof filteredPromos }[] = [];
                  const groupIndex: Record<string, number> = {};
                  filteredPromos.forEach((p) => {
                    const key = p.product_id || p.id;
                    if (groupIndex[key] === undefined) {
                      groupIndex[key] = groups.length;
                      groups.push({ key, promos: [p] });
                    } else {
                      groups[groupIndex[key]].promos.push(p);
                    }
                  });
                  return groups.map((group) => {
                    const first = group.promos[0];
                    const explicitOffer: any = (first as any).offer;
                    const promoSaleUnit = (first as any).sale_quantity_unit as 'box' | 'piece' | undefined;
                    const promoGiftUnit = (first as any).gift_quantity_unit as 'box' | 'piece' | undefined;
                    const inferredOffer = !explicitOffer && first.product_id
                      ? offers
                          .filter((offer) => offer.product_id === first.product_id)
                          .find((offer) => isOfferCurrentlyActive(offer, new Date(first.promo_date)))
                      : null;
                    const offer = explicitOffer || inferredOffer;
                    const saleUnit = (promoSaleUnit || offer?.min_quantity_unit || 'piece') as 'box' | 'piece';
                    const giftUnit = (promoGiftUnit || offer?.gift_quantity_unit || 'piece') as 'box' | 'piece';
                    const ppb = Number(first.product?.pieces_per_box || 0);
                     const offerSaleBP = offer ? formatBP(saleUnit === 'box' ? Number(offer.min_quantity || 0) * ppb : Number(offer.min_quantity || 0), ppb) : '';
                     const offerGiftBP = offer ? formatBP(giftUnit === 'box' ? Number(offer.gift_quantity || 0) * ppb : Number(offer.gift_quantity || 0), ppb) : '';
                     // Totals across all customers in this product group
                     const totalSalePieces = group.promos.reduce((sum, p) => {
                       const u = ((p as any).sale_quantity_unit || offer?.min_quantity_unit || 'piece') as 'box' | 'piece';
                       return sum + (u === 'box' ? Number(p.vente_quantity || 0) * ppb : Number(p.vente_quantity || 0));
                     }, 0);
                     const totalGiftPieces = group.promos.reduce((sum, p) => {
                       const u = ((p as any).gift_quantity_unit || offer?.gift_quantity_unit || 'piece') as 'box' | 'piece';
                       return sum + (u === 'box' ? Number(p.gratuite_quantity || 0) * ppb : Number(p.gratuite_quantity || 0));
                     }, 0);
                     const totalSaleBP = formatBP(totalSalePieces, ppb);
                     const totalGiftBP = formatBP(totalGiftPieces, ppb);
                    const offerDescription = offer
                      ? `${Number(offer.min_quantity || 0)} ${saleUnit === 'box' ? 'BOX' : 'PIECE'} + ${Number(offer.gift_quantity || 0)} ${giftUnit === 'box' ? 'BOX' : 'PIECE'} ( PROMO )`
                      : '';
                    return (
                      <Card key={group.key} className="overflow-hidden border-r-4 border-r-primary hover:shadow-md transition-shadow">
                        <CardContent className="p-0">
                          {/* Shared product header (clickable) */}
                          <button
                            type="button"
                            onClick={() => setDetailGroup({ promos: group.promos, offer, ppb, productName: first.product?.name || '', productImage: first.product?.image_url || null, offerDescription, totalSaleBP, totalGiftBP })}
                            className="w-full text-start bg-gradient-to-l from-primary/10 to-transparent px-4 py-2.5 flex items-center gap-3 hover:bg-primary/5 transition-colors cursor-pointer"
                          >
                            {first.product?.image_url ? (
                              <img
                                src={first.product.image_url}
                                alt={first.product?.name || ''}
                                className="w-12 h-12 rounded-md object-cover border border-border shrink-0"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-md border border-border bg-muted flex items-center justify-center shrink-0">
                                <Package className="w-5 h-5 text-primary" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 space-y-1">
                              <span className="font-bold text-base truncate block">{first.product?.name}</span>
                              {offer && (
                                <span className="text-xs font-semibold text-muted-foreground truncate block">{offerDescription}</span>
                              )}
                              <span className="text-[11px] text-muted-foreground block">
                                {group.promos.length} {language === 'fr' ? 'clients' : language === 'en' ? 'customers' : 'زبائن'}
                              </span>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 text-[11px]">
                                <ShoppingCart className="w-3 h-3" />
                                <span className="font-semibold">{totalSaleBP}</span>
                              </span>
                              <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 rounded-full px-2 py-0.5 text-[11px]">
                                <Gift className="w-3 h-3" />
                                <span className="font-semibold">{totalGiftBP}</span>
                              </span>
                            </div>
                          </button>
                        </CardContent>
                      </Card>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="activity" className="mt-4">
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-3">
              {myLogs?.map((log) => (
                <Card key={log.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">
                        {ACTION_TYPES[log.action_type] || log.action_type}
                      </Badge>
                      <Badge variant="secondary">
                        {ENTITY_TYPES[log.entity_type] || log.entity_type}
                      </Badge>
                    </div>
                    {log.details && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {Object.entries(log.details).map(([key, value]) => (
                          <span key={key} className="mr-2">{key}: {String(value)}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: getDateLocale(language) })}
                    </p>
                  </CardContent>
                </Card>
              ))}
              
              {(!myLogs || myLogs.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{t('common.no_events')}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('common.edit_operation')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('print.customer')}</Label>
              <Select value={editCustomer} onValueChange={setEditCustomer}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>{t('products.name')}</Label>
              <Select value={editProduct} onValueChange={setEditProduct}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('common.sale_quantity')}</Label>
                <Input
                  type="number"
                  value={editVente}
                  onChange={(e) => setEditVente(Number(e.target.value))}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('common.free_quantity')}</Label>
                <Input
                  type="number"
                  value={editGratuite}
                  onChange={(e) => setEditGratuite(Number(e.target.value))}
                  min={0}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>{t('common.notes')}</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="text-right"
              />
            </div>
            
            <Button onClick={handleSaveEdit} className="w-full" disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
              {t('common.save_changes')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Add Promo Dialog */}
      <AddPromoDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        product={selectedProduct}
        onSuccess={() => {
          fetchData();
          setSelectedProduct(null);
        }}
      />
      {/* Confirm Delete Dialog */}
      <AlertDialog open={!!deletePromo} onOpenChange={() => setDeletePromo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Trash2 className="w-5 h-5 text-destructive" />{t('promos.delete_record')}</AlertDialogTitle>
            <AlertDialogDescription>{t('promos.delete_confirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deletePromo) handleDelete(deletePromo); setDeletePromo(null); }}>{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!detailGroup} onOpenChange={(open) => !open && setDetailGroup(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{detailGroup?.productName}</DialogTitle>
          </DialogHeader>
          {detailGroup && (
            <div className="bg-gradient-to-l from-primary/10 to-transparent px-4 py-2.5 flex items-center gap-3 border-b sticky top-0 z-10 pe-10">
              {detailGroup.productImage ? (
                <img
                  src={detailGroup.productImage}
                  alt={detailGroup.productName}
                  className="w-12 h-12 rounded-md object-cover border border-border shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="w-12 h-12 rounded-md border border-border bg-muted flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-1">
                <span className="font-bold text-base truncate block">{detailGroup.productName}</span>
                {detailGroup.offer && (
                  <span className="text-xs font-semibold text-muted-foreground truncate block">{detailGroup.offerDescription}</span>
                )}
                <span className="text-[11px] text-muted-foreground block">
                  {detailGroup.promos.length} {language === 'fr' ? 'clients' : language === 'en' ? 'customers' : 'زبائن'}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 text-[11px]">
                  <ShoppingCart className="w-3 h-3" />
                  <span className="font-semibold">{detailGroup.totalSaleBP}</span>
                </span>
                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 rounded-full px-2 py-0.5 text-[11px]">
                  <Gift className="w-3 h-3" />
                  <span className="font-semibold">{detailGroup.totalGiftBP}</span>
                </span>
              </div>
            </div>
          )}
          {detailGroup && (
            <div className="divide-y divide-border/60">
              {detailGroup.promos.map((promo) => {
                const offer = detailGroup.offer;
                const ppb = detailGroup.ppb;
                const storeName = (language === 'fr' && promo.customer?.store_name_fr)
                  ? promo.customer?.store_name_fr
                  : promo.customer?.store_name;
                const pSaleUnit = ((promo as any).sale_quantity_unit || offer?.min_quantity_unit || 'piece') as 'box' | 'piece';
                const pGiftUnit = ((promo as any).gift_quantity_unit || offer?.gift_quantity_unit || 'piece') as 'box' | 'piece';
                const salePieces = pSaleUnit === 'box' ? Number(promo.vente_quantity || 0) * ppb : Number(promo.vente_quantity || 0);
                const giftPieces = pGiftUnit === 'box' ? Number(promo.gratuite_quantity || 0) * ppb : Number(promo.gratuite_quantity || 0);
                const displaySale = formatBP(salePieces, ppb);
                const displayGift = formatBP(giftPieces, ppb);
                return (
                  <div key={promo.id} className="p-4 space-y-3 relative" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                    <div className="absolute top-2 end-2 flex items-center gap-1">
                      {!isEditPromoHidden && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(promo)} disabled={isFrozen}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {!isDeletePromoHidden && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletePromo(promo)} disabled={isFrozen}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    {storeName && (
                      <div className="flex items-start gap-2 min-w-0 pb-2 border-b border-border/60 pe-16">
                        <Store className="w-4 h-4 text-amber-600 shrink-0 mt-1" />
                        <div className="flex-1 min-w-0 space-y-1">
                          <span className="font-bold truncate block text-base">{storeName}</span>
                          <div className="flex items-center gap-1 text-xs min-w-0">
                            <Calendar className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">
                              <span className="text-foreground font-medium">{format(new Date(promo.promo_date), 'dd MMM yyyy', { locale: getDateLocale(language) })}</span>
                              <span className="text-muted-foreground mx-1">-</span>
                              <span className="text-red-600 dark:text-red-400 font-semibold">{format(new Date(promo.promo_date), 'HH:mm')}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4 divide-x divide-border/60 [&>*:nth-child(2)]:pr-4 [&>*:nth-child(1)]:pl-4">
                      <div className="order-1 space-y-2">
                        <div className="flex items-center gap-2 text-base min-w-0">
                          <User className="w-4 h-4 shrink-0 text-muted-foreground" />
                          <span className="truncate font-bold">{(language === 'fr' && promo.customer?.name_fr) ? promo.customer.name_fr : promo.customer?.name}</span>
                        </div>
                        {promo.customer?.phone && (
                          <div className="flex items-center gap-2 text-base min-w-0">
                            <Phone className="w-4 h-4 shrink-0 text-muted-foreground" />
                            <span dir="ltr" className="truncate font-bold">{promo.customer.phone}</span>
                          </div>
                        )}
                      </div>
                      <div className="order-2 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="w-4 h-4 text-primary shrink-0" />
                          <p className="font-bold text-primary leading-none text-base">
                            {displaySale} <span className="font-bold">({language === 'fr' ? 'vente' : language === 'en' ? 'sale' : 'بيع'})</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Gift className={`w-4 h-4 shrink-0 ${promo.gratuite_quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
                          <p className={`font-bold leading-none text-base ${promo.gratuite_quantity > 0 ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>
                            {displayGift} <span className="font-bold">({language === 'fr' ? 'promo' : language === 'en' ? 'promo' : 'برومو'})</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    {promo.notes && (
                      <p className="text-xs text-muted-foreground bg-muted/40 p-2 rounded border-r-2 border-muted-foreground/30">
                        {promo.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const MyPromos: React.FC = () => {
  return (
    <PermissionGate 
      requiredPermissions={['page_my_promos', 'view_promos', 'create_promos']}
      redirectTo="/"
    >
      <MyPromosContent />
    </PermissionGate>
  );
};

export default MyPromos;
