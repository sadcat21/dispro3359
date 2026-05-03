import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import { Search, UserPlus, User, ChevronLeft, ChevronRight, Loader2, X, Banknote, MapPin, Store, Building2, Home, Map as MapIcon, Navigation, Compass, Landmark, Tent, TreePine, Mountain, Waves, Sun, Star, Users } from 'lucide-react';
import { Customer, Sector } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocalizedName } from '@/utils/sectorName';
import CustomerSummary from '@/components/customers/CustomerSummary';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import ClientTrustBadge from '@/components/customers/ClientTrustBadge';
import { computeClientTrustScoreFromHistory } from '@/utils/clientTrustScore';

interface CustomerPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  sectors?: Sector[];
  isLoading?: boolean;
  selectedCustomerId?: string;
  onSelect: (customer: Customer) => void;
  onAddNew?: () => void;
}

interface SectorGroup {
  key: string;
  sectorId: string | null;
  sectorName: string;
  customers: Customer[];
}

const normalizeSectorGroupName = (name: string) => name.replace(/\s+/g, ' ').trim();

const CustomerPickerDialog: React.FC<CustomerPickerDialogProps> = ({
  open,
  onOpenChange,
  customers,
  sectors = [],
  isLoading,
  selectedCustomerId,
  onSelect,
  onAddNew,
}) => {
  const { t, dir, language } = useLanguage();
  const { activeBranch } = useAuth();
  const [search, setSearch] = useState('');
  const [activeSectorKey, setActiveSectorKey] = useState<string | null>(null);
  const [activeRegionKey, setActiveRegionKey] = useState<string | null>(null);

  // Self-fetch sectors when not provided via props — restrict to sectors actually used by the visible customers
  const customerSectorIds = useMemo(
    () => Array.from(new Set(customers.map(c => c.sector_id).filter(Boolean))) as string[],
    [customers],
  );
  const { data: fetchedSectors } = useQuery({
    queryKey: ['sectors-for-picker', activeBranch?.id, customerSectorIds.sort().join(',')],
    queryFn: async () => {
      if (customerSectorIds.length === 0) return [] as Sector[];
      let query = supabase.from('sectors').select('*').in('id', customerSectorIds).order('name');
      if (activeBranch) {
        query = query.eq('branch_id', activeBranch.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Sector[];
    },
    enabled: open && sectors.length === 0,
  });

  const effectiveSectors = sectors.length > 0 ? sectors : (fetchedSectors || []);

  // Fetch sector zones (regions) to group customers by zone within a sector
  const { data: zonesMap } = useQuery({
    queryKey: ['sector-zones-map'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sector_zones').select('id, name, name_fr');
      if (error) throw error;
      const map: Record<string, { name: string; name_fr: string | null }> = {};
      (data || []).forEach((z: any) => { map[z.id] = { name: z.name, name_fr: z.name_fr }; });
      return map;
    },
    enabled: open,
  });

  // Fetch active debts for all customers
  const { data: customerDebtsMap } = useQuery({
    queryKey: ['customer-debts-summary-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('customer_debts')
        .select('customer_id, remaining_amount, updated_at')
        .in('status', ['active', 'partially_paid']);
      const map: Record<string, { total: number; lastDate: string | null }> = {};
      (data || []).forEach(d => {
        if (!map[d.customer_id]) map[d.customer_id] = { total: 0, lastDate: null };
        map[d.customer_id].total += Number(d.remaining_amount || 0);
        if (d.updated_at && (!map[d.customer_id].lastDate || d.updated_at > map[d.customer_id].lastDate!)) {
          map[d.customer_id].lastDate = d.updated_at;
        }
      });
      return map;
    },
    enabled: open,
  });

  const { data: customerTrustMap } = useQuery({
    queryKey: ['customer-trust-summary-all'],
    queryFn: async () => {
      const { data: allDebts, error: debtsError } = await supabase
        .from('customer_debts')
        .select('id, customer_id, total_amount, paid_amount');
      if (debtsError) throw debtsError;

      const debtIds = (allDebts || []).map((debt) => debt.id);
      if (!debtIds.length) return {};

      const { data: collections, error: collectionsError } = await supabase
        .from('debt_collections')
        .select('debt_id, amount_collected, created_at')
        .in('debt_id', debtIds);
      if (collectionsError) throw collectionsError;

      const debtsByCustomer = (allDebts || []).reduce((acc: Record<string, any[]>, debt: any) => {
        if (!debt.customer_id) return acc;
        if (!acc[debt.customer_id]) acc[debt.customer_id] = [];
        acc[debt.customer_id].push(debt);
        return acc;
      }, {});

      const debtToCustomer = new Map<string, string>((allDebts || []).map((debt: any) => [debt.id, debt.customer_id]));
      const collectionsByCustomer = (collections || []).reduce((acc: Record<string, any[]>, item: any) => {
        const customerId = item.debt_id ? debtToCustomer.get(item.debt_id as string) : null;
        if (!customerId) return acc;
        if (!acc[customerId]) acc[customerId] = [];
        acc[customerId].push(item);
        return acc;
      }, {});

      const result: Record<string, ReturnType<typeof computeClientTrustScoreFromHistory>> = {};
      Object.keys(debtsByCustomer).forEach((customerId) => {
        result[customerId] = computeClientTrustScoreFromHistory(
          debtsByCustomer[customerId],
          collectionsByCustomer[customerId] || [],
        );
      });
      return result;
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setSearch('');
      setActiveSectorKey(null);
      setActiveRegionKey(null);
    }
  }, [open]);

  useEffect(() => {
    setActiveRegionKey(null);
  }, [activeSectorKey]);

  

  const filteredCustomers = useMemo(() => {
    const source = !search.trim()
      ? customers
      : customers.filter(c => {
        const q = search.toLowerCase();
        return (
      c.name?.toLowerCase().includes(q) ||
      c.name_fr?.toLowerCase().includes(q) ||
      c.store_name?.toLowerCase().includes(q) ||
      (c as any).store_name_fr?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.wilaya?.toLowerCase().includes(q) ||
      c.internal_name?.toLowerCase().includes(q) ||
      c.address?.toLowerCase().includes(q)
        );
      });

    const seen = new Set<string>();
    return source.filter((customer) => {
      if (seen.has(customer.id)) return false;
      seen.add(customer.id);
      return true;
    });
  }, [customers, search]);

  // Build sector map for quick lookup
  const sectorMap = useMemo(() => {
    const map = new Map<string, string>();
    effectiveSectors.forEach(s => map.set(s.id, getLocalizedName(s, language)));
    return map;
  }, [effectiveSectors, language]);

  // Group customers by sector
  const groupedCustomers = useMemo((): SectorGroup[] => {
    const groups = new Map<string, SectorGroup>();

    filteredCustomers.forEach((customer) => {
      const sectorId = customer.sector_id || null;
      const sectorName = sectorId
        ? (normalizeSectorGroupName(sectorMap.get(sectorId) || '') || `سكتور غير معروف`)
        : 'بدون سكتور';

      const groupKey = sectorId
        ? (normalizeSectorGroupName(sectorMap.get(sectorId) || '') ? `name:${sectorName}` : `id:${sectorId}`)
        : 'no-sector';

      const existing = groups.get(groupKey);
      if (existing) {
        existing.customers.push(customer);
        if (!existing.sectorId && sectorId) existing.sectorId = sectorId;
        return;
      }

      groups.set(groupKey, {
        key: groupKey,
        sectorId,
        sectorName,
        customers: [customer],
      });
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.sectorId === null) return 1;
      if (b.sectorId === null) return -1;
      return a.sectorName.localeCompare(b.sectorName, 'ar');
    });
  }, [filteredCustomers, sectorMap]);

  // Sector visual styles (icon + color) — deterministic by index
  const SECTOR_STYLES = useMemo(() => ([
    { icon: MapPin, bg: 'bg-rose-500/10', text: 'text-rose-600', border: 'border-rose-500/30' },
    { icon: Store, bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/30' },
    { icon: Building2, bg: 'bg-sky-500/10', text: 'text-sky-600', border: 'border-sky-500/30' },
    { icon: Home, bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/30' },
    { icon: MapIcon, bg: 'bg-violet-500/10', text: 'text-violet-600', border: 'border-violet-500/30' },
    { icon: Navigation, bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-600', border: 'border-fuchsia-500/30' },
    { icon: Compass, bg: 'bg-cyan-500/10', text: 'text-cyan-600', border: 'border-cyan-500/30' },
    { icon: Landmark, bg: 'bg-orange-500/10', text: 'text-orange-600', border: 'border-orange-500/30' },
    { icon: Tent, bg: 'bg-lime-500/10', text: 'text-lime-600', border: 'border-lime-500/30' },
    { icon: TreePine, bg: 'bg-green-500/10', text: 'text-green-600', border: 'border-green-500/30' },
    { icon: Mountain, bg: 'bg-stone-500/10', text: 'text-stone-600', border: 'border-stone-500/30' },
    { icon: Waves, bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500/30' },
    { icon: Sun, bg: 'bg-yellow-500/10', text: 'text-yellow-600', border: 'border-yellow-500/30' },
    { icon: Star, bg: 'bg-pink-500/10', text: 'text-pink-600', border: 'border-pink-500/30' },
  ]), []);
  const sectorStyle = (key: string, index: number) => SECTOR_STYLES[index % SECTOR_STYLES.length];

  const activeGroup = activeSectorKey ? groupedCustomers.find(g => g.key === activeSectorKey) : null;
  const visibleCustomers = search.trim() ? filteredCustomers : (activeGroup?.customers || []);

  const getSectorName = (sectorId: string | null | undefined) => {
    if (!sectorId) return '';
    return sectorMap.get(sectorId) || '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] p-0 gap-0 rounded-2xl" dir={dir}>
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b">
          <DialogTitle className="text-center text-base font-bold">
            {t('customer_picker.title')}
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 left-4 text-destructive hover:text-destructive/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        {/* Search */}
        <div className="px-4 pt-3 pb-2 space-y-2">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('customer_picker.search_placeholder')}
              className="pr-10 h-11 rounded-full border-2 border-primary/30 focus:border-primary text-sm"
              autoFocus
            />
          </div>
          {activeSectorKey && !search.trim() && (
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => { setActiveSectorKey(null); setActiveRegionKey(null); }}
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <ChevronRight className="w-4 h-4" />
                {t('customer_picker.title')}
              </button>
              {activeRegionKey && (
                <>
                  <ChevronLeft className="w-3 h-3 text-muted-foreground" />
                  <button
                    onClick={() => setActiveRegionKey(null)}
                    className="text-primary hover:underline"
                  >
                    {activeRegionKey}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Customers List */}
        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-10 text-center">
              <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm text-muted-foreground">
                {search ? t('customer_picker.no_match') : t('orders.no_customers')}
              </p>
              {search && onAddNew && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1"
                  onClick={onAddNew}
                >
                  <UserPlus className="w-4 h-4" />
                  {t('customer_picker.add_new')}
                </Button>
              )}
            </div>
          ) : !activeSectorKey && !search.trim() ? (
            // Sector grid - بدون أيقونات، شارة عدد بالأحمر
            <div className="grid grid-cols-2 gap-2 p-3">
              {groupedCustomers.map((group, idx) => {
                const style = sectorStyle(group.key, idx);
                return (
                  <button
                    key={group.key}
                    onClick={() => setActiveSectorKey(group.key)}
                    className={cn(
                      "flex flex-row items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all hover:scale-105 active:scale-95 min-h-[56px]",
                      style.bg, style.border
                    )}
                  >
                    <p className={cn("text-sm font-bold text-center line-clamp-1", style.text)}>
                      {group.sectorName}
                    </p>
                    <span className="inline-flex items-center justify-center min-w-[28px] h-5 px-2 rounded-full bg-destructive text-white text-xs font-bold shrink-0">
                      {group.customers.length}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            // Customers — مقسمة حسب منطقة السكتور (sector_zones) داخل القسم
            (() => {
              const groupsByRegion = new Map<string, Customer[]>();
              visibleCustomers.forEach((c) => {
                const zoneId = (c as any).zone_id as string | null | undefined;
                const zone = zoneId ? zonesMap?.[zoneId] : null;
                const key = zone
                  ? ((language !== 'ar' && zone.name_fr) ? zone.name_fr : zone.name)
                  : 'بدون منطقة';
                if (!groupsByRegion.has(key)) groupsByRegion.set(key, []);
                groupsByRegion.get(key)!.push(c);
              });
              const regionEntries = Array.from(groupsByRegion.entries()).sort((a, b) =>
                a[0].localeCompare(b[0], 'ar')
              );
              // إذا لم تُختر منطقة بعد ولم يكن هناك بحث: اعرض شبكة أزرار المناطق
              if (!activeRegionKey && !search.trim()) {
                return (
                  <div className="grid grid-cols-2 gap-2 p-3">
                    {regionEntries.map(([region, list], rIdx) => {
                      const rStyle = sectorStyle(region, rIdx);
                      return (
                        <button
                          key={region}
                          onClick={() => setActiveRegionKey(region)}
                          className={cn(
                            "flex flex-row items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all hover:scale-105 active:scale-95 min-h-[56px]",
                            rStyle.bg, rStyle.border
                          )}
                        >
                          <MapPin className={cn("w-4 h-4 shrink-0", rStyle.text)} />
                          <p className={cn("text-sm font-bold text-center line-clamp-1", rStyle.text)}>
                            {region}
                          </p>
                          <span className="inline-flex items-center justify-center min-w-[28px] h-5 px-2 rounded-full bg-destructive text-white text-xs font-bold shrink-0">
                            {list.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              }

              // اعرض المجموعات (إما كلها عند البحث، أو منطقة واحدة فقط)
              const visibleRegions = search.trim()
                ? regionEntries
                : regionEntries.filter(([r]) => r === activeRegionKey);
              return (
                <div className="p-3 space-y-5">
                  {visibleRegions.map(([region, list], rIdx) => {
                    const rStyle = sectorStyle(region, rIdx);
                    return (
                      <div key={region}>
                        <div className="flex items-center justify-center my-2">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 text-xs font-bold shadow-sm",
                            rStyle.bg, rStyle.border, rStyle.text
                          )}>
                            <MapPin className="w-3.5 h-3.5" />
                            {region}
                            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-4 px-1.5 rounded-full bg-background/80 text-[10px]">
                              {list.length}
                            </span>
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {list.map((customer) => {
                            const isSelected = selectedCustomerId === customer.id;
                            const debtInfo = customerDebtsMap?.[customer.id];
                            const storeName = (language !== 'ar' && (customer as any).store_name_fr)
                              ? (customer as any).store_name_fr
                              : customer.store_name;
                            const displayName = (language !== 'ar' && (customer as any).name_fr)
                              ? (customer as any).name_fr
                              : customer.name;
                            return (
                              <button
                                key={customer.id}
                                className={cn(
                                  "relative flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-right transition-all hover:scale-[1.02] active:scale-95 min-h-[72px]",
                                  isSelected ? "bg-primary/10 border-primary" : cn(rStyle.bg, rStyle.border, "hover:brightness-95")
                                )}
                                onClick={() => {
                                  onSelect(customer);
                                  onOpenChange(false);
                                }}
                              >
                                <p className="text-sm font-bold text-foreground line-clamp-2 w-full text-right">
                                  {storeName || displayName}
                                </p>
                                {storeName && displayName && (
                                  <p className="text-[10px] text-muted-foreground line-clamp-1 w-full text-right">
                                    {displayName}
                                  </p>
                                )}
                                {debtInfo && debtInfo.total > 0 && (
                                  <span className="absolute top-1 left-1 inline-flex items-center justify-center px-1.5 h-4 rounded-full bg-destructive text-white text-[9px] font-bold">
                                    {debtInfo.total.toLocaleString()} DA
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-4 py-2.5 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {filteredCustomers.length} {t('customer_picker.count')}
          </p>
          {onAddNew && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-primary hover:text-primary gap-1"
              onClick={onAddNew}
            >
              <UserPlus className="w-4 h-4" />
              {t('customer_picker.new')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerPickerDialog;
