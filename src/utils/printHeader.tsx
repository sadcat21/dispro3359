import React from 'react';
import logoAsset from '@/assets/logo.png';
import type { CompanyInfo } from '@/hooks/useCompanyInfo';

/**
 * Shared header used at the top of every print/handover/receipt document.
 * Shows the official company logo + name + activity + address.
 */
export const buildPrintHeaderHTML = (
  companyInfo: Partial<CompanyInfo> | undefined,
  opts?: { dir?: 'rtl' | 'ltr' },
) => {
  const logo = companyInfo?.company_logo || logoAsset;
  const dir = opts?.dir || 'ltr';
  const name = companyInfo?.company_name || 'SARL LASER FOOD';
  const activity = companyInfo?.company_activity || '';
  const address = companyInfo?.company_address || '';
  return `
    <div style="display:flex;align-items:center;gap:14px;border-bottom:2px solid #0f172a;padding:10px 6px;margin-bottom:14px;direction:${dir}">
      <img src="${logo}" alt="${name}" style="height:62px;width:auto;object-fit:contain" />
      <div style="flex:1;text-align:center">
        <div style="font-size:20px;font-weight:bold;color:#0f172a;letter-spacing:0.5px">${name}</div>
        ${activity ? `<div style="font-size:11px;color:#475569;margin-top:2px">${activity}</div>` : ''}
        ${address ? `<div style="font-size:10px;color:#64748b">${address}</div>` : ''}
      </div>
    </div>
  `;
};

interface PrintHeaderProps {
  companyInfo?: Partial<CompanyInfo>;
  dir?: 'rtl' | 'ltr';
}

export const PrintHeader: React.FC<PrintHeaderProps> = ({ companyInfo, dir = 'ltr' }) => {
  const logo = companyInfo?.company_logo || logoAsset;
  const name = companyInfo?.company_name || 'SARL LASER FOOD';
  const activity = companyInfo?.company_activity || '';
  const address = companyInfo?.company_address || '';
  return (
    <div
      data-pdf-section
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        borderBottom: '2px solid #0f172a',
        padding: '10px 6px',
        marginBottom: 14,
        direction: dir,
      }}
    >
      <img src={logo} alt={name} style={{ height: 62, width: 'auto', objectFit: 'contain' }} />
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 'bold', color: '#0f172a', letterSpacing: 0.5 }}>{name}</div>
        {activity && (
          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{activity}</div>
        )}
        {address && <div style={{ fontSize: 10, color: '#64748b' }}>{address}</div>}
      </div>
    </div>
  );
};