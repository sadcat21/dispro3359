import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { ALGERIAN_WILAYAS } from '@/data/algerianWilayas';
import { StampPriceTier } from '@/types/stamp';
import { calculateStampAmount } from '@/hooks/useStampTiers';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';
import { PrintHeader } from '@/utils/printHeader';
import logoAsset from '@/assets/logo.png';

interface HandoverItem {
  order_id: string;
  payment_method: string;
  amount: number;
  customer_name: string | null;
  customer_name_fr?: string | null;
  customer_app_name?: string | null;
  base_amount?: number;
  stamp_amount?: number;
  stamp_percentage?: number;
  invoice_number?: string;
  invoice_date?: string;
  check_number?: string;
  check_date?: string;
  check_bank?: string;
  receipt_number?: string;
  transfer_reference?: string;
  paid_amount?: number;
  remaining_amount?: number;
}

interface Props {
  handoverId: string;
  handoverDate: string;
  cashInvoice1: number;
  cashInvoice2: number;
  checksAmount: number;
  receiptsAmount: number;
  transfersAmount: number;
  totalAmount: number;
  expensesAmount?: number;
  branchName?: string;
  branchWilaya?: string;
  deliveryMethod?: string;
  intermediaryName?: string;
  bankTransferReference?: string;
  receivedBy?: string;
  senderName?: string;
  unifiedCash?: boolean;
  onReady?: () => void;
}

