import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCustomerTypes, getCustomerTypeColor, CustomerTypeEntry } from '@/hooks/useCustomerTypes';
import { useRegistrationTypes } from '@/hooks/useRegistrationTypes';
import { useLanguage } from '@/contexts/LanguageContext';
import { FlaskConical } from 'lucide-react';

export interface CustomerLabelData {
  name?: string | null;
  store_name?: string | null;
  customer_type?: string | null;
  sector_name?: string | null;
  zone_name?: string | null;
  internal_name?: string | null;
  registration_type?: string | null;
  owner_first_name_ar?: string | null;
  owner_last_name_ar?: string | null;
  owner_first_name_fr?: string | null;
  owner_last_name_fr?: string | null;
}


interface CustomerLabelProps {
  customer: CustomerLabelData;
  /** compact = single line badges only, full = two lines */
  compact?: boolean;
  className?: string;
  /** Override customer types to avoid extra queries when parent already has them */
  customerTypes?: CustomerTypeEntry[];
  /** Hide badges when space is very tight */
  hideBadges?: boolean;
}

/**
 * Unified component to display customer store name + name + sector badge + type badge.
 * Use `compact` for dropdowns/lists (single line), default for cards/dialogs (two lines).
 */
const CustomerLabel: React.FC<CustomerLabelProps> = ({
  customer,
  compact = false,
  className,
  customerTypes: externalTypes,
  hideBadges = false,
}) => {
  const { language } = useLanguage();
  const { customerTypes: hookTypes } = useCustomerTypes();
  const types = externalTypes || hookTypes;

  const isTestCustomer = customer.internal_name?.startsWith('[تجريبي]') ?? false;

  const displayName = customer.store_name || customer.name || '—';
  const secondaryName = customer.store_name ? customer.name : null;

  // Owner full name (AR + FR) from business profile
  const ownerAr = [customer.owner_first_name_ar, customer.owner_last_name_ar]
    .filter(Boolean).join(' ').trim();
  const ownerFr = [customer.owner_first_name_fr, customer.owner_last_name_fr]
    .filter(Boolean).join(' ').trim();
  const ownerLabel = [ownerAr, ownerFr].filter(Boolean).join(' · ');


  // Customer type badge
  const typeEntry = types.find(t => t.ar === customer.customer_type);
  const typeShort = typeEntry?.short
    ? typeEntry.short.toUpperCase()
    : (customer.customer_type || '');
  const typeColor = typeEntry
    ? getCustomerTypeColor(typeEntry.short, 0, typeEntry)
    : null;


  const badges = !hideBadges && (
    <>
      {isTestCustomer && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0 border-destructive/50 text-destructive gap-0.5">
          <FlaskConical className="w-2.5 h-2.5" />
          تجريبي
        </Badge>
      )}
      {customer.sector_name && (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 h-4 shrink-0 border-primary/30 text-primary"
        >
          {customer.sector_name}
        </Badge>
      )}
      {customer.zone_name && (
        <Badge
          className="text-[10px] px-1.5 py-0 h-4 shrink-0 border-0 font-bold bg-blue-600 text-white"
        >
          {customer.zone_name}
        </Badge>
      )}
      {customer.customer_type && typeShort && (
        <Badge
          className="text-[10px] px-1.5 py-0 h-4 shrink-0 border-0 font-bold"
          style={typeColor ? { backgroundColor: typeColor.bg, color: typeColor.text } : undefined}
        >
          {typeShort}
        </Badge>
      )}
    </>
  );

  if (compact) {
    return (
      <span className={cn('inline-flex items-center gap-1 min-w-0', className)}>
        {regLabel && (
          <span className="text-[10px] text-muted-foreground font-medium shrink-0" dir="ltr">
            {regLabel}
          </span>
        )}
        <span className="font-bold text-sm truncate">{displayName}</span>
        {secondaryName && (
          <span className="text-xs text-muted-foreground truncate">— {secondaryName}</span>
        )}
        {badges}
      </span>
    );
  }

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-center gap-1 flex-wrap">
        {regLabel && (
          <span className="text-[10px] text-muted-foreground font-medium shrink-0" dir="ltr">
            {regLabel}
          </span>
        )}
        <span className="font-bold text-sm truncate">{displayName}</span>
        {badges}
      </div>
      {secondaryName && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">{secondaryName}</p>
      )}
    </div>
  );
};


export default CustomerLabel;
