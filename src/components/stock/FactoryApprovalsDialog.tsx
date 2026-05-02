import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Loader2, Package, Truck, Inbox, Send, CheckCircle, XCircle, Lock, Unlock,
  Edit, Save, X, AlertTriangle, Boxes, Sparkles, Wrench, FileText, User, Phone, Car, Printer,
} from 'lucide-react';
import ReceiptPrintView from '@/components/stock/ReceiptPrintView';
import FactoryReceiptQuickDialog from '@/components/stock/FactoryReceiptQuickDialog';
import FactoryDeliveryQuickDialog from '@/components/stock/FactoryDeliveryQuickDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/utils/formatters';
import { parseReceiptItemBreakdown, parseReceiptMeta } from '@/utils/stockReceipt';
import { boxesToBP, dbBPDisplay, dbBPToBoxes, parseBP } from '@/utils/boxPieceInput';
import { getProductDisplayName } from '@/utils/productDisplayName';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ReceiptItemDetail {
  id: string;
  product_id: string;
  product_name: string;
  product_app_name?: string | null;
  image_url?: string | null;
  pieces_per_box: number;
  new_qty: number;       // raw db quantity (box.piece format if ppb>1)
  comp_qty: number;
  comp_offers_qty: number;
}

interface DeliveryItemDetail {
  id: string;
  product_id: string;
  product_name: string;
  product_app_name?: string | null;
  image_url?: string | null;
  pieces_per_box: number;
  quantity: number;
  lot_number?: string | null;
  manufacturing_date?: string | null;
  manufacturing_time?: string | null;
  delivery_date?: string | null;
}

interface ReceiptRecord {
  id: string;
  invoice_number: string | null;
  notes: string | null;
  created_at: string;
  status: string;
  created_by: string;
  creator_name?: string;
  branch_id: string;
  invoice_photo_url: string | null;
  frozen_at: string | null;
  rejection_note: string | null;
  linked_delivery_id: string | null;
  pallet_count?: number;
  receipt_expenses?: number;
  expenses_description?: string | null;
  expenses_breakdown?: { description: string; amount: number }[] | null;
  items: ReceiptItemDetail[];
  meta: ReturnType<typeof parseReceiptMeta>;
}

interface DeliveryRecord {
  id: string;
  notes: string | null;
  created_at: string;
  status: string;
  created_by: string;
  creator_name?: string;
  branch_id: string;
  pallet_count: number;
  frozen_at: string | null;
  rejection_note: string | null;
  linked_receipt_id: string | null;
  items: DeliveryItemDetail[];
}

const fmt = (qty: number, ppb: number): string => ppb > 1 ? dbBPDisplay(qty, ppb) : String(qty);

const FactoryApprovalsDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { workerId, activeBranch } = useAuth();
  const [branchId, setBranchId] = useState<string | null>(null);
  const [tab, setTab] = useState<'receipts' | 'deliveries'>('receipts');
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editReceiptItems, setEditReceiptItems] = useState<ReceiptItemDetail[]>([]);
  const [editDeliveryItems, setEditDeliveryItems] = useState<DeliveryItemDetail[]>([]);
  const [editPallets, setEditPallets] = useState(0);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [summaryReceipt, setSummaryReceipt] = useState<ReceiptRecord | null>(null);
  const [printReceipt, setPrintReceipt] = useState<ReceiptRecord | null>(null);
  const [fullEditReceiptId, setFullEditReceiptId] = useState<string | null>(null);
  const [fullEditDeliveryId, setFullEditDeliveryId] = useState<string | null>(null);

  const printReceiptDetails = (r: ReceiptRecord) => {
    const linkedD = r.linked_delivery_id ? deliveries.find(d => d.id === r.linked_delivery_id) : null;
    const w = window.open('', '_blank');
    if (!w) return;
    const dateStr = new Date(r.created_at).toLocaleString('fr');
    const drv = r.meta;
    const hasDriver = drv.driver_name || drv.driver_phone || drv.license_plate;

    const itemsRows = r.items.map((it, i) => {
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
        <h1>Bon de Transfert</h1>
        <h2>Détails de réception</h2>
        <div class="row"><span class="label">Date:</span> <strong>${dateStr}</strong></div>
        ${r.invoice_number ? `<div class="row"><span class="label">N° Facture:</span> <strong>${r.invoice_number}</strong></div>` : ''}
        <div class="row"><span class="label">Source:</span> <strong>${r.meta.source === 'branch' ? 'Autre succursale' : 'Usine'}</strong></div>

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

        ${(() => {
          const breakdown = (Array.isArray((r as any).expenses_breakdown) && (r as any).expenses_breakdown.length > 0)
            ? (r as any).expenses_breakdown as { description: string; amount: number }[]
            : ((r.receipt_expenses ?? 0) > 0
                ? [{ description: r.expenses_description || '-', amount: Number(r.receipt_expenses) || 0 }]
                : []);
          const total = breakdown.reduce((s, l) => s + (Number(l.amount) || 0), 0);
          const expensesHtml = breakdown.length > 0 ? `
            <h3 style="margin-top:8px">Frais de réception</h3>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Description</th>
                  <th style="text-align:center">Montant (DA)</th>
                </tr>
              </thead>
              <tbody>
                ${breakdown.map((l, i) => `<tr><td>${i + 1}</td><td>${l.description || '-'}</td><td style="text-align:center">${Number(l.amount || 0).toLocaleString()}</td></tr>`).join('')}
                <tr><td colspan="2" style="text-align:right;font-weight:bold">Total</td><td style="text-align:center;font-weight:bold">${total.toLocaleString()} DA</td></tr>
              </tbody>
            </table>
          ` : '';
          return `
            <div class="box">
              <h3>Détails supplémentaires</h3>
              <div class="row"><span class="label">Nombre de palettes:</span> <strong>${r.pallet_count ?? 0}</strong></div>
              ${expensesHtml}
            </div>
          `;
        })()}

        ${linkedD ? `
          <div class="box">
            <h3>Livraison liée</h3>
            <div class="row"><span class="label">Date livraison:</span> <strong>${new Date(linkedD.created_at).toLocaleString('fr')}</strong></div>
            <div class="row"><span class="label">Palettes livrées:</span> <strong>${linkedD.pallet_count ?? 0}</strong></div>
            ${linkedD.notes ? `<div class="row"><span class="label">Remarques:</span> ${linkedD.notes}</div>` : ''}
            <table><thead><tr><th>#</th><th>Produit</th><th>Quantité</th></tr></thead><tbody>
              ${linkedD.items.map((it, i) => `<tr><td>${i + 1}</td><td>${it.product_app_name || it.product_name}</td><td>${it.quantity}</td></tr>`).join('')}
            </tbody></table>
          </div>
        ` : ''}

        ${r.meta.text ? `<div class="box"><h3>Remarques</h3><div class="row">${r.meta.text}</div></div>` : ''}

        <div class="signature">
          <div><div class="sig-line">Signature du récepteur</div></div>
          <div><div class="sig-line">Signature du livreur</div></div>
        </div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const printDeliveryDetails = (d: DeliveryRecord) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const dateStr = new Date(d.created_at).toLocaleString('fr');

    const itemsRows = d.items.map((it, i) => {
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
      </tr>
    `;
    }).join('');

    const totalBoxesSum = d.items.reduce((s, it) => s + dbBPToBoxes(it.quantity, it.pieces_per_box || 1), 0);
    const totalAvgPpb = d.items.length > 0 ? (d.items[0].pieces_per_box || 1) : 1;
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
        <h1>Bon de Livraison Usine</h1>
        <h2>Détails de livraison (produits endommagés)</h2>
        <div class="row"><span class="label">Date:</span> <strong>${dateStr}</strong></div>
        ${d.creator_name ? `<div class="row"><span class="label">Créé par:</span> <strong>${d.creator_name}</strong></div>` : ''}

        <div class="box">
          <h3>Détails supplémentaires</h3>
          <div class="row"><span class="label">Nombre de palettes livrées:</span> <strong>${d.pallet_count ?? 0}</strong></div>
        </div>

        ${d.items.length > 0 ? `
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

        ${d.notes ? `<div class="box"><h3>Remarques</h3><div class="row">${d.notes}</div></div>` : ''}

        <div class="signature">
          <div><div class="sig-line">Signature du livreur</div></div>
          <div><div class="sig-line">Signature usine</div></div>
        </div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const printPalletReturn = (d: DeliveryRecord) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const dateStr = new Date(d.created_at).toLocaleDateString('fr');
    const palletCount = d.pallet_count ?? 0;
    const branchName = activeBranch?.name || '';

    // Reuse NC metadata if present (constat_by / affectation)
    let nc: any = {};
    try {
      if (d.notes && d.notes.trim().startsWith('{')) {
        const parsed = JSON.parse(d.notes);
        if (parsed && typeof parsed === 'object' && parsed.__nc) nc = parsed;
      }
    } catch { /* ignore */ }
    const constatBy = nc.constat_by ?? '';
    const affectation = nc.affectation ?? '';

    w.document.write(`
      <html dir="ltr"><head><title>Bon de Retour Palettes</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body{font-family:Arial,sans-serif;color:#000;font-size:12px}
        .header{display:flex;align-items:stretch;border:1.5px solid #000;margin-bottom:12px}
        .logo{padding:8px 14px;font-weight:bold;font-size:22px;border-right:1.5px solid #000;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#000;color:#fff;min-width:120px}
        .logo i{font-style:italic;font-size:13px;font-weight:normal}
        .title{flex:1;padding:8px 14px;font-weight:bold;text-align:center;display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1.4}
        .date-box{border-left:1.5px solid #000;padding:8px 14px;display:flex;align-items:center;min-width:160px}
        .date-box b{margin-right:8px}
        .field{margin:6px 0;font-size:13px}
        .field b{text-decoration:underline}
        h1{text-align:center;font-size:22px;margin:28px 0 22px 0;text-decoration:underline;font-weight:bold}
        table.main{width:75%;margin:0 auto;border-collapse:collapse}
        table.main th,table.main td{border:1.5px solid #000;padding:10px 12px;font-size:14px}
        table.main th{background:#f5f5f5;font-weight:bold;text-align:left;width:50%}
        table.main td.qty{text-align:center;font-size:32px;font-weight:bold;height:110px;vertical-align:middle}
        .signatures{display:flex;justify-content:space-between;margin-top:70px;padding:0 30px}
        .signatures .sig{text-align:center;width:40%}
        .sig-title{font-size:13px;margin-bottom:55px}
        .sig-line{border-top:1px solid #000;padding-top:4px;font-size:12px}
        .center-sig{text-align:center;margin-top:35px}
        .center-sig .sig-title{margin-bottom:55px}
        .center-sig .sig-line{display:inline-block;border-top:1px solid #000;padding-top:4px;min-width:240px}
      </style></head><body>

        <div class="header">
          <div class="logo">AROMA<i>Café</i></div>
          <div class="title">SARL ALGOFOOD<br/>BON DE RETOUR PALETTES</div>
          <div class="date-box"><b>Date</b> ${dateStr}</div>
        </div>

        <div class="field"><b>CONSTAT ETABLI PAR :</b> ${constatBy}</div>
        <div class="field"><b>AFFECTATION :</b> ${affectation}</div>

        <h1>Bon de retour palettes</h1>

        <table class="main">
          <tr>
            <th>Désignation</th>
            <th style="text-align:center">Quantité</th>
          </tr>
          <tr>
            <td style="font-size:16px;font-weight:bold;vertical-align:middle">Palette</td>
            <td class="qty">${palletCount}</td>
          </tr>
        </table>

        <div class="signatures">
          <div class="sig">
            <div class="sig-title">Signature superviseur</div>
            <div class="sig-line">&nbsp;</div>
          </div>
          <div class="sig">
            <div class="sig-title">cachet distributeur</div>
            <div class="sig-line">&nbsp;</div>
          </div>
        </div>

        <div class="center-sig">
          <div class="sig-title">Signature chauffeur</div>
          <div class="sig-line">&nbsp;</div>
        </div>

      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const printFactoryNonConformity = (d: DeliveryRecord) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const dateStr = new Date(d.created_at).toLocaleDateString('fr');
    const branchName = activeBranch?.name || '';

    // Parse NC metadata embedded in notes (if available)
    let nc: any = {};
    let descNotes = d.notes || '';
    try {
      if (d.notes && d.notes.trim().startsWith('{')) {
        const parsed = JSON.parse(d.notes);
        if (parsed && typeof parsed === 'object' && parsed.__nc) {
          nc = parsed;
          descNotes = parsed.description || '';
        }
      }
    } catch { /* ignore */ }

    const constatBy = nc.constat_by ?? '';
    const affectation = nc.affectation ?? '';
    const clientName = nc.client_name || '';
    const clientContact = nc.client_contact || '';
    const ncType = nc.nc_type || 'interne'; // 'interne' | 'externe' | 'reclamation'
    const actions = nc.actions || '';
    const mark = (cond: boolean) => cond ? '✗' : '';

    // Rows = products, Columns = attributes
    const productRows = d.items.map(it => {
      const ppb = it.pieces_per_box || 1;
      const parsed = parseBP(Number(it.quantity || 0).toFixed(2), ppb);
      return `
      <tr>
        <td style="text-align:left;font-weight:bold">${it.product_app_name || it.product_name}</td>
        <td style="text-align:center">${it.manufacturing_date ? new Date(it.manufacturing_date).toLocaleDateString('fr') : '-'}</td>
        <td style="text-align:center">${it.lot_number || '-'}</td>
        <td style="text-align:center">${it.manufacturing_time || '-'}</td>
        <td style="text-align:center">${parsed.boxes}</td>
        <td style="text-align:center">${parsed.pieces}</td>
        <td style="text-align:center;font-weight:bold">${parsed.display}</td>
        <td style="text-align:center">${it.delivery_date ? new Date(it.delivery_date).toLocaleDateString('fr') : dateStr}</td>
      </tr>
    `;
    }).join('');

    w.document.write(`
      <html dir="ltr"><head><title>Fiche de Non Conformité - Usine</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body{font-family:Arial,sans-serif;color:#000;font-size:12px}
        .header{display:flex;align-items:stretch;border:1.5px solid #000;margin-bottom:12px}
        .logo{padding:8px 14px;font-weight:bold;font-size:22px;border-right:1.5px solid #000;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#000;color:#fff;min-width:120px}
        .logo i{font-style:italic;font-size:13px;font-weight:normal}
        .title{flex:1;padding:8px 14px;font-weight:bold;text-align:center;display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1.4}
        .date-box{border-left:1.5px solid #000;padding:8px 14px;display:flex;align-items:center;min-width:160px}
        .date-box b{margin-right:8px}
        .field{margin:6px 0;font-size:13px}
        .field b{text-decoration:underline}
        .section{border:1.5px solid #000;margin-top:8px}
        .section-title{font-weight:bold;padding:5px 8px;border-bottom:1.5px solid #000;background:#f5f5f5}
        .section-body{padding:6px 8px}
        table{width:100%;border-collapse:collapse}
        .nc-table th,.nc-table td{border:1px solid #000;padding:8px;text-align:center;font-size:12px;height:28px}
        .client-table td{border:1px solid #000;padding:8px;font-size:12px;height:28px;width:50%}
        .product-table th,.product-table td{border:1px solid #000;padding:6px 8px;font-size:11px}
        .product-table th{background:#fafafa;font-weight:bold;text-align:center}
        .desc-box{min-height:55px;padding:6px 8px;white-space:pre-wrap}
        .signatures{display:flex;justify-content:space-between;margin-top:30px}
        .signatures div{text-align:center;width:45%}
        .sig-line{border-top:1px solid #000;margin-top:55px;padding-top:5px;font-size:12px}
      </style></head><body>

        <div class="header">
          <div class="logo">AROMA<i>Café</i></div>
          <div class="title">FICHE DE NON CONFORMITÉ,<br/>RÉCLAMATION CLIENT ET<br/>D'ACTIONS CORRECTIVES</div>
          <div class="date-box"><b>Date</b> ${dateStr}</div>
        </div>

        <div class="field"><b>CONSTAT ETABLI PAR :</b> ${constatBy}</div>
        <div class="field"><b>AFFECTATION :</b> ${affectation}</div>

        <div class="section">
          <div class="section-title">1. Détection de la non-conformité</div>
          <div class="section-body">
            <table class="nc-table">
              <tr><th>NC Interne</th><th>NC Externe</th><th>Réclamation Client</th></tr>
              <tr><td>${mark(ncType === 'interne')}</td><td>${mark(ncType === 'externe')}</td><td>${mark(ncType === 'reclamation')}</td></tr>
            </table>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Coordonnés du client</div>
          <div class="section-body">
            <table class="client-table">
              <tr><td>${clientName || branchName}</td><td>${clientContact}</td></tr>
            </table>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Désignation et référence du produit incriminé</div>
          <div class="section-body">
            <table class="product-table">
              <thead>
                <tr>
                  <th style="min-width:140px;text-align:left">Produit concerné</th>
                  <th>Date de Fabrication</th>
                  <th>N° de LOT</th>
                  <th>Heure de fabrication</th>
                  <th>Boîtes</th>
                  <th>Pièces</th>
                  <th>Total (B.P)</th>
                  <th>Date de livraison</th>
                </tr>
              </thead>
              <tbody>${productRows}</tbody>
            </table>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Description de la non-conformité / réclamation client</div>
          <div class="desc-box">${descNotes}</div>
        </div>

        <div class="section">
          <div class="section-title">Actions correctives</div>
          <div class="desc-box">${actions}</div>
        </div>

        <div class="signatures">
          <div><div class="sig-line">Signature interne</div></div>
          <div><div class="sig-line">Signature distributeur/client</div></div>
        </div>

      </body></html>
    `);
    w.document.close();
    w.print();
  };

  useEffect(() => {
    if (!open) return;
    if (activeBranch?.id) setBranchId(activeBranch.id);
    else if (workerId) {
      supabase.from('workers').select('branch_id').eq('id', workerId).maybeSingle()
        .then(({ data }) => setBranchId(data?.branch_id || null));
    }
  }, [open, activeBranch?.id, workerId]);

  const fetchData = useCallback(async () => {
    if (!branchId) return;
    setIsLoading(true);
    try {
      // Fetch receipts
      const { data: rData } = await supabase
        .from('stock_receipts')
        .select('*')
        .eq('branch_id', branchId)
        .in('status', ['pending_approval', 'pending_branch', 'pending_assistant'])
        .order('created_at', { ascending: false });

      const receiptIds = (rData || []).map(r => r.id);
      const creatorIds = [...new Set((rData || []).map(r => r.created_by))];

      const [{ data: rItems }, { data: workers }] = await Promise.all([
        receiptIds.length > 0
          ? supabase.from('stock_receipt_items').select('*, product:products(name, app_name, image_url, pieces_per_box)').in('receipt_id', receiptIds)
          : Promise.resolve({ data: [] as any[] }),
        creatorIds.length > 0
          ? supabase.from('workers').select('id, full_name').in('id', creatorIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const workerMap = new Map((workers || []).map((w: any) => [w.id, w.full_name]));

      // Group items by receipt and aggregate breakdown per product
      const receiptsBuilt: ReceiptRecord[] = (rData || []).map((r: any) => {
        const itemsRaw = (rItems || []).filter((it: any) => it.receipt_id === r.id);
        const grouped = new Map<string, ReceiptItemDetail>();
        itemsRaw.forEach((it: any) => {
          const ppb = it.product?.pieces_per_box || 1;
          const breakdown = parseReceiptItemBreakdown(it);
          const existing = grouped.get(it.product_id);
          if (existing) {
            existing.new_qty += Number(breakdown.new_qty) || 0;
            existing.comp_qty += Number(breakdown.comp_qty) || 0;
            existing.comp_offers_qty += Number(breakdown.comp_offers_qty) || 0;
          } else {
            grouped.set(it.product_id, {
              id: it.id,
              product_id: it.product_id,
              product_name: it.product?.name || '',
              product_app_name: it.product?.app_name,
              image_url: it.product?.image_url,
              pieces_per_box: ppb,
              new_qty: Number(breakdown.new_qty) || 0,
              comp_qty: Number(breakdown.comp_qty) || 0,
              comp_offers_qty: Number(breakdown.comp_offers_qty) || 0,
            });
          }
        });
        return {
          ...r,
          creator_name: workerMap.get(r.created_by) || '',
          meta: parseReceiptMeta(r.notes),
          items: Array.from(grouped.values()),
        } as ReceiptRecord;
      });

      // Fetch deliveries
      const { data: dData } = await supabase
        .from('factory_orders')
        .select('*')
        .eq('branch_id', branchId)
        .eq('order_type', 'sending')
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });

      const dIds = (dData || []).map(d => d.id);
      const dCreatorIds = [...new Set((dData || []).map(d => d.created_by))];

      const [{ data: dItems }, { data: dWorkers }] = await Promise.all([
        dIds.length > 0
          ? supabase.from('factory_order_items').select('*, product:products(name, app_name, image_url, pieces_per_box)').in('factory_order_id', dIds)
          : Promise.resolve({ data: [] as any[] }),
        dCreatorIds.length > 0
          ? supabase.from('workers').select('id, full_name').in('id', dCreatorIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const dWorkerMap = new Map((dWorkers || []).map((w: any) => [w.id, w.full_name]));

      const deliveriesBuilt: DeliveryRecord[] = (dData || []).map((d: any) => ({
        ...d,
        creator_name: dWorkerMap.get(d.created_by) || '',
        items: (dItems || []).filter((it: any) => it.factory_order_id === d.id).map((it: any) => ({
          id: it.id,
          product_id: it.product_id,
          product_name: it.product?.name || '',
          product_app_name: it.product?.app_name,
          image_url: it.product?.image_url,
          pieces_per_box: it.product?.pieces_per_box || 1,
          quantity: Number(it.product_quantity) || 0,
          lot_number: it.lot_number || null,
          manufacturing_date: it.manufacturing_date || null,
          manufacturing_time: it.manufacturing_time || null,
          delivery_date: it.delivery_date || null,
        })),
      }));

      setReceipts(receiptsBuilt);
      setDeliveries(deliveriesBuilt);
    } catch (e: any) {
      toast.error(e.message || 'فشل التحميل');
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => { if (open && branchId) fetchData(); }, [open, branchId, fetchData]);

  // ─── Actions ───────────────────────────────────────────────────────
  const approveReceipt = async (r: ReceiptRecord) => {
    if (!workerId || r.frozen_at) return;
    setProcessingId(r.id);
    try {
      // مدير الفرع لا يوافق نهائياً — فقط يحوّل للإدارة العليا (مساعد المدير العام / مدير النظام)
      await supabase.from('stock_receipts').update({
        status: 'pending_assistant',
        branch_approved_by: workerId,
        branch_approved_at: new Date().toISOString(),
        pallet_count: r.pallet_count || 0,
      }).eq('id', r.id);

      // إذا كان مرتبطاً بتسليم، نحوّله أيضاً للإدارة
      if (r.linked_delivery_id) {
        await supabase.from('factory_orders').update({
          status: 'pending_assistant',
          branch_approved_by: workerId,
          branch_approved_at: new Date().toISOString(),
        }).eq('id', r.linked_delivery_id);
      }

      toast.success('تم إرسال الطلب للإدارة العليا للموافقة النهائية');
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || 'خطأ');
    } finally { setProcessingId(null); }
  };

  const approveDeliveryInternal = async (d: DeliveryRecord) => {
    for (const item of d.items) {
      if (item.quantity > 0) {
        const { data: stock } = await supabase.from('warehouse_stock')
          .select('id, quantity, damaged_quantity, factory_return_quantity')
          .eq('branch_id', d.branch_id).eq('product_id', item.product_id).maybeSingle();
        if (stock) {
          await supabase.from('warehouse_stock').update({
            quantity: Math.max(0, (Number(stock.quantity) || 0) - item.quantity),
            damaged_quantity: Math.max(0, (Number(stock.damaged_quantity) || 0) - item.quantity),
            factory_return_quantity: (Number(stock.factory_return_quantity) || 0) + item.quantity,
          }).eq('id', stock.id);
        }
      }
    }
    if (d.pallet_count > 0) {
      const { data: bp } = await supabase.from('branch_pallets').select('id, quantity').eq('branch_id', d.branch_id).maybeSingle();
      if (bp) await supabase.from('branch_pallets').update({ quantity: Math.max(0, bp.quantity - d.pallet_count) }).eq('id', bp.id);
      await supabase.from('pallet_movements').insert({
        branch_id: d.branch_id, quantity: -d.pallet_count, movement_type: 'delivery',
        reference_id: d.id, notes: 'تسليم باليطات للمصنع', created_by: workerId,
      });
    }
    await supabase.from('factory_orders').update({
      status: 'confirmed', confirmed_at: new Date().toISOString(),
      branch_approved_by: workerId, branch_approved_at: new Date().toISOString(),
    }).eq('id', d.id);
  };

  const approveDelivery = async (d: DeliveryRecord) => {
    if (!workerId || d.frozen_at) return;
    setProcessingId(d.id);
    try {
      // مدير الفرع يحوّل التسليم للإدارة العليا — لا تطبيق نهائي للحركات هنا
      await supabase.from('factory_orders').update({
        status: 'pending_assistant',
        branch_approved_by: workerId,
        branch_approved_at: new Date().toISOString(),
      }).eq('id', d.id);
      toast.success('تم إرسال طلب التسليم للإدارة العليا');
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || 'خطأ');
    } finally { setProcessingId(null); }
  };

  const reject = async (kind: 'receipt' | 'delivery', id: string) => {
    if (!rejectNote.trim()) { toast.error('اكتب سبب الرفض'); return; }
    setProcessingId(id);
    try {
      const table = kind === 'receipt' ? 'stock_receipts' : 'factory_orders';
      await supabase.from(table).update({
        status: 'rejected', rejection_note: rejectNote.trim(),
      }).eq('id', id);
      toast.success('تم الرفض');
      setRejectingId(null); setRejectNote('');
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || 'خطأ');
    } finally { setProcessingId(null); }
  };

  const toggleFreeze = async (kind: 'receipt' | 'delivery', id: string, freeze: boolean) => {
    setProcessingId(id);
    try {
      const table = kind === 'receipt' ? 'stock_receipts' : 'factory_orders';
      await supabase.from(table).update({
        frozen_at: freeze ? new Date().toISOString() : null,
        frozen_by: freeze ? workerId : null,
      }).eq('id', id);
      toast.success(freeze ? 'تم التأجيل' : 'تم فك التأجيل');
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || 'خطأ');
    } finally { setProcessingId(null); }
  };

  const startEditReceipt = (r: ReceiptRecord) => {
    setEditingId(r.id);
    setEditReceiptItems(r.items.map(i => ({ ...i })));
    setEditPallets(r.pallet_count || 0);
  };

  const startEditDelivery = (d: DeliveryRecord) => {
    setEditingId(d.id);
    setEditDeliveryItems(d.items.map(i => ({ ...i })));
    setEditPallets(d.pallet_count || 0);
  };

  const saveReceiptEdits = async (r: ReceiptRecord) => {
    setProcessingId(r.id);
    try {
      // Replace items: delete old, insert new aggregated rows
      await supabase.from('stock_receipt_items').delete().eq('receipt_id', r.id);
      const rows: any[] = [];
      editReceiptItems.forEach(item => {
        if (item.new_qty > 0) rows.push({
          receipt_id: r.id, product_id: item.product_id, quantity: item.new_qty, pallet_quantity: 0,
          notes: JSON.stringify({ item_type: 'new', new_qty: item.new_qty, comp_qty: 0, comp_offers_qty: 0 }),
        });
        if (item.comp_qty > 0) rows.push({
          receipt_id: r.id, product_id: item.product_id, quantity: item.comp_qty, pallet_quantity: 0,
          notes: JSON.stringify({ item_type: 'compensation', new_qty: 0, comp_qty: item.comp_qty, comp_offers_qty: 0 }),
        });
        if (item.comp_offers_qty > 0) rows.push({
          receipt_id: r.id, product_id: item.product_id, quantity: item.comp_offers_qty, pallet_quantity: 0,
          notes: JSON.stringify({ item_type: 'compensation_offers', new_qty: 0, comp_qty: 0, comp_offers_qty: item.comp_offers_qty }),
        });
      });
      if (rows.length > 0) await supabase.from('stock_receipt_items').insert(rows);
      await supabase.from('stock_receipts').update({ pallet_count: editPallets || 0 }).eq('id', r.id);
      toast.success('تم حفظ التعديلات');
      setEditingId(null);
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || 'فشل التعديل');
    } finally { setProcessingId(null); }
  };

  const saveDeliveryEdits = async (d: DeliveryRecord) => {
    setProcessingId(d.id);
    try {
      for (const item of editDeliveryItems) {
        await supabase.from('factory_order_items').update({ product_quantity: item.quantity }).eq('id', item.id);
      }
      await supabase.from('factory_orders').update({ pallet_count: editPallets }).eq('id', d.id);
      toast.success('تم حفظ التعديلات');
      setEditingId(null);
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || 'فشل التعديل');
    } finally { setProcessingId(null); }
  };

  // ─── Render helpers ────────────────────────────────────────────────
  const renderActionsBar = (
    kind: 'receipt' | 'delivery',
    record: ReceiptRecord | DeliveryRecord,
    onApprove: () => void,
    onSaveEdit: () => void,
    onStartEdit: () => void,
  ) => {
    const isEditing = editingId === record.id;
    const isFrozen = !!record.frozen_at;
    const isProcessing = processingId === record.id;

    if (rejectingId === record.id) {
      return (
        <div className="space-y-2 border-t pt-2">
          <Textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)}
            placeholder="اكتب سبب الرفض..." rows={2} className="text-xs" />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" className="flex-1" disabled={isProcessing}
              onClick={() => reject(kind, record.id)}>
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 ml-1" />}
              تأكيد الرفض
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => { setRejectingId(null); setRejectNote(''); }}>
              <X className="w-3.5 h-3.5 ml-1" /> إلغاء
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-2 border-t pt-2">
        {isEditing ? (
          <>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={isProcessing} onClick={onSaveEdit}>
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 ml-1" />}
              حفظ التعديلات
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
              <X className="w-3.5 h-3.5 ml-1" /> إلغاء التعديل
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={isProcessing || isFrozen}
              onClick={onApprove}>
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 ml-1" />}
              إرسال للإدارة
            </Button>
            <Button size="sm" variant="destructive" disabled={isProcessing || isFrozen}
              onClick={() => { setRejectingId(record.id); setRejectNote(''); }}>
              <XCircle className="w-3.5 h-3.5 ml-1" /> رفض
            </Button>
            <Button size="sm" variant="outline" disabled={isProcessing || isFrozen} onClick={onStartEdit}>
              <Edit className="w-3.5 h-3.5 ml-1" /> تعديل
            </Button>
            {kind === 'receipt' && (
              <Button size="sm" variant="outline" className="border-blue-500 text-blue-700"
                onClick={() => setPrintReceipt(record as ReceiptRecord)}>
                <Printer className="w-3.5 h-3.5 ml-1" /> طباعة وصل التحويل
              </Button>
            )}
            {kind === 'receipt' && (
              <Button size="sm" variant="outline" className="border-purple-500 text-purple-700"
                onClick={() => printReceiptDetails(record as ReceiptRecord)}>
                <FileText className="w-3.5 h-3.5 ml-1" /> طباعة تفاصيل الاستلام
              </Button>
            )}
            {kind === 'delivery' && (
              <Button size="sm" variant="outline" className="border-purple-500 text-purple-700"
                onClick={() => printDeliveryDetails(record as DeliveryRecord)}>
                <FileText className="w-3.5 h-3.5 ml-1" /> طباعة تفاصيل التسليم
              </Button>
            )}
            {kind === 'delivery' && (
              <Button size="sm" variant="outline" className="border-red-500 text-red-700"
                onClick={() => printFactoryNonConformity(record as DeliveryRecord)}>
                <Printer className="w-3.5 h-3.5 ml-1" /> طباعة للمصنع (Non Conformité)
              </Button>
            )}
            {kind === 'delivery' && (
              <Button size="sm" variant="outline" className="border-amber-600 text-amber-700"
                onClick={() => printPalletReturn(record as DeliveryRecord)}>
                <Printer className="w-3.5 h-3.5 ml-1" /> Bon de retour palettes
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={isProcessing}
              className={isFrozen ? 'border-blue-500 text-blue-700' : 'border-amber-500 text-amber-700'}
              onClick={() => toggleFreeze(kind, record.id, !isFrozen)}>
              {isFrozen ? <><Unlock className="w-3.5 h-3.5 ml-1" /> فك التأجيل</> : <><Lock className="w-3.5 h-3.5 ml-1" /> تأجيل</>}
            </Button>
          </>
        )}
      </div>
    );
  };

  // ─── Receipts list ─────────────────────────────────────────────────
  const renderReceipts = () => {
    if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
    if (receipts.length === 0) return <div className="text-center py-8 text-sm text-muted-foreground">لا توجد عمليات استلام معلقة</div>;

    return receipts.map(r => {
      const isExpanded = expandedId === r.id;
      const isEditing = editingId === r.id;
      const linkedD = r.linked_delivery_id ? deliveries.find(d => d.id === r.linked_delivery_id) : null;

      return (
        <div key={r.id} className="border rounded-lg overflow-hidden bg-card">
          <button className="w-full flex items-center gap-2 p-3 text-start"
            onClick={() => setExpandedId(isExpanded ? null : r.id)}>
            <Inbox className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold">
                  استلام من {r.meta.source === 'branch' ? 'فرع آخر' : 'المصنع'}
                </span>
                {r.invoice_number && <Badge variant="outline" className="text-[10px]">#{r.invoice_number}</Badge>}
                {r.frozen_at && <Badge className="bg-blue-600 text-white text-[10px]"><Lock className="w-2.5 h-2.5 ml-0.5" />مؤجّل</Badge>}
                {r.linked_delivery_id && <Badge className="bg-purple-600 text-white text-[10px]"><Truck className="w-2.5 h-2.5 ml-0.5" />مرتبط بتسليم</Badge>}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {r.creator_name} • {formatDate(r.created_at, 'dd/MM HH:mm', 'ar')}
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px]">{r.items.length} منتج</Badge>
          </button>

          {isExpanded && (
            <div className="p-3 pt-0 space-y-3">
              {/* Driver/Source info */}
              {(r.meta.driver_name || r.meta.driver_phone || r.meta.license_plate) && (
                <div className="bg-muted/50 rounded p-2 text-[11px] flex flex-wrap gap-3">
                  {r.meta.driver_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{r.meta.driver_name}</span>}
                  {r.meta.driver_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.meta.driver_phone}</span>}
                  {r.meta.license_plate && <span className="flex items-center gap-1"><Car className="w-3 h-3" />{r.meta.license_plate}</span>}
                </div>
              )}

              {r.meta.text && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded p-2 text-[11px]">
                  <FileText className="w-3 h-3 inline ml-1" />{r.meta.text}
                </div>
              )}

              {r.invoice_photo_url && (
                <a href={r.invoice_photo_url} target="_blank" rel="noopener noreferrer"
                  className="block text-[11px] text-primary underline">📷 عرض صورة الفاتورة</a>
              )}

              {/* Pallets */}
              {(r.pallet_count || 0) > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded p-2 flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1">🪵 باليطات مستلمة</span>
                  <Badge className="bg-amber-600 text-white">{r.pallet_count}</Badge>
                </div>
              )}

              {/* Products grid */}
              <div className="grid grid-cols-2 gap-2">
                {(isEditing ? editReceiptItems : r.items).map((item, idx) => {
                  const displayName = getProductDisplayName({ name: item.product_name, app_name: item.product_app_name });
                  const ppb = item.pieces_per_box;
                  return (
                    <div key={item.product_id} className="border rounded-lg p-2 bg-background">
                      <div className="flex items-start gap-2 mb-2">
                        {item.image_url ? (
                          <img src={item.image_url} className="w-12 h-12 rounded object-cover border shrink-0" alt="" />
                        ) : (
                          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0 border">
                            <Package className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold leading-tight line-clamp-2">{displayName}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">{ppb} قطعة/صندوق</p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {/* New */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                            <Sparkles className="w-3 h-3" />جديد
                          </span>
                          {isEditing ? (
                            <Input type="number" min={0} step={0.01} value={item.new_qty}
                              onChange={e => setEditReceiptItems(prev => prev.map((p, i) =>
                                i === idx ? { ...p, new_qty: parseFloat(e.target.value) || 0 } : p))}
                              className="h-6 w-20 text-[10px] text-center px-1" />
                          ) : (
                            <Badge className="bg-emerald-600 text-white text-[10px] h-5 px-1.5">{fmt(item.new_qty, ppb)}</Badge>
                          )}
                        </div>

                        {/* Compensation damaged */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] text-orange-700 dark:text-orange-400 flex items-center gap-1 font-semibold">
                            <Wrench className="w-3 h-3" />تعويض تالف
                          </span>
                          {isEditing ? (
                            <Input type="number" min={0} step={0.01} value={item.comp_qty}
                              onChange={e => setEditReceiptItems(prev => prev.map((p, i) =>
                                i === idx ? { ...p, comp_qty: parseFloat(e.target.value) || 0 } : p))}
                              className="h-6 w-20 text-[10px] text-center px-1" />
                          ) : (
                            <Badge className="bg-orange-600 text-white text-[10px] h-5 px-1.5">{fmt(item.comp_qty, ppb)}</Badge>
                          )}
                        </div>

                        {/* Compensation offers */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] text-purple-700 dark:text-purple-400 flex items-center gap-1 font-semibold">
                            <Boxes className="w-3 h-3" />تعويض عروض
                          </span>
                          {isEditing ? (
                            <Input type="number" min={0} step={0.01} value={item.comp_offers_qty}
                              onChange={e => setEditReceiptItems(prev => prev.map((p, i) =>
                                i === idx ? { ...p, comp_offers_qty: parseFloat(e.target.value) || 0 } : p))}
                              className="h-6 w-20 text-[10px] text-center px-1" />
                          ) : (
                            <Badge className="bg-purple-600 text-white text-[10px] h-5 px-1.5">{fmt(item.comp_offers_qty, ppb)}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Linked delivery preview */}
              {linkedD && (
                <div className="border-2 border-purple-300 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg p-2 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-300">
                    <Truck className="w-3.5 h-3.5" />تسليم مرتبط — سيتم تأكيده تلقائياً عند الموافقة
                  </div>
                  <div className="text-[11px] space-y-0.5">
                    {linkedD.pallet_count > 0 && <div>🪵 باليطات للتسليم: <strong>{linkedD.pallet_count}</strong></div>}
                    {linkedD.items.map(it => (
                      <div key={it.id}>
                        • {getProductDisplayName({ name: it.product_name, app_name: it.product_app_name })}: <strong>{fmt(it.quantity, it.pieces_per_box)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {renderActionsBar('receipt', r, () => setSummaryReceipt(r), () => saveReceiptEdits(r), () => setFullEditReceiptId(r.id))}
            </div>
          )}
        </div>
      );
    });
  };

  // ─── Deliveries list ───────────────────────────────────────────────
  const renderDeliveries = () => {
    if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
    const standalone = deliveries.filter(d => !receipts.some(r => r.linked_delivery_id === d.id));
    if (standalone.length === 0) return <div className="text-center py-8 text-sm text-muted-foreground">لا توجد عمليات تسليم معلقة</div>;

    return standalone.map(d => {
      const isExpanded = expandedId === d.id;
      const isEditing = editingId === d.id;

      return (
        <div key={d.id} className="border rounded-lg overflow-hidden bg-card">
          <button className="w-full flex items-center gap-2 p-3 text-start"
            onClick={() => setExpandedId(isExpanded ? null : d.id)}>
            <Send className="w-4 h-4 text-destructive shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold">تسليم تالف للمصنع</span>
                {d.frozen_at && <Badge className="bg-blue-600 text-white text-[10px]"><Lock className="w-2.5 h-2.5 ml-0.5" />مؤجّل</Badge>}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {d.creator_name} • {formatDate(d.created_at, 'dd/MM HH:mm', 'ar')}
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px]">{d.items.length + (d.pallet_count > 0 ? 1 : 0)} عنصر</Badge>
          </button>

          {isExpanded && (
            <div className="p-3 pt-0 space-y-3">
              {d.notes && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded p-2 text-[11px]">
                  <FileText className="w-3 h-3 inline ml-1" />{d.notes}
                </div>
              )}

              {/* Pallets */}
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded p-2 flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1">🪵 باليطات للتسليم</span>
                {isEditing ? (
                  <Input type="number" min={0} value={editPallets}
                    onChange={e => setEditPallets(parseInt(e.target.value) || 0)}
                    className="h-7 w-20 text-xs text-center" />
                ) : (
                  <Badge className="bg-amber-600 text-white">{d.pallet_count}</Badge>
                )}
              </div>

              {/* Damaged products grid */}
              {(isEditing ? editDeliveryItems : d.items).length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {(isEditing ? editDeliveryItems : d.items).map((item, idx) => {
                    const displayName = getProductDisplayName({ name: item.product_name, app_name: item.product_app_name });
                    return (
                      <div key={item.id} className="border rounded-lg p-2 bg-background">
                        <div className="flex items-start gap-2 mb-2">
                          {item.image_url ? (
                            <img src={item.image_url} className="w-12 h-12 rounded object-cover border shrink-0" alt="" />
                          ) : (
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0 border">
                              <Package className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold leading-tight line-clamp-2">{displayName}</p>
                            <p className="text-[9px] text-muted-foreground mt-0.5">{item.pieces_per_box} قطعة/صندوق</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] text-destructive flex items-center gap-1 font-semibold">
                            <AlertTriangle className="w-3 h-3" />تالف للتسليم
                          </span>
                          {isEditing ? (
                            <Input type="number" min={0} step={0.01} value={item.quantity}
                              onChange={e => setEditDeliveryItems(prev => prev.map((p, i) =>
                                i === idx ? { ...p, quantity: parseFloat(e.target.value) || 0 } : p))}
                              className="h-6 w-20 text-[10px] text-center px-1" />
                          ) : (
                            <Badge variant="destructive" className="text-[10px] h-5 px-1.5">{fmt(item.quantity, item.pieces_per_box)}</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {renderActionsBar('delivery', d, () => approveDelivery(d), () => saveDeliveryEdits(d), () => setFullEditDeliveryId(d.id))}
            </div>
          )}
        </div>
      );
    });
  };

  const totalReceipts = receipts.length;
  const standaloneDeliveries = deliveries.filter(d => !receipts.some(r => r.linked_delivery_id === d.id)).length;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            موافقات استلام/تسليم المصنع
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => { setTab(v as any); setExpandedId(null); setEditingId(null); }} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="receipts" className="relative">
              <Inbox className="w-4 h-4 ml-1" />الاستلام
              {totalReceipts > 0 && <Badge variant="destructive" className="absolute -top-1 -left-1 h-5 w-5 p-0 text-[10px]">{totalReceipts}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="relative">
              <Send className="w-4 h-4 ml-1" />التسليم
              {standaloneDeliveries > 0 && <Badge variant="destructive" className="absolute -top-1 -left-1 h-5 w-5 p-0 text-[10px]">{standaloneDeliveries}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="receipts" className="flex-1 overflow-y-auto space-y-2 mt-3 pr-1">
            {renderReceipts()}
          </TabsContent>
          <TabsContent value="deliveries" className="flex-1 overflow-y-auto space-y-2 mt-3 pr-1">
            {renderDeliveries()}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

      {/* نافذة ملخص الإرسال للإدارة */}
      <Dialog open={!!summaryReceipt} onOpenChange={(o) => { if (!o) setSummaryReceipt(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              ملخص الإرسال للإدارة العليا
            </DialogTitle>
          </DialogHeader>

          {summaryReceipt && (
            <div id="receipt-summary-print" className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg bg-muted/30">
                <div><span className="text-muted-foreground">رقم الفاتورة:</span> <strong>{summaryReceipt.invoice_number || '—'}</strong></div>
                <div><span className="text-muted-foreground">التاريخ:</span> <strong>{new Date(summaryReceipt.created_at).toLocaleString('ar')}</strong></div>
                <div><span className="text-muted-foreground">المُنشئ:</span> <strong>{summaryReceipt.creator_name || '—'}</strong></div>
                <div><span className="text-muted-foreground">المصدر:</span> <strong>{summaryReceipt.meta.source === 'branch' ? 'فرع آخر' : 'المصنع'}</strong></div>
                {summaryReceipt.meta.driver_name && (
                  <div><span className="text-muted-foreground">السائق:</span> <strong>{summaryReceipt.meta.driver_name}</strong></div>
                )}
                {summaryReceipt.meta.license_plate && (
                  <div><span className="text-muted-foreground">رقم اللوحة:</span> <strong>{summaryReceipt.meta.license_plate}</strong></div>
                )}
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-right">المنتج</th>
                      <th className="p-2 text-center text-emerald-700">جديد</th>
                      <th className="p-2 text-center text-amber-700">تعويض تالف</th>
                      <th className="p-2 text-center text-purple-700">تعويض عروض</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryReceipt.items.map((it) => (
                      <tr key={it.id} className="border-t">
                        <td className="p-2">{getProductDisplayName({ name: it.product_name, app_name: it.product_app_name })}</td>
                        <td className="p-2 text-center font-semibold">{fmt(it.new_qty, it.pieces_per_box)}</td>
                        <td className="p-2 text-center">{fmt(it.comp_qty, it.pieces_per_box)}</td>
                        <td className="p-2 text-center">{fmt(it.comp_offers_qty, it.pieces_per_box)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
                  <div className="text-xs text-muted-foreground">🪵 عدد الباليطات</div>
                  <div className="text-lg font-bold">{summaryReceipt.pallet_count || 0}</div>
                </div>
                <div className="p-3 border rounded-lg bg-rose-50 dark:bg-rose-950/20">
                  <div className="text-xs text-muted-foreground">💰 مصاريف الاستلام</div>
                  <div className="text-lg font-bold">{(summaryReceipt.receipt_expenses || 0).toLocaleString()} دج</div>
                  {Array.isArray((summaryReceipt as any).expenses_breakdown) && (summaryReceipt as any).expenses_breakdown.length > 0 ? (
                    <ul className="text-[10px] text-muted-foreground mt-1 space-y-0.5">
                      {((summaryReceipt as any).expenses_breakdown as { description: string; amount: number }[]).map((l, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span className="truncate">{l.description || '-'}</span>
                          <span className="font-semibold">{Number(l.amount || 0).toLocaleString()} دج</span>
                        </li>
                      ))}
                    </ul>
                  ) : summaryReceipt.expenses_description ? (
                    <div className="text-[10px] text-muted-foreground mt-1">{summaryReceipt.expenses_description}</div>
                  ) : null}
                </div>
              </div>

              {summaryReceipt.meta.text && (
                <div className="p-2 border rounded text-xs bg-muted/20">
                  <span className="text-muted-foreground">ملاحظات: </span>{summaryReceipt.meta.text}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-3 border-t no-print">
            <Button variant="outline" className="flex-1" onClick={() => {
              const node = document.getElementById('receipt-summary-print');
              if (!node) return;
              const w = window.open('', '_blank', 'width=800,height=600');
              if (!w) return;
              w.document.write(`<html dir="rtl"><head><title>ملخص الاستلام</title>
                <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:right}th{background:#f3f4f6}</style>
                </head><body><h2>ملخص الاستلام للإدارة</h2>${node.innerHTML}</body></html>`);
              w.document.close();
              w.focus();
              setTimeout(() => { w.print(); w.close(); }, 300);
            }}>
              <FileText className="w-4 h-4 ml-1" /> طباعة
            </Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              disabled={processingId === summaryReceipt?.id}
              onClick={async () => {
                if (!summaryReceipt) return;
                await approveReceipt(summaryReceipt);
                setSummaryReceipt(null);
              }}>
              {processingId === summaryReceipt?.id
                ? <Loader2 className="w-4 h-4 animate-spin ml-1" />
                : <Send className="w-4 h-4 ml-1" />}
              تأكيد الإرسال للإدارة
            </Button>
            <Button variant="ghost" onClick={() => setSummaryReceipt(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* نافذة طباعة وصل التحويل */}
      {printReceipt && (
        <ReceiptPrintView
          open={!!printReceipt}
          onOpenChange={(o) => { if (!o) setPrintReceipt(null); }}
          type="transfer"
          invoiceNumber={printReceipt.invoice_number}
          date={printReceipt.created_at}
          items={printReceipt.items.map(it => ({
            product_name: it.product_app_name || it.product_name,
            new_qty: it.new_qty,
            comp_qty: it.comp_qty,
            comp_offers_qty: it.comp_offers_qty,
            pieces_per_box: it.pieces_per_box,
            image_url: it.image_url,
          }))}
          driverInfo={{
            driver_name: printReceipt.meta.driver_name,
            driver_phone: printReceipt.meta.driver_phone,
            license_plate: printReceipt.meta.license_plate,
          }}
          notes={printReceipt.meta.text}
        />
      )}

      {/* فتح نافذة الإنشاء الكاملة في وضع التعديل */}
      {fullEditReceiptId && (
        <FactoryReceiptQuickDialog
          open={!!fullEditReceiptId}
          onOpenChange={(o) => { if (!o) setFullEditReceiptId(null); }}
          editReceiptId={fullEditReceiptId}
          onSaved={() => { setFullEditReceiptId(null); fetchData(); }}
        />
      )}
      {fullEditDeliveryId && (
        <FactoryDeliveryQuickDialog
          open={!!fullEditDeliveryId}
          onOpenChange={(o) => { if (!o) setFullEditDeliveryId(null); }}
          editDeliveryId={fullEditDeliveryId}
          onSaved={() => { setFullEditDeliveryId(null); fetchData(); }}
        />
      )}
    </>
  );
};

export default FactoryApprovalsDialog;
