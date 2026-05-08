import { boxesToBP, dbBPDisplay, dbBPToBoxes, parseBP } from '@/utils/boxPieceInput';
import { buildPrintHeaderHTML } from '@/utils/printHeader';
import { parseReceiptMeta, ReceiptMeta } from '@/utils/stockReceipt';

export interface PrintReceiptItem {
  product_name: string;
  product_app_name?: string | null;
  pieces_per_box: number;
  new_qty: number;
  comp_qty: number;
  comp_offers_qty: number;
}

export interface PrintDeliveryItem {
  product_name: string;
  product_app_name?: string | null;
  pieces_per_box: number;
  quantity: number;
  lot_number?: string | null;
  manufacturing_date?: string | null;
  manufacturing_time?: string | null;
  delivery_date?: string | null;
}

export interface PrintReceiptInput {
  invoice_number?: string | null;
  notes?: string | null;
  created_at: string;
  pallet_count?: number | null;
  receipt_expenses?: number | null;
  expenses_description?: string | null;
  expenses_breakdown?: { description: string; amount: number }[] | null;
  meta?: ReceiptMeta;
  items: PrintReceiptItem[];
}

export interface PrintDeliveryInput {
  notes?: string | null;
  created_at: string;
  creator_name?: string | null;
  pallet_count?: number | null;
  items: PrintDeliveryItem[];
}

