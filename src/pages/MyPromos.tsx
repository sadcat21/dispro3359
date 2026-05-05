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
import { Package, Calendar, User, Loader2, Search, Pencil, Trash2, Activity, Plus, Store, Gift, ShoppingCart } from 'lucide-react';
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
  if (!ppb || ppb <= 1) return String(p);
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
  const { t, language } = useLanguage();
  const [promos, setPromos] = useState<PromoWithDetails[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<OfferSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
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

  const logActivity = useLogActivity();
  const { data: myLogs } = useMyActivityLogs();

  // UI override checks — معطّلة بناءً على طلب المستخدم: العمال يمكنهم العرض فقط
  const isAddPromoHidden = true;
  const isEditPromoHidden = true;
  const isDeletePromoHidden = true;

  useEffect(() => {
    if (workerId) {
      fetchData();
    }
  }, [workerId, activeBranch]);

  const fetchData = async () => {
    try {
      const [promosRes, customersRes, productsRes, offersRes] = await Promise.all([
        supabase
          .from('promos')
          .select(`*, customer:customers(*), product:products(*), offer:product_offers(id, name, min_quantity_unit, gift_quantity_unit, min_quantity, gift_quantity)`)
          .eq('worker_id', workerId)
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
      setPromos((promosRes.data || []) as PromoWithDetails[]);
      if (customersRes.data) setCustomers(customersRes.data);
      if (productsRes.data) setProducts(productsRes.data);
      setOffers((offersRes.data || []) as OfferSnapshot[]);
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
                {filteredPromos.map((promo) => {
                  const storeName = (language === 'fr' && promo.customer?.store_name_fr)
                    ? promo.customer?.store_name_fr
                    : promo.customer?.store_name;
                  return (
                  <Card key={promo.id} className="overflow-hidden border-r-4 border-r-primary hover:shadow-md transition-shadow">
                    <CardContent className="p-0">
                      {/* Header: Product name */}
                      <div className="bg-gradient-to-l from-primary/10 to-transparent px-4 py-2.5 border-b flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Package className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-bold text-base truncate">{promo.product?.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!isEditPromoHidden && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(promo)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {!isDeletePromoHidden && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletePromo(promo)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Body */}
                      <div className="p-4 space-y-3">
                        {(() => {
                          const explicitOffer: any = (promo as any).offer;
                          const promoSaleUnit = (promo as any).sale_quantity_unit as 'box' | 'piece' | undefined;
                          const promoGiftUnit = (promo as any).gift_quantity_unit as 'box' | 'piece' | undefined;
                          const inferredOffer = !explicitOffer && promo.product_id
                            ? offers
                                .filter((offer) => offer.product_id === promo.product_id)
                                .find((offer) => isOfferCurrentlyActive(offer, new Date(promo.promo_date)))
                            : null;
                          const offer = explicitOffer || inferredOffer;
                          const saleUnit = (promoSaleUnit || offer?.min_quantity_unit || 'piece') as 'box' | 'piece';
                          const giftUnit = (promoGiftUnit || offer?.gift_quantity_unit || 'piece') as 'box' | 'piece';
                          // عرض الكميات بصيغة b.P (صناديق.قطع)
                          const ppb = Number(promo.product?.pieces_per_box || 0);
                          const salePieces = saleUnit === 'box' ? Number(promo.vente_quantity || 0) * ppb : Number(promo.vente_quantity || 0);
                          const giftPieces = giftUnit === 'box' ? Number(promo.gratuite_quantity || 0) * ppb : Number(promo.gratuite_quantity || 0);
                          const displaySale = formatBP(salePieces, ppb);
                          const displayGift = formatBP(giftPieces, ppb);
                          return (
                            <>
                              {offer && (
                                <div className="text-[11px] bg-muted/40 rounded-md py-1.5 px-2 border border-border flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold truncate text-muted-foreground">{offer.name}:</span>
                                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
                                    <ShoppingCart className="w-3 h-3" />
                                    <span className="font-semibold">{offer.min_quantity} {unitLabel(saleUnit)}</span>
                                  </span>
                                  <span className="text-muted-foreground">→</span>
                                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 rounded-full px-2 py-0.5">
                                    <Gift className="w-3 h-3" />
                                    <span className="font-semibold">{offer.gift_quantity} {unitLabel(giftUnit)}</span>
                                  </span>
                                </div>
                              )}
                              {/* Quantities (display per offer unit) */}
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                                  <ShoppingCart className="w-4 h-4 text-primary shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{t('common.sales')} ({unitLabel(saleUnit)})</p>
                                    <p className="font-bold text-primary leading-none">
                                      {displaySale}
                                    </p>
                                  </div>
                                </div>
                                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${promo.gratuite_quantity > 0 ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-muted/30 border-muted'}`}>
                                  <Gift className={`w-4 h-4 shrink-0 ${promo.gratuite_quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
                                  <div className="min-w-0">
                                    <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{t('common.free')} ({unitLabel(giftUnit)})</p>
                                    <p className={`font-bold leading-none ${promo.gratuite_quantity > 0 ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>
                                      {displayGift}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                        {/* Customer info */}
                        <div className="space-y-1.5 bg-muted/30 rounded-lg p-2.5">
                          {storeName && (
                            <div className="flex items-center gap-2 text-sm">
                              <Store className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="font-semibold truncate">{storeName}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="w-4 h-4 shrink-0" />
                            <span className="truncate">{promo.customer?.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            <span>{format(new Date(promo.promo_date), 'dd MMM yyyy - HH:mm', { locale: getDateLocale(language) })}</span>
                          </div>
                        </div>

                        {promo.notes && (
                          <p className="text-xs text-muted-foreground bg-muted/40 p-2 rounded border-r-2 border-muted-foreground/30">
                            {promo.notes}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
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
        <DialogContent className="max-w-sm" dir="rtl">
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
