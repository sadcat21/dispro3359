import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderItem, OrderWithDetails, OrderStatus } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { isAdminRole } from '@/lib/utils';
import { CANCELLED_ORDER_DEBT_NOTE, RESUMED_ORDER_DEBT_NOTE } from '@/constants/debts';
import { recordSaleTracking } from '@/utils/salesTracking';

export const useOrders = () => {
  const { workerId, role, activeBranch } = useAuth();

  useRealtimeSubscription(
    'orders-realtime',
    [{ table: 'orders' }, { table: 'order_items' }],
    [['orders'], ['my-orders'], ['assigned-orders'], ['order-items']],
    !!workerId
  );

  return useQuery({
    queryKey: ['orders', workerId, role, activeBranch?.id],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          customer:customers(*),
          created_by_worker:workers!orders_created_by_fkey(id, full_name, username),
          assigned_worker:workers!orders_assigned_worker_id_fkey(id, full_name, username)
        `)
        .order('created_at', { ascending: false });

      if (isAdminRole(role) && activeBranch) {
        query = query.or(`branch_id.eq.${activeBranch.id},branch_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as OrderWithDetails[];
    },
    enabled: !!workerId,
  });
};

export const useMyOrders = () => {
  const { workerId } = useAuth();

  return useQuery({
    queryKey: ['my-orders', workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(*),
          assigned_worker:workers!orders_assigned_worker_id_fkey(id, full_name, username)
        `)
        .eq('created_by', workerId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OrderWithDetails[];
    },
    enabled: !!workerId,
  });
};

export const useAssignedOrders = () => {
  const { workerId, role, activeBranch } = useAuth();

  return useQuery({
    queryKey: ['assigned-orders', workerId, role, activeBranch?.id],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          customer:customers(*, sector:sectors(id, name, name_fr), zone:sector_zones(id, name, name_fr)),
          created_by_worker:workers!orders_created_by_fkey(id, full_name, username),
          assigned_worker:workers!orders_assigned_worker_id_fkey(id, full_name, username)
        `)
        .order('created_at', { ascending: false });

      if (isAdminRole(role)) {
        if (activeBranch) {
          query = query.or(`branch_id.eq.${activeBranch.id},branch_id.is.null`);
        }
      } else {
        // Include orders assigned to this worker OR created by this worker
        // (even if unassigned or assigned to someone else)
        query = query.or(`assigned_worker_id.eq.${workerId!},created_by.eq.${workerId!}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const orders = data as OrderWithDetails[];

      // For workers: hide delivered orders that were accounted for
      if (role !== 'admin' && role !== 'branch_admin' && workerId) {
        const { data: lastSession } = await supabase
          .from('accounting_sessions')
          .select('period_end')
          .eq('worker_id', workerId)
          .eq('status', 'completed')
          .order('period_end', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastSession?.period_end) {
          const cutoff = new Date(lastSession.period_end);
          return orders.filter(order => {
            // Hide delivered and cancelled orders created before the accounting cutoff
            if (order.status === 'delivered' || order.status === 'cancelled') {
              return new Date(order.created_at) > cutoff;
            }
            return true;
          });
        } else {
          // No session yet: still hide cancelled orders
          return orders.filter(order => order.status !== 'cancelled');
        }
      }

      return orders;
    },
    enabled: !!workerId,
  });
};

export const useOrderItems = (orderId: string | null) => {
  return useQuery({
    queryKey: ['order-items', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          *,
          product:products(*)
        `)
        .eq('order_id', orderId);

      if (error) throw error;
      return data as (OrderItem & { product?: any })[];
    },
    enabled: !!orderId,
  });
};

