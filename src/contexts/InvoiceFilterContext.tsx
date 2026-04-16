import React, { createContext, useContext, useState, useCallback } from 'react';

export type InvoiceFilterMode = 'all' | 'invoice1' | 'invoice2';

interface InvoiceFilterContextType {
  mode: InvoiceFilterMode;
  cycleMode: () => void;
  /** Returns the payment_type filter value for queries, or null for 'all' */
  getPaymentTypeFilter: () => string | null;
  /** Label for current mode */
  modeLabel: string;
  /** Badge number: 1, 2, or 3 */
  badgeNumber: number;
  /** Badge color class */
  badgeColorClass: string;
}

const InvoiceFilterContext = createContext<InvoiceFilterContextType | undefined>(undefined);

export const InvoiceFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<InvoiceFilterMode>('all');

  const cycleMode = useCallback(() => {
    setMode(prev => {
      if (prev === 'all') return 'invoice1';
      if (prev === 'invoice1') return 'invoice2';
      return 'all';
    });
  }, []);

  const getPaymentTypeFilter = useCallback(() => {
    if (mode === 'invoice1') return 'with_invoice';
    if (mode === 'invoice2') return 'without_invoice';
    return null;
  }, [mode]);

  const badgeNumber = mode === 'invoice1' ? 1 : mode === 'invoice2' ? 2 : 3;
  const badgeColorClass = mode === 'invoice1' 
    ? 'bg-green-500' 
    : mode === 'invoice2' 
      ? 'bg-orange-500' 
      : 'bg-red-500';
  const modeLabel = mode === 'invoice1' 
    ? 'فاتورة 1' 
    : mode === 'invoice2' 
      ? 'فاتورة 2' 
      : 'الكل';

  return (
    <InvoiceFilterContext.Provider value={{ mode, cycleMode, getPaymentTypeFilter, modeLabel, badgeNumber, badgeColorClass }}>
      {children}
    </InvoiceFilterContext.Provider>
  );
};

export const useInvoiceFilter = () => {
  const ctx = useContext(InvoiceFilterContext);
  if (!ctx) throw new Error('useInvoiceFilter must be used within InvoiceFilterProvider');
  return ctx;
};
