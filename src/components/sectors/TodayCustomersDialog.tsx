import React, { useMemo, useState, useEffect } from 'react';
import CustomerSummary from '@/components/customers/CustomerSummary';
import { getLocalizedName } from '@/utils/sectorName';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MapPin, Truck, ShoppingCart, Landmark, User, Phone, Eye, EyeOff, CheckCircle, PackageX, PackageCheck, Navigation, Loader2, MapPinOff, Clock, Check, X, DoorClosed, UserX, ShoppingBag, Printer, XCircle, Search, BanknoteIcon, Pencil, CalendarClock, ClipboardList, Calendar as CalendarIcon, Package, AlertTriangle, FileText, Banknote, Plus, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useWorkerGeoPosition } from '@/hooks/useWorkerGeoPosition';
import { reverseGeocode } from '@/utils/geoUtils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useSectorCoverage } from '@/hooks/useSectorCoverage';
import { useAuth } from '@/contexts/AuthContext';
import { useDueDebts, DueDebt } from '@/hooks/useDebtCollections';
import { useTrackVisit } from '@/hooks/useVisitTracking';
import { useLocationThreshold } from '@/hooks/useLocationSettings';
import { useHasPermission } from '@/hooks/usePermissions';
import { calculateDistance } from '@/utils/geoUtils';
import { OrderWithDetails } from '@/types/database';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format, addDays, isFriday } from 'date-fns';
import SalesHubDialog from '@/components/sales/SalesHubDialog';
import CreateOrderDialog from '@/components/orders/CreateOrderDialog';
import DebtFlowDialog from '@/components/debts/DebtFlowDialog';
import { TodayDebtCollectionOperation } from '@/components/debts/CollectedDebtOperationDialog';
import ReceiptDialog from '@/components/printing/ReceiptDialog';
import ModifyOrderDialog from '@/components/orders/ModifyOrderDialog';
import { useOrderItems } from '@/hooks/useOrders';
import WorkerOrdersSummaryDialog from '@/components/accounting/WorkerOrdersSummaryDialog';
import WorkerSalesSummaryDialog from '@/components/accounting/WorkerSalesSummaryDialog';
import TodayPrintSettingsDialog from '@/components/sectors/TodayPrintSettingsDialog';
import OrdersPrintView from '@/components/print/OrdersPrintView';
import { PrintColumnConfig } from '@/components/print/PrintColumnsConfigDialog';
import { isAdminRole } from '@/lib/utils';
import ClientTrustBadge from '@/components/customers/ClientTrustBadge';
import { computeClientTrustScore } from '@/utils/clientTrustScore';

const DAY_NAMES: Record<string, string> = {
  saturday: 'السبت', sunday: 'الأحد', monday: 'الإثنين',
  tuesday: 'الثلاثاء', wednesday: 'الأربعاء', thursday: 'الخميس',
};
const JS_DAY_TO_NAME: Record<number, string> = {
  6: 'saturday', 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday',
};

const getMostRecentMatchingDate = (fromDate: Date, targetDay: string) => {
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(fromDate);
    candidate.setDate(fromDate.getDate() - offset);
    if (JS_DAY_TO_NAME[candidate.getDay()] === targetDay) {
      candidate.setHours(0, 0, 0, 0);
      return candidate;
    }
  }

  return null;
};

const toLocalDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toSafeNumber = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeSaleItem = (item: any) => ({
  productId: item?.product_id || item?.productId || item?.product?.id || '',
  productName: item?.product?.name || item?.product_name || item?.productName || '—',
  quantity: toSafeNumber(item?.quantity),
  unitPrice: toSafeNumber(item?.unit_price ?? item?.unitPrice),
  totalPrice: toSafeNumber(item?.total_price ?? item?.totalPrice),
  giftQuantity: toSafeNumber(item?.gift_quantity ?? item?.giftQuantity),
  giftPieces: toSafeNumber(item?.gift_pieces ?? item?.giftPieces),
  piecesPerBox: toSafeNumber(item?.pieces_per_box ?? item?.piecesPerBox ?? item?.product?.pieces_per_box),
  pricingUnit: item?.pricing_unit ?? item?.pricingUnit ?? item?.product?.pricing_unit ?? undefined,
  weightPerBox: toNullableNumber(item?.weight_per_box ?? item?.weightPerBox ?? item?.product?.weight_per_box),
});

// Resolve paid/remaining amounts from order fields (partial_amount + payment_status)
const resolveOrderPayment = (order: any, isOrderRequest: boolean) => {
  const totalAmount = Number(order.total_amount || 0);
  const paymentStatus = String(order.payment_status || '').toLowerCase();
  const partialAmount = order.partial_amount != null ? Number(order.partial_amount) : null;

  if (isOrderRequest) return { paidAmount: 0, remainingAmount: totalAmount };

  // Prefer explicit partial amount when valid (covers old/new status naming mismatches)
  if (partialAmount != null && partialAmount >= 0 && partialAmount < totalAmount) {
    return { paidAmount: partialAmount, remainingAmount: Math.max(0, totalAmount - partialAmount) };
  }

  // Unpaid / debt states
  if (['pending', 'payment_pending', 'no_payment', 'credit'].includes(paymentStatus)) {
    return { paidAmount: 0, remainingAmount: totalAmount };
  }

  // Partial states
  if (['partial', 'payment_partial'].includes(paymentStatus)) {
    const paid = Math.max(0, Math.min(totalAmount, partialAmount ?? 0));
    return { paidAmount: paid, remainingAmount: Math.max(0, totalAmount - paid) };
  }

  // Fully paid states (cash/check/full)
  if (['cash', 'check', 'payment_full', 'paid', 'full'].includes(paymentStatus)) {
    return { paidAmount: totalAmount, remainingAmount: 0 };
  }

  // Legacy fallback if remaining_amount exists on hydrated payloads
  if (order.remaining_amount != null) {
    const rem = Number(order.remaining_amount);
    return { paidAmount: Math.max(0, totalAmount - rem), remainingAmount: Math.max(0, rem) };
  }

  return { paidAmount: totalAmount, remainingAmount: 0 };
};

// Generate next work days (Sat-Thu, skip Friday) starting from tomorrow
const getNextWorkDays = (): { date: Date; label: string }[] => {
  const days: { date: Date; label: string }[] = [];
  const dayLabels = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  let current = addDays(new Date(), 1);
  while (days.length < 6) {
    if (!isFriday(current)) {
      days.push({
        date: new Date(current),
        label: `${dayLabels[current.getDay()]} ${format(current, 'dd/MM')}`,
      });
    }
    current = addDays(current, 1);
  }
  return days;
};

interface TodayCustomersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetWorkerId?: string;
  targetWorkerName?: string;
}

