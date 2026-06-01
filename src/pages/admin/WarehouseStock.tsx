import React, { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import StockEmptyDialog from '@/components/warehouse/StockEmptyDialog';
import StockManualEditDialog from '@/components/warehouse/StockManualEditDialog';
import { useNavigate } from 'react-router-dom';
import { Package, Users, Loader2, Search, BarChart3, ChevronDown, ChevronUp, ClipboardList, ClipboardCheck, Trash2, Pencil, History } from 'lucide-react';
import WarehouseProductMovementDialog from '@/components/warehouse/WarehouseProductMovementDialog';
import ProductWorkerMovementsDialog from '@/components/warehouse/ProductWorkerMovementsDialog';
import ProductDailySoldDialog from '@/components/warehouse/ProductDailySoldDialog';
import ProductMetricLogDialog, { MetricKind } from '@/components/warehouse/ProductMetricLogDialog';
import { getProductDisplayName } from '@/utils/productDisplayName';
import { boxesToBP, dbBPDisplay, dbBPDisplayAlways } from '@/utils/boxPieceInput';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWarehouseStock } from '@/hooks/useWarehouseStock';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminRole } from '@/lib/utils';
import SalesHubDialog from '@/components/sales/SalesHubDialog';
import QuickReceiptDialog from '@/components/warehouse/QuickReceiptDialog';
import QuickLoadWorkerDialog from '@/components/warehouse/QuickLoadWorkerDialog';
import BranchPalletCard from '@/components/stock/BranchPalletCard';
import WarehouseReviewDialog from '@/components/warehouse/WarehouseReviewDialog';
import WarehouseReviewHistory from '@/components/warehouse/WarehouseReviewHistory';
import WarehouseTodayAchievements from '@/components/warehouse/WarehouseTodayAchievements';
import { Calendar } from 'lucide-react';
import { dedupeSalesTrackingRows } from '@/utils/salesTrackingDedup';
import { fetchDeliveredOrdersForBranch } from '@/utils/fetchDeliveredOrdersForBranch';
import ReceiptSessionsTimelineDialog, { SelectedReceiptRange, isInRanges } from '@/components/warehouse/ReceiptSessionsTimelineDialog';
import { Filter, X } from 'lucide-react';

interface ProductSummary {
  productId: string;
  productName: string;
  received: number;
  workerStock: number;
  sold: number;
  gifts: number;
  damaged: number;
  factoryReturn: number;
  compensation: number;
  surplus: number;
  deficit: number;
  offers: number;
  remaining: number;
}

interface StockMovementSummaryRow {
  product_id: string | null;
  movement_type: string | null;
  quantity: number | null;
  created_at?: string | null;
}

interface WarehouseSaleSummaryRow {
  product_id: string | null;
  branch_id?: string | null;
  worker_id?: string | null;
  customer_id?: string | null;
  sold_boxes?: number | null;
  sold_pieces?: number | null;
  gift_boxes?: number | null;
  gift_pieces?: number | null;
  total_boxes: number | null;
  total_pieces: number | null;
  pieces_per_box: number | null;
  order_id: string | null;
  sold_at?: string | null;
  source?: string | null;
  order?: { status: string | null } | { status: string | null }[] | null;
}

const piecesToDbBP = (pieces: number, piecesPerBox: number) => {
  const ppb = Math.max(1, Math.round(piecesPerBox));
  const totalPieces = Math.max(0, Math.round(pieces));
  const boxes = Math.floor(totalPieces / ppb);
  const remPieces = totalPieces % ppb;
  return Number(`${boxes}.${String(remPieces).padStart(2, '0')}`);
};