const HandoverPrintView: React.FC<Props> = ({
  handoverId,
  handoverDate,
  cashInvoice1,
  cashInvoice2,
  checksAmount,
  receiptsAmount,
  transfersAmount,
  totalAmount,
  expensesAmount = 0,
  branchWilaya,
  deliveryMethod,
  intermediaryName,
  bankTransferReference,
  receivedBy,
  senderName,
  unifiedCash,
  onReady,
}) => {
  const [items, setItems] = useState<HandoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { companyInfo } = useCompanyInfo();

  useEffect(() => {
    const fetchItems = async () => {
      const { data: stampTiers } = await supabase
        .from('stamp_price_tiers')
        .select('*')
        .eq('is_active', true)
        .order('min_amount', { ascending: true });

      const { data } = await supabase
        .from('handover_items')
        .select('order_id, payment_method, amount, customer_name, treasury_entry_id')
        .eq('handover_id', handoverId);

      if (!data?.length) {
        setLoading(false);
        onReady?.();
        return;
      }

      const treasuryIds = data.filter((item) => item.treasury_entry_id).map((item) => item.treasury_entry_id);
      const treasuryMap: Record<string, any> = {};
      if (treasuryIds.length > 0) {
        const { data: treasuryEntries } = await supabase
          .from('manager_treasury')
          .select('id, invoice_number, invoice_date, check_number, check_date, check_bank, receipt_number, transfer_reference')
          .in('id', treasuryIds);
        (treasuryEntries || []).forEach((entry) => {
          treasuryMap[entry.id] = entry;
        });
      }

      const orderIds = data.map((item) => item.order_id).filter(Boolean);
      const orderMap: Record<string, any> = {};
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from('orders')
          .select('id, created_at, delivery_date, total_amount, order_items(total_price), customers(name_fr, name, store_name_fr, store_name, owner_first_name_fr, owner_last_name_fr)')
          .in('id', orderIds);
        (orders || []).forEach((order) => {
          orderMap[order.id] = order;
        });
      }

      // Per-order paid / remaining for receipt_cash items
      const receiptCashOrderIds = data
        .filter((it) => it.payment_method === 'receipt_cash')
        .map((it) => it.order_id)
        .filter(Boolean) as string[];
      const debtMap: Record<string, { paid: number; remaining: number; total: number }> = {};
      if (receiptCashOrderIds.length > 0) {
        const { data: debts } = await supabase
          .from('customer_debts')
          .select('order_id, paid_amount, remaining_amount, total_amount')
          .in('order_id', receiptCashOrderIds);
        (debts || []).forEach((d: any) => {
          debtMap[d.order_id] = {
            paid: Number(d.paid_amount || 0),
            remaining: Number(d.remaining_amount || 0),
            total: Number(d.total_amount || 0),
          };
        });
      }

      const enriched: HandoverItem[] = data.map((item) => {
        const treasuryEntry = item.treasury_entry_id ? treasuryMap[item.treasury_entry_id] : null;
        const order = item.order_id ? orderMap[item.order_id] : null;
        const customer = order?.customers;
        const ownerFr = [customer?.owner_last_name_fr, customer?.owner_first_name_fr].filter(Boolean).join(' ').trim();
        const customerNameFr = ownerFr || customer?.name_fr || null;
        const customerAppName = customer?.name || item.customer_name || null;
        const customerName = customerNameFr || customerAppName;
        const itemsSubtotal = (order?.order_items || []).reduce((sum: number, orderItem: any) => sum + Number(orderItem.total_price || 0), 0);
        const stampBaseAmount = itemsSubtotal > 0 ? itemsSubtotal : Number(order?.total_amount || item.amount || 0);
        const activeTiers = (stampTiers || []) as StampPriceTier[];
        const matchedTier = item.payment_method === 'cash'
          ? activeTiers.find((tier) => stampBaseAmount >= tier.min_amount && (tier.max_amount === null || stampBaseAmount <= tier.max_amount))
          : null;
        const exactStampAmount = item.payment_method === 'cash' && matchedTier
          ? Number(calculateStampAmount(stampBaseAmount, activeTiers).toFixed(2))
          : 0;
        const debt = item.payment_method === 'receipt_cash' && item.order_id ? debtMap[item.order_id] : null;
        return {
          ...item,
          customer_name: customerName || item.customer_name,
          customer_name_fr: customerNameFr,
          customer_app_name: customerAppName,
          base_amount: item.payment_method === 'cash'
            ? Number((Number(item.amount || 0) - exactStampAmount).toFixed(2))
            : undefined,
          stamp_amount: item.payment_method === 'cash' ? exactStampAmount : undefined,
          stamp_percentage: item.payment_method === 'cash' ? Number(matchedTier?.percentage || 0) : undefined,
          invoice_number: treasuryEntry?.invoice_number || undefined,
          invoice_date: treasuryEntry?.invoice_date || (order ? format(new Date(order.delivery_date || order.created_at), 'dd/MM/yyyy') : undefined),
          check_number: treasuryEntry?.check_number || undefined,
          check_date: treasuryEntry?.check_date || undefined,
          check_bank: treasuryEntry?.check_bank || undefined,
          receipt_number: treasuryEntry?.receipt_number || undefined,
          transfer_reference: treasuryEntry?.transfer_reference || undefined,
          paid_amount: debt ? debt.paid : (item.payment_method === 'receipt_cash' ? Number(item.amount || 0) : undefined),
          remaining_amount: debt ? debt.remaining : (item.payment_method === 'receipt_cash' ? 0 : undefined),
        };
      });

      setItems(enriched);
      setLoading(false);
      setTimeout(() => onReady?.(), 100);
    };

    fetchItems();
  }, [handoverId, onReady]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const checks = items.filter((item) => item.payment_method === 'check');
  const receiptDocs = items.filter((item) => item.payment_method === 'receipt');
  const receiptCash = items.filter((item) => item.payment_method === 'receipt_cash');
  const cashItems = items.filter((item) => item.payment_method === 'cash');
  const transfers = items.filter((item) => item.payment_method === 'transfer');

  const cashItemsTotal = cashItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const receiptCashTotal = receiptCash.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const receiptCashPaidTotal = receiptCash.reduce((sum, item) => sum + Number(item.paid_amount ?? item.amount ?? 0), 0);
  const receiptCashRemainingTotal = receiptCash.reduce((sum, item) => sum + Number(item.remaining_amount ?? 0), 0);
  const extraCashTotal = Math.max(0, totalAmount - (cashInvoice1 + cashInvoice2 + checksAmount + receiptsAmount + transfersAmount));
  const stampAmount = Math.max(0, cashInvoice1 - cashItemsTotal - receiptCashPaidTotal);
  const dateStr = format(new Date(handoverDate), 'dd/MM/yyyy');
  const wilayaFr = branchWilaya ? ALGERIAN_WILAYAS.find((wilaya) => wilaya.name === branchWilaya)?.nameFr || branchWilaya : '';
  const cashItemsWithStamp: HandoverItem[] = (() => {
    if (cashItems.length === 0) return [];

    const exactStampTotal = cashItems.reduce((sum, item) => sum + Number(item.stamp_amount || 0), 0);
    const useExactStamp = exactStampTotal > 0;

    if (useExactStamp) {
      return cashItems.map((item) => ({
        ...item,
        base_amount: Number(
          (
            item.base_amount ??
            (Number(item.amount || 0) - Number(item.stamp_amount || 0))
          ).toFixed(2),
        ),
        stamp_amount: Number(item.stamp_amount || 0),
      }));
    }

    if (stampAmount <= 0 || cashItemsTotal <= 0) {
      return cashItems.map((item) => ({
        ...item,
        base_amount: Number(item.amount || 0),
        stamp_amount: 0,
        stamp_percentage: 0,
      }));
    }

    let distributedStamp = 0;
    return cashItems.map((item, index) => {
      const itemAmount = Number(item.amount || 0);
      const isLast = index === cashItems.length - 1;
      const itemStamp = isLast
        ? Math.max(0, Number((stampAmount - distributedStamp).toFixed(2)))
        : Number(((stampAmount * itemAmount) / cashItemsTotal).toFixed(2));

      distributedStamp += itemStamp;

      return {
        ...item,
        base_amount: Math.max(0, Number((itemAmount - itemStamp).toFixed(2))),
        stamp_amount: itemStamp,
        stamp_percentage: itemAmount > 0 ? Number(((itemStamp / itemAmount) * 100).toFixed(2)) : 0,
      };
    });
  })();
  const cashItemsNetTotal = cashItemsWithStamp.reduce((sum, item) => sum + Number(item.base_amount || 0), 0);
  const cashItemsStampTotal = cashItemsWithStamp.reduce((sum, item) => sum + Number(item.stamp_amount || 0), 0);

  const renderClientCell = (item: HandoverItem) => {
    const frName = item.customer_name_fr && item.customer_name_fr.trim();
    const displayName = frName || item.customer_app_name || item.customer_name || '-';
    return <div style={{ color: '#dc2626' }}>{displayName}</div>;
  };

  const renderSimpleTable = (
    title: string,
    tableItems: HandoverItem[],
    total: number,
    extraColumns?: Array<{
      header: string;
      cell: (item: HandoverItem) => string;
      className?: string;
    }>,
  ) => {
    const extras = extraColumns || [];
    return (
      <div className="hv-block" data-pdf-section>
        <div className="hv-block-title">{title} ({tableItems.length})</div>
        <table className="hv-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Client</th>
              <th style={{ textAlign: 'left' }}>N° Facture</th>
              <th style={{ textAlign: 'right' }}>Montant</th>
              {extras.map((column) => (
                <th key={column.header} style={{ textAlign: 'left' }}>{column.header}</th>
              ))}
              <th style={{ textAlign: 'left' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {tableItems.length === 0 ? (
              <tr>
                <td colSpan={3 + extras.length + 1} style={{ textAlign: 'center', color: '#64748b' }}>-</td>
              </tr>
            ) : (
              tableItems.map((item, index) => (
                <tr key={`${title}-${index}`}>
                  <td style={{ textAlign: 'left' }}>{renderClientCell(item)}</td>
                  <td style={{ textAlign: 'left' }}>{item.invoice_number || '-'}</td>
                  <td style={{ textAlign: 'right' }}>{item.amount.toLocaleString()}</td>
                  {extras.map((column) => (
                    <td key={column.header} style={{ textAlign: 'left' }}>{column.cell(item)}</td>
                  ))}
                  <td style={{ textAlign: 'left' }}>{item.invoice_date || item.check_date || '-'}</td>
                </tr>
              ))
            )}
            <tr className="hv-total-row">
              <td colSpan={2} style={{ textAlign: 'left' }}>Total {title}</td>
              <td style={{ textAlign: 'right' }}>{total.toLocaleString()}</td>
              <td colSpan={extras.length + 1}></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderCashInvoice1Table = () => (
    <div className="hv-block" data-pdf-section>
      <div className="hv-block-title">ESPÈCES FACTURE 1 ({cashItemsWithStamp.length})</div>
      <table className="hv-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Client</th>
            <th style={{ textAlign: 'left' }}>N° Facture</th>
            <th style={{ textAlign: 'right' }}>Montant HT</th>
            <th style={{ textAlign: 'right' }}>Taux %</th>
            <th style={{ textAlign: 'right' }}>Timbre</th>
            <th style={{ textAlign: 'right' }}>Montant TTC</th>
            <th style={{ textAlign: 'left' }}>Date</th>
          </tr>
        </thead>
        <tbody>
          {cashItemsWithStamp.length === 0 ? (
            <tr><td colSpan={7} style={{ textAlign: 'center', color: '#64748b' }}>-</td></tr>
          ) : (
            cashItemsWithStamp.map((item, index) => (
              <tr key={`cash-invoice1-${index}`}>
                <td style={{ textAlign: 'left' }}>{renderClientCell(item)}</td>
                <td style={{ textAlign: 'left' }}>{item.invoice_number || '-'}</td>
                <td style={{ textAlign: 'right' }}>{Number(item.base_amount || 0).toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{Number(item.stamp_percentage || 0).toLocaleString()}%</td>
                <td style={{ textAlign: 'right' }}>{Number(item.stamp_amount || 0).toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{Number(item.amount || 0).toLocaleString()}</td>
                <td style={{ textAlign: 'left' }}>{item.invoice_date || item.check_date || '-'}</td>
              </tr>
            ))
          )}
          <tr className="hv-total-row">
            <td colSpan={2} style={{ textAlign: 'left' }}>Total ESPÈCES FACTURE 1</td>
            <td style={{ textAlign: 'right' }}>{cashItemsNetTotal.toLocaleString()}</td>
            <td style={{ textAlign: 'right' }}>-</td>
            <td style={{ textAlign: 'right' }}>{cashItemsStampTotal.toLocaleString()}</td>
            <td style={{ textAlign: 'right' }}>{cashItemsTotal.toLocaleString()}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const summaryRow = (label: string, value: number, accent?: string) => (
    <div className="hv-row">
      <span>{label}</span>
      <strong style={accent ? { color: accent } : undefined}>{value.toLocaleString()} DA</strong>
    </div>
  );

  return (
    <div className="print-handover" style={{ direction: 'ltr', textAlign: 'left', unicodeBidi: 'plaintext', background: '#fff', color: '#0f172a', fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: '12px', padding: '24px' }}>
      <style>{`
        .print-handover .hv-header { border-bottom: 3px double #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
        .print-handover .hv-meta { font-size: 11px; color: #000; line-height: 1.6; margin-top: 4px; }
        .print-handover .hv-meta b { color: #0f172a; }
        .print-handover .hv-block { border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; margin-bottom: 10px; page-break-inside: avoid; }
        .print-handover .hv-block-title { color: #dc2626; background: #fef2f2; padding: 6px 10px; font-size: 11px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; border-bottom: 1px solid #fecaca; }
        .print-handover .hv-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .print-handover .hv-table th { background: #f8fafc; color: #0f172a; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; font-size: 9px; padding: 5px 6px; border: 1px solid #e2e8f0; }
        .print-handover .hv-table td { border: 1px solid #e2e8f0; padding: 4px 6px; font-variant-numeric: tabular-nums; color: #0f172a; }
        .print-handover .hv-table tbody tr:nth-child(even) td { background: #f8fafc; }
        .print-handover .hv-table .hv-total-row td { background: #fef2f2 !important; color: #b91c1c; font-weight: 800; }
        .print-handover .hv-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px; }
        .print-handover .hv-block-body { padding: 4px 0; }
        .print-handover .hv-row { display: flex; justify-content: space-between; gap: 10px; padding: 5px 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
        .print-handover .hv-row:last-child { border-bottom: none; }
        .print-handover .hv-row strong { font-variant-numeric: tabular-nums; }
        .print-handover .hv-grand { margin-top: 10px; border: 2px solid #0f172a; border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
        .print-handover .hv-grand span { font-size: 13px; font-weight: 800; color: #0f172a; letter-spacing: 0.4px; text-transform: uppercase; }
        .print-handover .hv-grand strong { font-size: 14px; font-weight: 900; color: #15803d; font-variant-numeric: tabular-nums; }
        .print-handover .hv-sign { margin-top: 24px; font-size: 11px; color: #0f172a; }
        .print-handover .hv-sign .line { display: inline-block; border-top: 1px solid #0f172a; min-width: 220px; margin-left: 8px; padding-top: 4px; }
      `}</style>

      <div data-pdf-section style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', padding: '10px 6px', marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: 1, textTransform: 'uppercase' }}>Versement Dépôt</div>
      </div>

      <div className="hv-header" data-pdf-section>
        <div className="hv-meta">
          <div>
            <b>Date d'envoi :</b> {dateStr}
            {wilayaFr && <> &nbsp;|&nbsp; <b>Dépôt :</b> {wilayaFr}</>}
            {deliveryMethod === 'intermediary' && intermediaryName && <> &nbsp;|&nbsp; <b>Intermédiaire :</b> {intermediaryName}</>}
            {deliveryMethod === 'bank_transfer' && bankTransferReference && <> &nbsp;|&nbsp; <b>Réf. virement :</b> {bankTransferReference}</>}
          </div>
          {senderName && <div><b>Expéditeur :</b> {senderName}</div>}
          {receivedBy && <div><b>Destinataire :</b> {receivedBy}</div>}
        </div>
      </div>



      {(() => {
        const sections: Array<{ title: string; isEmpty: boolean; node: React.ReactNode }> = [
          { title: 'CHEQUES', isEmpty: checks.length === 0, node: renderSimpleTable('CHEQUES', checks, checksAmount, [
            { header: 'N° Chèque', cell: (item) => item.check_number || '-' },
            { header: 'Banque', cell: (item) => item.check_bank || '-' },
          ]) },
          { title: 'ESPÈCES FACTURE 1', isEmpty: cashItemsWithStamp.length === 0, node: renderCashInvoice1Table() },
          { title: 'VERSEMENT CASH', isEmpty: receiptCash.length === 0, node: renderSimpleTable('VERSEMENT CASH', receiptCash, receiptCashTotal, [
            { header: 'N° Reçu', cell: (item) => item.receipt_number || '-' },
            { header: 'Payé', cell: (item) => Number(item.paid_amount ?? item.amount ?? 0).toLocaleString() },
            { header: 'Restant', cell: (item) => Number(item.remaining_amount ?? 0).toLocaleString() },
          ]) },
          { title: 'VERSEMENT DOC', isEmpty: receiptDocs.length === 0, node: renderSimpleTable('VERSEMENT DOC', receiptDocs, receiptsAmount, [
            { header: 'N° Reçu', cell: (item) => item.receipt_number || '-' },
          ]) },
          { title: 'VIREMENTS', isEmpty: transfers.length === 0, node: renderSimpleTable('VIREMENTS', transfers, transfersAmount, [
            { header: 'Référence', cell: (item) => item.transfer_reference || '-' },
          ]) },
        ];

        const emptyTitles = sections.filter((section) => section.isEmpty).map((section) => section.title);

        return (
          <>
            {sections.filter((section) => !section.isEmpty).map((section) => (
              <React.Fragment key={section.title}>{section.node}</React.Fragment>
            ))}
            {emptyTitles.length > 0 && (
              <div className="hv-block" data-pdf-section>
                <div className="hv-block-title">Notes</div>
                <div className="hv-block-body">
                  <div className="hv-row">
                    <span>Sections vides</span>
                    <strong>{emptyTitles.join(', ')}</strong>
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}

      <div className="hv-two-col" data-pdf-section>
        <div className="hv-block">
          <div className="hv-block-title">Argent Physique (Espèces)</div>
          <div className="hv-block-body">
            {(() => {
              const displayedStamp = Math.max(cashItemsStampTotal, stampAmount);
              const totalEspecesBrut = cashItemsTotal + receiptCashPaidTotal + displayedStamp + cashInvoice2 + extraCashTotal;
              const totalEspeces = totalEspecesBrut - expensesAmount;
              return unifiedCash ? (
                summaryRow('Espèces', totalEspeces, '#15803d')
              ) : (
                <>
                  {summaryRow('Espèces Facture 1', cashItemsTotal)}
                  {summaryRow('Versement Cash (Payé)', receiptCashPaidTotal)}
                  {summaryRow('Timbre Facture 1', cashItemsStampTotal)}
                  {summaryRow('Espèces Facture 2', cashInvoice2)}
                  {summaryRow('Recouvrement dettes / cash suppl.', extraCashTotal)}
                  {expensesAmount > 0 && summaryRow('Dépenses (révisées)', -expensesAmount, '#b91c1c')}
                  {summaryRow('Total Espèces', totalEspeces, '#15803d')}
                </>
              );
            })()}
          </div>
        </div>

        <div className="hv-block">
          <div className="hv-block-title">Valeurs en Transit</div>
          <div className="hv-block-body">
            {summaryRow('Chèques', checksAmount, '#1d4ed8')}
            {summaryRow('Versement Doc', receiptsAmount, '#7e22ce')}
            {summaryRow('Virements', transfersAmount, '#0e7490')}
            {summaryRow('Total Valeurs', checksAmount + receiptsAmount + transfersAmount, '#0f172a')}
          </div>
        </div>
      </div>

      <div className="hv-grand" data-pdf-section>
        <span>Total Général</span>
        <strong>{(totalAmount - (receiptCashTotal - receiptCashPaidTotal) - expensesAmount).toLocaleString()} DA</strong>
      </div>

      <div className="hv-sign" data-pdf-section>
        <b>Signature :</b> <span className="line"></span>
      </div>
    </div>
  );
};

export default HandoverPrintView;