export const printFactoryReceiptDetails = (
  receipt: PrintReceiptInput,
  linkedDelivery: PrintDeliveryInput | null,
  companyInfo: any,
) => {
  const w = window.open('', '_blank');
  if (!w) return;
  const dateStr = new Date(receipt.created_at).toLocaleString('fr');
  const drv = receipt.meta || parseReceiptMeta(receipt.notes || null);
  const hasDriver = drv.driver_name || drv.driver_phone || drv.license_plate;

  const itemsRows = receipt.items.map((it, i) => {
    const totalBoxes =
      dbBPToBoxes(it.new_qty, it.pieces_per_box) +
      dbBPToBoxes(it.comp_qty, it.pieces_per_box) +
      dbBPToBoxes(it.comp_offers_qty, it.pieces_per_box);
    return `<tr>
      <td>${i + 1}</td>
      <td>${it.product_app_name || it.product_name}</td>
      <td style="text-align:center">${it.new_qty > 0 ? dbBPDisplay(it.new_qty, it.pieces_per_box) : '-'}</td>
      <td style="text-align:center">${it.comp_qty > 0 ? dbBPDisplay(it.comp_qty, it.pieces_per_box) : '-'}</td>
      <td style="text-align:center">${it.comp_offers_qty > 0 ? dbBPDisplay(it.comp_offers_qty, it.pieces_per_box) : '-'}</td>
      <td style="text-align:center;font-weight:bold">${boxesToBP(totalBoxes, it.pieces_per_box)}</td>
    </tr>`;
  }).join('');

  const breakdown = (Array.isArray(receipt.expenses_breakdown) && receipt.expenses_breakdown!.length > 0)
    ? receipt.expenses_breakdown!
    : ((receipt.receipt_expenses ?? 0) > 0
        ? [{ description: receipt.expenses_description || '-', amount: Number(receipt.receipt_expenses) || 0 }]
        : []);
  const total = breakdown.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const expensesHtml = breakdown.length > 0 ? `
    <h3 style="margin-top:8px">Frais de réception</h3>
    <table>
      <thead>
        <tr><th>#</th><th>Description</th><th style="text-align:center">Montant (DA)</th></tr>
      </thead>
      <tbody>
        ${breakdown.map((l, i) => `<tr><td>${i + 1}</td><td>${l.description || '-'}</td><td style="text-align:center">${Number(l.amount || 0).toLocaleString()}</td></tr>`).join('')}
        <tr><td colspan="2" style="text-align:right;font-weight:bold">Total</td><td style="text-align:center;font-weight:bold">${total.toLocaleString()} DA</td></tr>
      </tbody>
    </table>
  ` : '';

  w.document.write(`
    <html dir="ltr"><head><title>Bon de Transfert - Détails</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;color:#000}
      h1{text-align:center;font-size:22px;margin-bottom:10px}
      h2{text-align:center;font-size:16px;margin:0 0 15px 0;color:#444}
      .box{border:1px solid #999;border-radius:5px;padding:10px;margin:10px 0}
      .box h3{margin:0 0 8px 0;font-size:14px;border-bottom:1px solid #ccc;padding-bottom:4px}
      .row{font-size:13px;margin:4px 0}
      .label{color:#555}
      table{width:100%;border-collapse:collapse;margin-top:6px}
      th,td{border:1px solid #000;padding:5px 8px;font-size:12px;text-align:left}
      th{background:#f0f0f0}
      .signature{display:flex;justify-content:space-between;margin-top:40px}
      .signature div{text-align:center;width:40%}
      .sig-line{border-top:1px solid #000;margin-top:50px;padding-top:5px}
    </style></head><body>
      ${buildPrintHeaderHTML(companyInfo, { dir: "ltr" })}
      <h1>Bon de Transfert</h1>
      <h2>Détails de réception</h2>
      <div class="row"><span class="label">Date:</span> <strong>${dateStr}</strong></div>
      ${receipt.invoice_number ? `<div class="row"><span class="label">N° Facture:</span> <strong>${receipt.invoice_number}</strong></div>` : ''}
      <div class="row"><span class="label">Source:</span> <strong>${drv.source === 'branch' ? 'Autre succursale' : 'Usine'}</strong></div>

      ${hasDriver ? `
        <div class="box">
          <h3>Informations du chauffeur</h3>
          ${drv.driver_name ? `<div class="row">Nom: ${drv.driver_name}</div>` : ''}
          ${drv.driver_phone ? `<div class="row">Téléphone: ${drv.driver_phone}</div>` : ''}
          ${drv.license_plate ? `<div class="row">Immatriculation: ${drv.license_plate}</div>` : ''}
        </div>
      ` : ''}

      <table>
        <thead>
          <tr>
            <th>#</th><th>Produit</th>
            <th style="text-align:center">Nouveau</th>
            <th style="text-align:center">Comp. Dommage</th>
            <th style="text-align:center">Comp. Offres</th>
            <th style="text-align:center">Total</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>

      <div class="box">
        <h3>Détails supplémentaires</h3>
        <div class="row"><span class="label">Nombre de palettes:</span> <strong>${receipt.pallet_count ?? 0}</strong></div>
        ${expensesHtml}
      </div>

      ${linkedDelivery ? `
        <div class="box">
          <h3>Livraison liée (التسليم)</h3>
          <div class="row"><span class="label">Date livraison:</span> <strong>${new Date(linkedDelivery.created_at).toLocaleString('fr')}</strong></div>
          <div class="row"><span class="label">Palettes livrées:</span> <strong>${linkedDelivery.pallet_count ?? 0}</strong></div>
          ${linkedDelivery.notes ? `<div class="row"><span class="label">Remarques:</span> ${linkedDelivery.notes}</div>` : ''}
          ${linkedDelivery.items.length > 0 ? `
          <table><thead><tr>
            <th>#</th><th>Produit</th>
            <th style="text-align:center">N° de LOT</th>
            <th style="text-align:center">Date fab.</th>
            <th style="text-align:center">Quantité</th>
          </tr></thead><tbody>
            ${linkedDelivery.items.map((it, i) => `<tr>
              <td>${i + 1}</td>
              <td>${it.product_app_name || it.product_name}</td>
              <td style="text-align:center">${it.lot_number || '-'}</td>
              <td style="text-align:center">${it.manufacturing_date || '-'}</td>
              <td style="text-align:center">${dbBPDisplay(it.quantity, it.pieces_per_box || 1)}</td>
            </tr>`).join('')}
          </tbody></table>` : ''}
        </div>
      ` : ''}

      ${drv.text ? `<div class="box"><h3>Remarques</h3><div class="row">${drv.text}</div></div>` : ''}

      <div class="signature">
        <div><div class="sig-line">Signature du récepteur</div></div>
        <div><div class="sig-line">Signature du livreur</div></div>
      </div>
    </body></html>
  `);
  w.document.close();
  w.print();
};

