import React, { useState, useRef, useCallback } from 'react';
import { Gift, Package, ChevronDown, ChevronUp, User, Calendar, Printer, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { PromoTrackingItem } from '@/hooks/useSessionCalculations';
import { Button } from '@/components/ui/button';
import PromoDetailsPrintView from '@/components/print/PromoDetailsPrintView';

interface PromoTrackingSummaryProps {
  items: PromoTrackingItem[];
  totalGiftValue?: number;
  workerName?: string;
  periodStart?: string;
  periodEnd?: string;
}

const formatGiftDisplay = (giftPieces: number, piecesPerBox: number): string => {
  if (piecesPerBox <= 1) return `${giftPieces}`;
  const boxes = Math.floor(giftPieces / piecesPerBox);
  const remainingPieces = giftPieces % piecesPerBox;
  const piecesStr = remainingPieces.toString().padStart(2, '0');
  return `${boxes}.${piecesStr}`;
};

const PromoTrackingSummary: React.FC<PromoTrackingSummaryProps> = ({ items, totalGiftValue, workerName, periodStart, periodEnd }) => {
  const { t, tp, language } = useLanguage();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [printingIdx, setPrintingIdx] = useState<number | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const formatGiftLabel = (giftPieces: number): string => {
    if (giftPieces <= 0) return '0';
    if (language === 'fr' || language === 'en') return `${giftPieces} pcs`;
    return `${giftPieces} قطعة`;
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      const locale = language === 'fr' ? 'fr-FR' : language === 'en' ? 'en-US' : 'ar-DZ';
      return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const handlePrint = useCallback((idx: number) => {
    setPrintingIdx(idx);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintingIdx(null), 500);
    }, 300);
  }, []);

  if (items.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-3 text-sm">
        {tp('print.promo.no_promos')}
      </p>
    );
  }

  const printItem = printingIdx !== null ? items[printingIdx] : null;

  return (
    <div className="space-y-2">
      {/* Cards grid (matches sales summary look) */}
      <div className="grid grid-cols-3 gap-2 pb-2">
        {items.map((item, idx) => {
          const hasDetails = item.customerDetails && item.customerDetails.length > 0;
          return (
            <div
              key={`card-${idx}`}
              className="flex flex-col rounded-2xl overflow-hidden shadow-lg border-2 border-border hover:border-primary/50 cursor-pointer active:scale-[0.97] transition-all bg-card"
              onClick={() => hasDetails && setExpandedIdx(expandedIdx === idx ? null : idx)}
            >
              <div className="px-2 py-1.5 border-b text-center bg-muted border-border">
                <span className="font-bold text-xs leading-tight block truncate text-foreground">
                  {item.productName}
                </span>
              </div>
              <div className="w-full aspect-square bg-muted overflow-hidden">
                {item.productImage ? (
                  <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Gift className="w-10 h-10 text-primary/30" />
                  </div>
                )}
              </div>
              <div className="px-1.5 py-1.5 flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <div className="flex-1 flex items-center justify-center gap-1 rounded-md bg-primary/10 text-primary py-1 text-xs font-bold">
                    <Package className="w-3 h-3" />
                    {item.quantitySold}
                  </div>
                  <div className="flex items-center justify-center gap-0.5 rounded-md bg-purple-100 text-purple-700 py-1 px-1.5 text-[10px] font-bold">
                    🎁 {formatGiftDisplay(item.giftQuantity, item.piecesPerBox)}
                  </div>
                </div>
                {typeof item.loadedQuantity === 'number' && item.loadedQuantity > 0 && (() => {
                  const giftBoxes = item.piecesPerBox > 0 ? item.giftQuantity / item.piecesPerBox : 0;
                  const accounted = item.quantitySold + giftBoxes;
                  const diff = item.loadedQuantity - accounted;
                  return (
                    <div className="flex items-center gap-1 text-[9px] font-bold">
                      <div className="flex-1 flex items-center justify-center rounded-md bg-blue-100 text-blue-700 py-0.5">
                        شحن: {formatGiftDisplay(Math.round(item.loadedQuantity * (item.piecesPerBox || 1)), item.piecesPerBox || 1)}
                      </div>
                      <div className={`flex-1 flex items-center justify-center rounded-md py-0.5 ${Math.abs(diff) < 0.01 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        فارق: {diff > 0 ? '+' : ''}{formatGiftDisplay(Math.round(Math.abs(diff) * (item.piecesPerBox || 1)), item.piecesPerBox || 1)}
                      </div>
                    </div>
                  );
                })()}
                {/* تم حذف وصف العرض الرمادي بناءً على طلب المستخدم */}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expandable details table (kept for drill-down) */}
      <div className="bg-muted/30 rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-1 text-[10px] text-muted-foreground font-medium p-2 border-b">
          <span className="col-span-4">{t('stock.product') || tp('print.promo.product')}</span>
          <span className="col-span-2 text-center">{tp('print.promo.sales')}</span>
          <span className="col-span-3 text-center">{tp('print.promo.gift_delivered')}</span>
          <span className="col-span-3 text-end">{tp('print.promo.offer_summary')}</span>
        </div>
        {items.map((item, idx) => {
          const isExpanded = expandedIdx === idx;
          const hasDetails = item.customerDetails && item.customerDetails.length > 0;
          return (
            <div key={idx}>
              <div
                className={`grid grid-cols-12 gap-1 text-xs p-2 border-b border-dashed last:border-0 items-center ${hasDetails ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                onClick={() => hasDetails && setExpandedIdx(isExpanded ? null : idx)}
              >
                <div className="col-span-4 flex items-center gap-1.5">
                  {hasDetails ? (
                    isExpanded ? <ChevronUp className="w-3 h-3 text-primary shrink-0" /> : <ChevronDown className="w-3 h-3 text-primary shrink-0" />
                  ) : (
                    <Package className="w-3 h-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-wrap">{item.productName}</span>
                </div>
                <span className="col-span-2 text-center font-bold">{item.quantitySold}</span>
                <div className="col-span-3 text-center">
                  <span className="font-bold text-purple-600" title={formatGiftLabel(item.giftQuantity)}>
                    {formatGiftDisplay(item.giftQuantity, item.piecesPerBox)} 🎁
                  </span>
                  <div className="text-[9px] text-muted-foreground">
                    {formatGiftLabel(item.giftQuantity)}
                  </div>
                </div>
                <div className="col-span-3 text-end">
                  {item.offerDescription ? (
                    <span className="inline-block bg-primary/10 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-tight">
                      {item.offerDescription}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">{item.offerName || '-'}</span>
                  )}
                </div>
              </div>

              {/* Expanded customer details */}
              {isExpanded && hasDetails && (
                <div className="bg-accent/30 border-t border-border">
                  {/* Period + offer summary banner */}
                  {(periodStart || periodEnd || item.offerDescription || item.offerName) && (
                    <div className="px-3 py-2 bg-primary/5 border-b border-border/50 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        {(periodStart || periodEnd) && (
                          <span className="text-muted-foreground">
                            <strong className="text-foreground">{tp('print.promo.period')}:</strong>{' '}
                            {periodStart ? formatDate(periodStart) : '-'} → {periodEnd ? formatDate(periodEnd) : '-'}
                          </span>
                        )}
                        {(item.offerDescription || item.offerName) && (
                          <span className="text-muted-foreground">
                            <strong className="text-foreground">{tp('print.promo.offer_summary')}:</strong>{' '}
                            <span className="text-primary font-semibold">{item.offerDescription || item.offerName}</span>
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-[10px] h-7 rounded-lg print:hidden"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrint(idx);
                        }}
                      >
                        <Printer className="w-3 h-3" />
                        {t('common.print') || (language === 'fr' ? 'Imprimer' : 'طباعة')}
                      </Button>
                    </div>
                  )}
                  <div className="grid grid-cols-12 gap-1 text-[9px] text-muted-foreground font-medium px-3 py-1.5 border-b border-border/50">
                    <span className="col-span-4">{tp('print.promo.store_customer')}</span>
                    <span className="col-span-2 text-center">{tp('print.promo.qty_bought')}</span>
                    <span className="col-span-3 text-center">{tp('print.promo.gift_delivered')}</span>
                    <span className="col-span-3 text-end">{tp('print.promo.date_time')}</span>
                  </div>
                  {item.customerDetails.map((cd, cdIdx) => (
                    <div key={cdIdx} className="grid grid-cols-12 gap-1 text-[11px] px-3 py-1.5 border-b border-dashed border-border/30 last:border-0 items-center">
                      <div className="col-span-4 flex items-center gap-1">
                        <User className="w-3 h-3 text-muted-foreground shrink-0" />
                        <div className="truncate">
                          {cd.customerSectorName && (
                            <span className="text-[9px] text-primary font-medium block">{cd.customerSectorName}</span>
                          )}
                          {cd.customerStoreName && (
                            <span className="font-bold text-[11px]">{cd.customerStoreName}</span>
                          )}
                          {cd.customerStoreName && cd.customerName && <span className="text-muted-foreground"> - </span>}
                          <span className="text-muted-foreground text-[10px]">{cd.customerName || '-'}</span>
                        </div>
                      </div>
                      <span className="col-span-2 text-center font-semibold">{cd.quantitySold}</span>
                      <div className="col-span-3 text-center">
                        <span className="font-semibold text-purple-600">
                          {formatGiftDisplay(cd.giftPieces, item.piecesPerBox)}
                        </span>
                        <div className="text-[8px] text-muted-foreground">
                          {formatGiftLabel(cd.giftPieces)}
                        </div>
                      </div>
                      <div className="col-span-3 text-end flex items-center justify-end gap-0.5 text-muted-foreground">
                        <Calendar className="w-2.5 h-2.5 shrink-0" />
                        <span className="text-[9px]">{formatDate(cd.date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Print view (hidden, rendered via portal) */}
      {printItem && (
        <PromoDetailsPrintView
          ref={printRef}
          productName={printItem.productName}
          workerName={workerName}
          piecesPerBox={printItem.piecesPerBox}
          customerDetails={printItem.customerDetails}
          isVisible={printingIdx !== null}
          periodStart={periodStart}
          periodEnd={periodEnd}
          offerName={printItem.offerName}
          offerDescription={printItem.offerDescription}
        />
      )}
    </div>
  );
};

export default PromoTrackingSummary;
