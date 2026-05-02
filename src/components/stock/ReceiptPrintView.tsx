import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { dbBPDisplay, dbBPToBoxes, boxesToBP } from '@/utils/boxPieceInput';
import { formatDate } from '@/utils/formatters';

interface ReceiptPrintItem {
  product_name: string;
  new_qty: number;
  comp_qty: number;
  comp_offers_qty: number;
  pieces_per_box: number;
  image_url?: string | null;
}

interface DriverInfo {
  driver_name?: string | null;
  driver_phone?: string | null;
  license_plate?: string | null;
}

interface DeliveryDetail {
  pallet_count?: number | null;
  created_at?: string | null;
  notes?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'reception' | 'transfer';
  invoiceNumber?: string | null;
  date: string;
  items: ReceiptPrintItem[];
  driverInfo?: DriverInfo;
  notes?: string | null;
  branchName?: string;
  palletCount?: number | null;
  receiptExpenses?: number | null;
  expensesDescription?: string | null;
  deliveryDetail?: DeliveryDetail | null;
}

const ReceiptPrintView: React.FC<Props> = ({
  open, onOpenChange, type, invoiceNumber, date, items, driverInfo, notes, branchName,
  palletCount, receiptExpenses, expensesDescription, deliveryDetail,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const title = 'Bon de Transfert';

  const hasComp = items.some(i => i.comp_qty > 0);
  const hasCompOffers = items.some(i => i.comp_offers_qty > 0);
  const colCount = 3 + (hasComp ? 1 : 0) + (hasCompOffers ? 1 : 0);

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html dir="ltr">
        <head>
          <title>${title}</title>
           <style>
            body { font-family: Arial, sans-serif; padding: 20px; direction: ltr; color: #000; }
            h1 { text-align: center; font-size: 22px; margin-bottom: 10px; color: #000; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #000; padding: 6px 10px; text-align: left; font-size: 13px; color: #000; }
            th { font-weight: bold; }
            .signature { display: flex; justify-content: space-between; margin-top: 40px; }
            .signature div { text-align: center; width: 40%; }
            .sig-line { border-top: 1px solid #000; margin-top: 50px; padding-top: 5px; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="ltr">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef}>
          <h1 style={{ textAlign: 'center', fontSize: '22px', marginBottom: '10px' }}>{title}</h1>

          <div style={{ margin: '15px 0', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
              <span>Date: {formatDate(date, 'dd/MM/yyyy HH:mm', 'fr')}</span>
              {invoiceNumber && <span>N° Facture: {invoiceNumber}</span>}
            </div>
            {branchName && (
              <div style={{ margin: '4px 0' }}>Succursale: {branchName}</div>
            )}
          </div>

          {driverInfo && (driverInfo.driver_name || driverInfo.driver_phone || driverInfo.license_plate) && (
            <div style={{ border: '1px solid #ccc', padding: '8px', borderRadius: '5px', margin: '10px 0' }}>
              <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '5px' }}>Informations du chauffeur</div>
              {driverInfo.driver_name && <div style={{ fontSize: '12px' }}>Nom: {driverInfo.driver_name}</div>}
              {driverInfo.driver_phone && <div style={{ fontSize: '12px' }}>Téléphone: {driverInfo.driver_phone}</div>}
              {driverInfo.license_plate && <div style={{ fontSize: '12px' }}>Immatriculation: {driverInfo.license_plate}</div>}
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '15px 0' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'left', color: '#000' }}>#</th>
                <th style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'left', color: '#000' }}>Produit</th>
                <th style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'center', color: '#000' }}>Nouveau</th>
                <th style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'center', color: '#000' }}>Comp. Dommage</th>
                <th style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'center', color: '#000' }}>Comp. Offres</th>
                <th style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'center', fontWeight: 'bold', color: '#000' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const total = item.new_qty + item.comp_qty + item.comp_offers_qty;
                return (
                  <tr key={i}>
                    <td style={{ border: '1px solid #000', padding: '6px 10px', color: '#000' }}>{i + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '6px 10px', color: '#000' }}>{item.product_name}</td>
                    <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'center', color: '#000' }}>{item.new_qty > 0 ? boxesToBP(item.new_qty, item.pieces_per_box) : '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'center', color: '#000' }}>{item.comp_qty > 0 ? boxesToBP(item.comp_qty, item.pieces_per_box) : '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'center', color: '#000' }}>{item.comp_offers_qty > 0 ? boxesToBP(item.comp_offers_qty, item.pieces_per_box) : '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'center', fontWeight: 'bold', color: '#000' }}>{boxesToBP(total, item.pieces_per_box)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {notes && (
            <div style={{ fontSize: '12px', margin: '10px 0', color: '#000' }}>
              Remarques: {notes}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px' }}>
            <div style={{ textAlign: 'center', width: '40%' }}>
              <div style={{ borderTop: '1px solid #333', marginTop: '50px', paddingTop: '5px' }}>Signature du récepteur</div>
            </div>
            <div style={{ textAlign: 'center', width: '40%' }}>
              <div style={{ borderTop: '1px solid #333', marginTop: '50px', paddingTop: '5px' }}>Signature du livreur</div>
            </div>
          </div>
        </div>

        <Button className="w-full" onClick={handlePrint}>
          <Printer className="w-4 h-4 ml-2" /> Imprimer
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptPrintView;
