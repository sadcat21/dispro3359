import React, { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import logoImage from '@/assets/logo.png';

export interface OffersLogPrintRow {
  id: string;
  customerNameFr?: string | null;
  customerPhone?: string | null;
  sectorName?: string | null;
  soldDisplay?: string | null;
  promoDisplay?: string | null;
  workerName?: string | null;
  date?: string | null;
}

interface Props {
  rows: OffersLogPrintRow[];
  productName: string;
  promoLabel?: string;
  periode?: string;
  isVisible?: boolean;
}

const OffersLogPrintViewFr = forwardRef<HTMLDivElement, Props>(
  ({ rows, productName, promoLabel = '', periode = '', isVisible = false }, ref) => {
    const [container, setContainer] = useState<HTMLDivElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useLayoutEffect(() => {
      if (typeof document === 'undefined') return;
      const existing = document.getElementById('print-portal');
      if (existing) existing.remove();
      const div = document.createElement('div');
      div.id = 'print-portal';
      document.body.appendChild(div);
      containerRef.current = div;
      setContainer(div);
      return () => {
        if (div.parentNode) div.parentNode.removeChild(div);
        containerRef.current = null;
      };
    }, []);


    const minRows = 20;
    const emptyRowsCount = Math.max(0, minRows - rows.length);

    const content = (
      <div
        ref={ref}
        className="print-container"
        dir="ltr"
        style={{
          display: isVisible ? 'block' : 'none',
          position: 'relative',
          minHeight: '100vh',
        }}
      >
        <div style={{
          position: 'absolute', top: '45%', left: '50%',
          transform: 'translate(-50%, -50%)', zIndex: 0, opacity: 0.2, pointerEvents: 'none',
        }}>
          <img src={logoImage} alt="" style={{ width: '280px', height: 'auto' }} />
        </div>

        <div className="print-header-with-logo" style={{ position: 'relative', zIndex: 1 }}>
          <div className="print-logo"><img src={logoImage} alt="Laser Food" /></div>
          <div className="print-title-section">
            <h1>Espace Client dans le Secteur</h1>
            <p style={{ fontSize: '12pt', fontWeight: 700, marginTop: '5px' }}>
              Produit : {productName}
            </p>
          </div>
          <div className="print-logo"><img src={logoImage} alt="Laser Food" /></div>
        </div>

        <table className="word-table" style={{ position: 'relative', zIndex: 1 }}>
          <thead>
            <tr>
              <th style={{ width: '35px' }}>N°</th>
              <th>Nom</th>
              <th style={{ width: '110px' }}>Téléphone</th>
              <th>Secteur</th>
              <th style={{ width: '70px' }}>Vendu</th>
              <th style={{ width: '70px' }}>Promo</th>
              <th>Travailleur</th>
              <th style={{ width: '85px' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, index) => (
              <tr key={r.id}>
                <td className="center">{index + 1}</td>
                <td>{r.customerNameFr || ''}</td>
                <td className="ltr-text">{r.customerPhone || ''}</td>
                <td>{r.sectorName || ''}</td>
                <td className="center bold">{r.soldDisplay || '0'}</td>
                <td className="center bold">{r.promoDisplay || '0'}</td>
                <td className="small-text">{r.workerName || ''}</td>
                <td className="small-text">{r.date ? format(new Date(r.date), 'dd/MM/yyyy') : ''}</td>
              </tr>
            ))}
            {Array.from({ length: emptyRowsCount }).map((_, index) => (
              <tr key={`empty-${index}`}>
                <td className="center">&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="print-footer">
          <span>Date d'impression : {format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
          <span>Laser Food</span>
        </div>
      </div>
    );

    if (!container && !containerRef.current) return null;
    return createPortal(content, container || containerRef.current!);
  }
);

OffersLogPrintViewFr.displayName = 'OffersLogPrintViewFr';

export default OffersLogPrintViewFr;
