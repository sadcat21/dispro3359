import React, { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import logoImage from '@/assets/logo.png';
import { useLanguage } from '@/contexts/LanguageContext';
import { PromoCustomerDetail } from '@/hooks/useSessionCalculations';

interface PromoDetailsPrintViewProps {
  productName: string;
  workerName?: string;
  piecesPerBox: number;
  customerDetails: PromoCustomerDetail[];
  isVisible?: boolean;
  periodStart?: string;
  periodEnd?: string;
  offerName?: string;
  offerDescription?: string;
}

const formatGiftDisplay = (giftPieces: number, piecesPerBox: number): string => {
  if (piecesPerBox <= 0) return `${giftPieces}`;
  const boxes = Math.floor(giftPieces / piecesPerBox);
  const remainingPieces = giftPieces % piecesPerBox;
  const piecesStr = remainingPieces.toString().padStart(2, '0');
  return `${boxes}.${piecesStr}`;
};

const PromoDetailsPrintView = forwardRef<HTMLDivElement, PromoDetailsPrintViewProps>(
  ({ productName, workerName, piecesPerBox, customerDetails, isVisible = false, periodStart, periodEnd, offerName, offerDescription }, ref) => {
    const [container, setContainer] = useState<HTMLDivElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const { tp, language } = useLanguage();

    const formatGiftLabel = (giftPieces: number): string => {
      if (giftPieces <= 0) return '0';
      if (language === 'fr') return `${giftPieces} pcs`;
      if (language === 'en') return `${giftPieces} pcs`;
      return `${giftPieces} قطعة`;
    };

    const formatPeriod = (s?: string, e?: string): string => {
      if (!s || !e) return '-';
      try {
        return `${format(new Date(s), 'dd/MM/yyyy')} → ${format(new Date(e), 'dd/MM/yyyy')}`;
      } catch {
        return `${s} → ${e}`;
      }
    };

    const totalSold = customerDetails.reduce((sum, cd) => sum + cd.quantitySold, 0);
    const totalGiftPieces = customerDetails.reduce((sum, cd) => sum + cd.giftPieces, 0);

    const minRows = 18;
    const emptyRowsCount = Math.max(0, minRows - customerDetails.length);

    const offerSummary = offerDescription || offerName || '';

    useLayoutEffect(() => {
      if (typeof document === 'undefined') return;
      const existing = document.getElementById('print-portal-promo-details');
      if (existing) existing.remove();
      const div = document.createElement('div');
      div.id = 'print-portal-promo-details';
      document.body.appendChild(div);
      containerRef.current = div;
      setContainer(div);
      return () => {
        if (div.parentNode) div.parentNode.removeChild(div);
        containerRef.current = null;
      };
    }, []);

    const isRtl = language === 'ar';

    const content = (
      <div
        ref={ref}
        className="print-container"
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{
          display: isVisible ? 'block' : 'none',
          position: 'relative',
          minHeight: '100vh'
        }}
      >
        {/* Watermark */}
        <div style={{
          position: 'absolute',
          top: '45%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
          opacity: 0.2,
          pointerEvents: 'none'
        }}>
          <img src={logoImage} alt="" style={{ width: '280px', height: 'auto' }} />
        </div>

        {/* Header */}
        <div className="print-header-with-logo" style={{ position: 'relative', zIndex: 1 }}>
          <div className="print-logo">
            <img src={logoImage} alt="Laser Food" />
          </div>
          <div className="print-title-section">
            <h1>{tp('print.promo.details_title')}</h1>
            <p style={{ fontSize: '11pt', fontWeight: 600, marginTop: '5px' }}>
              {tp('print.promo.product')}: {productName}
              {workerName && ` | ${tp('print.promo.worker')}: ${workerName}`}
            </p>
            {(periodStart || periodEnd) && (
              <p style={{ fontSize: '10pt', fontWeight: 500, marginTop: '3px' }}>
                {tp('print.promo.period')}: {formatPeriod(periodStart, periodEnd)}
              </p>
            )}
            {offerSummary && (
              <p style={{ fontSize: '10pt', fontWeight: 600, marginTop: '3px', color: '#1f4e79' }}>
                {tp('print.promo.offer_summary')}: {offerSummary}
              </p>
            )}
          </div>
          <div className="print-logo">
            <img src={logoImage} alt="Laser Food" />
          </div>
        </div>

        {/* Table */}
        <table className="word-table" style={{ position: 'relative', zIndex: 1 }}>
          <thead>
            <tr>
              <th style={{ width: '35px' }}>{tp('print.promo.row_num')}</th>
              <th>{tp('print.promo.store_customer')}</th>
              <th style={{ width: '100px' }}>{tp('print.promo.phone')}</th>
              <th>{tp('print.promo.address_col')}</th>
              <th style={{ width: '70px' }}>{tp('print.promo.qty_bought')}</th>
              <th style={{ width: '90px' }}>{tp('print.promo.gift_delivered')}</th>
              <th style={{ width: '100px' }}>{tp('print.promo.date_time')}</th>
            </tr>
          </thead>
          <tbody>
            {customerDetails.map((cd, index) => (
              <tr key={index}>
                <td className="center">{index + 1}</td>
                <td>
                  {cd.customerSectorName && <em style={{ fontSize: '9px', color: '#888' }}>{cd.customerSectorName}<br/></em>}
                  {cd.customerStoreName && <strong>{cd.customerStoreName}</strong>}
                  {cd.customerStoreName && cd.customerName ? ' - ' : ''}
                  {cd.customerName || '-'}
                </td>
                <td className="ltr-text">{cd.customerPhone || '-'}</td>
                <td className="small-text">{cd.customerAddress || '-'}</td>
                <td className="center bold">{cd.quantitySold}</td>
                <td className="center bold">
                  <div>{formatGiftDisplay(cd.giftPieces, piecesPerBox)}</div>
                  <div style={{ fontSize: '7pt', fontWeight: 'normal', opacity: 0.7 }}>
                    {formatGiftLabel(cd.giftPieces)}
                  </div>
                </td>
                <td className="small-text center">
                  {cd.date ? format(new Date(cd.date), 'dd/MM/yyyy HH:mm') : '-'}
                </td>
              </tr>
            ))}

            {/* Empty rows */}
            {Array.from({ length: emptyRowsCount }).map((_, index) => (
              <tr key={`empty-${index}`}>
                <td className="center">&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            ))}

            {/* Totals */}
            <tr className="totals-row">
              <td colSpan={4} className="totals-label">{tp('print.promo.total_label')}</td>
              <td className="center bold">{totalSold}</td>
              <td className="center bold">
                <div>{formatGiftDisplay(totalGiftPieces, piecesPerBox)}</div>
                <div style={{ fontSize: '7pt', fontWeight: 'normal', opacity: 0.7 }}>
                  {formatGiftLabel(totalGiftPieces)}
                </div>
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div className="print-footer">
          <span>{tp('print.promo.print_date')}: {format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
          <span>Laser Food</span>
        </div>
      </div>
    );

    if (!container && !containerRef.current) return null;
    return createPortal(content, container || containerRef.current!);
  }
);

PromoDetailsPrintView.displayName = 'PromoDetailsPrintView';

export default PromoDetailsPrintView;
