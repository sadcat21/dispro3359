import React, { lazy, Suspense } from 'react';

// Lazy-load only dialogs that work with minimal props (open + onOpenChange + optional)
const CreateOrderDialog = lazy(() => import('@/components/orders/CreateOrderDialog'));
const OrderSearchDialog = lazy(() => import('@/components/orders/OrderSearchDialog'));
const CreateSessionDialog = lazy(() => import('@/components/accounting/CreateSessionDialog'));
const AddExpenseDialog = lazy(() => import('@/components/expenses/AddExpenseDialog'));
const ManageSectorsDialog = lazy(() => import('@/components/customers/ManageSectorsDialog'));
const InvoiceRequestDialog = lazy(() => import('@/components/treasury/InvoiceRequestDialog'));
const InvoiceSettingsDialog = lazy(() => import('@/components/treasury/InvoiceSettingsDialog'));
const CoinExchangeDialog = lazy(() => import('@/components/treasury/CoinExchangeDialog'));
const TreasurySettingsDialog = lazy(() => import('@/components/treasury/TreasurySettingsDialog'));
const PalletCalculatorDialog = lazy(() => import('@/components/stock/PalletCalculatorDialog'));
const CustomerFieldSettingsDialog = lazy(() => import('@/components/customers/CustomerFieldSettingsDialog'));
const AttendanceSettingsDialog = lazy(() => import('@/components/attendance/AttendanceSettingsDialog'));
const CreateRewardTaskDialog = lazy(() => import('@/components/rewards/CreateRewardTaskDialog'));
const CreateOfferDialog = lazy(() => import('@/components/offers/CreateOfferDialog'));

interface DialogPreviewRendererProps {
  codePath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogPreviewRenderer: React.FC<DialogPreviewRendererProps> = ({ codePath, open, onOpenChange }) => {
  if (!open) return null;

  const fallback = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-background p-6 rounded-lg text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
        <p className="text-sm">جاري تحميل النافذة...</p>
      </div>
    </div>
  );

  const noop = () => {};

  const renderDialog = () => {
    switch (codePath) {
      case 'src/components/orders/CreateOrderDialog.tsx':
        return <CreateOrderDialog open={open} onOpenChange={onOpenChange} />;
      case 'src/components/orders/OrderSearchDialog.tsx':
        return <OrderSearchDialog open={open} onOpenChange={onOpenChange} />;
      case 'src/components/accounting/CreateSessionDialog.tsx':
        return <CreateSessionDialog open={open} onOpenChange={onOpenChange} />;
      case 'src/components/expenses/AddExpenseDialog.tsx':
        return <AddExpenseDialog open={open} onOpenChange={onOpenChange} />;
      case 'src/components/customers/ManageSectorsDialog.tsx':
        return <ManageSectorsDialog open={open} onOpenChange={onOpenChange} />;
      case 'src/components/treasury/InvoiceRequestDialog.tsx':
        return <InvoiceRequestDialog open={open} onOpenChange={onOpenChange} />;
      case 'src/components/treasury/InvoiceSettingsDialog.tsx':
        return <InvoiceSettingsDialog open={open} onOpenChange={onOpenChange} />;
      case 'src/components/treasury/CoinExchangeDialog.tsx':
        return <CoinExchangeDialog open={open} onOpenChange={onOpenChange} />;
      case 'src/components/treasury/TreasurySettingsDialog.tsx':
        return <TreasurySettingsDialog open={open} onOpenChange={onOpenChange} />;
      case 'src/components/stock/PalletCalculatorDialog.tsx':
        return <PalletCalculatorDialog open={open} onOpenChange={onOpenChange} />;
      case 'src/components/customers/CustomerFieldSettingsDialog.tsx':
        return <CustomerFieldSettingsDialog open={open} onOpenChange={onOpenChange} />;
      case 'src/components/attendance/AttendanceSettingsDialog.tsx':
        return <AttendanceSettingsDialog open={open} onOpenChange={onOpenChange} />;
      case 'src/components/rewards/CreateRewardTaskDialog.tsx':
        return <CreateRewardTaskDialog open={open} onOpenChange={onOpenChange} />;
      case 'src/components/offers/CreateOfferDialog.tsx':
        return <CreateOfferDialog open={open} onOpenChange={onOpenChange} onSuccess={noop} />;
      default:
        return null;
    }
  };

  const dialog = renderDialog();
  if (!dialog) return null;

  return <Suspense fallback={fallback}>{dialog}</Suspense>;
};

export const PREVIEWABLE_DIALOGS = new Set([
  'src/components/orders/CreateOrderDialog.tsx',
  'src/components/orders/OrderSearchDialog.tsx',
  'src/components/accounting/CreateSessionDialog.tsx',
  'src/components/expenses/AddExpenseDialog.tsx',
  'src/components/customers/ManageSectorsDialog.tsx',
  'src/components/treasury/InvoiceRequestDialog.tsx',
  'src/components/treasury/InvoiceSettingsDialog.tsx',
  'src/components/treasury/CoinExchangeDialog.tsx',
  'src/components/treasury/TreasurySettingsDialog.tsx',
  'src/components/stock/PalletCalculatorDialog.tsx',
  'src/components/customers/CustomerFieldSettingsDialog.tsx',
  'src/components/attendance/AttendanceSettingsDialog.tsx',
  'src/components/rewards/CreateRewardTaskDialog.tsx',
  'src/components/offers/CreateOfferDialog.tsx',
]);

export default DialogPreviewRenderer;