export const useCreateOrder = () => {
  const queryClient = useQueryClient();
  const { workerId, activeBranch } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      customerId, 
      items, 
      notes, 
      deliveryDate,
      paymentType = 'with_invoice',
      invoicePaymentMethod,
      assignedWorkerId,
      totalAmount,
      prepaidAmount
    }: { 
      customerId: string; 
      items: { productId: string; quantity: number; unitPrice?: number; totalPrice?: number; giftQuantity?: number; giftPieces?: number; giftOfferId?: string; itemPaymentType?: string; itemInvoicePaymentMethod?: string | null; itemPriceSubType?: string; pricingUnit?: string; weightPerBox?: number | null; piecesPerBox?: number }[];
      notes?: string;
      deliveryDate?: string;
      paymentType?: 'with_invoice' | 'without_invoice';
      invoicePaymentMethod?: 'receipt' | 'check' | 'cash' | 'transfer' | null;
      assignedWorkerId?: string;
      totalAmount?: number;
      prepaidAmount?: number;
    }) => {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: customerId,
          created_by: workerId!,
          branch_id: activeBranch?.id || null,
          notes: notes || null,
          delivery_date: deliveryDate || null,
          payment_type: paymentType,
          invoice_payment_method: invoicePaymentMethod || null,
          status: assignedWorkerId ? 'assigned' : 'pending',
          assigned_worker_id: assignedWorkerId || null,
          total_amount: totalAmount || null,
          prepaid_amount: prepaidAmount || 0,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice || 0,
        total_price: item.totalPrice || 0,
        gift_quantity: item.giftQuantity || 0,
        gift_pieces: item.giftPieces || 0,
        gift_offer_id: item.giftOfferId || null,
        payment_type: item.itemPaymentType || null,
        invoice_payment_method: item.itemInvoicePaymentMethod || null,
        price_subtype: item.itemPriceSubType || null,
        pricing_unit: item.pricingUnit || 'box',
        weight_per_box: item.weightPerBox || null,
        pieces_per_box: item.piecesPerBox || null,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // إذا كانت الطلبية بفاتورة → أنشئ طلب موافقة في مسار الفواتير
      // (موافقة أولية من مدير الفرع ثم نهائية من مساعد المدير العام)
      if (paymentType === 'with_invoice') {
        const { error: invReqError } = await supabase
          .from('manual_invoice_requests')
          .insert({
            order_id: order.id,
            customer_id: customerId,
            worker_id: workerId!,
            branch_id: activeBranch?.id || null,
            status: 'pending_branch',
            payment_method: invoicePaymentMethod || null,
            products: items as any,
          } as any);

        if (invReqError) {
          console.warn('[useCreateOrder] فشل إنشاء طلب موافقة الفاتورة:', invReqError);
        }
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
      queryClient.invalidateQueries({ queryKey: ['branch-invoice-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['bm-kpis'] });
    },
  });
};

export const useAssignOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, workerId }: { orderId: string; workerId: string }) => {
      const { data, error } = await supabase
        .from('orders')
        .update({ 
          assigned_worker_id: workerId,
          status: 'assigned' as OrderStatus 
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
    },
  });
};

export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      // This hook only updates the order status.
      // Stock deduction for 'delivered' is handled exclusively by DeliverySaleDialog
      // to prevent duplicate deductions and ensure proper payment/debt tracking.
      if (status === 'delivered') {
        throw new Error('يجب استخدام نافذة التوصيل لتأكيد التسليم');
      }

      const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
    },
  });
};

export const useDeleteOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
    },
  });
};

