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
                    <Card key={(product as any)?.id || productOffers[0].id} className="flex flex-col h-full">
                      <CardHeader className="pb-2">
                        <div className="flex items-start gap-3">
                          {(product as any)?.image_url ? (
                            <img
                              src={(product as any).image_url}
                              alt={(product as any)?.name || ''}
                              className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover border shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Package className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm sm:text-base truncate">
                              {getProductDisplayName(product as any) || (product as any)?.name}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {productOffers.length} {productOffers.length === 1 ? 'مجموعة عرض' : 'مجموعات عروض'}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
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
                              "rounded-lg border p-2.5 space-y-2",
                              !offer.is_active && "opacity-60 bg-muted/30"
                            )}>
                              {/* Group header */}
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                  <Badge className="bg-primary/10 text-primary border-primary/30" variant="outline">
                                    مجموعة {gIndex + 1}
                                  </Badge>
                                  <span className="text-xs font-medium truncate">{offer.name}</span>
                                  {offer.is_stackable && (
                                    <Badge variant="outline" className="text-[10px] gap-1">
                                      <Layers className="w-3 h-3" />
                                      {t('offers.stackable')}
                                    </Badge>
                                  )}
                                </div>
                                <Switch
                                  checked={offer.is_active}
                                  onCheckedChange={(checked) => toggleOfferStatus(offer.id, checked)}
                                />
                              </div>

                              {/* Dates */}
                              {(offer.start_date || offer.end_date) && (
                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <Calendar className="w-3 h-3" />
                                  {offer.start_date && format(new Date(offer.start_date), 'dd MMM yyyy', { locale: dateLocale })}
                                  {offer.start_date && offer.end_date && ' - '}
                                  {offer.end_date && format(new Date(offer.end_date), 'dd MMM yyyy', { locale: dateLocale })}
                                </div>
                              )}

                              {/* Tiers (slides) */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {tiers.map((tier: any, index: number) => (
                                  <div key={index} className="flex flex-wrap items-center gap-1 p-1.5 bg-muted/50 rounded text-xs">
                                    <Badge variant="outline" className="text-[10px] px-1.5">
                                      شريحة {index + 1}
                                    </Badge>
                                    <Badge variant="secondary" className="text-[10px] px-1.5">
                                      اشتري {tier.min_quantity}{tier.max_quantity ? `-${tier.max_quantity}` : '+'}
                                    </Badge>
                                    <Badge className="bg-accent text-accent-foreground text-[10px] px-1.5">
                                      → {tier.gift_type === 'same_product'
                                        ? `${tier.gift_quantity} ${t('offers.free_units')}`
                                        : tier.gift_type === 'different_product' && tier.gift_product
                                        ? `${tier.gift_quantity} ${getProductDisplayName(tier.gift_product)}`
                                        : `${tier.discount_percentage}%`}
                                    </Badge>
                                    {tier.worker_reward_type !== 'none' && tier.worker_reward_amount > 0 && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 gap-1">
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
                              <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t">
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleEdit(offer)}>
                                  <Edit2 className="w-3 h-3 me-1" />
                                  {t('common.edit')}
                                </Button>
                                {canManage ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => setExtendTarget({
                                      offerId: offer.id,
                                      offerName: offer.name,
                                      tierId: null,
                                      tierLabel: null,
                                      mode: isOfferRunning(offer) ? 'extend' : 'resume',
                                    })}
                                  >
                                    {isOfferRunning(offer) ? <><Clock className="w-3 h-3 me-1" />تمديد</> : <><PlayCircle className="w-3 h-3 me-1" />استئناف</>}
                                  </Button>
                                ) : <span />}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs text-destructive hover:text-destructive"
                                  onClick={() => setDeleteConfirm(offer.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
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