const TodayCustomersDialog: React.FC<TodayCustomersDialogProps> = ({
  open, onOpenChange, targetWorkerId, targetWorkerName,
}) => {
  const { workerId: authWorkerId, activeBranch, role, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isAdmin = isAdminRole(role) || role === 'supervisor';
  const todayName = JS_DAY_TO_NAME[new Date().getDay()] || '';
  const [selectedDay, setSelectedDay] = useState(todayName);
  const [selectedCustomDate, setSelectedCustomDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { trackVisit } = useTrackVisit();
  const { data: locationThreshold } = useLocationThreshold();
  const canBypassLocation = useHasPermission('bypass_location_check');
  const [sortByDistance, setSortByDistance] = useState(true);

  // Real-time worker GPS position for distance sorting/badges
  const { position: workerPosition } = useWorkerGeoPosition(open && sortByDistance);
  const [workerAddress, setWorkerAddress] = useState<string>('');

  // Reverse geocode worker position to get current address
  useEffect(() => {
    if (!workerPosition) { setWorkerAddress(''); return; }
    let cancelled = false;
    reverseGeocode(workerPosition.lat, workerPosition.lng).then(addr => {
      if (!cancelled) setWorkerAddress(addr);
    });
    return () => { cancelled = true; };
  }, [workerPosition?.lat, workerPosition?.lng]);

  // Admin worker picker state
  const [selectedAdminWorkerId, setSelectedAdminWorkerId] = useState<string | null>(targetWorkerId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBulkPostpone, setShowBulkPostpone] = useState(false);
  
  const [postponeCustomer, setPostponeCustomer] = useState<any>(null);
  const [postponeWorkerId, setPostponeWorkerId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [calendarFilter, setCalendarFilter] = useState<'orders' | 'debts' | 'collections' | 'sales'>('orders');

  // Fetch workers list for admin picker
  const { data: workersList = [] } = useQuery({
    queryKey: ['today-cust-workers-list', activeBranch?.id],
    queryFn: async () => {
      let query = supabase.from('workers').select('id, full_name, username, is_active, role, branch_id');
      if (activeBranch) query = query.eq('branch_id', activeBranch.id);
      const { data } = await query.order('full_name');
      const workers = data || [];
      // Fetch custom roles to identify warehouse_manager
      const workerIds = workers.map(w => w.id);
      if (workerIds.length === 0) return workers;
      const { data: roleData } = await supabase
        .from('worker_roles')
        .select('worker_id, custom_role_id')
        .in('worker_id', workerIds);
      // Collect unique custom_role_ids and fetch their codes
      const customRoleIds = [...new Set((roleData || []).map(r => r.custom_role_id).filter(Boolean))] as string[];
      const roleCodeMap = new Map<string, string>();
      if (customRoleIds.length > 0) {
        const { data: rolesInfo } = await supabase
          .from('custom_roles')
          .select('id, code')
          .in('id', customRoleIds);
        for (const ri of (rolesInfo || [])) roleCodeMap.set(ri.id, ri.code);
      }
      const workerRoleCodesMap = new Map<string, Set<string>>();
      for (const r of (roleData || [])) {
        const code = r.custom_role_id ? roleCodeMap.get(r.custom_role_id) : null;
        if (code) {
          if (!workerRoleCodesMap.has(r.worker_id)) workerRoleCodesMap.set(r.worker_id, new Set());
          workerRoleCodesMap.get(r.worker_id)!.add(code);
        }
      }
      return workers.map(w => ({ ...w, _custom_role_codes: workerRoleCodesMap.get(w.id) || new Set<string>() }));
    },
    enabled: (isAdminRole(role) || role === 'supervisor') && open && !targetWorkerId,
  });

  const adminExcludedRoles = useMemo(() => new Set(['admin', 'branch_admin', 'project_manager', 'accountant', 'admin_assistant']), []);
  const adminPickerWorkers = useMemo(
    () => workersList.filter(w => !adminExcludedRoles.has(w.role) && (w.is_active ?? true)),
    [workersList, adminExcludedRoles]
  );

  // For admin: use selected worker or fallback to auth worker
  const effectiveWorkerId = targetWorkerId || (isAdmin && selectedAdminWorkerId ? selectedAdminWorkerId : authWorkerId);
  const effectiveWorkerName = targetWorkerName || (isAdmin && selectedAdminWorkerId ? workersList.find(w => w.id === selectedAdminWorkerId)?.full_name : undefined);
  const hasSpecificWorker = !!(targetWorkerId || selectedAdminWorkerId);
  const scopedBranchId = useMemo(() => {
    if (!activeBranch?.id) return null;
    // Bypass branch filter when viewing a specific worker's data (admin tracking)
    // or when the worker views their own data (already scoped by worker via sector_schedules & assigned_worker_id)
    if (hasSpecificWorker || !isAdmin) return null;
    return activeBranch.id;
  }, [activeBranch?.id, isAdmin, hasSpecificWorker]);

  // Compute the actual date for the selectedDay in the current Saturday-based week
  const NAME_TO_JS_DAY: Record<string, number> = {
    saturday: 6, sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
  };
  const selectedDayBounds = useMemo(() => {
    if (selectedCustomDate) {
      const customStart = new Date(selectedCustomDate);
      customStart.setHours(0, 0, 0, 0);
      const customEnd = new Date(selectedCustomDate);
      customEnd.setHours(23, 59, 59, 999);

      const customJsDay = selectedCustomDate.getDay();
      const daysFromSaturday = customJsDay === 6 ? 0 : customJsDay + 1;
      const weekStart = new Date(selectedCustomDate);
      weekStart.setDate(selectedCustomDate.getDate() - daysFromSaturday);
      weekStart.setHours(0, 0, 0, 0);

      return {
        start: customStart.toISOString(),
        end: customEnd.toISOString(),
        weekStart: weekStart.toISOString(),
        dateKey: toLocalDateKey(selectedCustomDate),
      };
    }

    const now = new Date();
    const currentJsDay = now.getDay();
    const targetJsDay = NAME_TO_JS_DAY[selectedDay] ?? currentJsDay;

    // Calculate the Saturday-based week start
    const daysFromSaturday = currentJsDay === 6 ? 0 : currentJsDay + 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysFromSaturday);
    weekStart.setHours(0, 0, 0, 0);

    // Calculate target day offset from Saturday
    const targetOffset = targetJsDay === 6 ? 0 : targetJsDay + 1;
    const targetDate = new Date(weekStart);
    targetDate.setDate(weekStart.getDate() + targetOffset);

    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      weekStart: weekStart.toISOString(),
      dateKey: toLocalDateKey(targetDate),
    };
  }, [selectedCustomDate, selectedDay]);

  const todayStart = selectedDayBounds.start;
  const todayDateStr = selectedDayBounds.dateKey;

  // Sub-dialog states
  const [showSalesHubDialog, setShowSalesHubDialog] = useState(false);
  const [salesHubTab, setSalesHubTab] = useState<'direct' | 'delivery'>('direct');
  const [pendingDeliveryOrder, setPendingDeliveryOrder] = useState<OrderWithDetails | null>(null);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [selectedCustomerForOrder, setSelectedCustomerForOrder] = useState<string | null>(null);
  const [showVisitNoPayment, setShowVisitNoPayment] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<any>(null);
  const [showCollectDebt, setShowCollectDebt] = useState(false);
  const [selectedCollectedOperation, setSelectedCollectedOperation] = useState<TodayDebtCollectionOperation | null>(null);
  const [showCollectedOperationDialog, setShowCollectedOperationDialog] = useState(false);
  const [checkingLocationFor, setCheckingLocationFor] = useState<string | null>(null);
  const [loadingDeliveryFor, setLoadingDeliveryFor] = useState<string | null>(null);
  const [orderDetailsDialog, setOrderDetailsDialog] = useState<any>(null);
  const [directSaleCustomerId, setDirectSaleCustomerId] = useState<string | null>(null);
  const [printReceiptData, setPrintReceiptData] = useState<any>(null);
  const [showPrintReceipt, setShowPrintReceipt] = useState(false);
  const [showOrdersSummary, setShowOrdersSummary] = useState(false);
  const [showSalesSummary, setShowSalesSummary] = useState(false);
  const [showPrintOrdersDialog, setShowPrintOrdersDialog] = useState(false);
  const [isPrintReady, setIsPrintReady] = useState(false);
  const [filteredOrdersForPrint, setFilteredOrdersForPrint] = useState<OrderWithDetails[]>([]);
  const [allOrderItems, setAllOrderItems] = useState<Map<string, any[]>>(new Map());
  const [printColumnConfig, setPrintColumnConfig] = useState<PrintColumnConfig[]>([]);
  const [printWorkerName, setPrintWorkerName] = useState<string | null>(null);
  const [printDeliveryDate, setPrintDeliveryDate] = useState<string | null>(null);
  const [printExtraRows, setPrintExtraRows] = useState<{ label: string; productQuantities: Record<string, number>; style?: 'highlight' | 'normal' }[]>([]);

  // Data queries
  const { data: sectors = [] } = useQuery({
    queryKey: ['today-cust-sectors', effectiveWorkerId, scopedBranchId],
    queryFn: async () => {
      let query = supabase.from('sectors').select('*');
      if (scopedBranchId) query = query.eq('branch_id', scopedBranchId);
      const { data } = await query;
      return data || [];
    },
    enabled: !!effectiveWorkerId && open,
  });

  // Fetch sector_schedules for multi-schedule support
  const { data: sectorSchedules = [] } = useQuery({
    queryKey: ['today-cust-sector-schedules', scopedBranchId],
    queryFn: async () => {
      const { data } = await supabase.from('sector_schedules').select('*');
      return data || [];
    },
    enabled: !!effectiveWorkerId && open,
  });

  const { data: sectorCustomers = [] } = useQuery({
    queryKey: ['today-cust-customers', scopedBranchId],
    queryFn: async () => {
      let query = supabase.from('customers').select('id, name, phone, wilaya, sector_id, zone_id, store_name, latitude, longitude, customer_type, internal_name').not('sector_id', 'is', null);
      if (scopedBranchId) query = query.eq('branch_id', scopedBranchId);
      const { data } = await query;
      return data || [];
    },
    enabled: !!effectiveWorkerId && open,
  });

  const { data: todayVisits = [] } = useQuery({
    queryKey: ['today-visits-dialog', effectiveWorkerId, todayStart, selectedDayBounds.end],
    queryFn: async () => {
      const { data } = await supabase
        .from('visit_tracking')
        .select('customer_id, operation_type, notes, created_at, latitude, longitude')
        .eq('worker_id', effectiveWorkerId!)
        .gte('created_at', todayStart)
        .lte('created_at', selectedDayBounds.end);
      return data || [];
    },
    enabled: !!effectiveWorkerId && open,
    refetchInterval: 10000,
  });

  const { data: todayOrders = [] } = useQuery({
    queryKey: ['today-orders-dialog', effectiveWorkerId, todayStart, selectedDayBounds.end],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('customer_id, created_at')
        .eq('created_by', effectiveWorkerId!)
        .gte('created_at', todayStart)
        .lte('created_at', selectedDayBounds.end)
        .not('status', 'eq', 'cancelled');
      return data || [];
    },
    enabled: !!effectiveWorkerId && open,
    refetchInterval: 10000,
  });

  const { data: calendarOrderDays = [] } = useQuery({
    queryKey: ['today-custom-calendar-order-days', effectiveWorkerId, selectedAdminWorkerId, isAdmin, hasSpecificWorker, calendarMonth.getFullYear(), calendarMonth.getMonth(), open],
    queryFn: async () => {
      const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
      const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0, 23, 59, 59, 999);

      // Fetch pending delivery orders using delivery_date
      let query = supabase
        .from('orders')
        .select('delivery_date, created_at')
        .not('status', 'eq', 'cancelled')
        .not('status', 'eq', 'delivered');

      if (!isAdmin || hasSpecificWorker) {
        query = query.or(`created_by.eq.${effectiveWorkerId},assigned_worker_id.eq.${effectiveWorkerId}`);
      }

      const { data } = await query;
      const monthKey = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`;
      return (data || []).map((row: any) => {
        const dateStr = row.delivery_date || row.created_at?.split('T')[0];
        return dateStr;
      }).filter((d: string) => d && d.startsWith(monthKey));
    },
    enabled: open && !!effectiveWorkerId && calendarFilter === 'orders',
  });

  const orderDaySet = useMemo(() => {
    return new Set(calendarOrderDays as string[]);
  }, [calendarOrderDays]);

  // Calendar: new debts days
  const { data: calendarDebtDays = [] } = useQuery({
    queryKey: ['calendar-debt-days', effectiveWorkerId, isAdmin, hasSpecificWorker, calendarMonth.getFullYear(), calendarMonth.getMonth()],
    queryFn: async () => {
      const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
      const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0, 23, 59, 59, 999);
      let query = supabase
        .from('customer_debts')
        .select('created_at')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());
      if (!isAdmin || hasSpecificWorker) query = query.eq('worker_id', effectiveWorkerId!);
      const { data } = await query;
      return [...new Set((data || []).map((r: any) => r.created_at?.split('T')[0]).filter(Boolean))];
    },
    enabled: open && !!effectiveWorkerId && calendarFilter === 'debts',
  });
  const debtDaySet = useMemo(() => new Set(calendarDebtDays as string[]), [calendarDebtDays]);

  // Calendar: debt collection days
  const { data: calendarCollectionDays = [] } = useQuery({
    queryKey: ['calendar-collection-days', effectiveWorkerId, isAdmin, hasSpecificWorker, calendarMonth.getFullYear(), calendarMonth.getMonth()],
    queryFn: async () => {
      const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
      const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0, 23, 59, 59, 999);
      let query = supabase
        .from('debt_collections')
        .select('created_at')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());
      if (!isAdmin || hasSpecificWorker) query = query.eq('worker_id', effectiveWorkerId!);
      const { data } = await query;
      return [...new Set((data || []).map((r: any) => r.created_at?.split('T')[0]).filter(Boolean))];
    },
    enabled: open && !!effectiveWorkerId && calendarFilter === 'collections',
  });
  const collectionDaySet = useMemo(() => new Set(calendarCollectionDays as string[]), [calendarCollectionDays]);

  // Calendar: direct sale days
  const { data: calendarSaleDays = [] } = useQuery({
    queryKey: ['calendar-sale-days', effectiveWorkerId, isAdmin, hasSpecificWorker, calendarMonth.getFullYear(), calendarMonth.getMonth()],
    queryFn: async () => {
      const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
      const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0, 23, 59, 59, 999);
      let query = supabase
        .from('visit_tracking')
        .select('created_at')
        .eq('operation_type', 'direct_sale')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());
      if (!isAdmin || hasSpecificWorker) query = query.eq('worker_id', effectiveWorkerId!);
      const { data } = await query;
      return [...new Set((data || []).map((r: any) => r.created_at?.split('T')[0]).filter(Boolean))];
    },
    enabled: open && !!effectiveWorkerId && calendarFilter === 'sales',
  });
  const saleDaySet = useMemo(() => new Set(calendarSaleDays as string[]), [calendarSaleDays]);

  // Active calendar day set based on filter
  const activeCalendarDaySet = useMemo(() => {
    switch (calendarFilter) {
      case 'orders': return orderDaySet;
      case 'debts': return debtDaySet;
      case 'collections': return collectionDaySet;
      case 'sales': return saleDaySet;
      default: return orderDaySet;
    }
  }, [calendarFilter, orderDaySet, debtDaySet, collectionDaySet, saleDaySet]);

  const calendarRingColor = useMemo(() => {
    switch (calendarFilter) {
      case 'orders': return 'ring-blue-500';
      case 'debts': return 'ring-red-500';
      case 'collections': return 'ring-green-500';
      case 'sales': return 'ring-amber-500';
      default: return 'ring-blue-500';
    }
  }, [calendarFilter]);

  // Load merge assignments setting
  const { data: mergeAssignmentsSetting } = useQuery({
    queryKey: ['coverage-merge-assignments-setting'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'coverage_merge_assignments')
        .maybeSingle();
      return data ? data.value !== 'false' : true; // default true
    },
    enabled: open,
  });
  const shouldMergeAssignments = mergeAssignmentsSetting ?? true;

  // Fetch all zones for badge display and grouping
  const { data: allZones = [] } = useQuery({
    queryKey: ['today-cust-zones'],
    queryFn: async () => {
      const { data } = await supabase.from('sector_zones').select('*').order('name');
      return data || [];
    },
    enabled: open,
  });

  const { data: todayDeliveredOrders = [] } = useQuery({
    queryKey: ['today-delivered-dialog', effectiveWorkerId, selectedDayBounds.start, selectedDayBounds.end, isAdmin],
    queryFn: async () => {
      // Use stock_movements to determine actual delivery time accurately
      let smQuery = supabase
        .from('stock_movements')
        .select('order_id, created_at')
        .eq('movement_type', 'delivery')
        .gte('created_at', selectedDayBounds.start)
        .lte('created_at', selectedDayBounds.end);
      if (!isAdmin || hasSpecificWorker) {
        smQuery = smQuery.eq('worker_id', effectiveWorkerId!);
      }
      const { data: movements } = await smQuery;
      if (!movements || movements.length === 0) return [];

      // Build a map of order_id -> earliest delivery time
      const deliveryTimeMap: Record<string, string> = {};
      movements.forEach(m => {
        if (m.order_id && (!deliveryTimeMap[m.order_id] || m.created_at < deliveryTimeMap[m.order_id])) {
          deliveryTimeMap[m.order_id] = m.created_at;
        }
      });

      const orderIds = [...new Set(movements.map(m => m.order_id).filter(Boolean))];
      if (orderIds.length === 0) return [];

      const { data } = await supabase
        .from('orders')
        .select('id, customer_id, status, assigned_worker_id, total_amount')
        .in('id', orderIds)
        .eq('status', 'delivered');
      return (data || []).filter(o => Number(o.total_amount || 0) > 0).map(o => ({ ...o, delivered_at: deliveryTimeMap[o.id] || null }));
    },
    enabled: !!effectiveWorkerId && open,
    refetchInterval: 10000,
  });

  const { data: dueDebts = [] } = useDueDebts(todayDateStr);
  const { data: allDebts = [] } = useDueDebts('__all__');

  const { data: todayCollections = [] } = useQuery({
    queryKey: ['today-debt-collections-dialog', effectiveWorkerId, todayDateStr],
    queryFn: async () => {
      let query = supabase
        .from('debt_collections')
        .select(`
          id,
          debt_id,
          worker_id,
          collection_date,
          action,
          amount_collected,
          payment_method,
          next_due_date,
          status,
          notes,
          created_at,
          worker:workers!debt_collections_worker_id_fkey(id, full_name, username),
          debt:customer_debts!debt_collections_debt_id_fkey(
            id,
            customer_id,
            total_amount,
            paid_amount,
            remaining_amount,
            due_date,
            collection_type,
            collection_days,
            collection_amount,
            worker:workers!customer_debts_worker_id_fkey(id, full_name, username),
            customer:customers(id, name, store_name, phone, customer_type, latitude, longitude, sector_id)
          )
        `)
        .eq('collection_date', todayDateStr);
      if (!isAdmin || hasSpecificWorker) {
        query = query.eq('worker_id', effectiveWorkerId!);
      }
      const { data } = await query;
      return (data || []) as TodayDebtCollectionOperation[];
    },
    enabled: !!effectiveWorkerId && open,
    refetchInterval: 10000,
  });

  const { data: todayCollectionsAll = [] } = useQuery({
    queryKey: ['today-debt-collections-dialog-all', todayDateStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('debt_collections')
        .select(`
          id,
          debt_id,
          worker_id,
          collection_date,
          action,
          amount_collected,
          payment_method,
          next_due_date,
          status,
          notes,
          created_at,
          worker:workers!debt_collections_worker_id_fkey(id, full_name, username),
          debt:customer_debts!debt_collections_debt_id_fkey(
            id,
            customer_id,
            total_amount,
            paid_amount,
            remaining_amount,
            due_date,
            collection_type,
            collection_days,
            collection_amount,
            worker:workers!customer_debts_worker_id_fkey(id, full_name, username),
            customer:customers(id, name, store_name, phone, customer_type, latitude, longitude, sector_id)
          )
        `)
        .eq('collection_date', todayDateStr);
      return (data || []) as TodayDebtCollectionOperation[];
    },
    enabled: isAdmin && open,
    refetchInterval: 10000,
  });

  // Compute consecutive no-order visit streaks per customer
  // Fetches all visits (type 'visit') and orders to calculate how many consecutive
  // visits happened without an order being placed. Resets to 0 when an order is created.
  const { data: noOrderStreakMap = new Map<string, number>() } = useQuery({
    queryKey: ['no-order-streak-map', effectiveWorkerId, scopedBranchId],
    queryFn: async () => {
      // Fetch recent visits (last 90 days to cover multiple weeks)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      ninetyDaysAgo.setHours(0, 0, 0, 0);
      const since = ninetyDaysAgo.toISOString();

      const [visitsRes, ordersRes] = await Promise.all([
        supabase
          .from('visit_tracking')
          .select('customer_id, created_at')
          .eq('operation_type', 'visit')
          .gte('created_at', since)
          .order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select('customer_id, created_at')
          .gte('created_at', since)
          .not('status', 'eq', 'cancelled')
          .order('created_at', { ascending: false }),
      ]);

      const visits = visitsRes.data || [];
      const orders = ordersRes.data || [];

      // For each customer, find the latest order date, then count visits after that date
      const latestOrderMap = new Map<string, string>();
      orders.forEach(o => {
        if (!o.customer_id) return;
        if (!latestOrderMap.has(o.customer_id) || o.created_at > latestOrderMap.get(o.customer_id)!) {
          latestOrderMap.set(o.customer_id, o.created_at);
        }
      });

      const streakMap = new Map<string, number>();
      visits.forEach(v => {
        if (!v.customer_id) return;
        const latestOrder = latestOrderMap.get(v.customer_id);
        // Count this visit only if it's after the latest order (or no order exists)
        if (!latestOrder || v.created_at > latestOrder) {
          streakMap.set(v.customer_id, (streakMap.get(v.customer_id) || 0) + 1);
        }
      });

      return streakMap;
    },
    enabled: !!effectiveWorkerId && open,
  });

  // Customer IDs with unsettled worker liability (cash from deliveries or debt collections)
  const { data: liabilityCustomerIds = new Set<string>() } = useQuery({
    queryKey: ['worker-liability-customers', effectiveWorkerId],
    queryFn: async () => {
      // Find last completed accounting session
      const { data: lastSession } = await supabase
        .from('accounting_sessions')
        .select('period_end')
        .eq('worker_id', effectiveWorkerId!)
        .eq('status', 'completed')
        .order('period_end', { ascending: false })
        .limit(1);
      const since = lastSession?.[0]?.period_end || null;

      // Delivered orders with cash/partial
      let oq = supabase
        .from('orders')
        .select('customer_id, payment_status')
        .eq('assigned_worker_id', effectiveWorkerId!)
        .eq('status', 'delivered')
        .in('payment_status', ['cash', 'check', 'partial']);
      if (since) oq = oq.gt('created_at', since);
      const { data: orders } = await oq;

      // Approved debt collections
      let dq = supabase
        .from('debt_collections')
        .select('customer_id:debt_id')
        .eq('worker_id', effectiveWorkerId!)
        .eq('status', 'approved');
      if (since) dq = dq.gt('created_at', since);
      const { data: cols } = await dq;

      const ids = new Set<string>();
      (orders || []).forEach(o => { if (o.customer_id) ids.add(o.customer_id); });
      // For debt collections, get customer_id from customer_debts
      const debtIds = (cols || []).map((c: any) => c.customer_id).filter(Boolean);
      if (debtIds.length > 0) {
        const { data: debts } = await supabase.from('customer_debts').select('customer_id').in('id', debtIds);
        (debts || []).forEach(d => { if (d.customer_id) ids.add(d.customer_id); });
      }
      return ids;
    },
    enabled: !!effectiveWorkerId && open,
  });

  const { data: workerStock = [] } = useQuery({
    queryKey: ['my-worker-stock', effectiveWorkerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('worker_stock')
        .select('id, product_id, quantity, product:products(*)')
        .eq('worker_id', effectiveWorkerId!)
        .gt('quantity', 0);
      return data || [];
    },
    enabled: !!effectiveWorkerId && open,
  });

  // Products for print dialog
  const { data: allProducts = [] } = useQuery({
    queryKey: ['today-cust-products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name');
      return data || [];
    },
    enabled: open,
  });

  // Today's direct sales — detect via visit_tracking (operation_type='direct_sale') since
  // the sales flow (via SalesHub/DirectSaleDialog) tracks each sale as a 'direct_sale' visit.
  // Also fetch from receipts as a secondary source.
  const { data: todayDirectSales = [] } = useQuery({
    queryKey: ['today-direct-sales-dialog', effectiveWorkerId, todayStart, selectedDayBounds.end],
    queryFn: async () => {
      // 1. Get direct-sale visit tracking entries (most reliable marker)
      let vtQuery = supabase
        .from('visit_tracking')
        .select('customer_id, created_at, operation_id')
        .eq('operation_type', 'direct_sale')
        .gte('created_at', todayStart)
        .lte('created_at', selectedDayBounds.end);
      if (!isAdmin || hasSpecificWorker) {
        vtQuery = vtQuery.eq('worker_id', effectiveWorkerId!);
      }
      const { data: vtData } = await vtQuery;
      const vtResults = (vtData || []).map(v => ({
        customer_id: v.customer_id,
        order_id: v.operation_id,
        created_at: v.created_at,
        items: null,
        total_amount: null,
        customer_name: null,
      }));

      // 2. Also try receipts with receipt_type='direct_sale' as secondary source
      let rQuery = supabase
        .from('receipts')
        .select('customer_id, order_id, items, total_amount, customer_name, created_at')
        .eq('receipt_type', 'direct_sale')
        .gte('created_at', todayStart)
        .lte('created_at', selectedDayBounds.end);
      if (!isAdmin || hasSpecificWorker) {
        rQuery = rQuery.eq('worker_id', effectiveWorkerId!);
      }
      const { data: rData } = await rQuery;

      // Exclude cancelled direct sales so a cancelled sale returns to direct-sale customers
      const orderIds = [...new Set([
        ...(vtResults.map(v => v.order_id)),
        ...((rData || []).map((r: any) => r.order_id)),
      ].filter(Boolean))] as string[];

      const cancelledOrderIds = new Set<string>();
      if (orderIds.length > 0) {
        const { data: orderStatuses } = await supabase
          .from('orders')
          .select('id, status, total_amount')
          .in('id', orderIds);

        (orderStatuses || []).forEach((o: any) => {
          if (o.status === 'cancelled' || Number(o.total_amount || 0) === 0) cancelledOrderIds.add(o.id);
        });
      }

      const isActiveSale = (orderId?: string | null) => !orderId || !cancelledOrderIds.has(orderId);

      // Merge: prefer receipts data, then visit tracking for any missing customers
      const seen = new Set<string>();
      const merged: typeof vtResults = [];
      (rData || []).forEach(r => {
        if (!r.customer_id) return;
        const receiptOrderId = (r as any).order_id;
        if (!receiptOrderId || !isActiveSale(receiptOrderId)) return;
        seen.add(r.customer_id);
        merged.push(r as any);
      });
      vtResults.forEach(v => {
        if (!v.customer_id) return;
        if (!isActiveSale(v.order_id)) return;
        if (!seen.has(v.customer_id)) {
          seen.add(v.customer_id);
          merged.push(v);
        }
      });
      return merged;
    },
    enabled: !!effectiveWorkerId && open,
    refetchInterval: 10000,
  });

  // Today's direct sale visit tracking (for "بدون بيع")
  const { data: todayDirectSaleVisits = [] } = useQuery({
    queryKey: ['today-direct-sale-visits-dialog', effectiveWorkerId, todayStart, selectedDayBounds.end],
    queryFn: async () => {
      const { data } = await supabase
        .from('visit_tracking')
        .select('customer_id, notes')
        .eq('worker_id', effectiveWorkerId!)
        .gte('created_at', todayStart)
        .lte('created_at', selectedDayBounds.end)
        .or('notes.ilike.%بدون بيع%,notes.ilike.%مغلق (بيع مباشر)%,notes.ilike.%غير متاح (بيع مباشر)%');
      return data || [];
    },
    enabled: !!effectiveWorkerId && open,
    refetchInterval: 10000,
  });

  // Sector coverage (substitution system)
  const { getActiveCoveragesForDate } = useSectorCoverage();
  const selectedDateStr = selectedDayBounds.dateKey;

  const activeCoveragesForSelectedDay = useMemo(() => {
    const activeCoverages = getActiveCoveragesForDate(selectedDateStr);

    if (activeCoverages.length > 0) {
      console.log('[Coverage Debug] Active coverages for', selectedDateStr, ':', activeCoverages.map(c => ({
        sector: c.sector_id, type: c.schedule_type, absent: c.absent_worker_id, sub: c.substitute_worker_id, mode: c.coverage_mode,
      })));
    }

    return activeCoverages.filter((coverage) => {
      const scopedSchedules = sectorSchedules.filter(
        (sc) => sc.sector_id === coverage.sector_id && sc.schedule_type === coverage.schedule_type
      );

      if (scopedSchedules.length > 0) {
        // Accept if the absent worker has a schedule on this day (ideal),
        // OR if the sector simply has schedules on this day for this type
        // (handles cases where schedules were modified after coverage creation)
        const daySchedules = scopedSchedules.filter(sc => sc.day === selectedDay);
        if (daySchedules.length > 0) return true;
        console.log('[Coverage Debug] Filtered out coverage - no schedules on', selectedDay, 'for sector', coverage.sector_id, 'type', coverage.schedule_type);
        return false;
      }

      const sector = sectors.find((s) => s.id === coverage.sector_id);
      if (!sector) return false;

      if (coverage.schedule_type === 'sales') {
        return sector.visit_day_sales === selectedDay;
      }

      return sector.visit_day_delivery === selectedDay;
    });
  }, [getActiveCoveragesForDate, selectedDateStr, sectorSchedules, selectedDay, sectors]);

  // Get absent worker IDs that effectiveWorker is covering today
  const coveredAbsentWorkerIds = useMemo(() => {
    if (!shouldMergeAssignments || !effectiveWorkerId) return [];
    return [...new Set(
      activeCoveragesForSelectedDay
        .filter(c => c.substitute_worker_id === effectiveWorkerId)
        .map(c => c.absent_worker_id)
    )];
  }, [shouldMergeAssignments, effectiveWorkerId, activeCoveragesForSelectedDay]);

  const { data: assignedOrders = [] } = useQuery({
    queryKey: ['today-cust-assigned-orders-full', effectiveWorkerId, todayDateStr, scopedBranchId, coveredAbsentWorkerIds],
    queryFn: async () => {
      const workerIds = [effectiveWorkerId!, ...coveredAbsentWorkerIds];
      let query = supabase
        .from('orders')
        .select('*, customer:customers(*), items:order_items(*, product:products(*))')
        .in('status', ['pending', 'assigned', 'in_progress', 'confirmed', 'processing', 'in_transit', 'ready']);
      if (!isAdmin || hasSpecificWorker) {
        query = query.in('assigned_worker_id', workerIds);
      } else if (scopedBranchId) {
        query = query.or(`branch_id.eq.${scopedBranchId},branch_id.is.null`);
      }
      const { data } = await query;
      return (data || []) as OrderWithDetails[];
    },
    enabled: !!effectiveWorkerId && open,
  });

  // Merge sector customers with customers from assigned orders (who may lack a sector)
  const customers = useMemo(() => {
    const customerMap = new Map<string, any>();
    sectorCustomers.forEach(c => customerMap.set(c.id, c));
    assignedOrders.forEach(o => {
      if (o.customer && o.customer_id && !customerMap.has(o.customer_id)) {
        const c = o.customer as any;
        customerMap.set(o.customer_id, {
          id: c.id, name: c.name, phone: c.phone, wilaya: c.wilaya,
          sector_id: c.sector_id, zone_id: c.zone_id, store_name: c.store_name,
          latitude: c.latitude, longitude: c.longitude, customer_type: c.customer_type,
        });
      }
    });
    return Array.from(customerMap.values());
  }, [sectorCustomers, assignedOrders]);

  // Computed data - use sector_schedules for determining today's sectors
  const todaySalesSectorIds = useMemo(() => {
    const ids = new Set<string>();

    // From sector_schedules
    sectorSchedules.forEach(sc => {
      if (sc.day === selectedDay && sc.schedule_type === 'sales') {
        if (!hasSpecificWorker && isAdmin) {
          ids.add(sc.sector_id);
        } else if (sc.worker_id === effectiveWorkerId) {
          ids.add(sc.sector_id);
        }
      }
    });

    // Fallback: legacy fields for sectors without schedules
    sectors.forEach(s => {
      const hasSalesSchedule = sectorSchedules.some(sc => sc.sector_id === s.id && sc.schedule_type === 'sales');
      if (hasSalesSchedule) return;

      if (s.visit_day_sales === selectedDay) {
        if (!hasSpecificWorker && isAdmin) ids.add(s.id);
        else if (s.sales_worker_id === effectiveWorkerId) ids.add(s.id);
      }
    });

    // Apply substitution transfers for this selected day
    if (effectiveWorkerId) {
      // In 'replace' mode: substitute loses their OWN original sectors for this schedule_type
      const hasReplaceCoverage = activeCoveragesForSelectedDay.some(
        c => c.schedule_type === 'sales' && c.substitute_worker_id === effectiveWorkerId && c.coverage_mode === 'replace'
      );
      if (hasReplaceCoverage) {
        // Collect covered sector IDs so we don't accidentally remove them
        const coveredSectorIds = new Set(
          activeCoveragesForSelectedDay
            .filter(c => c.schedule_type === 'sales' && c.substitute_worker_id === effectiveWorkerId)
            .map(c => c.sector_id)
        );
        // Remove substitute's own original sectors (keep only the covered ones)
        const ownOriginalIds = [...ids].filter(id => !coveredSectorIds.has(id));
        ownOriginalIds.forEach(id => ids.delete(id));
      }

      activeCoveragesForSelectedDay.forEach(c => {
        if (c.schedule_type !== 'sales') return;
        // Remove sector from absent worker
        if (c.absent_worker_id === effectiveWorkerId) ids.delete(c.sector_id);
        // Add covered sector to substitute worker
        if (c.substitute_worker_id === effectiveWorkerId) {
          ids.add(c.sector_id);
        }
      });
    }

    return ids;
  }, [sectorSchedules, sectors, selectedDay, effectiveWorkerId, isAdmin, hasSpecificWorker, activeCoveragesForSelectedDay]);

  const todayDeliverySectorIds = useMemo(() => {
    const ids = new Set<string>();

    sectorSchedules.forEach(sc => {
      if (sc.day === selectedDay && sc.schedule_type === 'delivery') {
        if (!hasSpecificWorker && isAdmin) {
          ids.add(sc.sector_id);
        } else if (sc.worker_id === effectiveWorkerId) {
          ids.add(sc.sector_id);
        }
      }
    });

    sectors.forEach(s => {
      const hasDeliverySchedule = sectorSchedules.some(sc => sc.sector_id === s.id && sc.schedule_type === 'delivery');
      if (hasDeliverySchedule) return;

      if (s.visit_day_delivery === selectedDay) {
        if (!hasSpecificWorker && isAdmin) ids.add(s.id);
        else if (s.delivery_worker_id === effectiveWorkerId) ids.add(s.id);
      }
    });

    // Apply substitution transfers for this selected day
    if (effectiveWorkerId) {
      // In 'replace' mode: substitute loses their OWN original sectors for this schedule_type
      const hasReplaceCoverage = activeCoveragesForSelectedDay.some(
        c => c.schedule_type === 'delivery' && c.substitute_worker_id === effectiveWorkerId && c.coverage_mode === 'replace'
      );
      if (hasReplaceCoverage) {
        const coveredSectorIds = new Set(
          activeCoveragesForSelectedDay
            .filter(c => c.schedule_type === 'delivery' && c.substitute_worker_id === effectiveWorkerId)
            .map(c => c.sector_id)
        );
        const ownOriginalIds = [...ids].filter(id => !coveredSectorIds.has(id));
        ownOriginalIds.forEach(id => ids.delete(id));
      }

      activeCoveragesForSelectedDay.forEach(c => {
        if (c.schedule_type !== 'delivery') return;
        // Remove sector from absent worker
        if (c.absent_worker_id === effectiveWorkerId) ids.delete(c.sector_id);
        // Add covered sector to substitute worker
        if (c.substitute_worker_id === effectiveWorkerId) {
          ids.add(c.sector_id);
        }
      });
    }

    return ids;
  }, [sectorSchedules, sectors, selectedDay, effectiveWorkerId, isAdmin, hasSpecificWorker, activeCoveragesForSelectedDay]);

   const availableWorkerIdsForSelectedDay = useMemo(() => {
    const workerAssignments = new Map<string, Set<string>>();

    const addAssignment = (workerId: string | null, key: string) => {
      if (!workerId) return;
      if (!workerAssignments.has(workerId)) workerAssignments.set(workerId, new Set<string>());
      workerAssignments.get(workerId)!.add(key);
    };

    const removeAssignment = (workerId: string | null, key: string) => {
      if (!workerId) return;
      const current = workerAssignments.get(workerId);
      if (!current) return;
      current.delete(key);
      if (current.size === 0) workerAssignments.delete(workerId);
    };

    // Base assignments from new schedule system
    sectorSchedules.forEach((sc) => {
      if (sc.day !== selectedDay || !sc.worker_id) return;
      addAssignment(sc.worker_id, `${sc.schedule_type}:${sc.sector_id}`);
    });

    // Fallback assignments from legacy day fields
    sectors.forEach((s) => {
      const hasSalesSchedule = sectorSchedules.some((sc) => sc.sector_id === s.id && sc.schedule_type === 'sales');
      const hasDeliverySchedule = sectorSchedules.some((sc) => sc.sector_id === s.id && sc.schedule_type === 'delivery');

      if (!hasSalesSchedule && s.visit_day_sales === selectedDay) {
        addAssignment(s.sales_worker_id, `sales:${s.id}`);
      }

      if (!hasDeliverySchedule && s.visit_day_delivery === selectedDay) {
        addAssignment(s.delivery_worker_id, `delivery:${s.id}`);
      }
    });

    // Apply transfers from coverage records
    activeCoveragesForSelectedDay.forEach((coverage) => {
      const key = `${coverage.schedule_type}:${coverage.sector_id}`;
      removeAssignment(coverage.absent_worker_id, key);
      addAssignment(coverage.substitute_worker_id, key);
    });

    // Include workers who have assigned orders for the selected day (even without sectors)
    const selectedDateStr = selectedDayBounds.dateKey;
    assignedOrders.forEach((order) => {
      if (!order.assigned_worker_id) return;
      const isForSelectedDay =
        (order.delivery_date && order.delivery_date.startsWith(selectedDateStr)) ||
        (!order.delivery_date && order.created_at >= selectedDayBounds.start && order.created_at <= selectedDayBounds.end);
      if (isForSelectedDay) addAssignment(order.assigned_worker_id, 'orders:assigned');
    });

    return new Set(
      Array.from(workerAssignments.entries())
        .filter(([, assignments]) => assignments.size > 0)
        .map(([workerId]) => workerId)
    );
  }, [sectorSchedules, sectors, selectedDay, activeCoveragesForSelectedDay, assignedOrders, selectedDayBounds.start, selectedDayBounds.end, selectedDayBounds.dateKey]);

  // IMPORTANT: filter from all sectors using the computed IDs (which already include coverage substitutions)
  // so covered sectors appear immediately in direct-sale/delivery lists for substitute workers.
  const todaySalesSectors = useMemo(() => sectors.filter(s => todaySalesSectorIds.has(s.id)), [sectors, todaySalesSectorIds]);
  const todayDeliverySectors = useMemo(() => sectors.filter(s => todayDeliverySectorIds.has(s.id)), [sectors, todayDeliverySectorIds]);

  // Direct sold customer IDs (declared early for use in delivery filtering)
  const directSoldCustomerIds = useMemo(() => new Set(todayDirectSales.map(s => s.customer_id).filter(Boolean)), [todayDirectSales]);

  const deliveryCustomerIdsWithOrders = useMemo(() => {
    const ids = new Set<string>();
    const deliverySectorIds = new Set(todayDeliverySectors.map(s => s.id));
    assignedOrders.forEach(o => {
      if (!o.customer_id) return;
      const customer = customers.find(c => c.id === o.customer_id);
      const matchesSector = customer?.sector_id && deliverySectorIds.has(customer.sector_id);
      // Include explicitly assigned orders for the selected day even if customer has a sector outside today's planned sectors
      const isForSelectedDay =
        (o.delivery_date && o.delivery_date.startsWith(selectedDayBounds.dateKey)) ||
        (!o.delivery_date && o.created_at >= selectedDayBounds.start && o.created_at <= selectedDayBounds.end);
      const isExplicitlyAssigned = !!effectiveWorkerId && o.assigned_worker_id === effectiveWorkerId && isForSelectedDay;
      if (matchesSector || isExplicitlyAssigned) ids.add(o.customer_id);
    });
    // Exclude direct-sale customers from delivery tracking
    todayDeliveredOrders.forEach(o => { if (o.customer_id && !directSoldCustomerIds.has(o.customer_id)) ids.add(o.customer_id); });
    return ids;
  }, [assignedOrders, todayDeliveredOrders, todayDeliverySectors, customers, effectiveWorkerId, directSoldCustomerIds, selectedDayBounds.dateKey, selectedDayBounds.start, selectedDayBounds.end]);

  const deliveryCustomers = useMemo(() => customers.filter(c => deliveryCustomerIdsWithOrders.has(c.id)), [customers, deliveryCustomerIdsWithOrders]);
  const salesCustomers = useMemo(() => {
    const sectorIds = new Set(todaySalesSectors.map(s => s.id));
    return customers.filter(c => c.sector_id && sectorIds.has(c.sector_id));
  }, [customers, todaySalesSectors]);

  const visitedCustomerIds = useMemo(() => new Set(todayVisits.filter(v => v.operation_type === 'visit').map(v => v.customer_id).filter(Boolean)), [todayVisits]);
  const orderedCustomerIds = useMemo(() => new Set(todayOrders.map(o => o.customer_id).filter(Boolean)), [todayOrders]);
  const salesNotVisited = useMemo(() => salesCustomers.filter(c => !visitedCustomerIds.has(c.id) && !orderedCustomerIds.has(c.id)), [salesCustomers, visitedCustomerIds, orderedCustomerIds]);
  const salesVisitedNoOrder = useMemo(() => salesCustomers.filter(c => visitedCustomerIds.has(c.id) && !orderedCustomerIds.has(c.id)), [salesCustomers, visitedCustomerIds, orderedCustomerIds]);

  // Sub-categorize salesVisitedNoOrder based on visit notes
  const closedCustomerIds = useMemo(() => new Set(
    todayVisits.filter(v => v.operation_type === 'visit' && v.notes && /مغلق/.test(v.notes)).map(v => v.customer_id).filter(Boolean)
  ), [todayVisits]);
  const unavailableCustomerIds = useMemo(() => new Set(
    todayVisits.filter(v => v.operation_type === 'visit' && v.notes && /غير متاح/.test(v.notes)).map(v => v.customer_id).filter(Boolean)
  ), [todayVisits]);
  const salesVisitedOnly = useMemo(() => salesVisitedNoOrder.filter(c => !closedCustomerIds.has(c.id) && !unavailableCustomerIds.has(c.id)), [salesVisitedNoOrder, closedCustomerIds, unavailableCustomerIds]);
  const salesClosed = useMemo(() => salesVisitedNoOrder.filter(c => closedCustomerIds.has(c.id)), [salesVisitedNoOrder, closedCustomerIds]);
  const salesUnavailable = useMemo(() => salesVisitedNoOrder.filter(c => unavailableCustomerIds.has(c.id)), [salesVisitedNoOrder, unavailableCustomerIds]);
  const salesSuspended = useMemo(() => salesVisitedNoOrder.filter(c => closedCustomerIds.has(c.id) || unavailableCustomerIds.has(c.id)), [salesVisitedNoOrder, closedCustomerIds, unavailableCustomerIds]);
  const salesWithOrders = useMemo(() => salesCustomers.filter(c => orderedCustomerIds.has(c.id)), [salesCustomers, orderedCustomerIds]);

  // Map customer_id -> { deliveryDate, deliveryDay, itemCount } for "تم الطلب" tab
  const orderInfoMap = useMemo(() => {
    const map = new Map<string, { deliveryDate: string; deliveryDay: string; itemCount: number }>();
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    // Use todayOrders customer_ids to filter assignedOrders for full data
    const orderedIds = new Set(todayOrders.map(o => o.customer_id));
    assignedOrders.forEach(o => {
      if (!o.customer_id || !orderedIds.has(o.customer_id)) return;
      const items = (o as any).items || [];
      const itemCount = items.length;
      const dd = (o as any).delivery_date || '';
      let deliveryDay = '';
      let deliveryDate = dd;
      if (dd) {
        try {
          const d = new Date(dd + 'T00:00:00');
          deliveryDay = dayNames[d.getDay()] || '';
          deliveryDate = format(d, 'dd/MM');
        } catch {}
      }
      const existing = map.get(o.customer_id);
      if (!existing) {
        map.set(o.customer_id, { deliveryDate, deliveryDay, itemCount });
      } else {
        map.set(o.customer_id, {
          deliveryDate: dd > (existing.deliveryDate || '') ? deliveryDate : existing.deliveryDate,
          deliveryDay: dd > (existing.deliveryDate || '') ? deliveryDay : existing.deliveryDay,
          itemCount: existing.itemCount + itemCount,
        });
      }
    });
    return map;
  }, [todayOrders, assignedOrders]);

  const deliveredCustomerIds = useMemo(() => new Set(todayDeliveredOrders.map(o => o.customer_id).filter(Boolean)), [todayDeliveredOrders]);
  const customerDeliveryTimeMap = useMemo(() => {
    const map = new Map<string, string>();
    todayDeliveredOrders.forEach(o => {
      if (o.customer_id && o.delivered_at) map.set(o.customer_id, o.delivered_at);
    });
    return map;
  }, [todayDeliveredOrders]);

  // Time maps for visits, orders, and direct sales
  const visitTimeMap = useMemo(() => {
    const map = new Map<string, string>();
    todayVisits.forEach(v => {
      if (v.customer_id && v.created_at) {
        if (!map.has(v.customer_id) || v.created_at > map.get(v.customer_id)!) {
          map.set(v.customer_id, v.created_at);
        }
      }
    });
    return map;
  }, [todayVisits]);

  const orderTimeMap = useMemo(() => {
    const map = new Map<string, string>();
    todayOrders.forEach(o => {
      if (o.customer_id && o.created_at) {
        if (!map.has(o.customer_id) || o.created_at > map.get(o.customer_id)!) {
          map.set(o.customer_id, o.created_at);
        }
      }
    });
    return map;
  }, [todayOrders]);

  const directSaleTimeMap = useMemo(() => {
    const map = new Map<string, string>();
    todayDirectSales.forEach(s => {
      if (s.customer_id && s.created_at) {
        if (!map.has(s.customer_id) || s.created_at > map.get(s.customer_id)!) {
          map.set(s.customer_id, s.created_at);
        }
      }
    });
    return map;
  }, [todayDirectSales]);

  const debtCollectionTimeMap = useMemo(() => {
    const map = new Map<string, string>();
    todayCollections.forEach(c => {
      if (c.debt_id && c.created_at) {
        if (!map.has(c.debt_id) || c.created_at > map.get(c.debt_id)!) {
          map.set(c.debt_id, c.created_at);
        }
      }
    });
    return map;
  }, [todayCollections]);

  // Distance map: customer_id -> distance in meters (worker position at visit time vs customer stored location)
  const customerDistanceMap = useMemo(() => {
    const map = new Map<string, number>();
    todayVisits.forEach(v => {
      if (v.customer_id && v.latitude && v.longitude) {
        const customer = customers.find(c => c.id === v.customer_id);
        if (customer?.latitude && customer?.longitude) {
          const distKm = calculateDistance(v.latitude, v.longitude, customer.latitude, customer.longitude);
          const distMeters = Math.round(distKm * 1000);
          // Keep the most recent visit distance
          if (!map.has(v.customer_id) || (v.created_at && v.created_at > (todayVisits.find(tv => tv.customer_id === v.customer_id && map.has(v.customer_id))?.created_at || ''))) {
            map.set(v.customer_id, distMeters);
          }
        }
      }
    });
    return map;
  }, [todayVisits, customers]);

  const deliveryVisitedCustomerIds = useMemo(() => new Set(todayVisits.filter(v => v.operation_type === 'delivery_visit').map(v => v.customer_id).filter(Boolean)), [todayVisits]);

  // Customers whose ALL assigned orders have postpone_count > 0 (rescheduled to today)
  // These should appear in the "مؤجلة" tab, not in "بدون توصيل"
  const onlyPostponedCustomerIds = useMemo(() => {
    const custOrders = new Map<string, { total: number; postponed: number }>();
    assignedOrders.forEach(o => {
      if (!o.customer_id || !['pending', 'assigned', 'in_progress'].includes(o.status)) return;
      const entry = custOrders.get(o.customer_id) || { total: 0, postponed: 0 };
      entry.total++;
      if ((o as any).postpone_count > 0) entry.postponed++;
      custOrders.set(o.customer_id, entry);
    });
    const ids = new Set<string>();
    custOrders.forEach((v, k) => {
      if (v.total > 0 && v.total === v.postponed) ids.add(k);
    });
    return ids;
  }, [assignedOrders]);

  const deliveryNotDone = useMemo(() => deliveryCustomers.filter(c => !deliveredCustomerIds.has(c.id) && !deliveryVisitedCustomerIds.has(c.id) && !onlyPostponedCustomerIds.has(c.id)), [deliveryCustomers, deliveredCustomerIds, deliveryVisitedCustomerIds, onlyPostponedCustomerIds]);
  const deliveryNotReceived = useMemo(() => deliveryCustomers.filter(c => deliveryVisitedCustomerIds.has(c.id) && !deliveredCustomerIds.has(c.id)), [deliveryCustomers, deliveryVisitedCustomerIds, deliveredCustomerIds]);
  const deliveryReceived = useMemo(() => deliveryCustomers.filter(c => deliveredCustomerIds.has(c.id) && !directSoldCustomerIds.has(c.id)), [deliveryCustomers, deliveredCustomerIds, directSoldCustomerIds]);

  // Sub-categorize deliveryNotReceived based on delivery_visit notes
  const deliveryClosedCustomerIds = useMemo(() => new Set(
    todayVisits.filter(v => v.operation_type === 'delivery_visit' && v.notes && /مغلق/.test(v.notes)).map(v => v.customer_id).filter(Boolean)
  ), [todayVisits]);
  const deliveryUnavailableCustomerIds = useMemo(() => new Set(
    todayVisits.filter(v => v.operation_type === 'delivery_visit' && v.notes && /غير متاح/.test(v.notes)).map(v => v.customer_id).filter(Boolean)
  ), [todayVisits]);
  const deliveryDebtRefusedCustomerIds = useMemo(() => new Set(
    todayVisits.filter(v => v.operation_type === 'visit' && v.notes && /رفض الدين.*توصيل/.test(v.notes)).map(v => v.customer_id).filter(Boolean)
  ), [todayVisits]);
  const deliveryCancelledCustomerIds = useMemo(() => new Set(
    todayVisits.filter(v => v.operation_type === 'delivery_visit' && v.notes && /إلغاء|ملغي/.test(v.notes)).map(v => v.customer_id).filter(Boolean)
  ), [todayVisits]);
  const deliveryNotReceivedVisitOnly = useMemo(() => deliveryNotReceived.filter(c => !deliveryClosedCustomerIds.has(c.id) && !deliveryUnavailableCustomerIds.has(c.id) && !deliveryDebtRefusedCustomerIds.has(c.id) && !deliveryCancelledCustomerIds.has(c.id)), [deliveryNotReceived, deliveryClosedCustomerIds, deliveryUnavailableCustomerIds, deliveryDebtRefusedCustomerIds, deliveryCancelledCustomerIds]);
  const deliveryNotReceivedClosed = useMemo(() => deliveryNotReceived.filter(c => deliveryClosedCustomerIds.has(c.id)), [deliveryNotReceived, deliveryClosedCustomerIds]);
  const deliveryNotReceivedUnavailable = useMemo(() => deliveryNotReceived.filter(c => deliveryUnavailableCustomerIds.has(c.id)), [deliveryNotReceived, deliveryUnavailableCustomerIds]);
  const deliveryNotReceivedDebtRefused = useMemo(() => deliveryNotReceived.filter(c => deliveryDebtRefusedCustomerIds.has(c.id)), [deliveryNotReceived, deliveryDebtRefusedCustomerIds]);
  const deliveryNotReceivedCancelled = useMemo(() => deliveryNotReceived.filter(c => deliveryCancelledCustomerIds.has(c.id)), [deliveryNotReceived, deliveryCancelledCustomerIds]);

  // Postponed/overdue delivery orders (delivery_date before today, still undelivered)
  const postponedDeliveryOrders = useMemo(() => 
    assignedOrders.filter(o => o.delivery_date && o.delivery_date < todayDateStr && ['pending', 'assigned', 'in_progress'].includes(o.status)),
    [assignedOrders, todayDateStr]
  );
  const postponedCustomerIds = useMemo(() => {
    const ids = new Set(postponedDeliveryOrders.map(o => o.customer_id).filter(Boolean));
    // Also include customers rescheduled TO today (postpone_count > 0)
    onlyPostponedCustomerIds.forEach(id => ids.add(id));
    return ids;
  }, [postponedDeliveryOrders, onlyPostponedCustomerIds]);
  const deliveryPostponed = useMemo(() => {
    const custMap = new Map<string, any>();
    postponedDeliveryOrders.forEach(o => {
      if (o.customer_id && o.customer && !custMap.has(o.customer_id)) {
        custMap.set(o.customer_id, o.customer);
      }
    });
    // Add customers from onlyPostponedCustomerIds
    customers.forEach(c => {
      if (postponedCustomerIds.has(c.id) && !custMap.has(c.id)) custMap.set(c.id, c);
    });
    // Remove customers who have already been delivered
    return Array.from(custMap.values()).filter(c => !deliveredCustomerIds.has(c.id));
  }, [postponedDeliveryOrders, customers, postponedCustomerIds, deliveredCustomerIds]);

  // Map of customer_id -> max postpone_count for badge display
  const postponeCountMap = useMemo(() => {
    const map = new Map<string, number>();
    assignedOrders.forEach(o => {
      if (o.customer_id && (o as any).postpone_count > 0) {
        const current = map.get(o.customer_id) || 0;
        map.set(o.customer_id, Math.max(current, (o as any).postpone_count));
      }
    });
    return map;
  }, [assignedOrders]);

  // IDs of customers whose orders were rescheduled to today (for badge)
  const rescheduledToTodayIds = useMemo(() => {
    const ids = new Set<string>();
    assignedOrders.forEach(o => {
      if (o.customer_id && (o as any).postpone_count > 0) {
        ids.add(o.customer_id);
      }
    });
    return ids;
  }, [assignedOrders]);

  const collectedDebtIds = useMemo(() => new Set(todayCollections.filter(c => c.action !== 'no_payment').map(c => c.debt_id)), [todayCollections]);
  const noPaymentDebtIds = useMemo(() => new Set(todayCollections.filter(c => c.action === 'no_payment').map(c => c.debt_id)), [todayCollections]);
  const collectedDebtIdsAll = useMemo(() => new Set(todayCollectionsAll.filter(c => c.action !== 'no_payment').map(c => c.debt_id)), [todayCollectionsAll]);
  const noPaymentDebtIdsAll = useMemo(() => new Set(todayCollectionsAll.filter(c => c.action === 'no_payment').map(c => c.debt_id)), [todayCollectionsAll]);
  const debtCustomers = useMemo(() => dueDebts, [dueDebts]);
  const allDebtsFiltered = useMemo(() => allDebts, [allDebts]);
  // New debts: created today (use due_date as proxy since DueDebt lacks created_at directly)
  const newDebtsToday = useMemo(() => {
    const todayStr = selectedDayBounds.dateKey;
    return allDebts.filter(d => d.due_date && d.due_date === todayStr);
  }, [allDebts, selectedDayBounds.dateKey]);
  const workerDebts = useMemo(() => {
    if (hasSpecificWorker) return allDebts.filter(d => d.worker_id === effectiveWorkerId);
    return allDebts;
  }, [allDebts, effectiveWorkerId, hasSpecificWorker]);
  const debtClosedCustomerIds = useMemo(() => new Set(
    todayVisits
      .filter((v: any) => v.operation_type === 'visit' && String(v.notes || '').includes('(تحصيل دين)') && String(v.notes || '').includes('مغلق'))
      .map((v: any) => v.customer_id)
  ), [todayVisits]);
  const debtUnavailableCustomerIds = useMemo(() => new Set(
    todayVisits
      .filter((v: any) => v.operation_type === 'visit' && String(v.notes || '').includes('(تحصيل دين)') && String(v.notes || '').includes('غير متاح'))
      .map((v: any) => v.customer_id)
  ), [todayVisits]);
  const debtsToCollectToday = useMemo(() => {
    const collectedSet = isAdmin ? collectedDebtIdsAll : collectedDebtIds;
    const noPaymentSet = isAdmin ? noPaymentDebtIdsAll : noPaymentDebtIds;
    return debtCustomers.filter(d =>
      !collectedSet.has(d.id) &&
      !noPaymentSet.has(d.id) &&
      !debtClosedCustomerIds.has(d.customer_id) &&
      !debtUnavailableCustomerIds.has(d.customer_id)
    );
  }, [debtCustomers, collectedDebtIds, noPaymentDebtIds, collectedDebtIdsAll, noPaymentDebtIdsAll, debtClosedCustomerIds, debtUnavailableCustomerIds, isAdmin]);
  const collectedDebtOperations = useMemo(
    () => todayCollections
      .filter((collection) => collection.action !== 'no_payment')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [todayCollections]
  );
  const debtsNoPaymentVisitOnly = useMemo(
    () => workerDebts.filter(d => noPaymentDebtIds.has(d.id) && !debtClosedCustomerIds.has(d.customer_id) && !debtUnavailableCustomerIds.has(d.customer_id)),
    [workerDebts, noPaymentDebtIds, debtClosedCustomerIds, debtUnavailableCustomerIds]
  );
  const debtsNoPaymentClosed = useMemo(
    () => workerDebts.filter(d => debtClosedCustomerIds.has(d.customer_id)),
    [workerDebts, debtClosedCustomerIds]
  );
  const debtsNoPaymentUnavailable = useMemo(
    () => workerDebts.filter(d => debtUnavailableCustomerIds.has(d.customer_id)),
    [workerDebts, debtUnavailableCustomerIds]
  );
  const debtsNoPaymentToday = useMemo(
    () => {
      const byId = new Map<string, any>();
      [...debtsNoPaymentVisitOnly, ...debtsNoPaymentClosed, ...debtsNoPaymentUnavailable].forEach((debt) => byId.set(debt.id, debt));
      return Array.from(byId.values());
    },
    [debtsNoPaymentVisitOnly, debtsNoPaymentClosed, debtsNoPaymentUnavailable]
  );

  // Fetch sales worker visits for Prévente sectors to know which customers were visited
  const preventeDeliverySectors = useMemo(() => todayDeliverySectors.filter(s => (s as any).sector_type !== 'cash_van'), [todayDeliverySectors]);
  const { data: salesRepStatuses = [] } = useQuery({
    queryKey: ['sales-rep-statuses-for-prevente', preventeDeliverySectors.map(s => s.id).sort().join(','), customers.length, selectedDayBounds.dateKey],
    queryFn: async () => {
      if (preventeDeliverySectors.length === 0) return [];

      const selectedDate = new Date(selectedDayBounds.start);
      selectedDate.setHours(0, 0, 0, 0);

      const sectorStatusRows = await Promise.all(
        preventeDeliverySectors.map(async (sector) => {
          const sectorCustomerIds = customers.filter(c => c.sector_id === sector.id).map(c => c.id);
          if (sectorCustomerIds.length === 0) return [];

          const scheduledSalesDays = Array.from(new Set(
            sectorSchedules
              .filter(sc => sc.sector_id === sector.id && sc.schedule_type === 'sales' && !!sc.day)
              .map(sc => sc.day)
          ));

          if (scheduledSalesDays.length === 0 && sector.visit_day_sales) {
            scheduledSalesDays.push(sector.visit_day_sales);
          }

          const latestSalesDate = scheduledSalesDays
            .map(day => getMostRecentMatchingDate(selectedDate, day))
            .filter((date): date is Date => !!date)
            .sort((a, b) => b.getTime() - a.getTime())[0];

          if (!latestSalesDate) return [];

          const latestSalesDay = JS_DAY_TO_NAME[latestSalesDate.getDay()];
          if (!latestSalesDay) return [];

          const salesWorkerIds = new Set<string>();
          const daySchedules = sectorSchedules.filter(
            sc => sc.sector_id === sector.id && sc.schedule_type === 'sales' && sc.day === latestSalesDay
          );

          if (daySchedules.length > 0) {
            daySchedules.forEach(sc => {
              if (sc.worker_id) salesWorkerIds.add(sc.worker_id);
            });
          } else if (sector.visit_day_sales === latestSalesDay && sector.sales_worker_id) {
            salesWorkerIds.add(sector.sales_worker_id);
          }

          const salesDayCoverages = getActiveCoveragesForDate(toLocalDateKey(latestSalesDate)).filter(
            coverage => coverage.sector_id === sector.id && coverage.schedule_type === 'sales'
          );

          salesDayCoverages.forEach(coverage => {
            if (coverage.absent_worker_id) salesWorkerIds.delete(coverage.absent_worker_id);
            if (coverage.substitute_worker_id) salesWorkerIds.add(coverage.substitute_worker_id);
          });

          if (salesWorkerIds.size === 0) return [];

          const salesDayStart = new Date(latestSalesDate);
          salesDayStart.setHours(0, 0, 0, 0);
          const salesDayEnd = new Date(latestSalesDate);
          salesDayEnd.setHours(23, 59, 59, 999);

          const { data, error } = await (supabase as any).rpc('get_customer_sales_rep_statuses', {
            p_worker_ids: Array.from(salesWorkerIds),
            p_customer_ids: sectorCustomerIds,
            p_start: salesDayStart.toISOString(),
            p_end: salesDayEnd.toISOString(),
          });

          if (error) throw error;
          return data || [];
        })
      );

      return sectorStatusRows.flat();
    },
    enabled: !!effectiveWorkerId && open && preventeDeliverySectors.length > 0,
    refetchInterval: 10000,
  });

  // Customers ordered by sales reps in Prévente sectors for selected day
  const salesWorkerOrderedCustomerIds = useMemo(() => {
    const ids = new Set<string>();
    (salesRepStatuses as any[]).forEach((row) => {
      if (row?.status === 'ordered' && row?.customer_id) ids.add(row.customer_id);
    });
    return ids;
  }, [salesRepStatuses]);

  // Sales rep visit status map for Prévente customers (used for badges)
  // Status: 'ordered' | 'visited' | 'closed' | 'unavailable' | 'not_visited'
  const salesRepStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    const preventeSectorIds = new Set(preventeDeliverySectors.map(s => s.id));

    customers.forEach(c => {
      if (c.sector_id && preventeSectorIds.has(c.sector_id)) {
        map.set(c.id, 'not_visited');
      }
    });

    (salesRepStatuses as any[]).forEach((row) => {
      if (row?.customer_id && row?.status && map.has(row.customer_id)) {
        map.set(row.customer_id, row.status);
      }
    });

    return map;
  }, [salesRepStatuses, customers, preventeDeliverySectors]);

  // Direct sale customers:
  // 1. Cash Van sectors (today delivery) → ALL customers
  // 2. Prévente sectors (today delivery) → ALL customers EXCEPT those with pending delivery orders or already ordered by sales rep
  const directSaleCustomers = useMemo(() => {
    const cashVanSectorIds = new Set(todayDeliverySectors.filter(s => (s as any).sector_type === 'cash_van').map(s => s.id));
    const preventeSectorIds = new Set(preventeDeliverySectors.map(s => s.id));
    // Only exclude customers delivered via regular delivery (not direct sales)
    const deliveryOnlyCustomerIds = new Set(
      [...deliveredCustomerIds].filter(id => !directSoldCustomerIds.has(id))
    );
    
    const cashVanCustomers = customers.filter(c => c.sector_id && cashVanSectorIds.has(c.sector_id) && !deliveryOnlyCustomerIds.has(c.id));
    const preventeAllCustomers = customers.filter(c => {
      if (!c.sector_id || !preventeSectorIds.has(c.sector_id)) return false;
      if (todaySalesSectorIds.has(c.sector_id)) return false;
      if (deliveryCustomerIdsWithOrders.has(c.id) || deliveryOnlyCustomerIds.has(c.id)) return false;
      // Include customers the sales rep visited (but didn't order for),
      // AND customers the sales rep didn't visit at all (not_visited / no status)
      const repStatus = salesRepStatusMap.get(c.id);
      if (repStatus === 'ordered') return false; // already has a delivery order from sales rep
      return true;
    });
    
    const combined = new Map<string, typeof customers[0]>();
    [...cashVanCustomers, ...preventeAllCustomers].forEach(c => combined.set(c.id, c));
    return Array.from(combined.values());
  }, [todayDeliverySectors, preventeDeliverySectors, customers, deliveredCustomerIds, directSoldCustomerIds, deliveryCustomerIdsWithOrders, salesWorkerOrderedCustomerIds, salesRepStatusMap, todaySalesSectorIds]);

  // Direct sale sub-categorization (directSoldCustomerIds declared above near delivery section)
  const directNoSaleCustomerIds = useMemo(() => new Set(todayDirectSaleVisits.map(v => v.customer_id).filter(Boolean)), [todayDirectSaleVisits]);
  const directSalePending = useMemo(() => directSaleCustomers.filter(c => !directSoldCustomerIds.has(c.id) && !directNoSaleCustomerIds.has(c.id)), [directSaleCustomers, directSoldCustomerIds, directNoSaleCustomerIds]);
  // directSaleSold: include ALL customers who were direct-sold today, even if they belong to a sales sector
  // (they may have been filtered out of directSaleCustomers, but since the sale already happened they must appear)
  const directSaleSold = useMemo(() => {
    const fromList = directSaleCustomers.filter(c => directSoldCustomerIds.has(c.id));
    const fromListIds = new Set(fromList.map(c => c.id));
    // Add any direct-sold customers not already in directSaleCustomers
    const extra = customers.filter(c => directSoldCustomerIds.has(c.id) && !fromListIds.has(c.id));
    return [...fromList, ...extra];
  }, [directSaleCustomers, directSoldCustomerIds, customers]);
  const directSaleNoSale = useMemo(() => directSaleCustomers.filter(c => directNoSaleCustomerIds.has(c.id) && !directSoldCustomerIds.has(c.id)), [directSaleCustomers, directNoSaleCustomerIds, directSoldCustomerIds]);

  // Sub-categorize directSaleNoSale based on visit notes
  const directSaleClosedCustomerIds = useMemo(() => new Set(
    todayDirectSaleVisits.filter(v => v.notes && /مغلق/.test(v.notes)).map(v => v.customer_id).filter(Boolean)
  ), [todayDirectSaleVisits]);
  const directSaleUnavailableCustomerIds = useMemo(() => new Set(
    todayDirectSaleVisits.filter(v => v.notes && /غير متاح/.test(v.notes)).map(v => v.customer_id).filter(Boolean)
  ), [todayDirectSaleVisits]);
  const directSaleNoSaleVisitOnly = useMemo(() => directSaleNoSale.filter(c => !directSaleClosedCustomerIds.has(c.id) && !directSaleUnavailableCustomerIds.has(c.id)), [directSaleNoSale, directSaleClosedCustomerIds, directSaleUnavailableCustomerIds]);
  const directSaleNoSaleClosed = useMemo(() => directSaleNoSale.filter(c => directSaleClosedCustomerIds.has(c.id)), [directSaleNoSale, directSaleClosedCustomerIds]);
  const directSaleNoSaleUnavailable = useMemo(() => directSaleNoSale.filter(c => directSaleUnavailableCustomerIds.has(c.id)), [directSaleNoSale, directSaleUnavailableCustomerIds]);

  // Location check
  const checkLocationBeforeAction = async (customer: any): Promise<boolean> => {
    if (canBypassLocation) return true;
    if (!customer.latitude || !customer.longitude) return true;
    const threshold = locationThreshold ?? 100;
    setCheckingLocationFor(customer.id);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) { reject(); return; }
        navigator.geolocation.getCurrentPosition(resolve, () => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 });
        }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 });
      });
      const distanceKm = calculateDistance(position.coords.latitude, position.coords.longitude, customer.latitude, customer.longitude);
      const distanceMeters = distanceKm * 1000;
      if (distanceMeters > threshold) {
        const formattedDistance = distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(1)} كم` : `${Math.round(distanceMeters)} متر`;
        toast.error(`📍 أنت بعيد عن العميل بمسافة ${formattedDistance}`, { description: `يجب أن تكون على بُعد ${threshold} متر أو أقل` });
        return false;
      }
      return true;
    } catch {
      toast.error('تعذر تحديد موقعك. يرجى تفعيل خدمة الموقع.');
      return false;
    } finally {
      setCheckingLocationFor(null);
    }
  };

  // Handlers
  const handleDeliveryCustomerClick = async (customer: any) => {
    setLoadingDeliveryFor(customer.id);
    try {
      let query = supabase
        .from('orders')
        .select('*, customer:customers(*, sector:sectors(id, name, name_fr), zone:sector_zones(id, name, name_fr)), created_by_worker:workers!orders_created_by_fkey(id, full_name, username)')
        .eq('customer_id', customer.id)
        .in('status', ['pending', 'assigned', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (!isAdmin) query = query.eq('assigned_worker_id', effectiveWorkerId!);
      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) {
        setPendingDeliveryOrder(data[0] as OrderWithDetails);
        setSalesHubTab('delivery');
        setShowSalesHubDialog(true);
      } else {
        toast.error('لا توجد طلبية معينة لهذا العميل');
      }
    } catch {
      toast.error('خطأ في جلب بيانات الطلبية');
    } finally {
      setLoadingDeliveryFor(null);
    }
  };

  const handleShowDeliveredOrderDetails = async (customer: any) => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*, customer:customers(*), items:order_items(*, product:products(*))')
        .eq('customer_id', customer.id)
        .eq('status', 'delivered')
        .gte('updated_at', todayStart)
        .lte('updated_at', selectedDayBounds.end)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        const hydratedItems = await hydrateOrderItems(data[0]);
        setOrderDetailsDialog({ ...data[0], items: hydratedItems });
      } else {
        toast.error('لم يتم العثور على تفاصيل الطلبية');
      }
    } catch {
      toast.error('خطأ في جلب التفاصيل');
    }
  };

  const handleShowOrderDetails = async (customer: any) => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*, customer:customers(*), items:order_items(*, product:products(*))')
        .eq('customer_id', customer.id)
        .eq('created_by', effectiveWorkerId!)
        .gte('created_at', todayStart)
        .lte('created_at', selectedDayBounds.end)
        .not('status', 'eq', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        const hydratedItems = await hydrateOrderItems(data[0]);
        setOrderDetailsDialog({ ...data[0], items: hydratedItems, _isOrderRequest: true });
      } else {
        toast.error('لم يتم العثور على تفاصيل الطلبية');
      }
    } catch {
      toast.error('خطأ في جلب التفاصيل');
    }
  };

  const fetchDirectSaleOrderDetails = async (customerId: string) => {
    // 1) Prefer operation_id from direct_sale visit tracking (most precise link to order)
    let vtQuery = supabase
      .from('visit_tracking')
      .select('operation_id, created_at')
      .eq('customer_id', customerId)
      .eq('operation_type', 'direct_sale')
      .gte('created_at', todayStart)
      .lte('created_at', selectedDayBounds.end)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!isAdmin || hasSpecificWorker) {
      vtQuery = vtQuery.eq('worker_id', effectiveWorkerId!);
    }

    const { data: vtData } = await vtQuery;
    const operationOrderId = vtData?.[0]?.operation_id || null;
    const saleFromList = todayDirectSales.find((s: any) => s.customer_id === customerId);
    const orderIdFromList = saleFromList?.order_id || null;
    const directOrderId = operationOrderId || orderIdFromList;

    if (directOrderId) {
      const { data: directOrder } = await supabase
        .from('orders')
        .select('*, customer:customers(*), items:order_items(*, product:products(*))')
        .eq('id', directOrderId)
        .maybeSingle();

      if (directOrder) {
        const hydratedItems = await hydrateOrderItems(directOrder);
        return { ...directOrder, items: hydratedItems };
      }
    }

    // 2) Fallback: latest delivered order for customer today (scoped by worker when needed)
    let fallbackQuery = supabase
      .from('orders')
      .select('*, customer:customers(*), items:order_items(*, product:products(*))')
      .eq('customer_id', customerId)
      .eq('status', 'delivered')
      .gte('created_at', todayStart)
      .lte('created_at', selectedDayBounds.end)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!isAdmin || hasSpecificWorker) {
      fallbackQuery = fallbackQuery.eq('created_by', effectiveWorkerId!);
    }

    const { data: fallbackOrders } = await fallbackQuery;
    if (fallbackOrders && fallbackOrders.length > 0) {
      const hydratedItems = await hydrateOrderItems(fallbackOrders[0]);
      return { ...fallbackOrders[0], items: hydratedItems };
    }

    return null;
  };

  const handleShowDirectSaleDetails = async (customer: any) => {
    try {
      const directOrder = await fetchDirectSaleOrderDetails(customer.id);
      if (directOrder) {
        setOrderDetailsDialog({ ...directOrder, _isDirectSale: true, customer: directOrder.customer || customer });
        return;
      }

      const sale = todayDirectSales.find(s => s.customer_id === customer.id);
      if (sale) {
        setOrderDetailsDialog({ ...sale, _isDirectSale: true, customer });
        return;
      }

      toast.error('لم يتم العثور على تفاصيل البيع المباشر');
    } catch {
      toast.error('خطأ في جلب تفاصيل البيع المباشر');
    }
  };

  const hydrateOrderItems = async (order: any) => {
    const currentItems = Array.isArray(order?.items) ? order.items : [];
    if (currentItems.length > 0) return currentItems;

    if (order?.id) {
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('*, product:products(*)')
        .eq('order_id', order.id);
      if (orderItems && orderItems.length > 0) return orderItems;

      const { data: receipt } = await supabase
        .from('receipts')
        .select('items')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (Array.isArray((receipt as any)?.items) && (receipt as any).items.length > 0) {
        return (receipt as any).items;
      }
    }

    return [];
  };


  const buildReceiptDataFromOrder = (order: any, isDirectSale: boolean) => {
    const customer = order.customer;
    const items = order.items || [];
    const totalAmount = Number(order.total_amount || 0);
    const isOrderRequest = !isDirectSale && !!order._isOrderRequest;
    const { paidAmount, remainingAmount } = resolveOrderPayment(order, isOrderRequest);

    return {
      receiptType: (isDirectSale ? 'direct_sale' : 'delivery') as any,
      orderId: order.id || null,
      customerId: customer?.id || '',
      customerName: customer?.store_name || customer?.name || order.customer_name || '—',
      customerPhone: customer?.phone || null,
      workerId: user?.id || '',
      workerName: user?.full_name || '',
      workerPhone: null,
      branchId: user?.branch_id || null,
      items: items.map((item: any) => {
        const normalizedItem = normalizeSaleItem(item);
        return {
          productId: normalizedItem.productId,
          productName: normalizedItem.productName,
          quantity: normalizedItem.quantity,
          unitPrice: normalizedItem.unitPrice,
          totalPrice: normalizedItem.totalPrice,
          giftQuantity: normalizedItem.giftQuantity,
          giftPieces: normalizedItem.giftPieces,
          piecesPerBox: normalizedItem.piecesPerBox,
          pricingUnit: normalizedItem.pricingUnit,
          weightPerBox: normalizedItem.weightPerBox,
        };
      }),
      totalAmount,
      paidAmount,
      remainingAmount,
      paymentMethod: order.payment_type || order.paymentMethod || 'cash',
      notes: order.notes || null,
      receiptTitleOverride: !isDirectSale && order._isOrderRequest ? 'BON DE COMMANDE' : undefined,
    };
  };

  const handlePrintDeliveredOrder = async (customer: any) => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*, customer:customers(*), items:order_items(*, product:products(*))')
        .eq('customer_id', customer.id)
        .eq('status', 'delivered')
        .gte('updated_at', todayStart)
        .lte('updated_at', selectedDayBounds.end)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        const hydratedItems = await hydrateOrderItems(data[0]);
        setPrintReceiptData(buildReceiptDataFromOrder({ ...data[0], items: hydratedItems }, false));
        setShowPrintReceipt(true);
      } else {
        toast.error('لم يتم العثور على الطلبية');
      }
    } catch { toast.error('خطأ في جلب البيانات'); }
  };

  const handlePrintDirectSale = async (customer: any) => {
    try {
      const directOrder = await fetchDirectSaleOrderDetails(customer.id);
      if (directOrder) {
        setPrintReceiptData(buildReceiptDataFromOrder({ ...directOrder, _isDirectSale: true, customer: directOrder.customer || customer }, true));
        setShowPrintReceipt(true);
        return;
      }

      const sale = todayDirectSales.find(s => s.customer_id === customer.id);
      if (sale) {
        setPrintReceiptData(buildReceiptDataFromOrder({ ...sale, _isDirectSale: true, customer }, true));
        setShowPrintReceipt(true);
        return;
      }

      toast.error('لم يتم العثور على بيانات البيع المباشر للطباعة');
    } catch {
      toast.error('خطأ في جلب بيانات البيع المباشر');
    }
  };

  // Quick print a temporary receipt (no payment/debt info) for warehouse staff
  const handleQuickPrintTempReceipt = async (customer: any) => {
    try {
      let query = supabase
        .from('orders')
        .select('*, customer:customers(*), items:order_items(*, product:products(*))')
        .eq('customer_id', customer.id)
        .in('status', ['pending', 'assigned', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (!isAdmin) query = query.eq('assigned_worker_id', effectiveWorkerId!);
      const { data } = await query;
      if (data && data.length > 0) {
        const hydratedItems = await hydrateOrderItems(data[0]);
        const order = { ...data[0], items: hydratedItems };
        const items = order.items || [];
        const totalAmount = Number(order.total_amount || 0);
        const cust = order.customer;
        setPrintReceiptData({
          receiptType: 'delivery' as any,
          orderId: order.id || null,
          customerId: cust?.id || '',
          customerName: cust?.store_name || cust?.name || '—',
          customerPhone: cust?.phone || null,
          workerId: user?.id || '',
          workerName: user?.full_name || '',
          workerPhone: null,
          branchId: user?.branch_id || null,
          items: items.map((item: any) => {
            const n = normalizeSaleItem(item);
            return {
              productId: n.productId,
              productName: n.productName,
              quantity: n.quantity,
              unitPrice: n.unitPrice,
              totalPrice: n.totalPrice,
              giftQuantity: n.giftQuantity,
              giftPieces: n.giftPieces,
              piecesPerBox: n.piecesPerBox,
              pricingUnit: n.pricingUnit,
              weightPerBox: n.weightPerBox,
            };
          }),
          totalAmount,
          paidAmount: totalAmount,
          remainingAmount: 0,
          paymentMethod: null,
          notes: null,
          receiptTitleOverride: 'BON DE VERIFICATION',
          hidePaymentDetails: true,
        });
        setShowPrintReceipt(true);
      } else {
        toast.error('لا توجد طلبية لهذا العميل');
      }
    } catch { toast.error('خطأ في جلب بيانات الطباعة'); }
  };

  const handleDeliveryVisitWithoutDelivery = async (customer: any) => {
    const allowed = await checkLocationBeforeAction(customer);
    if (!allowed) return;
    try {
      await trackVisit({ customerId: customer.id, operationType: 'delivery_visit', notes: `زيارة توصيل بدون تسليم - ${customer.store_name || customer.name}` });
      toast.success(`تم تسجيل زيارة بدون تسليم لـ ${customer.store_name || customer.name}`);
    } catch { toast.error('فشل في تسجيل الزيارة'); }
  };

  const handleDeliveryClosedVisit = async (customer: any) => {
    const allowed = await checkLocationBeforeAction(customer);
    if (!allowed) return;
    try {
      await trackVisit({ customerId: customer.id, operationType: 'delivery_visit', notes: `مغلق (توصيل) - ${customer.store_name || customer.name}` });
      toast.success(`تم تسجيل "${customer.store_name || customer.name}" كمغلق`);
    } catch { toast.error('فشل في تسجيل الحالة'); }
  };

  const handleDeliveryUnavailableVisit = async (customer: any) => {
    const allowed = await checkLocationBeforeAction(customer);
    if (!allowed) return;
    try {
      await trackVisit({ customerId: customer.id, operationType: 'delivery_visit', notes: `غير متاح (توصيل) - ${customer.store_name || customer.name}` });
      toast.success(`تم تسجيل "${customer.store_name || customer.name}" كغير متاح`);
    } catch { toast.error('فشل في تسجيل الحالة'); }
  };

  const handleVisitWithoutOrder = async (customer: any) => {
    const allowed = await checkLocationBeforeAction(customer);
    if (!allowed) return;
    try {
      await trackVisit({ customerId: customer.id, operationType: 'visit', notes: `زيارة بدون طلبية - ${customer.name}` });
      toast.success(`تم تسجيل زيارة ${customer.name} بنجاح`);
    } catch { toast.error('فشل في تسجيل الزيارة'); }
  };

  const handleCustomerClosed = async (customer: any) => {
    const allowed = await checkLocationBeforeAction(customer);
    if (!allowed) return;
    try {
      await trackVisit({ customerId: customer.id, operationType: 'visit', notes: `مغلق - ${customer.store_name || customer.name}` });
      toast.success(`تم تسجيل "${customer.store_name || customer.name}" كمغلق`);
    } catch { toast.error('فشل في تسجيل الحالة'); }
  };

  const handleCustomerUnavailable = async (customer: any) => {
    const allowed = await checkLocationBeforeAction(customer);
    if (!allowed) return;
    try {
      await trackVisit({ customerId: customer.id, operationType: 'visit', notes: `غير متاح - ${customer.store_name || customer.name}` });
      toast.success(`تم تسجيل "${customer.store_name || customer.name}" كغير متاح`);
    } catch { toast.error('فشل في تسجيل الحالة'); }
  };

  const handleDirectSaleClosed = async (customer: any) => {
    const allowed = await checkLocationBeforeAction(customer);
    if (!allowed) return;
    try {
      await trackVisit({ customerId: customer.id, operationType: 'visit', notes: `مغلق (بيع مباشر) - ${customer.store_name || customer.name}` });
      toast.success(`تم تسجيل "${customer.store_name || customer.name}" كمغلق`);
    } catch { toast.error('فشل في تسجيل الحالة'); }
  };

  const handleDirectSaleUnavailable = async (customer: any) => {
    const allowed = await checkLocationBeforeAction(customer);
    if (!allowed) return;
    try {
      await trackVisit({ customerId: customer.id, operationType: 'visit', notes: `غير متاح (بيع مباشر) - ${customer.store_name || customer.name}` });
      toast.success(`تم تسجيل "${customer.store_name || customer.name}" كغير متاح`);
    } catch { toast.error('فشل في تسجيل الحالة'); }
  };

  const handleDirectSaleNoSale = async (customer: any) => {
    const allowed = await checkLocationBeforeAction(customer);
    if (!allowed) return;
    try {
      await trackVisit({ customerId: customer.id, operationType: 'visit', notes: `بدون بيع - ${customer.store_name || customer.name}` });
      toast.success(`تم تسجيل "${customer.store_name || customer.name}" بدون بيع`);
    } catch { toast.error('فشل في تسجيل الحالة'); }
  };

  const handleDeliveryDebtRefused = async (customer: any) => {
    const allowed = await checkLocationBeforeAction(customer);
    if (!allowed) return;
    try {
      await trackVisit({ customerId: customer.id, operationType: 'visit', notes: `رفض الدين (توصيل) - ${customer.store_name || customer.name}` });
      toast.success(`تم تسجيل رفض الدين لـ "${customer.store_name || customer.name}"`);
    } catch { toast.error('فشل في تسجيل الحالة'); }
  };

  const handleDeliveryCancelled = async (customer: any) => {
    const allowed = await checkLocationBeforeAction(customer);
    if (!allowed) return;
    try {
      await trackVisit({ customerId: customer.id, operationType: 'delivery_visit', notes: `إلغاء (توصيل) - ${customer.store_name || customer.name}` });
      toast.success(`تم تسجيل إلغاء التوصيل لـ "${customer.store_name || customer.name}"`);
    } catch { toast.error('فشل في تسجيل الحالة'); }
  };

  const handleBulkPostpone = async (newDate: Date) => {
    const customerIds = deliveryNotDone.map(c => c.id);
    if (customerIds.length === 0) { toast.info('لا توجد طلبيات للتأجيل'); return; }
    const dateStr = format(newDate, 'yyyy-MM-dd');
    try {
      // Find all orders for these customers that are not yet delivered
      const orderIds = assignedOrders
        .filter(o => customerIds.includes(o.customer_id) && ['pending', 'assigned', 'in_progress'].includes(o.status))
        .map(o => o.id);
      if (orderIds.length === 0) { toast.info('لا توجد طلبيات للتأجيل'); return; }
      const { error } = await supabase
        .from('orders')
        .update({ delivery_date: dateStr })
        .in('id', orderIds);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
      queryClient.invalidateQueries({ queryKey: ['today-cust-assigned-orders-full'] });
      toast.success(`تم تأجيل ${orderIds.length} طلبية إلى ${format(newDate, 'dd/MM/yyyy')}`);
      setShowBulkPostpone(false);
    } catch {
      toast.error('فشل في تأجيل الطلبيات');
    }
  };

  const handleSinglePostpone = async (newDate: Date) => {
    if (!postponeCustomer) return;
    const customerOrders = assignedOrders
      .filter(o => o.customer_id === postponeCustomer.id && ['pending', 'assigned', 'in_progress'].includes(o.status));
    if (customerOrders.length === 0) { toast.info('لا توجد طلبيات لهذا العميل'); return; }
    const dateStr = format(newDate, 'yyyy-MM-dd');
    try {
      // Increment postpone_count and optionally reassign worker
      for (const order of customerOrders) {
        const updateData: any = { delivery_date: dateStr, postpone_count: ((order as any).postpone_count || 0) + 1 };
        if (postponeWorkerId) {
          updateData.assigned_worker_id = postponeWorkerId;
          updateData.status = 'assigned';
        }
        const { error } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', order.id);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
      queryClient.invalidateQueries({ queryKey: ['today-cust-assigned-orders-full'] });
      toast.success(`تم تأجيل طلبية ${postponeCustomer.name} إلى ${format(newDate, 'dd/MM/yyyy')}`);
      setPostponeCustomer(null);
    } catch {
      toast.error('فشل في تأجيل الطلبية');
    }
  };

  const handleDirectSaleDebtRefused = async (customer: any) => {
    const allowed = await checkLocationBeforeAction(customer);
    if (!allowed) return;
    try {
      await trackVisit({ customerId: customer.id, operationType: 'visit', notes: `رفض الدين (بيع مباشر) - ${customer.store_name || customer.name}` });
      toast.success(`تم تسجيل رفض الدين لـ "${customer.store_name || customer.name}"`);
    } catch { toast.error('فشل في تسجيل الحالة'); }
  };

  const handleDebtDebtRefused = async (debt: any) => {
    const customer = debt.customer as any;
    const customerObj = { id: debt.customer_id, latitude: customer?.latitude, longitude: customer?.longitude, store_name: customer?.store_name, name: customer?.name };
    const allowed = await checkLocationBeforeAction(customerObj);
    if (!allowed) return;
    try {
      await trackVisit({ customerId: debt.customer_id, operationType: 'visit', notes: `رفض الدين (تحصيل دين) - ${customer?.store_name || customer?.name}` });
      toast.success(`تم تسجيل رفض الدين لـ "${customer?.store_name || customer?.name}"`);
    } catch { toast.error('فشل في تسجيل الحالة'); }
  };

  const handleDirectSaleClick = (customer: any) => {
    setDirectSaleCustomerId(customer.id);
    setSalesHubTab('direct');
    setShowSalesHubDialog(true);
  };

  const handleDebtCustomerClosed = async (debt: any) => {
    const customer = debt.customer as any;
    const customerObj = { id: debt.customer_id, latitude: customer?.latitude, longitude: customer?.longitude, store_name: customer?.store_name, name: customer?.name };
    const allowed = await checkLocationBeforeAction(customerObj);
    if (!allowed) return;
    try {
      await trackVisit({ customerId: debt.customer_id, operationType: 'visit', notes: `مغلق (تحصيل دين) - ${customer?.store_name || customer?.name}` });
      toast.success(`تم تسجيل "${customer?.store_name || customer?.name}" كمغلق`);
    } catch { toast.error('فشل في تسجيل الحالة'); }
  };

  const handleDebtCustomerUnavailable = async (debt: any) => {
    const customer = debt.customer as any;
    const customerObj = { id: debt.customer_id, latitude: customer?.latitude, longitude: customer?.longitude, store_name: customer?.store_name, name: customer?.name };
    const allowed = await checkLocationBeforeAction(customerObj);
    if (!allowed) return;
    try {
      await trackVisit({ customerId: debt.customer_id, operationType: 'visit', notes: `غير متاح (تحصيل دين) - ${customer?.store_name || customer?.name}` });
      toast.success(`تم تسجيل "${customer?.store_name || customer?.name}" كغير متاح`);
    } catch { toast.error('فشل في تسجيل الحالة'); }
  };

  const handleSalesCustomerClick = (customer: any) => {
    setSelectedCustomerForOrder(customer.id);
    setShowCreateOrder(true);
  };

  const handleDebtClick = (debt: any) => {
    // Open full debt details dialog (CollectCustomerDebtDialog) like in debt management
    setSelectedDebt(debt);
    setShowCollectDebt(true);
  };

  const handleCollectedOperationClick = (operation: TodayDebtCollectionOperation) => {
    setSelectedCollectedOperation(operation);
    setShowCollectedOperationDialog(true);
  };

  const handleVisitNoPayment = (debt: any) => {
    setSelectedDebt(debt);
    setShowVisitNoPayment(true);
  };

  const todaySectorNames = useMemo(() => {
    const allTodayIds = new Set([...todaySalesSectorIds, ...Array.from(todayDeliverySectorIds)]);
    return sectors.filter(s => allTodayIds.has(s.id)).map(s => s.name).join(' / ');
  }, [sectors, todaySalesSectorIds, todayDeliverySectorIds]);

  const dayLabel = DAY_NAMES[selectedDay] || selectedDay;
  const selectedDateCaption = selectedCustomDate ? format(selectedCustomDate, 'dd/MM/yyyy') : null;
  const titleDayPart = dayLabel;
  const calendarButtonLabel = format(new Date(selectedDayBounds.dateKey), 'dd/MM');
  const sectorPart = todaySectorNames || '';
  const workerPart = effectiveWorkerName
    ? effectiveWorkerName
    : selectedAdminWorkerId && isAdmin
    ? workersList.find(w => w.id === selectedAdminWorkerId)?.full_name || ''
    : '';

  // العنوان: اليوم — اسم السيكتور (بدون "عملاء اليوم")
  const titleParts = [titleDayPart];
  if (sectorPart) titleParts.push(sectorPart);
  if (workerPart) titleParts.push(workerPart);
  const displayTitle = titleParts.join(' — ');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-10px)] max-w-[calc(100vw-10px)] sm:max-w-md p-0 gap-0 max-h-[88dvh] flex flex-col overflow-hidden" dir="rtl">
          <DialogHeader className="px-2.5 py-2 border-b shrink-0">
            <DialogTitle className="flex w-full items-center gap-1.5 pe-12 text-sm">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span className="min-w-0 flex-1 truncate">{displayTitle}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  aria-label="اليوم السابق"
                  onClick={() => {
                    const baseDate = selectedCustomDate || new Date();
                    const prev = new Date(baseDate);
                    prev.setDate(prev.getDate() - 1);
                    if (isFriday(prev)) prev.setDate(prev.getDate() - 1);
                    setSelectedCustomDate(prev);
                    const jsDay = prev.getDay();
                    setSelectedDay(JS_DAY_TO_NAME[jsDay] || todayName);
                  }}
                  className="flex items-center justify-center w-6 h-6 rounded-full border border-red-300 bg-red-100 hover:bg-red-200 text-red-600 shrink-0"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="اختيار تاريخ"
                  onClick={() => setCalendarOpen(true)}
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[9px] font-medium whitespace-nowrap transition-colors shrink-0 ${
                    selectedCustomDate
                      ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
                      : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <CalendarIcon className="w-3 h-3" />
                  <span dir="ltr">{calendarButtonLabel}</span>
                </button>
                <button
                  type="button"
                  aria-label="اليوم التالي"
                  onClick={() => {
                    const baseDate = selectedCustomDate || new Date();
                    const next = new Date(baseDate);
                    next.setDate(next.getDate() + 1);
                    if (isFriday(next)) next.setDate(next.getDate() + 1);
                    setSelectedCustomDate(next);
                    const jsDay = next.getDay();
                    setSelectedDay(JS_DAY_TO_NAME[jsDay] || todayName);
                  }}
                  className="flex items-center justify-center w-6 h-6 rounded-full border border-green-300 bg-green-100 hover:bg-green-200 text-green-600 shrink-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Admin worker picker strip */}
          {isAdmin && !targetWorkerId && adminPickerWorkers.length > 0 && (
            <div className="border-b px-1.5 py-1 shrink-0">
              {(() => {
                const ADMIN_ROLES = new Set(['supervisor', 'warehouse_manager']);
                const isAdminWorker = (w: any) => ADMIN_ROLES.has(w.role) || (w._custom_role_codes && w._custom_role_codes.has('warehouse_manager'));
                const adminRow = adminPickerWorkers.filter(w => isAdminWorker(w));
                const fieldRow = adminPickerWorkers.filter(w => !isAdminWorker(w));

                const WORKER_CHIP_COLORS = [
                  { bg: 'bg-blue-100 border-blue-300 text-blue-800', selected: 'bg-blue-600 text-white border-blue-600' },
                  { bg: 'bg-emerald-100 border-emerald-300 text-emerald-800', selected: 'bg-emerald-600 text-white border-emerald-600' },
                  { bg: 'bg-amber-100 border-amber-300 text-amber-800', selected: 'bg-amber-600 text-white border-amber-600' },
                  { bg: 'bg-violet-100 border-violet-300 text-violet-800', selected: 'bg-violet-600 text-white border-violet-600' },
                  { bg: 'bg-rose-100 border-rose-300 text-rose-800', selected: 'bg-rose-600 text-white border-rose-600' },
                  { bg: 'bg-cyan-100 border-cyan-300 text-cyan-800', selected: 'bg-cyan-600 text-white border-cyan-600' },
                  { bg: 'bg-orange-100 border-orange-300 text-orange-800', selected: 'bg-orange-600 text-white border-orange-600' },
                  { bg: 'bg-teal-100 border-teal-300 text-teal-800', selected: 'bg-teal-600 text-white border-teal-600' },
                  { bg: 'bg-indigo-100 border-indigo-300 text-indigo-800', selected: 'bg-indigo-600 text-white border-indigo-600' },
                  { bg: 'bg-pink-100 border-pink-300 text-pink-800', selected: 'bg-pink-600 text-white border-pink-600' },
                ];

                const renderRow = (workers: typeof adminPickerWorkers, colorOffset: number) => (
                  <ScrollArea className="w-full" dir="rtl">
                    <div className="flex gap-1 pb-1">
                      {workers.map((w, idx) => {
                        const isSelected = w.id === selectedAdminWorkerId;
                        const color = WORKER_CHIP_COLORS[(idx + colorOffset) % WORKER_CHIP_COLORS.length];
                        return (
                          <button
                            key={w.id}
                            onClick={() => setSelectedAdminWorkerId(isSelected ? null : w.id)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-medium whitespace-nowrap transition-colors shrink-0
                              ${isSelected ? color.selected : color.bg}
                            `}
                          >
                            {w.full_name}
                          </button>
                        );
                      })}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                );

                return (
                  <div className="space-y-1">
                    {adminRow.length > 0 && renderRow(adminRow, 3)}
                    {fieldRow.length > 0 && renderRow(fieldRow, 0)}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Day picker strip - equal width day buttons */}
          <div className="border-b px-1.5 py-1 shrink-0">
            <div className="grid grid-cols-6 gap-1" dir="rtl">
              {Object.entries(DAY_NAMES).map(([key, label]) => {
                const isSelected = key === selectedDay && !selectedCustomDate;
                const isToday = key === todayName;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedCustomDate(undefined);
                      setSelectedDay(key);
                    }}
                    className={`relative min-w-0 w-full rounded-full border px-0.5 py-1 text-[10px] font-medium leading-tight transition-colors
                      ${isSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:bg-accent text-foreground'}
                    `}
                  >
                    <span className="block truncate">{label}</span>
                    {isToday && !isSelected && <span className="absolute top-0.5 start-1 text-[8px] leading-none text-primary">●</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-3 pt-2 pb-1 shrink-0 space-y-1.5">
            <div className="relative">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs pr-8"
                dir="rtl"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={sortByDistance} onCheckedChange={setSortByDistance} className="shrink-0" />
              <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                <MapPin className="w-3 h-3 shrink-0 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground truncate" dir="rtl">
                  {workerAddress || (sortByDistance ? 'جارٍ تحديد الموقع...' : 'فعّل الترتيب لعرض موقعك')}
                </span>
              </div>
            </div>
          </div>

          <Tabs defaultValue="sales" className="flex flex-col flex-1 min-h-0">
            <TabsList className="w-full rounded-none border-b shrink-0">
              <TabsTrigger value="delivery" className="flex-1 gap-1 text-xs">
                <Truck className="w-3.5 h-3.5" />
                توصيل
                {deliveryCustomers.length > 0 && <Badge variant="secondary" className="text-[10px] px-1">{deliveryCustomers.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="sales" className="flex-1 gap-1 text-xs">
                <ShoppingCart className="w-3.5 h-3.5" />
                طلبات
                {salesCustomers.length > 0 && <Badge variant="secondary" className="text-[10px] px-1">{salesCustomers.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="direct-sale" className="flex-1 gap-1 text-xs">
                <ShoppingBag className="w-3.5 h-3.5" />
                بيع مباشر
                {directSaleCustomers.length > 0 && <Badge className="text-[10px] px-1 bg-emerald-500">{directSaleCustomers.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="debts" className="flex-1 gap-1 text-xs">
                <Landmark className="w-3.5 h-3.5" />
                ديون
                {debtCustomers.length > 0 && <Badge variant="destructive" className="text-[10px] px-1">{debtCustomers.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            {/* Delivery Tab */}
            <TabsContent value="delivery" className="m-0 flex-1 min-h-0">
              <Tabs defaultValue="not-delivered" className="flex flex-col h-full min-h-0">
                <TabsList className="w-full rounded-none border-b shrink-0 h-auto p-0.5 gap-0.5">
                  <TabsTrigger value="not-delivered" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700">
                    <Truck className="w-3 h-3" />
                    بدون توصيل
                    {deliveryNotDone.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-orange-500">{deliveryNotDone.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="not-received" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700">
                    <PackageX className="w-3 h-3" />
                    بدون تسليم
                    {deliveryNotReceived.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-amber-500">{deliveryNotReceived.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="received" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
                    <PackageCheck className="w-3 h-3" />
                    تم الاستلام
                    {deliveryReceived.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-green-500">{deliveryReceived.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="postponed" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700">
                    <CalendarClock className="w-3 h-3" />
                    مؤجلة
                    {deliveryPostponed.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-purple-500">{deliveryPostponed.length}</Badge>}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="not-delivered" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                  {deliveryNotDone.length > 0 && (
                    <div className="p-2 border-b flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                        onClick={() => setShowPrintOrdersDialog(true)}
                      >
                        <Printer className="w-4 h-4" />
                        طباعة الشحنة
                      </Button>
                    </div>
                  )}
                  <CustomerList liabilityCustomerIds={liabilityCustomerIds} noOrderStreakMap={noOrderStreakMap} customers={deliveryNotDone} emptyMessage="تم توصيل جميع العملاء ✓" onCustomerClick={handleDeliveryCustomerClick} onVisitWithoutOrder={handleDeliveryVisitWithoutDelivery} onClosed={handleDeliveryClosedVisit} onUnavailable={handleDeliveryUnavailableVisit} onDebtRefused={handleDeliveryDebtRefused} onCancelled={handleDeliveryCancelled} onPostpone={(c) => setPostponeCustomer(c)} onPrint={handleQuickPrintTempReceipt} showVisitButton visitButtonLabel="بدون تسليم" showActionButtons showCancelButton showPrintButton checkingLocationFor={checkingLocationFor} loadingFor={loadingDeliveryFor} searchQuery={searchQuery} sectors={sectors} allZones={allZones} workerPosition={workerPosition} sortByDistance={sortByDistance} postponedBadgeIds={rescheduledToTodayIds} postponeCountMap={postponeCountMap} />
                </TabsContent>
                <TabsContent value="not-received" className="m-0 flex-1 min-h-0">
                  <Tabs defaultValue="visit-only" className="flex flex-col h-full min-h-0">
                    <TabsList className="w-full rounded-none border-b shrink-0 h-auto p-0.5 gap-0.5 bg-amber-50">
                      <TabsTrigger value="visit-only" className="flex-1 gap-1 text-[10px] px-1 py-1 data-[state=active]:bg-amber-200 data-[state=active]:text-amber-800">
                        <PackageX className="w-3 h-3" />
                        زيارة
                        {deliveryNotReceivedVisitOnly.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-amber-500">{deliveryNotReceivedVisitOnly.length}</Badge>}
                      </TabsTrigger>
                      <TabsTrigger value="unavailable" className="flex-1 gap-1 text-[10px] px-1 py-1 data-[state=active]:bg-yellow-200 data-[state=active]:text-yellow-800">
                        <UserX className="w-3 h-3" />
                        غير متاح
                        {deliveryNotReceivedUnavailable.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-yellow-500">{deliveryNotReceivedUnavailable.length}</Badge>}
                      </TabsTrigger>
                      <TabsTrigger value="closed" className="flex-1 gap-1 text-[10px] px-1 py-1 data-[state=active]:bg-red-100 data-[state=active]:text-red-700">
                        <DoorClosed className="w-3 h-3" />
                        مغلق
                        {deliveryNotReceivedClosed.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-red-500">{deliveryNotReceivedClosed.length}</Badge>}
                      </TabsTrigger>
                      <TabsTrigger value="debt-refused" className="flex-1 gap-1 text-[10px] px-1 py-1 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700">
                        <BanknoteIcon className="w-3 h-3" />
                        رفض دين
                        {deliveryNotReceivedDebtRefused.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-purple-500">{deliveryNotReceivedDebtRefused.length}</Badge>}
                      </TabsTrigger>
                      <TabsTrigger value="cancelled" className="flex-1 gap-1 text-[10px] px-1 py-1 data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive">
                        <XCircle className="w-3 h-3" />
                        ملغي
                        {deliveryNotReceivedCancelled.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-destructive">{deliveryNotReceivedCancelled.length}</Badge>}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="visit-only" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                      <CustomerList liabilityCustomerIds={liabilityCustomerIds} noOrderStreakMap={noOrderStreakMap} customers={deliveryNotReceivedVisitOnly} emptyMessage="لا توجد زيارات بدون تسليم" onCustomerClick={handleDeliveryCustomerClick} showActionButtons onClosed={handleDeliveryClosedVisit} onUnavailable={handleDeliveryUnavailableVisit} onDebtRefused={handleDeliveryDebtRefused} onPrint={handleQuickPrintTempReceipt} showPrintButton checkingLocationFor={checkingLocationFor} loadingFor={loadingDeliveryFor} searchQuery={searchQuery} sectors={sectors} allZones={allZones} workerPosition={workerPosition} sortByDistance={sortByDistance} timeMap={visitTimeMap} distanceMap={customerDistanceMap} />
                    </TabsContent>
                    <TabsContent value="unavailable" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                      <CustomerList liabilityCustomerIds={liabilityCustomerIds} noOrderStreakMap={noOrderStreakMap} customers={deliveryNotReceivedUnavailable} emptyMessage="لا يوجد عملاء غير متاحين" onCustomerClick={handleDeliveryCustomerClick} checkingLocationFor={checkingLocationFor} loadingFor={loadingDeliveryFor} searchQuery={searchQuery} sectors={sectors} allZones={allZones} workerPosition={workerPosition} sortByDistance={sortByDistance} timeMap={visitTimeMap} distanceMap={customerDistanceMap} />
                    </TabsContent>
                    <TabsContent value="closed" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                      <CustomerList liabilityCustomerIds={liabilityCustomerIds} noOrderStreakMap={noOrderStreakMap} customers={deliveryNotReceivedClosed} emptyMessage="لا يوجد عملاء مغلقين" onCustomerClick={handleDeliveryCustomerClick} checkingLocationFor={checkingLocationFor} loadingFor={loadingDeliveryFor} searchQuery={searchQuery} sectors={sectors} allZones={allZones} workerPosition={workerPosition} sortByDistance={sortByDistance} timeMap={visitTimeMap} distanceMap={customerDistanceMap} />
                    </TabsContent>
                    <TabsContent value="debt-refused" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                      <CustomerList liabilityCustomerIds={liabilityCustomerIds} noOrderStreakMap={noOrderStreakMap} customers={deliveryNotReceivedDebtRefused} emptyMessage="لا يوجد عملاء رفضوا الدين" onCustomerClick={handleDeliveryCustomerClick} checkingLocationFor={checkingLocationFor} loadingFor={loadingDeliveryFor} searchQuery={searchQuery} sectors={sectors} allZones={allZones} workerPosition={workerPosition} sortByDistance={sortByDistance} timeMap={visitTimeMap} distanceMap={customerDistanceMap} />
                    </TabsContent>
                    <TabsContent value="cancelled" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                      <CustomerList liabilityCustomerIds={liabilityCustomerIds} noOrderStreakMap={noOrderStreakMap} customers={deliveryNotReceivedCancelled} emptyMessage="لا توجد طلبيات ملغية" onCustomerClick={handleDeliveryCustomerClick} checkingLocationFor={checkingLocationFor} loadingFor={loadingDeliveryFor} searchQuery={searchQuery} sectors={sectors} allZones={allZones} workerPosition={workerPosition} sortByDistance={sortByDistance} timeMap={visitTimeMap} distanceMap={customerDistanceMap} />
                    </TabsContent>
                  </Tabs>
                </TabsContent>
                <TabsContent value="received" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                  {effectiveWorkerId && (
                    <div className="p-2 border-b flex gap-2">
                      {isAdmin && (
                        <Button variant="outline" size="sm" className="flex-1 gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={() => setShowSalesSummary(true)}>
                          <ShoppingBag className="w-4 h-4" />
                          تجميع المبيعات
                        </Button>
                      )}
                    </div>
                  )}
                  <CustomerList liabilityCustomerIds={liabilityCustomerIds} noOrderStreakMap={noOrderStreakMap} customers={deliveryReceived} emptyMessage="لا توجد توصيلات بعد" onCustomerClick={handleShowDeliveredOrderDetails} showPrintButton onPrint={handlePrintDeliveredOrder} checkingLocationFor={checkingLocationFor} loadingFor={loadingDeliveryFor} searchQuery={searchQuery} sectors={sectors} allZones={allZones} workerPosition={workerPosition} sortByDistance={sortByDistance} deliveryTimeMap={customerDeliveryTimeMap} timeMap={customerDeliveryTimeMap} distanceMap={customerDistanceMap} />
                </TabsContent>
                <TabsContent value="postponed" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                  <CustomerList liabilityCustomerIds={liabilityCustomerIds} noOrderStreakMap={noOrderStreakMap} customers={deliveryPostponed} emptyMessage="لا توجد طلبيات مؤجلة" onCustomerClick={handleDeliveryCustomerClick} onVisitWithoutOrder={handleDeliveryVisitWithoutDelivery} onClosed={handleDeliveryClosedVisit} onUnavailable={handleDeliveryUnavailableVisit} onDebtRefused={handleDeliveryDebtRefused} onCancelled={handleDeliveryCancelled} onPostpone={(c) => setPostponeCustomer(c)} onPrint={handleQuickPrintTempReceipt} showVisitButton visitButtonLabel="بدون تسليم" showActionButtons showCancelButton showPrintButton checkingLocationFor={checkingLocationFor} loadingFor={loadingDeliveryFor} searchQuery={searchQuery} sectors={sectors} allZones={allZones} workerPosition={workerPosition} sortByDistance={sortByDistance} postponedBadgeIds={postponedCustomerIds} postponeCountMap={postponeCountMap} />
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* Sales Tab */}
            <TabsContent value="sales" className="m-0 flex-1 min-h-0">
              <Tabs defaultValue="not-visited" className="flex flex-col h-full min-h-0">
                <TabsList className="w-full rounded-none border-b shrink-0 h-auto p-0.5 gap-0.5">
                  <TabsTrigger value="not-visited" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700">
                    <EyeOff className="w-3 h-3" />
                    بدون زيارة
                    {salesNotVisited.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-orange-500">{salesNotVisited.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="visited-no-order" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700">
                    <Eye className="w-3 h-3" />
                    زيارة
                    {salesVisitedNoOrder.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-amber-500">{salesVisitedNoOrder.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="with-orders" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
                    <CheckCircle className="w-3 h-3" />
                    تم الطلب
                    {salesWithOrders.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-green-500">{salesWithOrders.length}</Badge>}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="not-visited" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                  <CustomerList liabilityCustomerIds={liabilityCustomerIds} noOrderStreakMap={noOrderStreakMap} customers={salesNotVisited} emptyMessage="تمت زيارة جميع العملاء ✓" onCustomerClick={handleSalesCustomerClick} onVisitWithoutOrder={handleVisitWithoutOrder} onClosed={handleCustomerClosed} onUnavailable={handleCustomerUnavailable} showVisitButton showActionButtons checkingLocationFor={checkingLocationFor} searchQuery={searchQuery} sectors={sectors} allZones={allZones} workerPosition={workerPosition} sortByDistance={sortByDistance} />
                </TabsContent>
                <TabsContent value="visited-no-order" className="m-0 flex-1 min-h-0">
                  <Tabs defaultValue="visit-only" className="flex flex-col h-full min-h-0">
                    <TabsList className="w-full rounded-none border-b shrink-0 h-auto p-0.5 gap-0.5 bg-amber-50">
                      <TabsTrigger value="visit-only" className="flex-1 gap-1 text-[10px] px-1 py-1 data-[state=active]:bg-amber-200 data-[state=active]:text-amber-800">
                        <Eye className="w-3 h-3" />
                        بدون طلبية
                        {salesVisitedOnly.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-amber-500">{salesVisitedOnly.length}</Badge>}
                      </TabsTrigger>
                      <TabsTrigger value="suspended" className="flex-1 gap-1 text-[10px] px-1 py-1 data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive">
                        <AlertTriangle className="w-3 h-3" />
                        معلق
                        {salesSuspended.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-destructive">{salesSuspended.length}</Badge>}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="visit-only" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                      <CustomerList liabilityCustomerIds={liabilityCustomerIds} noOrderStreakMap={noOrderStreakMap} customers={salesVisitedOnly} emptyMessage="لا توجد زيارات بدون طلبيات" onCustomerClick={handleSalesCustomerClick} checkingLocationFor={checkingLocationFor} searchQuery={searchQuery} sectors={sectors} allZones={allZones} workerPosition={workerPosition} sortByDistance={sortByDistance} timeMap={visitTimeMap} distanceMap={customerDistanceMap} />
                    </TabsContent>
                    <TabsContent value="suspended" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                      <CustomerList liabilityCustomerIds={liabilityCustomerIds} noOrderStreakMap={noOrderStreakMap} customers={salesSuspended} emptyMessage="لا يوجد عملاء معلقون" onCustomerClick={handleSalesCustomerClick} checkingLocationFor={checkingLocationFor} searchQuery={searchQuery} sectors={sectors} allZones={allZones} workerPosition={workerPosition} sortByDistance={sortByDistance} timeMap={visitTimeMap} distanceMap={customerDistanceMap} />
                    </TabsContent>
                  </Tabs>
                </TabsContent>
                <TabsContent value="with-orders" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                  {isAdmin && effectiveWorkerId && (
                    <div className="p-2 border-b">
                      <Button variant="outline" size="sm" className="w-full gap-2 text-blue-700 border-blue-300 hover:bg-blue-50" onClick={() => setShowOrdersSummary(true)}>
                        <ClipboardList className="w-4 h-4" />
                        تجميع الطلبيات
                      </Button>
                    </div>
                  )}
                  <CustomerList liabilityCustomerIds={liabilityCustomerIds} noOrderStreakMap={noOrderStreakMap} customers={salesWithOrders} emptyMessage="لا توجد طلبيات بعد" onCustomerClick={handleShowOrderDetails} checkingLocationFor={checkingLocationFor} searchQuery={searchQuery} sectors={sectors} allZones={allZones} workerPosition={workerPosition} sortByDistance={sortByDistance} timeMap={orderTimeMap} distanceMap={customerDistanceMap} orderInfoMap={orderInfoMap} />
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* Direct Sale Tab */}
            <TabsContent value="direct-sale" className="m-0 flex-1 min-h-0">
              <Tabs defaultValue="pending" className="flex flex-col h-full min-h-0">
                <TabsList className="w-full rounded-none border-b shrink-0 h-auto p-0.5 gap-0.5">
                  <TabsTrigger value="pending" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700">
                    <ShoppingBag className="w-3 h-3" />
                    العملاء
                    {directSalePending.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-orange-500">{directSalePending.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="sold" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
                    <CheckCircle className="w-3 h-3" />
                    تم البيع
                    {directSaleSold.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-green-500">{directSaleSold.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="no-sale" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700">
                    <XCircle className="w-3 h-3" />
                    بدون بيع
                    {directSaleNoSale.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-amber-500">{directSaleNoSale.length}</Badge>}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                  <CustomerList liabilityCustomerIds={liabilityCustomerIds} noOrderStreakMap={noOrderStreakMap} customers={directSalePending} emptyMessage="لا توجد محلات متاحة للبيع المباشر" onCustomerClick={handleDirectSaleClick} onClosed={handleDirectSaleClosed} onUnavailable={handleDirectSaleUnavailable} onDebtRefused={handleDirectSaleDebtRefused} onNoSale={handleDirectSaleNoSale} showActionButtons showNoSaleButton checkingLocationFor={checkingLocationFor} searchQuery={searchQuery} sectors={sectors} allZones={allZones} workerPosition={workerPosition} sortByDistance={sortByDistance} salesRepStatusMap={salesRepStatusMap} />
                </TabsContent>
                <TabsContent value="sold" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                  {isAdmin && effectiveWorkerId && (
                    <div className="p-2 border-b">
                      <Button variant="outline" size="sm" className="w-full gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={() => setShowSalesSummary(true)}>
                        <ShoppingBag className="w-4 h-4" />
                        تجميع المبيعات
                      </Button>
                    </div>
                  )}
                  <CustomerList liabilityCustomerIds={liabilityCustomerIds} noOrderStreakMap={noOrderStreakMap} customers={directSaleSold} emptyMessage="لا توجد مبيعات بعد" onCustomerClick={handleShowDirectSaleDetails} showPrintButton onPrint={handlePrintDirectSale} checkingLocationFor={checkingLocationFor} searchQuery={searchQuery} sectors={sectors} allZones={allZones} workerPosition={workerPosition} sortByDistance={sortByDistance} timeMap={directSaleTimeMap} distanceMap={customerDistanceMap} />
                </TabsContent>
                <TabsContent value="no-sale" className="m-0 flex-1 min-h-0">
                  <Tabs defaultValue="visit-only" className="flex flex-col h-full min-h-0">
                    <TabsList className="w-full rounded-none border-b shrink-0 h-auto p-0.5 gap-0.5 bg-amber-50">
                      <TabsTrigger value="visit-only" className="flex-1 gap-1 text-[10px] px-1 py-1 data-[state=active]:bg-amber-200 data-[state=active]:text-amber-800">
                        <XCircle className="w-3 h-3" />
                        بدون بيع
                        {directSaleNoSaleVisitOnly.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-amber-500">{directSaleNoSaleVisitOnly.length}</Badge>}
                      </TabsTrigger>
                      <TabsTrigger value="unavailable" className="flex-1 gap-1 text-[10px] px-1 py-1 data-[state=active]:bg-yellow-200 data-[state=active]:text-yellow-800">
                        <UserX className="w-3 h-3" />
                        غير متاح
                        {directSaleNoSaleUnavailable.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-yellow-500">{directSaleNoSaleUnavailable.length}</Badge>}
                      </TabsTrigger>
                      <TabsTrigger value="closed" className="flex-1 gap-1 text-[10px] px-1 py-1 data-[state=active]:bg-red-100 data-[state=active]:text-red-700">
                        <DoorClosed className="w-3 h-3" />
                        مغلق
                        {directSaleNoSaleClosed.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-red-500">{directSaleNoSaleClosed.length}</Badge>}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="visit-only" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                      <CustomerList liabilityCustomerIds={liabilityCustomerIds} noOrderStreakMap={noOrderStreakMap} customers={directSaleNoSaleVisitOnly} emptyMessage="لا توجد زيارات بدون بيع" onCustomerClick={handleDirectSaleClick} checkingLocationFor={checkingLocationFor} searchQuery={searchQuery} sectors={sectors} allZones={allZones} workerPosition={workerPosition} sortByDistance={sortByDistance} timeMap={visitTimeMap} distanceMap={customerDistanceMap} />
                    </TabsContent>
                    <TabsContent value="unavailable" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                      <CustomerList liabilityCustomerIds={liabilityCustomerIds} noOrderStreakMap={noOrderStreakMap} customers={directSaleNoSaleUnavailable} emptyMessage="لا يوجد عملاء غير متاحين" onCustomerClick={handleDirectSaleClick} checkingLocationFor={checkingLocationFor} searchQuery={searchQuery} sectors={sectors} allZones={allZones} workerPosition={workerPosition} sortByDistance={sortByDistance} timeMap={visitTimeMap} distanceMap={customerDistanceMap} />
                    </TabsContent>
                    <TabsContent value="closed" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                      <CustomerList liabilityCustomerIds={liabilityCustomerIds} noOrderStreakMap={noOrderStreakMap} customers={directSaleNoSaleClosed} emptyMessage="لا يوجد عملاء مغلقين" onCustomerClick={handleDirectSaleClick} checkingLocationFor={checkingLocationFor} searchQuery={searchQuery} sectors={sectors} allZones={allZones} workerPosition={workerPosition} sortByDistance={sortByDistance} timeMap={visitTimeMap} distanceMap={customerDistanceMap} />
                    </TabsContent>
                  </Tabs>
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* Debts Tab */}
            <TabsContent value="debts" className="m-0 flex-1 min-h-0">
              <Tabs defaultValue="today-collection" className="flex flex-col h-full min-h-0">
                <TabsList className="w-full rounded-none border-b shrink-0 h-auto p-0.5 gap-0.5">
                  <TabsTrigger value="today-collection" className="flex-1 gap-1 text-[10px] px-1 py-1.5 data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700">
                    <Clock className="w-3 h-3" />
                    تحصيل
                    {debtsToCollectToday.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-orange-500">{debtsToCollectToday.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="new-debts" className="flex-1 gap-1 text-[10px] px-1 py-1.5 data-[state=active]:bg-red-100 data-[state=active]:text-red-700">
                    <Plus className="w-3 h-3" />
                    جديدة
                    {newDebtsToday.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-red-500">{newDebtsToday.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="collected" className="flex-1 gap-1 text-[10px] px-1 py-1.5 data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
                    <Check className="w-3 h-3" />
                    تحصيل
                    {collectedDebtOperations.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-green-500">{collectedDebtOperations.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="no-payment" className="flex-1 gap-1 text-[10px] px-1 py-1.5 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700">
                    <X className="w-3 h-3" />
                    بدون
                    {debtsNoPaymentToday.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-amber-500">{debtsNoPaymentToday.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="all-debts" className="flex-1 gap-1 text-[10px] px-1 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                    <Landmark className="w-3 h-3" />
                    الكل
                    {allDebtsFiltered.length > 0 && <Badge variant="secondary" className="text-[9px] px-1 h-4">{allDebtsFiltered.length}</Badge>}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="today-collection" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                  <DebtList debts={debtsToCollectToday} onCollect={handleDebtClick} onVisitNoPayment={handleVisitNoPayment} onClosed={handleDebtCustomerClosed} onUnavailable={handleDebtCustomerUnavailable} onDebtRefused={handleDebtDebtRefused} emptyMessage="لا توجد ديون مستحقة اليوم ✓" searchQuery={searchQuery} />
                </TabsContent>
                <TabsContent value="new-debts" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                  <DebtList debts={newDebtsToday} onCollect={handleDebtClick} onVisitNoPayment={handleVisitNoPayment} onClosed={handleDebtCustomerClosed} onUnavailable={handleDebtCustomerUnavailable} onDebtRefused={handleDebtDebtRefused} emptyMessage="لا توجد ديون جديدة اليوم" searchQuery={searchQuery} />
                </TabsContent>
                <TabsContent value="collected" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                  <CollectedDebtOperationList operations={collectedDebtOperations} emptyMessage="لا توجد تحصيلات بعد" searchQuery={searchQuery} onOpenDetails={handleCollectedOperationClick} sectors={sectors} allZones={allZones} />
                </TabsContent>
                <TabsContent value="no-payment" className="m-0 flex-1 min-h-0">
                  <Tabs defaultValue="visit-only" className="flex flex-col h-full min-h-0">
                    <TabsList className="w-full rounded-none border-b shrink-0 h-auto p-0.5 gap-0.5 bg-amber-50">
                      <TabsTrigger value="visit-only" className="flex-1 gap-1 text-[10px] px-1 py-1 data-[state=active]:bg-amber-200 data-[state=active]:text-amber-800">
                        <Eye className="w-3 h-3" />
                        زيارة
                        {debtsNoPaymentVisitOnly.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-amber-500">{debtsNoPaymentVisitOnly.length}</Badge>}
                      </TabsTrigger>
                      <TabsTrigger value="unavailable" className="flex-1 gap-1 text-[10px] px-1 py-1 data-[state=active]:bg-yellow-200 data-[state=active]:text-yellow-800">
                        <UserX className="w-3 h-3" />
                        غير متاح
                        {debtsNoPaymentUnavailable.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-yellow-500">{debtsNoPaymentUnavailable.length}</Badge>}
                      </TabsTrigger>
                      <TabsTrigger value="closed" className="flex-1 gap-1 text-[10px] px-1 py-1 data-[state=active]:bg-red-100 data-[state=active]:text-red-700">
                        <DoorClosed className="w-3 h-3" />
                        مغلق
                        {debtsNoPaymentClosed.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-red-500">{debtsNoPaymentClosed.length}</Badge>}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="visit-only" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                      <DebtList debts={debtsNoPaymentVisitOnly} onCollect={handleDebtClick} onVisitNoPayment={handleVisitNoPayment} onClosed={handleDebtCustomerClosed} onUnavailable={handleDebtCustomerUnavailable} onDebtRefused={handleDebtDebtRefused} emptyMessage="لا توجد زيارات بدون تحصيل" searchQuery={searchQuery} timeMap={debtCollectionTimeMap} />
                    </TabsContent>
                    <TabsContent value="unavailable" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                      <DebtList debts={debtsNoPaymentUnavailable} onCollect={handleDebtClick} onVisitNoPayment={handleVisitNoPayment} onClosed={handleDebtCustomerClosed} onUnavailable={handleDebtCustomerUnavailable} onDebtRefused={handleDebtDebtRefused} emptyMessage="لا يوجد عملاء غير متاحين" searchQuery={searchQuery} />
                    </TabsContent>
                    <TabsContent value="closed" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                      <DebtList debts={debtsNoPaymentClosed} onCollect={handleDebtClick} onVisitNoPayment={handleVisitNoPayment} onClosed={handleDebtCustomerClosed} onUnavailable={handleDebtCustomerUnavailable} onDebtRefused={handleDebtDebtRefused} emptyMessage="لا يوجد عملاء مغلقين" searchQuery={searchQuery} />
                    </TabsContent>
                  </Tabs>
                </TabsContent>
                <TabsContent value="all-debts" className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
                  <DebtList debts={allDebtsFiltered} onCollect={handleDebtClick} onVisitNoPayment={handleVisitNoPayment} onClosed={handleDebtCustomerClosed} onUnavailable={handleDebtCustomerUnavailable} onDebtRefused={handleDebtDebtRefused} emptyMessage="لا توجد ديون مستحقة" searchQuery={searchQuery} />
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      {orderDetailsDialog && (
        <OrderDetailsDialog
          order={orderDetailsDialog}
          onClose={() => setOrderDetailsDialog(null)}
          onCancelOrder={async (orderId: string) => {
            try {
              const { data: oItems } = await supabase.from('order_items').select('product_id, quantity').eq('order_id', orderId);
              const { data: oData } = await supabase.from('orders').select('assigned_worker_id, status').eq('id', orderId).single();
              if (oData && oData.status === 'delivered' && oData.assigned_worker_id && oItems) {
                for (const item of oItems) {
                  const { data: ws } = await supabase.from('worker_stock').select('id, quantity').eq('worker_id', oData.assigned_worker_id).eq('product_id', item.product_id).maybeSingle();
                  if (ws) await supabase.from('worker_stock').update({ quantity: ws.quantity + item.quantity }).eq('id', ws.id);
                  await supabase.from('stock_movements').delete().eq('order_id', orderId).eq('product_id', item.product_id).eq('movement_type', 'delivery');
                }
              }
              await supabase.from('customer_debts').delete().eq('order_id', orderId);
              const { error } = await supabase
                .from('orders')
                .update({ status: 'cancelled' })
                .eq('id', orderId);
              if (error) throw error;
              toast.success('تم إلغاء الطلبية بنجاح');
              queryClient.invalidateQueries({ queryKey: ['today-orders-dialog'] });
              queryClient.invalidateQueries({ queryKey: ['today-cust-assigned-orders-full'] });
              queryClient.invalidateQueries({ queryKey: ['my-worker-stock'] });
              queryClient.invalidateQueries({ queryKey: ['worker-truck-stock'] });
              queryClient.invalidateQueries({ queryKey: ['today-delivered-dialog'] });
              queryClient.invalidateQueries({ queryKey: ['today-direct-sales-dialog'] });
              setOrderDetailsDialog(null);
            } catch {
              toast.error('فشل في إلغاء الطلبية');
            }
          }}
          onCancelDirectSale={async (saleOrder: any) => {
            try {
              const orderId = saleOrder.id;
              if (!orderId) throw new Error('No order ID');
              const { data: oItems } = await supabase.from('order_items').select('product_id, quantity').eq('order_id', orderId);
              const { data: oData } = await supabase.from('orders').select('assigned_worker_id, created_by').eq('id', orderId).single();
              const wId = oData?.assigned_worker_id || oData?.created_by;
              if (wId && oItems) {
                for (const item of oItems) {
                  const { data: ws } = await supabase.from('worker_stock').select('id, quantity').eq('worker_id', wId).eq('product_id', item.product_id).maybeSingle();
                  if (ws) await supabase.from('worker_stock').update({ quantity: ws.quantity + item.quantity }).eq('id', ws.id);
                  await supabase.from('stock_movements').delete().eq('order_id', orderId).eq('product_id', item.product_id);
                }
              }
              await supabase.from('customer_debts').delete().eq('order_id', orderId);
              const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
              if (error) throw error;

              const cancelledCustomerId = saleOrder?.customer?.id || saleOrder?.customer_id || null;
              if (cancelledCustomerId) {
                let vtUpdate = supabase
                  .from('visit_tracking')
                  .update({ operation_type: 'visit', notes: 'تم إلغاء البيع المباشر' })
                  .eq('operation_type', 'direct_sale')
                  .eq('customer_id', cancelledCustomerId)
                  .gte('created_at', todayStart)
                  .lte('created_at', selectedDayBounds.end);

                if (wId || effectiveWorkerId) {
                  vtUpdate = vtUpdate.eq('worker_id', wId || effectiveWorkerId);
                }

                await vtUpdate;
              }

              toast.success('تم إلغاء البيع المباشر وإرجاع المخزون بنجاح');
              queryClient.invalidateQueries({ queryKey: ['today-orders-dialog'] });
              queryClient.invalidateQueries({ queryKey: ['today-cust-assigned-orders-full'] });
              queryClient.invalidateQueries({ queryKey: ['my-worker-stock'] });
              queryClient.invalidateQueries({ queryKey: ['worker-truck-stock'] });
              queryClient.invalidateQueries({ queryKey: ['today-delivered-dialog'] });
              queryClient.invalidateQueries({ queryKey: ['today-direct-sales-dialog'] });
              queryClient.invalidateQueries({ queryKey: ['today-direct-sale-visits-dialog'] });
              setOrderDetailsDialog(null);
            } catch {
              toast.error('فشل في إلغاء البيع المباشر');
            }
          }}
        />
      )}

      {/* Sub-dialogs */}
      <SalesHubDialog
        open={showSalesHubDialog}
        onOpenChange={(open) => {
          setShowSalesHubDialog(open);
          if (!open) {
            setPendingDeliveryOrder(null);
            setDirectSaleCustomerId(null);
          }
        }}
        initialTab={salesHubTab}
        initialDeliveryOrder={pendingDeliveryOrder}
        initialCustomerId={directSaleCustomerId || undefined}
        stockSource="worker"
        stockItems={workerStock}
      />

      <CreateOrderDialog
        open={showCreateOrder}
        onOpenChange={setShowCreateOrder}
        initialCustomerId={selectedCustomerForOrder || undefined}
      />

      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="w-auto max-w-[92vw] p-0 overflow-hidden" dir="rtl">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-sm mb-2">اختيار تاريخ مخصص</DialogTitle>
            <div className="flex flex-wrap gap-1">
              {([
                { key: 'orders' as const, label: 'طلبات', color: 'bg-blue-100 text-blue-700 border-blue-300', active: 'bg-blue-600 text-white border-blue-600' },
                { key: 'debts' as const, label: 'ديون جديدة', color: 'bg-red-100 text-red-700 border-red-300', active: 'bg-red-600 text-white border-red-600' },
                { key: 'collections' as const, label: 'تحصيل', color: 'bg-green-100 text-green-700 border-green-300', active: 'bg-green-600 text-white border-green-600' },
                { key: 'sales' as const, label: 'بيع مباشر', color: 'bg-amber-100 text-amber-700 border-amber-300', active: 'bg-amber-600 text-white border-amber-600' },
              ]).map(btn => (
                <button
                  key={btn.key}
                  onClick={() => setCalendarFilter(btn.key)}
                  className={`px-2 py-0.5 rounded-full border text-[10px] font-medium transition-colors ${calendarFilter === btn.key ? btn.active : btn.color}`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </DialogHeader>
          <div className="px-3 pb-3">
            <Calendar
              mode="single"
              selected={selectedCustomDate ?? new Date(selectedDayBounds.dateKey)}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              onSelect={(date) => {
                if (!date) return;
                const jsDay = date.getDay();
                setSelectedCustomDate(date);
                setSelectedDay(JS_DAY_TO_NAME[jsDay] || todayName);
                setCalendarOpen(false);
              }}
              modifiers={{
                hasActivity: (date) => activeCalendarDaySet.has(toLocalDateKey(date)),
              }}
              modifiersClassNames={{
                hasActivity: `ring-2 ${calendarRingColor} ring-inset rounded-md`,
              }}
              initialFocus
              className="pointer-events-auto"
            />
          </div>
        </DialogContent>
      </Dialog>

      {selectedDebt && (
        <DebtFlowDialog
          open={showVisitNoPayment}
          onOpenChange={(o) => { setShowVisitNoPayment(o); if (!o) setSelectedDebt(null); }}
          mode="visit"
          debt={selectedDebt}
        />
      )}

      {selectedDebt && (
        <DebtFlowDialog
          open={showCollectDebt}
          onOpenChange={(o) => { setShowCollectDebt(o); if (!o) setSelectedDebt(null); }}
          mode="details"
          debt={selectedDebt}
          customerName={(selectedDebt.customer as any)?.store_name || (selectedDebt.customer as any)?.name || ''}
          customerId={selectedDebt.customer_id}
          initialTab="collect"
        />
      )}

      {selectedCollectedOperation && (
        <DebtFlowDialog
          open={showCollectedOperationDialog}
          onOpenChange={(o) => {
            setShowCollectedOperationDialog(o);
            if (!o) setSelectedCollectedOperation(null);
          }}
          mode="collection_operation"
          collection={selectedCollectedOperation}
        />
      )}

      {/* Print Receipt Dialog */}
      {printReceiptData && (
        <ReceiptDialog
          open={showPrintReceipt}
          onOpenChange={(o) => { setShowPrintReceipt(o); if (!o) setPrintReceiptData(null); }}
          receiptData={printReceiptData}
        />
      )}
      {/* Single Customer Postpone Dialog */}
      <Dialog open={!!postponeCustomer} onOpenChange={(open) => { if (!open) { setPostponeCustomer(null); setPostponeWorkerId(null); } }}>
        <DialogContent className="max-w-xs" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-amber-600" />
              تأجيل توصيل {postponeCustomer?.name}
            </DialogTitle>
          </DialogHeader>
          {/* Worker reassignment */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">عامل التوصيل:</Label>
            <Select value={postponeWorkerId || '_same'} onValueChange={(v) => setPostponeWorkerId(v === '_same' ? null : v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="نفس العامل الحالي" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="_same">نفس العامل الحالي</SelectItem>
                {adminPickerWorkers.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">اختر يوم التوصيل الجديد:</p>
          <div className="grid grid-cols-2 gap-2">
            {getNextWorkDays().map(({ date, label }) => (
              <Button
                key={date.toISOString()}
                variant="outline"
                className="h-12 text-sm font-bold hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700"
                onClick={() => handleSinglePostpone(date)}
              >
                {label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Orders Summary Dialog */}
      {effectiveWorkerId && (
        <WorkerOrdersSummaryDialog
          open={showOrdersSummary}
          onOpenChange={setShowOrdersSummary}
          workerId={effectiveWorkerId}
          workerName={effectiveWorkerName || ''}
        />
      )}

      {/* Sales Summary Dialog */}
      {effectiveWorkerId && (
        <WorkerSalesSummaryDialog
          open={showSalesSummary}
          onOpenChange={setShowSalesSummary}
          workerId={effectiveWorkerId}
          workerName={effectiveWorkerName || ''}
        />
      )}

      {/* Unified Print Settings Dialog */}
      <TodayPrintSettingsDialog
        open={showPrintOrdersDialog}
        onOpenChange={setShowPrintOrdersDialog}
        orders={assignedOrders.filter(o => ['pending', 'assigned', 'in_progress', 'confirmed', 'processing', 'in_transit', 'ready'].includes(o.status))}
        products={allProducts as any}
        workerStock={workerStock as any}
        sectors={sectors}
        zones={allZones}
        onPrint={async (selectedOrders, columnConfig, includeLoadedProducts, cashVanQuantities, deliveryDate) => {
          if (!selectedOrders || selectedOrders.length === 0) {
            toast.info('لا توجد طلبيات للطباعة');
            return;
          }
          const orderIds = selectedOrders.map(o => o.id);
          const { data: items } = await supabase
            .from('order_items')
            .select('*, product:products(*)')
            .in('order_id', orderIds);
          const itemsMap = new Map<string, any[]>();
          items?.forEach(item => {
            const existing = itemsMap.get(item.order_id) || [];
            existing.push(item);
            itemsMap.set(item.order_id, existing);
          });

          // Enrich orders with sector/zone objects for print
          const sectorMap = new Map(sectors.map(s => [s.id, s]));
          const zoneMap = new Map(allZones.map(z => [z.id, z]));
          const enrichedOrders = selectedOrders.map(o => {
            const customer = o.customer as any;
            if (customer) {
              const enrichedCustomer = { ...customer };
              if (customer.sector_id && !customer.sector) {
                enrichedCustomer.sector = sectorMap.get(customer.sector_id) || null;
              }
              if (customer.zone_id && !customer.zone) {
                enrichedCustomer.zone = zoneMap.get(customer.zone_id) || null;
              }
              return { ...o, customer: enrichedCustomer };
            }
            return o;
          });

          setAllOrderItems(itemsMap);
          setFilteredOrdersForPrint(enrichedOrders);
          setPrintColumnConfig(columnConfig);
          setPrintWorkerName(effectiveWorkerName || null);
          setPrintDeliveryDate(deliveryDate || null);
          setIsPrintReady(true);
          setShowPrintOrdersDialog(false);
          setTimeout(() => {
            window.print();
            setIsPrintReady(false);
            setPrintWorkerName(null);
            setPrintDeliveryDate(null);
          }, 500);
        }}
      />

      {/* Print View (hidden, only shown when printing) */}
      {isPrintReady && (
        <OrdersPrintView
          orders={filteredOrdersForPrint}
          orderItems={allOrderItems}
          products={allProducts as any}
          title={printWorkerName ? `ورقة التوصيل - ${printWorkerName}` : 'ورقة التوصيل'}
          dateRange={printDeliveryDate || undefined}
          isVisible={isPrintReady}
          columnConfig={printColumnConfig}
        />
      )}
    </>
  );
};

// Order Details Dialog - shows order/sale details similar to receipt content
const OrderDetailsDialog: React.FC<{ order: any; onClose: () => void; onCancelOrder?: (orderId: string) => void; onCancelDirectSale?: (order: any) => Promise<void> }> = ({ order, onClose, onCancelOrder, onCancelDirectSale }) => {
  const { user } = useAuth();
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showModifyDialog, setShowModifyDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { data: modifyOrderItems } = useOrderItems(showModifyDialog ? order.id : null);
  const isDirectSale = order._isDirectSale;
  const items = isDirectSale ? (order.items || []) : (order.items || []);
  const customer = isDirectSale ? order.customer : order.customer;
  const isOrderRequest = !isDirectSale && !!order._isOrderRequest;

  // For delivered orders, fetch the actual debt from customer_debts to stay in sync
  const { data: orderDebt } = useQuery({
    queryKey: ['order-debt-details', order.id],
    queryFn: async () => {
      if (!order.id) return null;
      const { data } = await supabase
        .from('customer_debts')
        .select('total_amount, paid_amount, remaining_amount')
        .eq('order_id', order.id)
        .maybeSingle();
      return data;
    },
    enabled: !!order.id && order.status === 'delivered',
  });

  const itemsTotalAmount = items.reduce((sum: number, item: any) => {
    const normalizedItem = normalizeSaleItem(item);
    if (normalizedItem.totalPrice > 0) {
      return sum + normalizedItem.totalPrice;
    }
    const paidQuantity = Math.max(0, normalizedItem.quantity - normalizedItem.giftQuantity);
    return sum + (paidQuantity * normalizedItem.unitPrice);
  }, 0);

  const shouldUseStampedTotal = order.payment_type === 'with_invoice' && order.invoice_payment_method === 'cash';
  const effectiveTotalAmount = shouldUseStampedTotal
    ? Math.max(
      itemsTotalAmount,
      Number(orderDebt?.total_amount || 0),
      Number(order.total_amount || 0),
    )
    : itemsTotalAmount > 0
      ? itemsTotalAmount
      : Number(orderDebt?.total_amount || order.total_amount || 0);
  const fallback = resolveOrderPayment({ ...order, total_amount: effectiveTotalAmount }, isOrderRequest);

  // Use actual debt data when available, otherwise fall back to calculated values
  const paidAmount = orderDebt
    ? Math.max(0, effectiveTotalAmount - Number(orderDebt.remaining_amount || 0))
    : fallback.paidAmount;
  const remainingAmount = orderDebt
    ? Number(orderDebt.remaining_amount || 0)
    : fallback.remainingAmount;

  const handlePrint = () => {
    setShowReceiptDialog(true);
  };

  const receiptData = {
    receiptType: (isDirectSale ? 'direct_sale' : 'delivery') as any,
    orderId: order.id || null,
    customerId: customer?.id || '',
    customerName: customer?.store_name || customer?.name || order.customer_name || '—',
    customerPhone: customer?.phone || null,
    workerId: user?.id || '',
    workerName: user?.full_name || '',
    workerPhone: null,
    branchId: user?.branch_id || null,
    items: items.map((item: any) => {
      const normalizedItem = normalizeSaleItem(item);
      return {
        productId: normalizedItem.productId,
        productName: normalizedItem.productName,
        quantity: normalizedItem.quantity,
        unitPrice: normalizedItem.unitPrice,
        totalPrice: normalizedItem.totalPrice,
        giftQuantity: normalizedItem.giftQuantity,
      };
    }),
    totalAmount: effectiveTotalAmount,
    paidAmount,
    remainingAmount,
    paymentMethod: order.payment_type || order.paymentMethod || 'cash',
    notes: order.notes || null,
    receiptTitleOverride: !isDirectSale && order._isOrderRequest ? 'BON DE COMMANDE' : undefined,
  };

  return (
    <>
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-sm p-4 gap-3 max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            {isDirectSale ? '🛒 تفاصيل البيع المباشر' : '📦 تفاصيل الطلبية'}
            {order.status === 'cancelled' && (
              <Badge variant="destructive" className="text-[10px] px-2 py-0.5">ملغاة</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Customer Info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2">
              <CustomerSummary
                customer={{
                  name: customer?.name,
                  store_name: customer?.store_name,
                  customer_type: customer?.customer_type,
                  phone: customer?.phone,
                  wilaya: customer?.wilaya,
                }}
                compact
                showAvatar={false}
                showMeta={false}
              />
            </div>
            {customer?.phone && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="w-3 h-3" />
                <span>{customer.phone}</span>
              </div>
            )}
            {order.created_at && (
              <p className="text-xs text-muted-foreground">
                التاريخ: {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}
              </p>
            )}
          </div>

          {/* Items */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 text-xs font-bold border-b">المنتجات</div>
            <div className="divide-y">
              {items.map((item: any, idx: number) => {
                const normalizedItem = normalizeSaleItem(item);
                const productName = normalizedItem.productName;
                const quantity = normalizedItem.quantity;
                const unitPrice = normalizedItem.unitPrice;
                const itemTotal = normalizedItem.totalPrice;
                const giftQty = normalizedItem.giftQuantity;
                const productImage = item?.product?.image_url || item?.image_url || null;

                return (
                  <div key={idx} className="px-3 py-2">
                    <div className="flex items-start gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-muted/40">
                        {productImage ? (
                          <img
                            src={productImage}
                            alt={productName}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                            لا صورة
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-sm leading-5">{productName}</span>
                          <span className="font-bold text-sm whitespace-nowrap">{Number(itemTotal || 0).toLocaleString()} DA</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>الكمية: {quantity}</span>
                          <span>السعر: {Number(unitPrice || 0).toLocaleString()} DA</span>
                          {giftQty > 0 && <span className="text-emerald-600">هدية: {giftQty}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total */}
          <div className="bg-primary/5 rounded-lg p-3 flex items-center justify-between">
            <span className="font-bold">المجموع</span>
            <span className="font-bold text-lg text-primary">{Number(effectiveTotalAmount || 0).toLocaleString()} DA</span>
          </div>

          {/* Paid / Remaining - show only when partial or no payment */}
          {remainingAmount > 0 && (
            <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">المبلغ المدفوع</span>
                <span className="font-bold text-emerald-600">{paidAmount.toLocaleString()} DA</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">المتبقي (دين)</span>
                <span className="font-bold text-destructive">{remainingAmount.toLocaleString()} DA</span>
              </div>
            </div>
          )}

          {!isDirectSale && order.notes && (
            <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
              ملاحظات: {order.notes}
            </div>
          )}

          {/* Edit & Print & Cancel Buttons - Hide for delivered/sold orders */}
          {order.id && order.status !== 'delivered' && !isDirectSale && (
            <Button className="w-full gap-2" variant="default" onClick={() => setShowModifyDialog(true)}>
              <Pencil className="w-4 h-4" />
              تعديل الطلبية
            </Button>
          )}
          <Button className="w-full gap-2" variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
            طباعة الوصل
          </Button>
          {order.id && onCancelOrder && order._isOrderRequest && (
            <></>
          )}
          {order.id && (onCancelOrder || onCancelDirectSale) && order.status !== 'delivered' && order.status !== 'cancelled' && (isDirectSale || order._isOrderRequest) && (
            <Button
              className="w-full gap-2"
              variant="destructive"
              disabled={cancelling}
              onClick={async () => {
                setCancelling(true);
                try {
                  if (isDirectSale && onCancelDirectSale) {
                    await onCancelDirectSale(order);
                  } else if (onCancelOrder) {
                    await onCancelOrder(order.id);
                  }
                  onClose();
                } finally {
                  setCancelling(false);
                }
              }}
            >
              {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              {isDirectSale ? 'إلغاء البيع المباشر' : 'إلغاء الطلبية'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <ReceiptDialog
      open={showReceiptDialog}
      onOpenChange={setShowReceiptDialog}
      receiptData={receiptData}
    />

    {showModifyDialog && modifyOrderItems && (
      <ModifyOrderDialog
        open={showModifyDialog}
        onOpenChange={(o) => { setShowModifyDialog(o); if (!o) onClose(); }}
        order={order}
        orderItems={modifyOrderItems}
      />
    )}
    </>
  );
};

// Reusable CustomerList component
const CustomerList: React.FC<{
  customers: any[];
  emptyMessage: string;
  onCustomerClick: (c: any) => void;
  onVisitWithoutOrder?: (c: any) => void;
  onClosed?: (c: any) => void;
  onUnavailable?: (c: any) => void;
  onDebtRefused?: (c: any) => void;
  onCancelled?: (c: any) => void;
  onNoSale?: (c: any) => void;
  onPrint?: (c: any) => void;
  onPostpone?: (c: any) => void;
  showVisitButton?: boolean;
  visitButtonLabel?: string;
  showActionButtons?: boolean;
  showPrintButton?: boolean;
  showNoSaleButton?: boolean;
  showCancelButton?: boolean;
  checkingLocationFor: string | null;
  loadingFor?: string | null;
  searchQuery?: string;
  sectors?: any[];
  allZones?: any[];
  salesRepStatusMap?: Map<string, string>;
  deliveryTimeMap?: Map<string, string>;
  timeMap?: Map<string, string>;
  distanceMap?: Map<string, number>;
  workerPosition?: { lat: number; lng: number } | null;
  sortByDistance?: boolean;
  postponedBadgeIds?: Set<string>;
  postponeCountMap?: Map<string, number>;
  orderInfoMap?: Map<string, { deliveryDate: string; deliveryDay: string; itemCount: number }>;
  liabilityCustomerIds?: Set<string>;
  noOrderStreakMap?: Map<string, number>;
}> = ({ customers, emptyMessage, onCustomerClick, onVisitWithoutOrder, onClosed, onUnavailable, onDebtRefused, onCancelled, onNoSale, onPrint, onPostpone, showVisitButton, visitButtonLabel, showActionButtons, showPrintButton, showNoSaleButton, showCancelButton, checkingLocationFor, loadingFor, searchQuery, sectors, allZones, salesRepStatusMap, deliveryTimeMap, timeMap, distanceMap, workerPosition, sortByDistance, postponedBadgeIds, postponeCountMap, noOrderStreakMap, orderInfoMap, liabilityCustomerIds }) => {
  const { language } = useLanguage();

  // Compute live distance from worker to each customer
  const liveDistanceMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!workerPosition) return map;
    customers.forEach(c => {
      if (c.latitude && c.longitude) {
        const distKm = calculateDistance(workerPosition.lat, workerPosition.lng, c.latitude, c.longitude);
        map.set(c.id, Math.round(distKm * 1000));
      }
    });
    return map;
  }, [customers, workerPosition]);

  const filtered = useMemo(() => {
    let list = customers;
    if (searchQuery?.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.store_name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q)
      );
    }
    // Sort by distance if enabled and worker position available
    if (sortByDistance && workerPosition && liveDistanceMap.size > 0) {
      list = [...list].sort((a, b) => {
        const dA = liveDistanceMap.get(a.id) ?? Infinity;
        const dB = liveDistanceMap.get(b.id) ?? Infinity;
        return dA - dB;
      });
    } else if (timeMap && timeMap.size > 0) {
      // Fallback: sort by timeMap descending (newest first) if available
      list = [...list].sort((a, b) => {
        const tA = timeMap.get(a.id) || '';
        const tB = timeMap.get(b.id) || '';
        return tB.localeCompare(tA);
      });
    }
    return list;
  }, [customers, searchQuery, timeMap, sortByDistance, workerPosition, liveDistanceMap]);

  // Group by zone
  const zoneGroups = useMemo(() => {
    const groups = new Map<string | null, any[]>();
    filtered.forEach(c => {
      const key = c.zone_id || null;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    });
    const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
      if (!a) return 1;
      if (!b) return -1;
      const nameA = allZones?.find(z => z.id === a)?.name || '';
      const nameB = allZones?.find(z => z.id === b)?.name || '';
      return nameA.localeCompare(nameB, 'ar');
    });
    return sortedKeys.map(key => ({
      zoneId: key,
      zoneName: key ? (allZones?.find(z => z.id === key) ? getLocalizedName(allZones.find(z => z.id === key)!, language) : 'منطقة غير معروفة') : 'بدون منطقة',
      customers: groups.get(key)!,
    }));
  }, [filtered, allZones, language]);

  const [openCustomerId, setOpenCustomerId] = useState<string | null>(null);

  if (filtered.length === 0) {
    return <div className="p-6 text-center text-sm text-muted-foreground">{searchQuery?.trim() ? 'لا توجد نتائج' : emptyMessage}</div>;
  }

  const renderCustomer = (c: any) => {
    const isOpen = openCustomerId === c.id;
    const sector = sectors?.find(s => s.id === c.sector_id);
    const zone = allZones?.find(z => z.id === c.zone_id);
    // Visual distinction for direct sale customers based on sales rep status
    const repStatus = salesRepStatusMap?.get(c.id);
    let cardBg = '';
    if (salesRepStatusMap && salesRepStatusMap.has(c.id)) {
      if (repStatus === 'closed') cardBg = 'bg-red-50 border-s-4 border-s-red-400';
      else if (repStatus === 'unavailable') cardBg = 'bg-yellow-50 border-s-4 border-s-yellow-400';
      else if (repStatus === 'not_visited') cardBg = 'bg-white border-s-4 border-s-gray-300';
      else if (repStatus === 'visited') cardBg = 'bg-blue-50 border-s-4 border-s-blue-400';
    }
    return (
      <Collapsible key={c.id} open={isOpen} onOpenChange={(val) => setOpenCustomerId(val ? c.id : null)}>
      <div className={`p-3 hover:bg-muted/50 transition-colors ${cardBg}`}>
        <div className="flex items-center gap-1">
        <button
          className="flex-1 flex items-center gap-2 text-start min-w-0"
          onClick={() => onCustomerClick(c)}
          disabled={loadingFor === c.id}
        >
          <div className="relative w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            {loadingFor === c.id ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <User className="w-4 h-4 text-primary" />}
            {liabilityCustomerIds?.has(c.id) && (
              <span className="absolute -top-0.5 -end-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <CustomerSummary
              customer={{
                name: c.name,
                store_name: c.store_name,
                customer_type: c.customer_type,
                sector_name: sector ? getLocalizedName(sector, language) : undefined,
                zone_name: zone ? getLocalizedName(zone, language) : undefined,
                phone: c.phone,
                wilaya: c.wilaya,
              }}
              showAvatar={false}
              showMeta={false}
            />
             {liveDistanceMap.has(c.id) && (
               <Badge className="text-[9px] px-1.5 py-0 h-4 bg-yellow-400 text-black border-0 font-medium">
                 📍 {liveDistanceMap.get(c.id)! >= 1000
                   ? `${(liveDistanceMap.get(c.id)! / 1000).toFixed(1)} كم`
                   : `${liveDistanceMap.get(c.id)!} م`}
               </Badge>
             )}
             {postponedBadgeIds?.has(c.id) && (
                <Badge className="text-[9px] px-1.5 py-0 h-4 bg-purple-600 text-white border-0 font-medium gap-0.5">
                  <CalendarClock className="w-3 h-3" />
                  {postponeCountMap?.get(c.id) || 1}
                </Badge>
               )}
             {noOrderStreakMap && (noOrderStreakMap.get(c.id) || 0) >= 2 && (
                <Badge className="text-[9px] px-1.5 py-0 h-4 bg-red-100 text-red-700 border-0 font-bold gap-0.5">
                  🔄 {noOrderStreakMap.get(c.id)} بدون طلبية
                </Badge>
               )}
             {orderInfoMap?.has(c.id) && (() => {
                const info = orderInfoMap.get(c.id)!;
                return (
                  <span className="flex items-center gap-1 flex-wrap">
                    {info.deliveryDate && (
                      <Badge className="text-[9px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700 border-0 gap-0.5">
                        <Truck className="w-3 h-3" />
                        {info.deliveryDay} {info.deliveryDate}
                      </Badge>
                    )}
                    {info.itemCount > 0 && (
                      <Badge className="text-[9px] px-1.5 py-0 h-4 bg-green-100 text-green-700 border-0 gap-0.5">
                        <Package className="w-3 h-3" />
                        {info.itemCount} منتج
                      </Badge>
                    )}
                  </span>
                );
              })()}
             {salesRepStatusMap && salesRepStatusMap.has(c.id) && (() => {
                const status = salesRepStatusMap.get(c.id);
                if (status === 'not_visited') return <Badge className="text-[9px] px-1.5 py-0 h-4 bg-gray-200 text-gray-700 border-0 gap-0.5"><EyeOff className="w-3 h-3" /> بدون زيارة (مندوب)</Badge>;
                if (status === 'closed') return <Badge className="text-[9px] px-1.5 py-0 h-4 bg-red-200 text-red-800 border-0 gap-0.5"><DoorClosed className="w-3 h-3" /> مغلق (مندوب)</Badge>;
                if (status === 'unavailable') return <Badge className="text-[9px] px-1.5 py-0 h-4 bg-yellow-200 text-yellow-800 border-0 gap-0.5"><UserX className="w-3 h-3" /> غير متاح (مندوب)</Badge>;
                if (status === 'visited') return <Badge className="text-[9px] px-1.5 py-0 h-4 bg-blue-200 text-blue-800 border-0 gap-0.5"><Eye className="w-3 h-3" /> تمت الزيارة (مندوب)</Badge>;
                return null;
              })()}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {c.phone && <span>{c.phone}</span>}
              {distanceMap?.has(c.id) ? (
                <span>• 📍 {distanceMap.get(c.id)!} م</span>
              ) : c.wilaya ? (
                <span>• {c.wilaya}</span>
              ) : null}
              {timeMap?.has(c.id) && (
                <span className="flex items-center gap-0.5 text-[10px]">
                  <Clock className="w-3 h-3" />
                  {format(new Date(timeMap.get(c.id)!), 'HH:mm')}
                </span>
              )}
            </div>
          </div>
        </button>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className={`h-7 w-7 shrink-0 rounded-full ${isOpen ? 'bg-destructive text-white' : 'bg-green-600 text-black'}`}>
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="flex items-center gap-2 mt-1.5 px-2 py-1 bg-muted/30 rounded text-xs text-muted-foreground flex-wrap">
            {c.name && <span className="font-medium text-foreground">👤 {c.name}</span>}
            {c.phone && (
              <a href={`tel:${c.phone}`} className="flex items-center gap-0.5 text-primary" onClick={e => e.stopPropagation()}>
                <Phone className="w-3 h-3" />
                {c.phone}
              </a>
            )}
          </div>
          <div className="flex items-center gap-1 mt-1.5 justify-end flex-wrap">
            {c.latitude && c.longitude && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-0.5" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`, '_blank')}>
                <Navigation className="w-3 h-3" />
                الموقع
              </Button>
            )}
            {showPrintButton && onPrint && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={(e) => { e.stopPropagation(); onPrint(c); }}>
                <Printer className="w-3.5 h-3.5" />
              </Button>
            )}
            {showVisitButton && onVisitWithoutOrder && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-0.5 text-orange-600" onClick={() => onVisitWithoutOrder(c)} disabled={checkingLocationFor === c.id}>
                {checkingLocationFor === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPinOff className="w-3 h-3" />}
                {visitButtonLabel || 'زيارة بدون طلبية'}
              </Button>
            )}
            {showNoSaleButton && onNoSale && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-0.5 text-amber-600" onClick={() => onNoSale(c)} disabled={checkingLocationFor === c.id}>
                {checkingLocationFor === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                بدون بيع
              </Button>
            )}
            {showActionButtons && onClosed && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-0.5 text-destructive" onClick={() => onClosed(c)} disabled={checkingLocationFor === c.id}>
                <DoorClosed className="w-3 h-3" />
                مغلق
              </Button>
            )}
            {showActionButtons && onUnavailable && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-0.5 text-muted-foreground" onClick={() => onUnavailable(c)} disabled={checkingLocationFor === c.id}>
                <UserX className="w-3 h-3" />
                غير متاح
              </Button>
            )}
            {showActionButtons && onDebtRefused && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-0.5 text-purple-600" onClick={() => onDebtRefused(c)} disabled={checkingLocationFor === c.id}>
                <BanknoteIcon className="w-3 h-3" />
                رفض الدين
              </Button>
            )}
            {showCancelButton && onCancelled && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-0.5 text-destructive" onClick={() => onCancelled(c)} disabled={checkingLocationFor === c.id}>
                <XCircle className="w-3 h-3" />
                إلغاء
              </Button>
            )}
            {onPostpone && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-0.5 text-amber-600" onClick={() => onPostpone(c)}>
                <CalendarClock className="w-3 h-3" />
                تأجيل
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </div>
      </Collapsible>
    );
  };

  return (
    <div className="pb-16">
      {zoneGroups.length <= 1 ? (
        <div className="divide-y">
          {filtered.map(renderCustomer)}
        </div>
      ) : (
        zoneGroups.map(group => (
          <div key={group.zoneId || 'no-zone'}>
            <div className="sticky top-0 z-10 bg-blue-600 text-white px-4 py-1.5 text-xs font-bold flex items-center justify-between">
              <span>{group.zoneName}</span>
              <Badge className="bg-white/20 text-white border-0 text-[10px]">{group.customers.length}</Badge>
            </div>
            <div className="divide-y">
              {group.customers.map(renderCustomer)}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const CollectedDebtOperationList: React.FC<{
  operations: TodayDebtCollectionOperation[];
  emptyMessage: string;
  searchQuery?: string;
  onOpenDetails: (operation: TodayDebtCollectionOperation) => void;
  sectors?: any[];
  allZones?: any[];
}> = ({ operations, emptyMessage, searchQuery, onOpenDetails, sectors, allZones }) => {
  const { language } = useLanguage();

  // Group operations by customer_id so multiple debt collections for same customer appear as one card
  const grouped = useMemo(() => {
    let list = operations;
    if (searchQuery?.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((operation) => {
        const customer = operation.debt?.customer;
        return (customer?.name || '').toLowerCase().includes(q) ||
          (customer?.store_name || '').toLowerCase().includes(q) ||
          (customer?.phone || '').includes(q);
      });
    }

    const byCustomer = new Map<string, { operations: TodayDebtCollectionOperation[]; totalCollected: number; seenDebtIds: Set<string>; totalRemaining: number; customer: any; latestAt: string }>();
    for (const op of list) {
      const custId = op.debt?.customer_id || (op.debt?.customer as any)?.id || op.id;
      const debtId = op.debt_id || op.id;
      const existing = byCustomer.get(custId);
      const collected = Number(op.amount_collected || 0);
      const remaining = Number(op.debt?.remaining_amount || 0);
      if (existing) {
        existing.operations.push(op);
        existing.totalCollected += collected;
        // Only count remaining once per unique debt
        if (!existing.seenDebtIds.has(debtId)) {
          existing.seenDebtIds.add(debtId);
          existing.totalRemaining += remaining;
        }
        if (op.created_at > existing.latestAt) {
          existing.latestAt = op.created_at;
          existing.customer = op.debt?.customer || existing.customer;
        }
      } else {
        byCustomer.set(custId, {
          operations: [op],
          totalCollected: collected,
          seenDebtIds: new Set([debtId]),
          totalRemaining: remaining,
          customer: op.debt?.customer,
          latestAt: op.created_at,
        });
      }
    }

    return Array.from(byCustomer.values()).sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
  }, [operations, searchQuery]);

  if (grouped.length === 0) {
    return <div className="p-6 text-center text-sm text-muted-foreground">{searchQuery?.trim() ? 'لا توجد نتائج' : emptyMessage}</div>;
  }

  return (
    <div className="space-y-2 p-2">
      {grouped.map((group, idx) => {
        const customer = group.customer;
        const primaryOp = group.operations[0];

        return (
          <Card key={primaryOp.id} className="overflow-hidden">
            <button className="w-full px-3 py-2 text-right hover:bg-muted/20 transition-colors" onClick={() => onOpenDetails(primaryOp)}>
              <div className="grid grid-cols-2 grid-rows-2 gap-x-3 items-center">
                <div className="text-left row-start-1 col-start-2" dir="ltr">
                  <span className="text-sm font-black text-green-600">{group.totalCollected.toLocaleString()} DA</span>
                </div>
                <div className="min-w-0 row-start-1 col-start-1">
                  <span className="text-sm font-bold text-foreground truncate block">{customer?.store_name || customer?.name || '—'}</span>
                </div>
                <div className="text-left row-start-2 col-start-2" dir="ltr">
                  {group.totalRemaining > 0 && (
                    <span className="text-xs font-bold text-red-500">{group.totalRemaining.toLocaleString()} DA</span>
                  )}
                </div>
                <div className="min-w-0 row-start-2 col-start-1">
                  <span className="text-xs text-muted-foreground truncate block">{customer?.name || '—'}</span>
                </div>
              </div>
            </button>
          </Card>
        );
      })}
    </div>
  );
};

// Reusable DebtList component
const DebtList: React.FC<{ debts: DueDebt[]; onCollect: (d: DueDebt) => void; onVisitNoPayment: (d: DueDebt) => void; onClosed: (d: DueDebt) => void; onUnavailable: (d: DueDebt) => void; onDebtRefused?: (d: DueDebt) => void; emptyMessage: string; searchQuery?: string; timeMap?: Map<string, string>; allDebts?: DueDebt[]; allCollections?: any[] }> = ({ debts, onCollect, onVisitNoPayment, onClosed, onUnavailable, onDebtRefused, emptyMessage, searchQuery, timeMap, allDebts, allCollections }) => {
  const filtered = useMemo(() => {
    let list = debts;
    if (searchQuery?.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(d => {
        const cust = d.customer as any;
        return (cust?.name || '').toLowerCase().includes(q) ||
          (cust?.store_name || '').toLowerCase().includes(q) ||
          (cust?.phone || '').includes(q);
      });
    }
    if (timeMap && timeMap.size > 0) {
      list = [...list].sort((a, b) => {
        const tA = timeMap.get(a.id) || '';
        const tB = timeMap.get(b.id) || '';
        return tB.localeCompare(tA);
      });
    }
    return list;
  }, [debts, searchQuery, timeMap]);

  const [openDebtId, setOpenDebtId] = useState<string | null>(null);

  if (filtered.length === 0) {
    return <div className="p-6 text-center text-sm text-muted-foreground">{searchQuery?.trim() ? 'لا توجد نتائج' : emptyMessage}</div>;
  }

  return (
    <div className="divide-y pb-16">
      {filtered.map(debt => {
        // Visual distinction: document-based (check/virmo/virsmo) vs cash-based
        const paymentType = String((debt as any).collection_type || '').toLowerCase();
        const notes = String(debt.notes || '').toLowerCase();
        const isDocumentBased = /شيك|cheque|check|فيرمو|virmo|virsmo|فيرسمو/.test(notes) || /شيك|cheque|check|فيرمو|virmo|virsmo|فيرسمو/.test(paymentType);
        const isCashBased = /كاش|cash|فاتوره|facture|اسباس|espace|باسم/.test(notes) || /كاش|cash|فاتوره|facture|اسباس|espace|باسم/.test(paymentType);
        const borderClass = isDocumentBased ? 'border-r-4 border-r-purple-500 bg-purple-50/30' : isCashBased ? 'border-r-4 border-r-emerald-500 bg-emerald-50/30' : '';
        
        const isOpen = openDebtId === debt.id;
        return (
        <Collapsible key={debt.id} open={isOpen} onOpenChange={(val) => setOpenDebtId(val ? debt.id : null)}>
        <div className={`p-3 hover:bg-muted/50 transition-colors ${borderClass}`}>
          <div className="flex items-center gap-1">
          <button className="flex-1 text-right min-w-0" onClick={() => onCollect(debt)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <CustomerSummary
                  customer={{
                    name: (debt.customer as any)?.name,
                    store_name: (debt.customer as any)?.store_name,
                    customer_type: (debt.customer as any)?.customer_type,
                    phone: (debt.customer as any)?.phone,
                    wilaya: (debt.customer as any)?.wilaya,
                  }}
                  compact
                  showAvatar={false}
                  showMeta={false}
                  badges={
                    <ClientTrustBadge
                      trust={computeClientTrustScore({
                        totalDebt: Number(debt.total_amount || 0),
                        paidAmount: Number(debt.paid_amount || 0),
                        noCollectionVisits: 0,
                        paymentVisitNumber: 1,
                      })}
                      compact
                    />
                  }
                />
                {isDocumentBased && <Badge className="text-[8px] px-1 h-3.5 bg-purple-100 text-purple-700 border-0 shrink-0"><FileText className="w-2.5 h-2.5 mr-0.5" />مستند</Badge>}
                {isCashBased && <Badge className="text-[8px] px-1 h-3.5 bg-emerald-100 text-emerald-700 border-0 shrink-0"><Banknote className="w-2.5 h-2.5 mr-0.5" />كاش</Badge>}
              </div>
              <span className="text-destructive font-bold">{Number(debt.remaining_amount).toLocaleString()} DA</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{debt.due_date ? format(new Date(debt.due_date + 'T00:00:00'), 'dd/MM/yyyy') : '—'}</span>
              {(debt.customer as any)?.phone && <span>• {(debt.customer as any).phone}</span>}
              {timeMap?.has(debt.id) && (
                <span className="flex items-center gap-0.5 text-[10px]">
                  ⏰ {format(new Date(timeMap.get(debt.id)!), 'HH:mm')}
                </span>
              )}
            </div>
          </button>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className={`h-7 w-7 shrink-0 rounded-full ${isOpen ? 'bg-destructive text-white' : 'bg-green-600 text-black'}`}>
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="flex items-center gap-2 mt-1.5 px-2 py-1 bg-muted/30 rounded text-xs text-muted-foreground flex-wrap">
              {(debt.customer as any)?.name && <span className="font-medium text-foreground">👤 {(debt.customer as any).name}</span>}
              {(debt.customer as any)?.phone && (
                <a href={`tel:${(debt.customer as any).phone}`} className="flex items-center gap-0.5 text-primary" onClick={e => e.stopPropagation()}>
                  <Phone className="w-3 h-3" />
                  {(debt.customer as any).phone}
                </a>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1.5 justify-end flex-wrap">
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-0.5 text-orange-600" onClick={(e) => { e.stopPropagation(); onVisitNoPayment(debt); }}>
                <Eye className="w-3 h-3" />
                زيارة بدون دفع
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-0.5 text-green-600" onClick={(e) => { e.stopPropagation(); onCollect(debt); }}>
                <Landmark className="w-3 h-3" />
                تحصيل
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-0.5 text-red-600" onClick={(e) => { e.stopPropagation(); onClosed(debt); }}>
                <DoorClosed className="w-3 h-3" />
                مغلق
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-0.5 text-gray-600" onClick={(e) => { e.stopPropagation(); onUnavailable(debt); }}>
                <UserX className="w-3 h-3" />
                غير متاح
              </Button>
              {onDebtRefused && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-0.5 text-purple-600" onClick={(e) => { e.stopPropagation(); onDebtRefused(debt); }}>
                  <BanknoteIcon className="w-3 h-3" />
                  رفض الدين
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </div>
        </Collapsible>
        );
      })}
    </div>
  );
};

export default TodayCustomersDialog;




