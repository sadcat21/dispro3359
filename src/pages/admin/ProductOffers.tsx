import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
      <div className="p-4 space-y-4" dir={dir}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Gift className="w-6 h-6 text-primary" />
                {t('offers.management')}
              </h1>
              <p className="text-sm text-muted-foreground">{t('offers.management_desc')}</p>
            </div>
          </div>
          {!isAddOfferHidden && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 me-2" />
              {t('offers.new')}
            </Button>
          )}
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
          <TabsList>
            <TabsTrigger value="active">
              {t('common.active') || 'النشطة'} ({activeOffers.length})
            </TabsTrigger>
            <TabsTrigger value="inactive">
              {t('common.inactive') || 'غير النشطة'} ({inactiveOffers.length})
            </TabsTrigger>
            <TabsTrigger value="expired">
              منتهية ({expiredOffers.length})
            </TabsTrigger>
            <TabsTrigger value="all">
              الكل ({filteredOffers.length})
            </TabsTrigger>
          </TabsList>

          {(['active', 'inactive', 'expired', 'all'] as const).map((tabKey) => {
            const list = tabKey === 'active' ? activeOffers
              : tabKey === 'expired' ? expiredOffers
              : tabKey === 'inactive' ? inactiveOffers
              : filteredOffers;
            return (
              <TabsContent key={tabKey} value={tabKey} className="space-y-3">
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
                  list.map((offer) => (
                    <Card key={offer.id} className={!offer.is_active ? 'opacity-60' : ''}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {(offer.product as any)?.image_url ? (
                              <img
                                src={(offer.product as any).image_url}
                                alt={offer.product?.name || ''}
                                className="w-14 h-14 rounded-lg object-cover border shrink-0"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                <Package className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                                {offer.name}
                                {offer.is_stackable && (
                                  <Badge variant="outline" className="text-xs">
                                    <Layers className="w-3 h-3 me-1" />
                                    {t('offers.stackable')}
                                  </Badge>
                                )}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <Package className="w-3 h-3" />
                                {offer.product?.name}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={offer.is_active}
                            onCheckedChange={(checked) => toggleOfferStatus(offer.id, checked)}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Tiers */}
                        <div className="space-y-2">
                          {(offer.tiers && offer.tiers.length > 0 ? offer.tiers : [{
                            min_quantity: offer.min_quantity,
                            max_quantity: offer.max_quantity,
                            gift_type: offer.gift_type,
                            gift_quantity: offer.gift_quantity,
                            gift_product: offer.gift_product,
                            discount_percentage: offer.discount_percentage,
                            worker_reward_type: offer.worker_reward_type,
                            worker_reward_amount: offer.worker_reward_amount,
                          }]).map((tier: any, index: number) => (
                            <div key={index} className="flex flex-wrap items-center gap-2 p-2 bg-muted/50 rounded">
                              <Badge variant="outline" className="text-xs">
                                {t('offers.tier')} {index + 1}
                              </Badge>
                              <Badge variant="secondary">
                                {t('offers.buy')} {tier.min_quantity}
                                {tier.max_quantity ? `-${tier.max_quantity}` : '+'}
                              </Badge>
                              <Badge className="bg-accent text-accent-foreground">
                                → {tier.gift_type === 'same_product'
                                  ? `${tier.gift_quantity} ${t('offers.free_units')}`
                                  : tier.gift_type === 'different_product' && tier.gift_product
                                  ? `${tier.gift_quantity} ${getProductDisplayName(tier.gift_product)}`
                                  : `${tier.discount_percentage}% ${t('offers.discount')}`}
                              </Badge>
                              {tier.worker_reward_type !== 'none' && tier.worker_reward_amount > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  <Users className="w-3 h-3 me-1" />
                                  {tier.worker_reward_type === 'fixed'
                                    ? `${tier.worker_reward_amount} ${t('currency.dzd')}`
                                    : `${tier.worker_reward_amount}%`}
                                </Badge>
                              )}
                              {tier.id && canManage && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs ms-auto"
                                  onClick={() => setExtendTarget({
                                    offerId: offer.id,
                                    offerName: offer.name,
                                    tierId: tier.id,
                                    tierLabel: `${t('offers.tier')} ${index + 1}`,
                                    mode: isOfferRunning(offer) ? 'extend' : 'resume',
                                  })}
                                >
                                  {isOfferRunning(offer) ? (
                                    <><Clock className="w-3 h-3 me-1" />تمديد</>
                                  ) : (
                                    <><PlayCircle className="w-3 h-3 me-1" />استئناف</>
                                  )}
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Dates */}
                        {(offer.start_date || offer.end_date) && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            {offer.start_date && format(new Date(offer.start_date), 'dd MMM yyyy', { locale: dateLocale })}
                            {offer.start_date && offer.end_date && ' - '}
                            {offer.end_date && format(new Date(offer.end_date), 'dd MMM yyyy', { locale: dateLocale })}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleEdit(offer)}
                          >
                            <Edit2 className="w-4 h-4 me-2" />
                            {t('common.edit')}
                          </Button>
                          {canManage && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setExtendTarget({
                                offerId: offer.id,
                                offerName: offer.name,
                                tierId: null,
                                tierLabel: null,
                                mode: isOfferRunning(offer) ? 'extend' : 'resume',
                              })}
                            >
                              {isOfferRunning(offer) ? (
                                <><Clock className="w-4 h-4 me-2" />تمديد العرض</>
                              ) : (
                                <><PlayCircle className="w-4 h-4 me-2" />استئناف العرض</>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm(offer.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
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
