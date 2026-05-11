import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import StockEmptyDialog from '@/components/warehouse/StockEmptyDialog';
import StockManualEditDialog from '@/components/warehouse/StockManualEditDialog';
import { useNavigate } from 'react-router-dom';
import { Package, Users, Loader2, Search, BarChart3, ChevronDown, ChevronUp, ClipboardList, ClipboardCheck, Trash2, Pencil } from 'lucide-react';
import { boxesToBP, dbBPDisplay, parseBP } from '@/utils/boxPieceInput';
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

const dbBPToPieces = (quantity: number, piecesPerBox: number) =>
  parseBP(Number(quantity || 0).toFixed(2), piecesPerBox).totalPieces;

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
  const { activeBranch, role, activeRole } = useAuth();
  const isWarehouseManager = activeRole?.custom_role_code === 'warehouse_manager';
  const isCompanyManager = activeRole?.custom_role_code === 'company_manager';
  const canEdit = isAdminRole(role) || isCompanyManager;
  const { warehouseStock, workerStocksByWorker, isLoading, products, workers, createReceipt, loadToWorker, refresh } = useWarehouseStock();
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

  const branchId = activeBranch?.id;

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
          .select('product_id, quantity, discrepancy_type')
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

  // Fetch sold from order_items for delivered orders
  const { data: soldData, isLoading: soldLoading } = useQuery({
    queryKey: ['warehouse-sold-summary', branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const { data: deliveredOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('branch_id', branchId)
        .eq('status', 'delivered');
      const orderIds = (deliveredOrders || []).map(o => o.id);
      if (orderIds.length === 0) return [];
      const { data } = await supabase
        .from('order_items')
        .select('order_id, product_id, quantity, gift_quantity')
        .in('order_id', orderIds);
      return data || [];
    },
    enabled: !!branchId,
  });

  // Fetch sales totals from sales_tracking. We split by source:
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

      const rows = (rawSales || []) as WarehouseSaleSummaryRow[];
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
        return belongsToBranch && (!row.order_id || order?.status === 'delivered');
      }).map((row) => ({
        ...row,
        order: row.order_id ? { status: orderById.get(row.order_id)?.status || null } : null,
      }));
    },
    enabled: !!branchId,
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
        productName: p.name,
        received: 0,
        workerStock: 0,
        sold: 0,
        gifts: 0,
        damaged: 0,
        factoryReturn: 0,
        compensation: 0,
        surplus: 0,
        deficit: 0,
        remaining: 0,
      };
    }

    // Received
    for (const r of (summaryData?.receipts || [])) {
      if (summaries[r.product_id]) {
        summaries[r.product_id].received += Number(r.quantity || 0);
      }
    }

    // Worker stocks
    for (const ws of (summaryData?.workerStocks || [])) {
      if (summaries[ws.product_id]) {
        summaries[ws.product_id].workerStock += Number(ws.quantity || 0);
      }
    }

    // Sold from order_items (delivered)
    const countedOrderProductKeys = new Set<string>();
    for (const oi of (soldData || [])) {
      if (summaries[oi.product_id]) {
        if (oi.order_id) countedOrderProductKeys.add(`${oi.order_id}:${oi.product_id}`);
        const product = products.find(p => p.id === oi.product_id);
        const piecesPerBox = product?.pieces_per_box || 20;

        const rawQty = Number(oi.quantity || 0);
        const rawGiftPieces = Number(oi.gift_quantity || 0);

        // quantity is stored بصيغة صناديق.قطع (تعبيرية) => نحولها لإجمالي قطع أولاً
        const qtyRounded = Math.round(rawQty * 100) / 100;
        const qtyBoxes = Math.floor(qtyRounded);
        const qtyPieces = Math.round((qtyRounded - qtyBoxes) * 100);
        const totalQtyPieces = (qtyBoxes * piecesPerBox) + qtyPieces;

        // الهدايا لا تُحتسب كمباع: نطرحها من المباع، ونبقيها في خانة الهدايا فقط
        const paidPieces = Math.max(0, totalQtyPieces - rawGiftPieces);
        const paidBoxes = Math.floor(paidPieces / piecesPerBox);
        const paidRemPieces = paidPieces % piecesPerBox;
        const paidQtyInBoxPieceFormat = paidBoxes + (paidRemPieces / 100);

        summaries[oi.product_id].sold = Math.round((summaries[oi.product_id].sold + paidQtyInBoxPieceFormat) * 100) / 100;
        summaries[oi.product_id].gifts += rawGiftPieces;
      }
    }

    // Discrepancies (surplus / deficit فقط)
    for (const d of (summaryData?.discrepancies || [])) {
      if (!summaries[d.product_id]) continue;
      const qty = Number(d.quantity || 0);
      if (d.discrepancy_type === 'deficit') {
        summaries[d.product_id].deficit += qty;
      } else if (d.discrepancy_type === 'surplus') {
        summaries[d.product_id].surplus += qty;
      }
    }

    // Damaged, factory return, compensation from warehouse stock (current snapshot)
    for (const ws of (summaryData?.warehouseDamaged || [])) {
      if (!summaries[ws.product_id]) continue;
      summaries[ws.product_id].damaged += Number(ws.damaged_quantity || 0);
      summaries[ws.product_id].factoryReturn += Number(ws.factory_return_quantity || 0);
      summaries[ws.product_id].compensation += Number(ws.compensation_quantity || 0);
    }

    // Compute remaining from fundamentals: receipts − load + return − warehouse_sale
    // (deliveries are deducted from worker stock, not from warehouse stock)
    const loadByProduct: Record<string, number> = {};
    const returnByProduct: Record<string, number> = {};
    const lastReceiptByProduct: Record<string, string> = {};
    const loadedAfterReceiptByProduct: Record<string, number> = {};
    for (const m of ((movementsData || []) as StockMovementSummaryRow[])) {
      const pid = m.product_id;
      if (!pid) continue;
      const qty = Number(m.quantity || 0);
      if (m.movement_type === 'load') {
        loadByProduct[pid] = (loadByProduct[pid] || 0) + qty;
      } else if (m.movement_type === 'return') {
        returnByProduct[pid] = (returnByProduct[pid] || 0) + qty;
      }
    }

    for (const r of (summaryData?.receipts || [])) {
      const pid = r.product_id;
      const createdAt = (r as any).created_at as string | undefined;
      if (pid && createdAt && (!lastReceiptByProduct[pid] || createdAt > lastReceiptByProduct[pid])) {
        lastReceiptByProduct[pid] = createdAt;
      }
    }

    for (const m of ((movementsData || []) as StockMovementSummaryRow[])) {
      const pid = m.product_id;
      if (!pid || m.movement_type !== 'load') continue;
      const lastReceiptAt = lastReceiptByProduct[pid];
      if (lastReceiptAt && m.created_at && m.created_at >= lastReceiptAt) {
        loadedAfterReceiptByProduct[pid] = (loadedAfterReceiptByProduct[pid] || 0) + Number(m.quantity || 0);
      }
    }

    const warehouseSaleByProduct: Record<string, number> = {};
    const otherSaleByProduct: Record<string, number> = {};
    for (const s of ((warehouseSalesData || []) as WarehouseSaleSummaryRow[])) {
      const pid = s.product_id;
      if (!pid) continue;
      const ppb = Number(s.pieces_per_box) || 20;
      const boxes = Number(s.total_boxes || 0);
      const pieces = Number(s.total_pieces || 0);
      const totalPieces = boxes * ppb + pieces;
      const fullBoxes = Math.floor(totalPieces / ppb);
      const remPieces = totalPieces % ppb;
      const inBoxPieceFmt = fullBoxes + remPieces / 100;
      if (s.source === 'warehouse_sale') {
        warehouseSaleByProduct[pid] = (warehouseSaleByProduct[pid] || 0) + inBoxPieceFmt;
      } else if (!s.order_id || !countedOrderProductKeys.has(`${s.order_id}:${pid}`)) {
        // مبيعات تسليم/مباشرة لم تُحتسب عبر order_items (مثل الطلبات القديمة بدون branch_id) — تُضاف للمباع
        otherSaleByProduct[pid] = (otherSaleByProduct[pid] || 0) + inBoxPieceFmt;
      }
    }

    for (const pid of Object.keys(summaries)) {
      const received = summaries[pid].received;
      const loadT = loadByProduct[pid] || 0;
      const returnT = returnByProduct[pid] || 0;
      const wSale = warehouseSaleByProduct[pid] || 0;
      const oSale = otherSaleByProduct[pid] || 0;
      const damaged = summaries[pid].damaged || 0;
      // أضف مبيعات المخزن المباشرة + مبيعات التسليم/المباشرة (بدون طلب) إلى المباع
      const extraSold = wSale + oSale;
      if (extraSold > 0) {
        summaries[pid].sold = Math.round((summaries[pid].sold + extraSold) * 100) / 100;
      }
      summaries[pid].remaining = Math.round((received - loadT + returnT - wSale - damaged) * 100) / 100;
    }

    // Hide products where all values are zero
    return Object.values(summaries)
      .filter(s => s.received + s.workerStock + s.sold + s.gifts + s.damaged + s.factoryReturn + s.compensation + s.surplus + s.deficit + s.remaining > 0)
      .sort((a, b) => a.productName.localeCompare(b.productName));
  }, [products, summaryData, soldData, warehouseStock, warehouseSalesData, movementsData]);

  const filteredSummaries = useMemo(() => {
    if (!search.trim()) return productSummaries;
    return productSummaries.filter(s => s.productName.includes(search));
  }, [productSummaries, search]);

  // Map of computed remaining (received - load + return - warehouse_sale) per product,
  // used as fallback when the warehouse_stock table itself is empty (e.g., after data cleanup).
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

  if (isLoading || summaryLoading || soldLoading || warehouseSalesLoading || movementsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
        <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
          <Package className="w-4 h-4" />
          {t('warehouse.stock_summary')}
          <Badge variant="secondary" className="text-xs">{filteredSummaries.length}</Badge>
        </h3>

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
                const fmt = (v: number) => dbBPDisplay(v, piecesPerBox);
                // Format gifts: gifts are stored as total pieces, convert to boxes first
                const giftInBoxes = s.gifts / piecesPerBox;
                const giftFormatted = boxesToBP(giftInBoxes, piecesPerBox);

                const row1 = [
                  { label: t('warehouse.at_workers'), value: s.workerStock, display: fmt(s.workerStock), color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
                  { label: t('warehouse.sold'), value: s.sold, display: fmt(s.sold), color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30' },
                  { label: t('warehouse.surplus'), value: s.surplus, display: fmt(s.surplus), color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
                  { label: t('warehouse.deficit'), value: s.deficit, display: fmt(s.deficit), color: 'text-destructive', bg: 'bg-red-50 dark:bg-red-950/30' },
                ];
                const row2 = [
                  { label: t('warehouse.gifts'), value: s.gifts, display: giftFormatted, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-950/30' },
                  { label: t('warehouse.damaged'), value: s.damaged, display: fmt(s.damaged), color: 'text-destructive', bg: 'bg-red-50 dark:bg-red-950/30' },
                  { label: t('warehouse.returned'), value: s.factoryReturn, display: fmt(s.factoryReturn), color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30' },
                  { label: t('warehouse.compensation'), value: s.compensation, display: fmt(s.compensation), color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-950/30' },
                ];
                return (
                  <Card key={s.productId} className="overflow-hidden border-border/60 shadow-sm">
                    {/* Product image + name + received + remaining */}
                    <div className="w-full bg-primary/5 border-b border-border/40 px-3 py-2 flex items-center justify-between gap-2">
                      <button
                        className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-80 transition-opacity"
                        onClick={() => setExpandedProduct(prev => prev === s.productId ? null : s.productId)}
                      >
                        {(() => {
                          const prod = products.find(p => p.id === s.productId);
                          return prod?.image_url ? (
                            <img src={prod.image_url} alt={s.productName} className="w-8 h-8 rounded-md object-cover shrink-0 border border-border" />
                          ) : (
                            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4 text-muted-foreground" />
                            </div>
                          );
                        })()}
                        <span className="font-semibold text-sm text-primary text-right break-words">{s.productName}</span>
                      </button>
                      <div className="flex items-center gap-3 shrink-0">
                        {!isWarehouseManager && (
                          <div className="flex items-center gap-1">
                           <span className="text-[11px] text-muted-foreground">{t('warehouse.received')}</span>
                            <span className="text-sm font-bold tabular-nums text-emerald-600">{fmt(s.received)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-muted-foreground">{t('warehouse.remaining')}</span>
                          <span className={`text-base font-extrabold tabular-nums ${s.remaining > 0 ? 'text-primary' : 'text-muted-foreground/50'}`}>{fmt(s.remaining)}</span>
                        </div>
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
                    </div>
                    {expandedProduct === s.productId && (
                      <CardContent className="p-3 space-y-1.5">
                        <div className="grid grid-cols-4 gap-1.5">
                          {row1.map(st => (
                            <div key={st.label} className={`rounded-md px-2 py-1.5 text-center ${st.value > 0 ? st.bg : 'bg-muted/30'}`}>
                              <div className={`text-[11px] leading-tight mb-0.5 ${st.value > 0 ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>{st.label}</div>
                              <div className={`text-sm font-bold tabular-nums ${st.value > 0 ? st.color : 'text-muted-foreground/40'}`}>{st.display}</div>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {row2.map(st => (
                            <div key={st.label} className={`rounded-md px-2 py-1.5 text-center ${st.value > 0 ? st.bg : 'bg-muted/30'}`}>
                              <div className={`text-[11px] leading-tight mb-0.5 ${st.value > 0 ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>{st.label}</div>
                              <div className={`text-sm font-bold tabular-nums ${st.value > 0 ? st.color : 'text-muted-foreground/40'}`}>{st.display}</div>
                            </div>
                          ))}
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
                      {data.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{item.product?.name}</span>
                          <span className="font-medium">{dbBPDisplay(Number(item.quantity || 0), item.product?.pieces_per_box || 20)}</span>
                        </div>
                      ))}
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
    </div>
  );
};

export default WarehouseStock;