const WarehouseStock: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { role, activeRole } = useAuth();
  const isWarehouseManager = activeRole?.custom_role_code === 'warehouse_manager';
  const isCompanyManager = activeRole?.custom_role_code === 'company_manager';
  const canEdit = isAdminRole(role) || isCompanyManager;
  const { warehouseStock, workerStocksByWorker, isLoading, products, workers, createReceipt, loadToWorker, refresh, branchId } = useWarehouseStock();
  const [showSalesHubDialog, setShowSalesHubDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showLoadWorkerDialog, setShowLoadWorkerDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showEmptyDialog, setShowEmptyDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('stock');
  const [search, setSearch] = useState('');
  const [expandedWorkers, setExpandedWorkers] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<ProductSummary | null>(null);
  const [movementProduct, setMovementProduct] = useState<ProductSummary | null>(null);
  const [workersForProduct, setWorkersForProduct] = useState<ProductSummary | null>(null);
  const [soldForProduct, setSoldForProduct] = useState<ProductSummary | null>(null);
  const [metricLog, setMetricLog] = useState<{ product: ProductSummary; metric: MetricKind } | null>(null);
  // فلتر التوقيت (من-إلى) — يطبَّق على المُستلم/المباع/الهدايا/الفروقات.
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const selectedReceiptRanges: SelectedReceiptRange[] = [];
  const hasReceiptFilter = Boolean(dateFrom || dateTo);


  // Fetch aggregated data for summary
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['warehouse-product-summary', branchId],
    queryFn: async () => {
      if (!branchId) return { receipts: [], movements: [], discrepancies: [], workerStocks: [], warehouseDamaged: [] };

      // First get receipt IDs for this branch
      const { data: branchReceipts } = await supabase
        .from('stock_receipts')
        .select('id, created_at')
        .eq('branch_id', branchId);
      
      const receiptIds = (branchReceipts || []).map(r => r.id);
      const receiptCreatedAtById = new Map((branchReceipts || []).map(r => [r.id, r.created_at]));

      const [receiptsRes, discrepanciesRes, workerStocksRes, warehouseRes] = await Promise.all([
        // Total received per product (filter by receipt IDs)
        receiptIds.length > 0
          ? supabase
              .from('stock_receipt_items')
              .select('receipt_id, product_id, quantity')
              .in('receipt_id', receiptIds)
          : Promise.resolve({ data: [], error: null }),
        // Discrepancies (surplus, deficit)
        supabase
          .from('stock_discrepancies')
          .select('product_id, quantity, discrepancy_type, created_at')
          .eq('branch_id', branchId),
        // Worker stocks
        supabase
          .from('worker_stock')
          .select('product_id, quantity')
          .eq('branch_id', branchId),
        // Damaged stock tracked directly on warehouse stock rows
        supabase
          .from('warehouse_stock')
          .select('product_id, damaged_quantity, factory_return_quantity, compensation_quantity')
          .eq('branch_id', branchId),
      ]);

      return {
        receipts: (receiptsRes.data || []).map((r: any) => ({ ...r, created_at: receiptCreatedAtById.get(r.receipt_id) || null })),
        discrepancies: discrepanciesRes.data || [],
        workerStocks: workerStocksRes.data || [],
        warehouseDamaged: warehouseRes.data || [],
      };
    },
    enabled: !!branchId,
  });

  // Per-(worker, product) load/return totals for badges
  const { data: workerProductMovements } = useQuery({
    queryKey: ['warehouse-worker-product-movements', branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data } = await supabase
        .from('stock_movements')
        .select('worker_id, product_id, movement_type, quantity, status')
        .eq('branch_id', branchId)
        .in('movement_type', ['load', 'return'])
        .neq('status', 'rejected');
      const map: Record<string, { loaded: number; returned: number }> = {};
      for (const m of (data || [])) {
        if (!m.worker_id || !m.product_id) continue;
        const k = `${m.worker_id}__${m.product_id}`;
        if (!map[k]) map[k] = { loaded: 0, returned: 0 };
        const q = Number(m.quantity || 0);
        if (m.movement_type === 'load') map[k].loaded += q;
        else map[k].returned += q;
      }
      return map;
    },
  });

  const latestReceiptAtByProduct = useMemo(() => {
    const latest: Record<string, string> = {};
    for (const r of (summaryData?.receipts || [])) {
      const pid = r.product_id;
      const createdAt = (r as any).created_at as string | undefined;
      if (pid && createdAt && (!latest[pid] || createdAt > latest[pid])) {
        latest[pid] = createdAt;
      }
    }
    return latest;
  }, [summaryData?.receipts]);

  const latestReceiptQueryKey = useMemo(
    () => Object.entries(latestReceiptAtByProduct).sort(([a], [b]) => a.localeCompare(b)).map(([pid, at]) => `${pid}:${at}`).join('|'),
    [latestReceiptAtByProduct]
  );

  // Fetch sold from order_items for delivered orders. Each item carries the
  // order's updated_at so window-filtering by receipt sessions can be applied.
  const rangesKey = useMemo(
    () => selectedReceiptRanges.map(r => `${r.id}:${r.start}:${r.end}`).join('|'),
    [selectedReceiptRanges],
  );
  const { data: soldData, isLoading: soldLoading } = useQuery({
    queryKey: ['warehouse-sold-summary', branchId, rangesKey],
    queryFn: async () => {
      if (!branchId) return [] as any[];
      // When ranges are active, restrict by earliest start to limit payload.
      const minStart = selectedReceiptRanges.length
        ? selectedReceiptRanges.reduce(
            (m, r) => (new Date(r.start).getTime() < new Date(m).getTime() ? r.start : m),
            selectedReceiptRanges[0].start,
          )
        : null;
      const deliveredOrders = await fetchDeliveredOrdersForBranch({
        branchId,
        minStart,
        select: 'id, updated_at, created_at, branch_id, assigned_worker_id',
      });
      const orderIds = deliveredOrders.map(o => o.id);
      if (orderIds.length === 0) return [];
      const dateById = new Map(deliveredOrders.map((o: any) => [o.id, o.updated_at || o.created_at]));
      // Paginate order_items too.
      const items: any[] = [];
      for (let i = 0; i < orderIds.length; i += 200) {
        const slice = orderIds.slice(i, i + 200);
        const { data } = await supabase
          .from('order_items')
          .select('order_id, product_id, quantity, gift_quantity, gift_pieces, pieces_per_box')
          .in('order_id', slice);
        if (data) items.push(...data);
      }
      return items.map((it: any) => ({ ...it, _delivered_at: dateById.get(it.order_id) || null }));
    },
    enabled: !!branchId,
  });


  // Fetch sales totals from sales_tracking after the latest receipt per product. We split by source:
  // - warehouse_sale: subtracted from المتبقي AND added to المباع
  // - delivery_sale / direct_sale: added to المباع only (worker stock handles المتبقي)
  const { data: warehouseSalesData, isLoading: warehouseSalesLoading } = useQuery({
    queryKey: ['warehouse-sales-tracking', branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const { data: rawSales } = await supabase
        .from('sales_tracking')
        .select('product_id, branch_id, worker_id, customer_id, sold_boxes, sold_pieces, gift_boxes, gift_pieces, total_boxes, total_pieces, pieces_per_box, order_id, source, sold_at')
        .in('source', ['warehouse_sale', 'delivery_sale', 'direct_sale'])
        .or(`branch_id.eq.${branchId},branch_id.is.null`);

      const rows = dedupeSalesTrackingRows((rawSales || []) as WarehouseSaleSummaryRow[]);
      const orderIds = Array.from(new Set(rows.map(r => r.order_id).filter(Boolean) as string[]));
      const workerIds = Array.from(new Set(rows.map(r => r.worker_id).filter(Boolean) as string[]));
      const customerIds = Array.from(new Set(rows.map(r => r.customer_id).filter(Boolean) as string[]));

      const [ordersRes, workersRes, customersRes] = await Promise.all([
        orderIds.length ? supabase.from('orders').select('id, status, branch_id').in('id', orderIds) : Promise.resolve({ data: [] }),
        workerIds.length ? supabase.from('workers_safe').select('id, branch_id').in('id', workerIds) : Promise.resolve({ data: [] }),
        customerIds.length ? supabase.from('customers').select('id, branch_id').in('id', customerIds) : Promise.resolve({ data: [] }),
      ]);

      const orderById = new Map((ordersRes.data || []).map((o: any) => [o.id, o]));
      const workerBranchById = new Map((workersRes.data || []).map((w: any) => [w.id, w.branch_id]));
      const customerBranchById = new Map((customersRes.data || []).map((c: any) => [c.id, c.branch_id]));

      return rows.filter((row) => {
        const order = row.order_id ? orderById.get(row.order_id) : null;
        const inferredBranchId = row.branch_id || order?.branch_id || (row.worker_id ? workerBranchById.get(row.worker_id) : null) || (row.customer_id ? customerBranchById.get(row.customer_id) : null);
        const belongsToBranch = inferredBranchId === branchId || (!row.branch_id && !inferredBranchId);
        const hasGift = Number(row.gift_boxes || 0) > 0 || Number(row.gift_pieces || 0) > 0;
        const orderOk = !row.order_id || order?.status === 'delivered' || hasGift;
        // Counted cumulatively so totals balance against cumulative received.
        return belongsToBranch && orderOk;
      }).map((row) => ({
        ...row,
        order: row.order_id ? { status: orderById.get(row.order_id)?.status || null } : null,
      }));
    },
    enabled: !!branchId && !summaryLoading,
  });

  // Fetch all stock movements (load / return) for this branch to compute remaining from fundamentals
  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ['warehouse-movements-summary', branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const { data } = await supabase
        .from('stock_movements')
        .select('product_id, movement_type, quantity, created_at')
        .eq('branch_id', branchId)
        .in('movement_type', ['load', 'return']);
      return data || [];
    },
    enabled: !!branchId,
  });

  const productSummaries = useMemo((): ProductSummary[] => {
    if (!products.length) return [];

    const summaries: Record<string, ProductSummary> = {};

    // Initialize all products
    for (const p of products) {
      summaries[p.id] = {
        productId: p.id,
        productName: getProductDisplayName(p),
        received: 0,
        workerStock: 0,
        sold: 0,
        gifts: 0,
        damaged: 0,
        factoryReturn: 0,
        compensation: 0,
        surplus: 0,
        deficit: 0,
        offers: 0,
        remaining: 0,
      };
    }

    // فلتر زمني: من بداية يوم dateFrom حتى نهاية يوم dateTo (شامل).
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    const inWindow = (iso: string | null | undefined) => {
      if (!fromMs && !toMs) return true;
      if (!iso) return false;
      const t = new Date(iso).getTime();
      if (fromMs && t < fromMs) return false;
      if (toMs && t > toMs) return false;
      return true;
    };


    // Received
    for (const r of (summaryData?.receipts || [])) {
      if (!summaries[r.product_id]) continue;
      if (!inWindow((r as any).created_at)) continue;
      summaries[r.product_id].received += Number(r.quantity || 0);
    }

    // Worker stocks — لقطة حالية بلا تاريخ. تُعرض دائمًا حتى مع تفعيل فلتر النوافذ.
    for (const ws of (summaryData?.workerStocks || [])) {
      if (summaries[ws.product_id]) {
        summaries[ws.product_id].workerStock += Number(ws.quantity || 0);
      }
    }

    // Offers/gifts from delivered order_items (authoritative source).
    for (const oi of (soldData || [])) {
      const pid = oi.product_id;
      if (!summaries[pid]) continue;
      if (!inWindow((oi as any)._delivered_at)) continue;
      const ppb = Number((oi as any).pieces_per_box || products.find(p => p.id === pid)?.pieces_per_box) || 20;
      const g = Number((oi as any).gift_quantity || 0);
      const gBoxes = Math.floor(g);
      const gBoxPieces = Math.round((g - gBoxes) * 100);
      const extraGiftPieces = Number((oi as any).gift_pieces || 0);
      const giftPieces = gBoxes * ppb + gBoxPieces + extraGiftPieces;
      summaries[pid].gifts += giftPieces;
      summaries[pid].offers += giftPieces;
    }


    // Manual promo entries (entered by admin via ManualPromoEntryDialog) are written to
    // sales_tracking with order_id = null. They never appear in order_items, so add them here.
    for (const s of ((warehouseSalesData || []) as WarehouseSaleSummaryRow[])) {
      const pid = s.product_id;
      if (!summaries[pid]) continue;
      if (s.order_id) continue; // already counted via order_items above
      if (!inWindow((s as any).sold_at)) continue;
      const ppb = Number(s.pieces_per_box) || Number(products.find(p => p.id === pid)?.pieces_per_box) || 20;
      const gPieces = Number((s as any).gift_boxes || 0) * ppb + Number((s as any).gift_pieces || 0);
      if (gPieces <= 0) continue;
      summaries[pid].gifts += gPieces;
      summaries[pid].offers += gPieces;
    }



    // Discrepancies (surplus / deficit فقط)
    for (const d of (summaryData?.discrepancies || [])) {
      if (!summaries[d.product_id]) continue;
      if (!inWindow((d as any).created_at)) continue;
      const qty = Number(d.quantity || 0);
      if (d.discrepancy_type === 'deficit') {
        summaries[d.product_id].deficit += qty;
      } else if (d.discrepancy_type === 'surplus') {
        summaries[d.product_id].surplus += qty;
      }
    }

    // Damaged / factory return / compensation — لقطة حالية بلا تاريخ. تُخفى عند الفلترة.
    if (!hasReceiptFilter) {
      for (const ws of (summaryData?.warehouseDamaged || [])) {
        if (!summaries[ws.product_id]) continue;
        summaries[ws.product_id].damaged += Number(ws.damaged_quantity || 0);
        summaries[ws.product_id].factoryReturn += Number(ws.factory_return_quantity || 0);
        summaries[ws.product_id].compensation += Number(ws.compensation_quantity || 0);
      }
    }

    // Sold: derive from delivered orders + order_items (authoritative source).
    const warehouseSaleByProduct: Record<string, number> = {};
    const soldPiecesByProduct: Record<string, number> = {};
    const ppbByProduct: Record<string, number> = {};
    for (const p of products) ppbByProduct[p.id] = Number(p.pieces_per_box) || 20;

    for (const oi of (soldData || [])) {
      const pid = oi.product_id;
      if (!pid) continue;
      if (!inWindow((oi as any)._delivered_at)) continue;
      const rppb = Number((oi as any).pieces_per_box || ppbByProduct[pid]) || 20;
      const qty = Number((oi as any).quantity || 0);            // BP-encoded boxes.pieces
      const giftBoxes = Number((oi as any).gift_quantity || 0);
      const qBoxes = Math.max(0, Math.floor(qty) - giftBoxes);
      const qPieces = Math.round((qty - Math.floor(qty)) * 100);
      const paidPieces = qBoxes * rppb + qPieces;
      soldPiecesByProduct[pid] = (soldPiecesByProduct[pid] || 0) + paidPieces;
    }

    // warehouse_sale still needs sales_tracking (for "remaining" computation only)
    for (const s of ((warehouseSalesData || []) as WarehouseSaleSummaryRow[])) {
      const pid = s.product_id;
      if (!pid) continue;
      if (s.order_id && (s as any).order?.status !== 'delivered') continue;
      if (s.source !== 'warehouse_sale') continue;
      if (!inWindow((s as any).sold_at)) continue;
      const ppb = Number(s.pieces_per_box) || 20;
      const totalPieces = Number(s.total_boxes || 0) * ppb + Number(s.total_pieces || 0);
      const fullBoxes = Math.floor(totalPieces / ppb);
      const remPieces = totalPieces % ppb;
      warehouseSaleByProduct[pid] = (warehouseSaleByProduct[pid] || 0) + (fullBoxes + remPieces / 100);
    }

    const warehouseQtyByProduct = new Map(
      warehouseStock.map((row) => [row.product_id, Number(row.quantity || 0)])
    );

    for (const pid of Object.keys(summaries)) {
      const received = summaries[pid].received;
      const ppb = products.find(p => p.id === pid)?.pieces_per_box || 20;
      summaries[pid].sold = piecesToDbBP(soldPiecesByProduct[pid] || 0, ppb);
      summaries[pid].offers = piecesToDbBP(summaries[pid].offers || 0, ppb);
      const s = summaries[pid];
      const deductions = (s.workerStock || 0)
        + (s.sold || 0)
        + (s.offers || 0)
        + (s.surplus || 0)
        + (s.deficit || 0)
        + (s.damaged || 0)
        + (s.factoryReturn || 0)
        + (s.compensation || 0);

      summaries[pid].remaining = Math.round((received - deductions) * 100) / 100;

      // عند عدم تفعيل الفلتر: أَظهر الرصيد الفعلي من جدول warehouse_stock.
      // عند تفعيل الفلتر: نبقي على الحساب المُحدود بالنافذة (المستلم − البطاقات المؤرَّخة).
      if (!hasReceiptFilter && warehouseQtyByProduct.has(pid)) {
        summaries[pid].remaining = warehouseQtyByProduct.get(pid) || 0;
      }
    }

    // Hide products where all values are zero
    return Object.values(summaries)
      .filter(s => s.received + s.workerStock + s.sold + s.gifts + s.damaged + s.factoryReturn + s.compensation + s.surplus + s.deficit + s.offers + s.remaining > 0)
      .sort((a, b) => a.productName.localeCompare(b.productName));
  }, [products, summaryData, soldData, warehouseStock, warehouseSalesData, movementsData, hasReceiptFilter, selectedReceiptRanges, dateFrom, dateTo]);

  const filteredSummaries = useMemo(() => {
    if (!search.trim()) return productSummaries;
    return productSummaries.filter(s => s.productName.includes(search));
  }, [productSummaries, search]);

  // Map of available quantities per product. When warehouse_stock exists it reflects
  // the real warehouse balance; otherwise it falls back to the reconstructed total.
  const availableQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of productSummaries) {
      if (s.remaining > 0) map[s.productId] = s.remaining;
    }
    return map;
  }, [productSummaries]);

  // Fetch pallet quantity for review
  const { data: palletData } = useQuery({
    queryKey: ['branch-pallet-qty', branchId],
    queryFn: async () => {
      const { data } = await supabase
        .from('branch_pallets')
        .select('quantity')
        .eq('branch_id', branchId!)
        .single();
      return data?.quantity || 0;
    },
    enabled: !!branchId,
  });

  // Only block on essential queries; sales_tracking & stock_movements aggregations
  // populate progressively in the background to avoid freezing the page.
  if (isLoading || summaryLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  const isAggregating = soldLoading || warehouseSalesLoading || movementsLoading;

  const hasStock = warehouseStock.length > 0;
  const stockItemsForSale = warehouseStock.map(s => ({
    id: s.id,
    product_id: s.product_id,
    quantity: s.quantity,
    product: s.product,
  }));

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          {t('stock.warehouse_stock')}
        </h2>
        <div className="flex items-center gap-1.5" />

      </div>
      {/* Tabs */}
      <Tabs value={activeTab === 'today' ? 'stock' : activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="stock" className="text-xs gap-1">
            <Package className="w-3.5 h-3.5" />
            {t('warehouse.stock_tab')}
          </TabsTrigger>
          <TabsTrigger value="review" className="text-xs gap-1">
            <ClipboardCheck className="w-3.5 h-3.5" />
            {t('warehouse.reviews_tab')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4 mt-3">
      {/* Pallet Balance */}
      {branchId && <BranchPalletCard branchId={branchId} />}

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('warehouse.search_product')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-9"
        />
      </div>

      {/* Product Summary Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
            <Package className="w-4 h-4" />
            {t('warehouse.stock_summary')}
            <Badge variant="secondary" className="text-xs">{filteredSummaries.length}</Badge>
          </h3>
        </div>


        {filteredSummaries.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              {t('warehouse.no_stock_data')}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 pb-2">
              {filteredSummaries.map(s => {
                const piecesPerBox = products.find(p => p.id === s.productId)?.pieces_per_box || 20;
                const fmt = (v: number) => dbBPDisplayAlways(v, piecesPerBox);
                // Format gifts: gifts are stored as total pieces, convert to boxes first
                const giftInBoxes = s.gifts / piecesPerBox;
                const giftFormatted = boxesToBP(giftInBoxes, piecesPerBox);

                const row1 = [
                  { label: t('warehouse.at_workers'), value: s.workerStock, display: fmt(s.workerStock), color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', onClick: () => setWorkersForProduct(s) },
                  { label: t('warehouse.sold'), value: s.sold, display: fmt(s.sold), color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30', onClick: () => setSoldForProduct(s) },
                  { label: t('warehouse.surplus'), value: s.surplus, display: fmt(s.surplus), color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', onClick: () => setMetricLog({ product: s, metric: 'surplus' }) },
                  { label: t('warehouse.deficit'), value: s.deficit, display: fmt(s.deficit), color: 'text-destructive', bg: 'bg-red-50 dark:bg-red-950/30', onClick: () => setMetricLog({ product: s, metric: 'deficit' }) },
                ] as Array<{ label: string; value: number; display: string; color: string; bg: string; onClick?: () => void }>;
                const row2 = [
                  
                  { label: 'العروض', value: s.offers, display: fmt(s.offers), color: 'text-fuchsia-600', bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/30', onClick: () => setMetricLog({ product: s, metric: 'offers' }) },
                  { label: t('warehouse.damaged'), value: s.damaged, display: fmt(s.damaged), color: 'text-destructive', bg: 'bg-red-50 dark:bg-red-950/30', onClick: () => setMetricLog({ product: s, metric: 'damaged' }) },
                  { label: t('warehouse.returned'), value: s.factoryReturn, display: fmt(s.factoryReturn), color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30', onClick: () => setMetricLog({ product: s, metric: 'factoryReturn' }) },
                  { label: t('warehouse.compensation'), value: s.compensation, display: fmt(s.compensation), color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-950/30', onClick: () => setMetricLog({ product: s, metric: 'compensation' }) },
                ] as Array<{ label: string; value: number; display: string; color: string; bg: string; onClick?: () => void }>;
                return (
                  <Card key={s.productId} className="overflow-hidden border-border/60 shadow-sm">
                    {/* Product image + name + received + remaining */}
                    <div className="w-full bg-primary/5 border-b border-border/40 px-3 py-2 grid grid-cols-[auto_1fr_auto] gap-2 items-center">
                      {/* Right column (DOM first in RTL): action buttons stacked */}
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 border-primary/40 text-primary"
                          aria-label="حركة المخزون"
                          title="حركة المخزون"
                          onClick={(e) => { e.stopPropagation(); setMovementProduct(s); }}
                        >
                          <History className="w-3.5 h-3.5" />
                        </Button>
                        {canEdit && (
                          <Button
                            size="icon"
                            variant="destructive"
                            className="h-7 w-7"
                            aria-label={t('warehouse.manual_edit')}
                            title={t('warehouse.manual_edit')}
                            onClick={(e) => { e.stopPropagation(); setEditProduct(s); }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      {/* Middle column: name + delivery/remaining */}
                      <button
                        className="flex flex-col gap-1 min-w-0 items-center text-center hover:opacity-80 transition-opacity"
                        onClick={() => setExpandedProduct(prev => prev === s.productId ? null : s.productId)}
                      >
                        <span className="font-extrabold text-sm text-foreground break-words">{s.productName}</span>
                        <div className="flex items-center justify-center gap-3 flex-wrap">
                          {!isWarehouseManager && (
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-muted-foreground">{t('warehouse.received')}</span>
                              <span className="text-sm font-bold tabular-nums text-emerald-600">{fmt(s.received)}</span>
                            </div>
                          )}
                          <div dir="ltr" className="flex items-center gap-1">
                            <span className={`text-base font-extrabold tabular-nums ${s.remaining > 0 ? 'text-primary' : 'text-muted-foreground/50'}`}>{fmt(s.remaining)}</span>
                            <span className="text-[11px] text-muted-foreground">{t('warehouse.remaining')}</span>
                          </div>
                        </div>
                      </button>
                      {/* Left column (DOM last in RTL): product image */}
                      {(() => {
                        const prod = products.find(p => p.id === s.productId);
                        return prod?.image_url ? (
                          <img src={prod.image_url} alt={s.productName} className="w-12 h-12 rounded-md object-cover shrink-0 border border-border" />
                        ) : (
                          <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5 text-muted-foreground" />
                          </div>
                        );
                      })()}
                    </div>
                    {expandedProduct === s.productId && (
                      <CardContent className="p-3 space-y-1.5">
                        <div className="grid grid-cols-4 gap-1.5">
                          {row1.map(st => {
                            const isBtn = !!st.onClick;
                            const cls = `rounded-md px-2 py-1.5 text-center transition-colors ${st.value > 0 ? st.bg : 'bg-muted/30'} ${isBtn ? 'cursor-pointer hover:ring-2 hover:ring-primary/40 active:scale-[0.98]' : ''}`;
                            const content = (
                              <>
                                <div className={`text-[11px] leading-tight mb-0.5 ${st.value > 0 ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>{st.label}</div>
                                <div className={`text-sm font-bold tabular-nums ${st.value > 0 ? st.color : 'text-muted-foreground/40'}`}>{st.display}</div>
                              </>
                            );
                            return isBtn ? (
                              <button key={st.label} type="button" className={cls} onClick={st.onClick}>{content}</button>
                            ) : (
                              <div key={st.label} className={cls}>{content}</div>
                            );
                          })}
                        </div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {row2.map(st => {
                            const isBtn = !!st.onClick;
                            const cls = `rounded-md px-2 py-1.5 text-center transition-colors ${st.value > 0 ? st.bg : 'bg-muted/30'} ${isBtn ? 'cursor-pointer hover:ring-2 hover:ring-primary/40 active:scale-[0.98]' : ''}`;
                            const content = (
                              <>
                                <div className={`text-[11px] leading-tight mb-0.5 ${st.value > 0 ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>{st.label}</div>
                                <div className={`text-sm font-bold tabular-nums ${st.value > 0 ? st.color : 'text-muted-foreground/40'}`}>{st.display}</div>
                              </>
                            );
                            return isBtn ? (
                              <button key={st.label} type="button" className={cls} onClick={st.onClick}>{content}</button>
                            ) : (
                              <div key={st.label} className={cls}>{content}</div>
                            );
                          })}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
        )}
      </div>

      {/* Worker Stocks (collapsible) */}
      <div>
        <button
          className="flex items-center gap-2 w-full text-sm font-semibold text-muted-foreground py-2"
          onClick={() => setExpandedWorkers(prev => !prev)}
        >
          <Users className="w-4 h-4" />
          {t('stock.worker_stock')}
          <Badge variant="secondary" className="text-xs">{Object.keys(workerStocksByWorker).length}</Badge>
          <div className="flex-1" />
          {expandedWorkers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {expandedWorkers && (
          Object.keys(workerStocksByWorker).length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-muted-foreground text-sm">
                {t('stock.no_stock')}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {Object.entries(workerStocksByWorker).map(([workerId, data]) => (
                <Card key={workerId}>
                  <CardContent className="p-3">
                    <div className="font-semibold text-sm mb-2 text-primary">
                      {data.worker?.full_name || t('common.unknown')}
                    </div>
                    <div className="space-y-1">
                      {data.items.map(item => {
                        const ppb = item.product?.pieces_per_box || 20;
                        const mv = workerProductMovements?.[`${workerId}__${item.product_id}`];
                        return (
                          <div key={item.id} className="flex items-center justify-between gap-2 text-xs flex-wrap">
                            <span className="text-muted-foreground flex-1 min-w-0 truncate">{item.product?.name}</span>
                            <div className="flex items-center gap-1">
                              {mv && mv.loaded > 0 && (
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">
                                  شحن {dbBPDisplay(mv.loaded, ppb)}
                                </Badge>
                              )}
                              {mv && mv.returned > 0 && (
                                <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200 text-[10px] px-1.5 py-0">
                                  تفريغ {dbBPDisplay(mv.returned, ppb)}
                                </Badge>
                              )}
                              <span className="font-medium">{dbBPDisplay(Number(item.quantity || 0), ppb)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}
      </div>

        </TabsContent>

        <TabsContent value="review" className="mt-3">
          {branchId && <WarehouseReviewHistory branchId={branchId} />}
        </TabsContent>

        {isWarehouseManager && (
          <TabsContent value="today" className="mt-3">
            {branchId && <WarehouseTodayAchievements branchId={branchId} />}
          </TabsContent>
        )}
      </Tabs>

      <SalesHubDialog
        open={showSalesHubDialog}
        onOpenChange={setShowSalesHubDialog}
        initialTab="direct"
        stockSource="warehouse"
        stockItems={stockItemsForSale}
      />

      <QuickReceiptDialog
        open={showReceiptDialog}
        onOpenChange={setShowReceiptDialog}
        products={products}
        branchId={branchId}
        createReceipt={createReceipt}
      />

      <QuickLoadWorkerDialog
        open={showLoadWorkerDialog}
        onOpenChange={setShowLoadWorkerDialog}
        products={products}
        workers={workers}
        warehouseStock={warehouseStock}
        availableQuantities={availableQuantities}
        loadToWorker={loadToWorker}
      />

      {branchId && (
        <WarehouseReviewDialog
          open={showReviewDialog}
          onOpenChange={setShowReviewDialog}
          branchId={branchId}
          products={products}
          warehouseStock={warehouseStock}
          palletQuantity={palletData || 0}
        />
       )}

      <StockEmptyDialog
        open={showEmptyDialog}
        onOpenChange={setShowEmptyDialog}
        warehouseStock={warehouseStock}
        branchId={branchId}
        onComplete={() => refresh()}
      />

      {editProduct && branchId && (
        <StockManualEditDialog
          open={!!editProduct}
          onOpenChange={(open) => !open && setEditProduct(null)}
          productId={editProduct.productId}
          productName={editProduct.productName}
          branchId={branchId}
          piecesPerBox={products.find(p => p.id === editProduct.productId)?.pieces_per_box || 20}
          currentValues={{
            gifts: editProduct.gifts,
            damaged: editProduct.damaged,
            factoryReturn: editProduct.factoryReturn,
            compensation: editProduct.compensation,
            surplus: editProduct.surplus,
            deficit: editProduct.deficit,
            sold: editProduct.sold,
            remaining: editProduct.remaining,
          }}
        />
      )}
      {workersForProduct && branchId && (
        <ProductWorkerMovementsDialog
          open={!!workersForProduct}
          onOpenChange={(open) => !open && setWorkersForProduct(null)}
          branchId={branchId}
          productId={workersForProduct.productId}
          productName={workersForProduct.productName}
          piecesPerBox={products.find(p => p.id === workersForProduct.productId)?.pieces_per_box || 20}
        />
      )}
      {soldForProduct && branchId && (
        <ProductDailySoldDialog
          open={!!soldForProduct}
          onOpenChange={(open) => !open && setSoldForProduct(null)}
          branchId={branchId}
          productId={soldForProduct.productId}
          productName={soldForProduct.productName}
          piecesPerBox={products.find(p => p.id === soldForProduct.productId)?.pieces_per_box || 20}
          sinceIso={hasReceiptFilter ? null : (latestReceiptAtByProduct[soldForProduct.productId] || null)}
          ranges={hasReceiptFilter ? selectedReceiptRanges : undefined}
        />
      )}
      {metricLog && branchId && (
        <ProductMetricLogDialog
          open={!!metricLog}
          onOpenChange={(open) => !open && setMetricLog(null)}
          branchId={branchId}
          productId={metricLog.product.productId}
          productName={metricLog.product.productName}
          piecesPerBox={products.find(p => p.id === metricLog.product.productId)?.pieces_per_box || 20}
          metric={metricLog.metric}
          ranges={hasReceiptFilter ? selectedReceiptRanges : undefined}
        />
      )}
      {movementProduct && branchId && (
        <WarehouseProductMovementDialog
          open={!!movementProduct}
          onOpenChange={(open) => !open && setMovementProduct(null)}
          branchId={branchId}
          productId={movementProduct.productId}
          productName={movementProduct.productName}
          productImage={products.find(p => p.id === movementProduct.productId)?.image_url || null}
          piecesPerBox={products.find(p => p.id === movementProduct.productId)?.pieces_per_box || 20}
        />
      )}
    </div>

  );
};

export default WarehouseStock;
