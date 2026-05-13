import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { 
  Gift, Plus, Search, Edit2, Trash2, Package, 
  Calendar, Users, Layers, ArrowLeft, Clock, PlayCircle, Settings2
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProductOffers } from '@/hooks/useProductOffers';
import { ProductOfferWithDetails } from '@/types/productOffer';
import CreateOfferDialog from '@/components/offers/CreateOfferDialog';
import ExtendOfferDialog from '@/components/offers/ExtendOfferDialog';
import GlobalOfferSettingsDialog from '@/components/offers/GlobalOfferSettingsDialog';
import { format } from 'date-fns';
import { ar, fr, enUS } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useIsElementHidden } from '@/hooks/useUIOverrides';
import { isAdminRole, isCompanyManagerRole } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getProductDisplayName } from '@/utils/productDisplayName';

const ProductOffers: React.FC = () => {
  const { t, language, dir } = useLanguage();
  const { role, activeRole } = useAuth();
  const navigate = useNavigate();
  const { offers, isLoading, fetchOffers, deleteOffer, toggleOfferStatus } = useProductOffers();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [editOffer, setEditOffer] = useState<ProductOfferWithDetails | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [extendTarget, setExtendTarget] = useState<{
    offerId: string;
    offerName: string;
    tierId: string | null;
    tierLabel: string | null;
    mode: 'extend' | 'resume';
  } | null>(null);

  const dateLocale = language === 'ar' ? ar : language === 'fr' ? fr : enUS;

  /** هل العرض ما زال شغّالاً ضمن فترته؟ */
  const isOfferRunning = (offer: ProductOfferWithDetails): boolean => {
    if (!offer.is_active) return false;
    const now = new Date();
    const start = offer.start_date ? new Date(offer.start_date) : null;
    const end = offer.end_date ? new Date(offer.end_date) : null;
    if (start && now < start) return false;
    if (end && now > end) return false;
    return true;
  };
  
  const isAdmin = isAdminRole(role);
  const isBranchAdmin = role === 'branch_admin';
  const isCompanyManager = isCompanyManagerRole(activeRole?.custom_role_code);
  const canManage = isAdmin || isBranchAdmin || isCompanyManager;
  const isAddOfferHidden = useIsElementHidden('button', 'add_offer');

  useEffect(() => {
    if (!canManage) {
      navigate('/');
    }
  }, [canManage, navigate]);

  const filteredOffers = offers.filter(offer => 
    offer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    offer.product?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isExpired = (o: ProductOfferWithDetails) => {
    if (!o.end_date) return false;
    const end = new Date(o.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return end < today;
  };
  const activeOffers = filteredOffers.filter(o => o.is_active && !isExpired(o));
  const expiredOffers = filteredOffers.filter(o => isExpired(o));
  const inactiveOffers = filteredOffers.filter(o => !o.is_active && !isExpired(o));
  const [statusTab, setStatusTab] = useState<'active' | 'inactive' | 'expired' | 'all'>('active');

  const handleEdit = (offer: ProductOfferWithDetails) => {
    setEditOffer(offer);
    setShowCreateDialog(true);
  };

  const handleDelete = async (id: string) => {
    await deleteOffer(id);
    setDeleteConfirm(null);
  };

  const getGiftText = (offer: ProductOfferWithDetails) => {
    if (offer.gift_type === 'same_product') {
      return `${offer.gift_quantity} ${t('offers.free_units')}`;
    } else if (offer.gift_type === 'different_product' && offer.gift_product) {
      return `${offer.gift_quantity} ${getProductDisplayName(offer.gift_product)}`;
    } else if (offer.gift_type === 'discount') {
      return `${offer.discount_percentage}% ${t('offers.discount')}`;
    }
    return '';
  };

  const getWorkerRewardText = (offer: ProductOfferWithDetails) => {
    if (offer.worker_reward_type === 'none') return null;
    if (offer.worker_reward_type === 'fixed') {
      return `${offer.worker_reward_amount} ${t('currency.dzd')}`;
    }
    return `${offer.worker_reward_amount}%`;
  };

  return (
    <>
      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 max-w-7xl mx-auto" dir={dir}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
                <span className="truncate">{t('offers.management')}</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{t('offers.management_desc')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:flex items-center gap-2">
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setShowSettingsDialog(true)} className="sm:size-default">
                <Settings2 className="w-4 h-4 me-2" />
                <span className="truncate">إعدادات العروض</span>
              </Button>
            )}
            {!isAddOfferHidden && (
              <Button size="sm" onClick={() => setShowCreateDialog(true)} className="sm:size-default">
                <Plus className="w-4 h-4 me-2" />
                {t('offers.new')}
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('common.search')}
            className="ps-10"
          />
        </div>

        {/* Status Tabs */}
        <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as 'active' | 'inactive' | 'expired' | 'all')}>
          <TabsList className="w-full sm:w-auto overflow-x-auto flex h-auto flex-nowrap justify-start">
            <TabsTrigger value="active" className="text-xs sm:text-sm whitespace-nowrap">
              {t('common.active') || 'النشطة'} ({activeOffers.length})
            </TabsTrigger>
            <TabsTrigger value="inactive" className="text-xs sm:text-sm whitespace-nowrap">
              {t('common.inactive') || 'غير النشطة'} ({inactiveOffers.length})
            </TabsTrigger>
            <TabsTrigger value="expired" className="text-xs sm:text-sm whitespace-nowrap">
              منتهية ({expiredOffers.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs sm:text-sm whitespace-nowrap">
              الكل ({filteredOffers.length})
            </TabsTrigger>
          </TabsList>

          {(['active', 'inactive', 'expired', 'all'] as const).map((tabKey) => {
            const list = tabKey === 'active' ? activeOffers
              : tabKey === 'expired' ? expiredOffers
              : tabKey === 'inactive' ? inactiveOffers
              : filteredOffers;
            return (
              <TabsContent key={tabKey} value={tabKey} className="mt-3">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('common.loading')}
                  </div>
                ) : list.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Gift className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>{t('offers.no_offers')}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {Object.values(
                    list.reduce((acc: Record<string, { product: any; offers: typeof list }>, off) => {
                      const pid = off.product_id || off.id;
                      if (!acc[pid]) acc[pid] = { product: off.product, offers: [] as any };
                      acc[pid].offers.push(off);
                      return acc;
                    }, {})
                  ).map(({ product, offers: productOffers }) => (
                    <Card
                      key={(product as any)?.id || productOffers[0].id}
                      className="group flex flex-col h-full overflow-hidden border-border/60 bg-gradient-to-b from-card to-card/50 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300"
                    >
                      <CardHeader className="pb-3 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 border-b border-border/50">
                        <div className="flex items-center gap-3">
                          {(product as any)?.image_url ? (
                            <div className="relative shrink-0">
                              <img
                                src={(product as any).image_url}
                                alt={(product as any)?.name || ''}
                                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover ring-2 ring-background shadow-md"
                              />
                              <span className="absolute -bottom-1 -end-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ring-2 ring-background">
                                {productOffers.length}
                              </span>
                            </div>
                          ) : (
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-muted flex items-center justify-center shrink-0 ring-2 ring-background shadow-md">
                              <Package className="w-7 h-7 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm sm:text-base font-bold leading-tight line-clamp-2">
                              {getProductDisplayName(product as any) || (product as any)?.name}
                            </CardTitle>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Gift className="w-3 h-3 text-primary" />
                              <p className="text-[11px] text-muted-foreground">
                                {productOffers.length} {productOffers.length === 1 ? 'عرض نشط' : 'عروض نشطة'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2.5 pt-3 flex-1">
                        {productOffers.map((offer, gIndex) => {
                          const tiers = (offer.tiers && offer.tiers.length > 0 ? offer.tiers : [{
                            id: null,
                            min_quantity: offer.min_quantity,
                            max_quantity: offer.max_quantity,
                            gift_type: offer.gift_type,
                            gift_quantity: offer.gift_quantity,
                            gift_product: offer.gift_product,
                            discount_percentage: offer.discount_percentage,
                            worker_reward_type: offer.worker_reward_type,
                            worker_reward_amount: offer.worker_reward_amount,
                          }]) as any[];
                          return (
                            <div key={offer.id} className={cn(
                              "rounded-xl border border-border/60 bg-card overflow-hidden transition-all",
                              offer.is_active ? "shadow-sm hover:shadow-md hover:border-primary/40" : "opacity-60 bg-muted/20"
                            )}>
                              {/* Group header */}
                              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 border-b border-border/50">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <Badge className="bg-primary text-primary-foreground border-0 text-[10px] h-5 px-2 font-bold shrink-0">
                                    #{gIndex + 1}
                                  </Badge>
                                  <span className="text-xs font-semibold truncate">{offer.name}</span>
                                  {offer.is_stackable && (
                                    <Badge variant="outline" className="text-[10px] h-5 gap-0.5 px-1.5 shrink-0">
                                      <Layers className="w-2.5 h-2.5" />
                                    </Badge>
                                  )}
                                </div>
                                <Switch
                                  checked={offer.is_active}
                                  onCheckedChange={(checked) => toggleOfferStatus(offer.id, checked)}
                                  className="scale-75"
                                />
                              </div>

                              <div className="p-2.5 space-y-2">
                                {/* Dates */}
                                {(offer.start_date || offer.end_date) && (
                                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/30 rounded-md px-2 py-1">
                                    <Calendar className="w-3 h-3 text-primary" />
                                    <span className="font-medium">
                                      {offer.start_date && format(new Date(offer.start_date), 'dd MMM', { locale: dateLocale })}
                                      {offer.start_date && offer.end_date && ' ← '}
                                      {offer.end_date && format(new Date(offer.end_date), 'dd MMM yyyy', { locale: dateLocale })}
                                    </span>
                                  </div>
                                )}

                                {/* Tiers (slides) */}
                                <div className="space-y-1.5">
                                  {tiers.map((tier: any, index: number) => (
                                    <div key={index} className="flex flex-wrap items-center gap-1.5 p-2 bg-gradient-to-l from-primary/5 to-transparent border border-primary/10 rounded-lg text-xs">
                                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-background shrink-0">
                                        شريحة {index + 1}
                                      </Badge>
                                      <Badge variant="secondary" className="text-[10px] h-5 px-2 font-semibold">
                                        اشتري {tier.min_quantity}{tier.max_quantity ? `-${tier.max_quantity}` : '+'}
                                      </Badge>
                                      <span className="text-muted-foreground">←</span>
                                      <Badge className="bg-primary text-primary-foreground text-[10px] h-5 px-2 font-bold shadow-sm">
                                        {tier.gift_type === 'same_product'
                                          ? `+${tier.gift_quantity} ${t('offers.free_units')}`
                                          : tier.gift_type === 'different_product' && tier.gift_product
                                          ? `+${tier.gift_quantity} ${getProductDisplayName(tier.gift_product)}`
                                          : `${tier.discount_percentage}% خصم`}
                                      </Badge>
                                      {tier.worker_reward_type !== 'none' && tier.worker_reward_amount > 0 && (
                                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 ms-auto bg-accent/30">
                                          <Users className="w-2.5 h-2.5" />
                                          {tier.worker_reward_type === 'fixed'
                                            ? `${tier.worker_reward_amount}${t('currency.dzd')}`
                                            : `${tier.worker_reward_amount}%`}
                                        </Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {/* Actions */}
                                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-dashed">
                                  <Button variant="ghost" size="sm" className="h-8 text-xs hover:bg-primary/10 hover:text-primary" onClick={() => handleEdit(offer)}>
                                    <Edit2 className="w-3.5 h-3.5 me-1" />
                                    {t('common.edit')}
                                  </Button>
                                  {canManage ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 text-xs hover:bg-accent/30"
                                      onClick={() => setExtendTarget({
                                        offerId: offer.id,
                                        offerName: offer.name,
                                        tierId: null,
                                        tierLabel: null,
                                        mode: isOfferRunning(offer) ? 'extend' : 'resume',
                                      })}
                                    >
                                      {isOfferRunning(offer) ? <><Clock className="w-3.5 h-3.5 me-1" />تمديد</> : <><PlayCircle className="w-3.5 h-3.5 me-1" />استئناف</>}
                                    </Button>
                                  ) : <span />}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => setDeleteConfirm(offer.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      {/* Create/Edit Dialog */}
      <CreateOfferDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) setEditOffer(null);
        }}
        onSuccess={() => {
          fetchOffers();
          setEditOffer(null);
        }}
        editOffer={editOffer}
      />

      <GlobalOfferSettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
      />

      {/* Extend / Resume Dialog */}
      {extendTarget && (
        <ExtendOfferDialog
          open={!!extendTarget}
          onOpenChange={(open) => { if (!open) setExtendTarget(null); }}
          offerId={extendTarget.offerId}
          offerName={extendTarget.offerName}
          tierId={extendTarget.tierId}
          tierLabel={extendTarget.tierLabel}
          mode={extendTarget.mode}
          onSuccess={() => fetchOffers()}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('offers.delete_confirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('offers.delete_confirm_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProductOffers;