export const printFactoryDeliveryDetails = (
  delivery: PrintDeliveryInput,
  companyInfo: any,
) => {
  const w = window.open('', '_blank');
  if (!w) return;
  const dateStr = new Date(delivery.created_at).toLocaleString('fr');

  const itemsRows = delivery.items.map((it, i) => {
    const ppb = it.pieces_per_box || 1;
    const parsed = parseBP(Number(it.quantity || 0).toFixed(2), ppb);
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${it.product_app_name || it.product_name}</td>
        <td style="text-align:center">${it.lot_number || '-'}</td>
        <td style="text-align:center">${it.manufacturing_date || '-'}</td>
        <td style="text-align:center">${it.manufacturing_time || '-'}</td>
        <td style="text-align:center">${it.delivery_date || '-'}</td>
        <td style="text-align:center">${parsed.boxes}</td>
        <td style="text-align:center">${parsed.pieces}</td>
        <td style="text-align:center;font-weight:bold">${parsed.display}</td>
      </tr>`;
  }).join('');

  const totalBoxesSum = delivery.items.reduce((s, it) => s + dbBPToBoxes(it.quantity, it.pieces_per_box || 1), 0);
  const totalAvgPpb = delivery.items.length > 0 ? (delivery.items[0].pieces_per_box || 1) : 1;
  const totalDisplay = boxesToBP(totalBoxesSum, totalAvgPpb);

  w.document.write(`
    <html dir="ltr"><head><title>Bon de Livraison Usine - Détails</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;color:#000}
      h1{text-align:center;font-size:22px;margin-bottom:10px}
      h2{text-align:center;font-size:16px;margin:0 0 15px 0;color:#444}
      .box{border:1px solid #999;border-radius:5px;padding:10px;margin:10px 0}
      .box h3{margin:0 0 8px 0;font-size:14px;border-bottom:1px solid #ccc;padding-bottom:4px}
      .row{font-size:13px;margin:4px 0}
      .label{color:#555}
      table{width:100%;border-collapse:collapse;margin-top:6px}
      th,td{border:1px solid #000;padding:5px 6px;font-size:11px;text-align:left}
      th{background:#f0f0f0}
      .signature{display:flex;justify-content:space-between;margin-top:40px}
      .signature div{text-align:center;width:40%}
      .sig-line{border-top:1px solid #000;margin-top:50px;padding-top:5px}
    </style></head><body>
      ${buildPrintHeaderHTML(companyInfo, { dir: "ltr" })}
      <h1>Bon de Livraison Usine</h1>
      <h2>Détails de livraison (produits endommagés)</h2>
      <div class="row"><span class="label">Date:</span> <strong>${dateStr}</strong></div>
      ${delivery.creator_name ? `<div class="row"><span class="label">Créé par:</span> <strong>${delivery.creator_name}</strong></div>` : ''}

      <div class="box">
        <h3>Détails supplémentaires</h3>
        <div class="row"><span class="label">Nombre de palettes livrées:</span> <strong>${delivery.pallet_count ?? 0}</strong></div>
      </div>

      ${delivery.items.length > 0 ? `
        <h3 style="margin-top:8px">Produits endommagés</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Produit</th>
              <th style="text-align:center">N° de LOT</th>
              <th style="text-align:center">Date fab.</th>
              <th style="text-align:center">Heure fab.</th>
              <th style="text-align:center">Date liv.</th>
              <th style="text-align:center">Cartons</th>
              <th style="text-align:center">Pièces</th>
              <th style="text-align:center">Total (B.P)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
            <tr>
              <td colspan="8" style="text-align:right;font-weight:bold">Total général (B.P)</td>
              <td style="text-align:center;font-weight:bold">${totalDisplay}</td>
            </tr>
          </tbody>
        </table>
      ` : ''}

      ${delivery.notes ? `<div class="box"><h3>Remarques</h3><div class="row">${delivery.notes}</div></div>` : ''}

      <div class="signature">
        <div><div class="sig-line">Signature du livreur</div></div>
        <div><div class="sig-line">Signature usine</div></div>
      </div>
    </body></html>
  `);
  w.document.close();
  w.print();
};