export const useCancelOrder = () => {
  const queryClient = useQueryClient();
  const { workerId } = useAuth();

  return useMutation({
    mutationFn: async (orderId: string) => {
      // Fetch order + items + debt in parallel
      const [orderRes, itemsRes, debtRes] = await Promise.all([
        supabase.from('orders').select('id, assigned_worker_id, status, branch_id').eq('id', orderId).single(),
        supabase.from('order_items').select('product_id, quantity').eq('order_id', orderId),
        supabase.from('customer_debts').select('id, remaining_amount, status').eq('order_id', orderId).maybeSingle(),
      ]);

      if (orderRes.error) throw orderRes.error;
      const order = orderRes.data;
      const orderItems = itemsRes.data;
      const debt = debtRes.data;

      // Build all parallel mutations
      const mutations: PromiseLike<any>[] = [];

      if (order.status === 'delivered' && order.assigned_worker_id && orderItems?.length) {
        // Get all worker stock in one query
        const { data: workerStocks } = await supabase
          .from('worker_stock')
          .select('id, product_id, quantity')
          .eq('worker_id', order.assigned_worker_id)
          .in('product_id', orderItems.map(i => i.product_id));

        const stockMap = new Map((workerStocks || []).map(ws => [ws.product_id, ws]));

        for (const item of orderItems) {
          const ws = stockMap.get(item.product_id);
          if (ws) {
            mutations.push(
              supabase.from('worker_stock').update({ quantity: ws.quantity + item.quantity }).eq('id', ws.id)
            );
          }
          mutations.push(
            supabase.from('stock_movements').delete().eq('order_id', orderId).eq('product_id', item.product_id).eq('movement_type', 'delivery')
          );
        }
      }

      if (debt && debt.status !== 'paid') {
        mutations.push(
          supabase.from('customer_debts').update({ status: 'cancelled', remaining_amount: 0, paid_amount: 0, notes: CANCELLED_ORDER_DEBT_NOTE }).eq('id', debt.id)
        );
      }

      // Clean up sales/offer ledgers so cancelled order disappears from
      // achievements, promos and pending-offer confirmations.
      mutations.push(
        (supabase as any).from('sales_tracking').delete().eq('order_id', orderId)
      );
      mutations.push(
        (supabase as any).from('promos').delete().eq('order_id', orderId)
      );
      // Soft-mark pending_offer_confirmations so we can restore the original
      // state on resume (cancelled_pending vs cancelled_confirmed). The offers
      // tab queries filter by status='pending'/'confirmed' so these are
      // hidden until the order is resumed.
      mutations.push(
        (supabase as any).from('pending_offer_confirmations').update({ status: 'cancelled_pending' }).eq('order_id', orderId).eq('status', 'pending')
      );
      mutations.push(
        (supabase as any).from('pending_offer_confirmations').update({ status: 'cancelled_confirmed' }).eq('order_id', orderId).eq('status', 'confirmed')
      );

      // Update order status
      mutations.push(
        supabase.from('orders').update({ status: 'cancelled' as OrderStatus }).eq('id', orderId).select().single()
      );

      const results = await Promise.all(mutations);
      const orderResult = results[results.length - 1];
      if (orderResult.error) throw orderResult.error;
      return orderResult.data;
    },
    onSuccess: () => {
      // Invalidate all related queries in parallel
      const keys = ['orders', 'my-orders', 'assigned-orders', 'my-worker-stock', 'worker-truck-stock', 'customer-debts', 'order-debt-details', 'worker-liability', 'all-workers-liability', 'achievements-data', 'sales-tracking', 'worker-achievements', 'promos', 'my-promos', 'my-achievements-page'];
      keys.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });
};

export const useResumeOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      // Fetch order + items in parallel
      const [orderRes, itemsRes] = await Promise.all([
        supabase.from('orders').select('id, assigned_worker_id, status, branch_id, customer_id, total_amount, payment_status, partial_amount, payment_type, invoice_payment_method, customer:customers(name), assigned_worker:workers!orders_assigned_worker_id_fkey(full_name), branch:branches(name)').eq('id', orderId).single(),
        supabase.from('order_items').select('id, product_id, quantity, gift_quantity, gift_pieces, gift_offer_id, unit_price, total_price, pieces_per_box, product:products(name)').eq('order_id', orderId),
      ]);

      if (orderRes.error) throw orderRes.error;
      const order = orderRes.data as any;
      if (order.status !== 'cancelled') throw new Error('الطلبية ليست ملغاة');
      const orderItems = itemsRes.data as any[] | null;

      const mutations: PromiseLike<any>[] = [];

      // Deduct products from worker stock in parallel
      if (order.assigned_worker_id && orderItems?.length) {
        const { data: workerStocks } = await supabase
          .from('worker_stock')
          .select('id, product_id, quantity')
          .eq('worker_id', order.assigned_worker_id)
          .in('product_id', orderItems.map(i => i.product_id));

        const stockMap = new Map((workerStocks || []).map(ws => [ws.product_id, ws]));

        for (const item of orderItems) {
          const ws = stockMap.get(item.product_id);
          if (ws) {
            mutations.push(
              supabase.from('worker_stock').update({ quantity: Math.max(0, ws.quantity - item.quantity) }).eq('id', ws.id)
            );
          }
          mutations.push(
            supabase.from('stock_movements').insert({
              product_id: item.product_id,
              branch_id: order.branch_id,
              quantity: item.quantity,
              movement_type: 'delivery',
              status: 'approved',
              created_by: order.assigned_worker_id,
              worker_id: order.assigned_worker_id,
              order_id: orderId,
              notes: 'استئناف طلبية ملغاة',
            })
          );
        }
      }

      // Restore debt
      const totalAmount = Number(order.total_amount || 0);
      const partialAmount = Number(order.partial_amount || 0);
      const paymentStatus = String(order.payment_status || '').toLowerCase();

      // Determine paid and remaining amounts
      let paidAmount = totalAmount;
      let debtAmount = 0;

      if (['pending', 'payment_pending', 'no_payment', 'credit'].includes(paymentStatus)) {
        paidAmount = 0;
        debtAmount = totalAmount;
      } else if (['partial', 'payment_partial'].includes(paymentStatus)) {
        paidAmount = partialAmount;
        debtAmount = Math.max(0, totalAmount - partialAmount);
      }

      if (debtAmount > 0 && order.customer_id && order.assigned_worker_id) {
        const { data: existingDebt } = await supabase
          .from('customer_debts')
          .select('id')
          .eq('order_id', orderId)
          .maybeSingle();

        if (existingDebt) {
          mutations.push(
            supabase.from('customer_debts').update({
              status: debtAmount === totalAmount ? 'active' : 'partially_paid',
              total_amount: totalAmount,
              paid_amount: paidAmount,
              remaining_amount: debtAmount,
              notes: RESUMED_ORDER_DEBT_NOTE,
            }).eq('id', existingDebt.id)
          );
        } else {
          mutations.push(
            supabase.from('customer_debts').insert({
              customer_id: order.customer_id,
              order_id: orderId,
              worker_id: order.assigned_worker_id,
              branch_id: order.branch_id,
              total_amount: totalAmount,
              paid_amount: paidAmount,
              remaining_amount: debtAmount,
              status: debtAmount === totalAmount ? 'active' : 'partially_paid',
              notes: RESUMED_ORDER_DEBT_NOTE,
            })
          );
        }
      }

      // Restore pending_offer_confirmations from prior cancel state.
      // - cancelled_confirmed → confirmed (no re-approval needed).
      // - cancelled_pending   → pending + note that this came from a recovered
      //   cancelled sale and was never confirmed before cancellation.
      const RESUMED_PENDING_NOTE = 'هذا العرض من بيع مستعاد، لم يكتمل تأكيده قبل الإلغاء';
      const { data: priorPending } = await (supabase as any)
        .from('pending_offer_confirmations')
        .select('id, order_item_id, offer_id, product_id, status')
        .eq('order_id', orderId)
        .in('status', ['cancelled_pending', 'cancelled_confirmed']);

      const restoredKeys = new Set<string>();
      const keyOf = (oi: string | null, off: string | null, pid: string) => `${oi || ''}|${off || ''}|${pid}`;
      for (const row of (priorPending || []) as any[]) {
        restoredKeys.add(keyOf(row.order_item_id, row.offer_id, row.product_id));
        if (row.status === 'cancelled_confirmed') {
          mutations.push(
            (supabase as any).from('pending_offer_confirmations')
              .update({ status: 'confirmed' })
              .eq('id', row.id)
          );
        } else {
          mutations.push(
            (supabase as any).from('pending_offer_confirmations')
              .update({ status: 'pending', notes: RESUMED_PENDING_NOTE })
              .eq('id', row.id)
          );
        }
      }

      // Restore sales_tracking from items. For deferred offers whose pending
      // record we just restored, skip recordPendingOfferConfirmation by clearing
      // offerId so recordSaleTracking treats them as immediate (sales_tracking
      // already excludes the gift portion via giftBoxes=0). For deferred items
      // without a prior pending record, fall back to the normal flow which
      // creates a fresh pending entry.
      if (orderItems?.length) {
        try {
          await recordSaleTracking({
            source: 'delivery_sale',
            orderId: order.id,
            branchId: order.branch_id || null,
            branchName: order.branch?.name || null,
            workerId: order.assigned_worker_id || null,
            workerName: order.assigned_worker?.full_name || null,
            customerId: order.customer_id || null,
            customerName: order.customer?.name || null,
            notes: 'استئناف طلبية ملغاة',
            items: orderItems.map((it: any) => {
              const hasRestored = restoredKeys.has(keyOf(it.id, it.gift_offer_id, it.product_id));
              return {
                productId: it.product_id,
                productName: it.product?.name || null,
                orderItemId: it.id || null,
                quantity: Number(it.quantity || 0),
                // If the prior pending row was restored, zero out gift here so
                // recordSaleTracking does not insert a duplicate pending row.
                giftBoxes: hasRestored ? 0 : Number(it.gift_quantity || 0),
                giftPieces: hasRestored ? 0 : Number(it.gift_pieces || 0),
                piecesPerBox: Number(it.pieces_per_box || 20),
                unitPrice: Number(it.unit_price || 0),
                totalPrice: Number(it.total_price || 0),
                offerId: hasRestored ? null : (it.gift_offer_id || null),
              };
            }),
          });
        } catch (e) { console.warn('[useResumeOrder] recordSaleTracking failed', e); }
      }

      // Update order status
      mutations.push(
        supabase.from('orders').update({ status: 'delivered' as OrderStatus }).eq('id', orderId).select().single()
      );

      const results = await Promise.all(mutations);
      const orderResult = results[results.length - 1];
      if (orderResult.error) throw orderResult.error;
      return orderResult.data;
    },
    onSuccess: () => {
      const keys = ['orders', 'my-orders', 'assigned-orders', 'my-worker-stock', 'worker-truck-stock', 'customer-debts', 'order-debt-details', 'worker-liability', 'all-workers-liability', 'achievements-data', 'sales-tracking', 'worker-achievements', 'promos', 'my-promos', 'my-achievements-page', 'pending-offer-confirmations'];
      keys.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });
};