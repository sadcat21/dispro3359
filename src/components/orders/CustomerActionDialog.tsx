import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import CustomerPickerDialog from './CustomerPickerDialog';
import CustomerSummary from '@/components/customers/CustomerSummary';
import {
    ShoppingCart, Banknote, Truck, Ban, AlertTriangle
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Customer, Sector } from '@/types/database';
import { toast } from 'sonner';

interface CustomerActionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOrder?: (customer: Customer) => void;
    onSale?: (customer: Customer) => void;
    onDelivery?: (customer: Customer) => void;
    onVisitOnly?: (customer: Customer) => void;
    allowedActions?: ('order' | 'sale' | 'delivery' | 'visit')[];
    /** When set, selecting a customer immediately triggers this action without showing action buttons */
    directAction?: 'order' | 'sale' | 'delivery' | 'visit';
}

const CustomerActionDialog: React.FC<CustomerActionDialogProps> = ({
    open,
    onOpenChange,
    onOrder,
    onSale,
    onDelivery,
    onVisitOnly,
    allowedActions = ['order', 'sale', 'delivery', 'visit'],
    directAction,
}) => {
    const { t, dir } = useLanguage();
    const { activeBranch, activeRole, user } = useAuth();
    const effectiveBranchId = activeBranch?.id || activeRole?.branch_id || user?.branch_id || null;

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [pendingOrders, setPendingOrders] = useState<Array<{ id: string; total_amount: number | null; status: string }>>([]);
    const [checkingOrders, setCheckingOrders] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => {
        if (open) {
            fetchCustomers();
            fetchSectors();
        } else {
            setSelectedCustomer(null);
            setPendingOrders([]);
        }
    }, [open, effectiveBranchId]);

    const fetchCustomers = async () => {
        setIsLoading(true);
        try {
            let query = supabase.from('customers').select('*').eq('status', 'active').order('name');
            if (effectiveBranchId) {
                query = query.or(`branch_id.eq.${effectiveBranchId},branch_id.is.null`);
            }
            // Strict wilaya gate: customers must belong to the active branch's wilaya
            const branchWilaya = activeBranch?.wilaya || null;
            if (branchWilaya) {
                query = query.or(`wilaya.eq."${branchWilaya}",wilaya.is.null`);
            }
            const { data, error } = await query;
            if (error) throw error;
            setCustomers(data || []);
        } catch (error) {
            console.error('Error fetching customers:', error);
            toast.error(t('orders.fetch_error'));
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSectors = async () => {
        try {
            let query = supabase.from('sectors').select('*').order('name');
            if (effectiveBranchId) {
                query = query.eq('branch_id', effectiveBranchId);
            }
            const { data, error } = await query;
            if (error) throw error;
            setSectors((data || []) as Sector[]);
        } catch (error) {
            console.error('Error fetching sectors:', error);
        }
    };

    const todayBounds = () => {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(); end.setHours(23, 59, 59, 999);
        return { start: start.toISOString(), end: end.toISOString() };
    };

    const fetchPendingOrdersForCustomer = async (customerId: string) => {
        const { start, end } = todayBounds();
        const { data, error } = await supabase
            .from('orders')
            .select('id, total_amount, status')
            .eq('customer_id', customerId)
            .not('status', 'in', '("delivered","cancelled")')
            .gte('created_at', start)
            .lte('created_at', end)
            .order('created_at', { ascending: false });
        if (error) {
            console.warn('pending orders check failed', error);
            return [];
        }
        return (data || []) as Array<{ id: string; total_amount: number | null; status: string }>;
    };

    const cancelPendingOrders = async () => {
        if (!pendingOrders.length) return;
        setCancelling(true);
        try {
            const ids = pendingOrders.map((o) => o.id);
            const { error } = await supabase
                .from('orders')
                .update({ status: 'cancelled' as any })
                .in('id', ids);
            if (error) throw error;
            await (supabase as any)
                .from('pending_offer_confirmations')
                .delete()
                .in('order_id', ids)
                .eq('status', 'pending');
        } catch (e) {
            console.error(e);
            toast.error('تعذر إلغاء الطلبية الموجودة');
            throw e;
        } finally {
            setCancelling(false);
        }
    };

    const handleAction = async (action: 'order' | 'sale' | 'delivery' | 'visit') => {
        if (!selectedCustomer) return;
        if (action === 'sale' && pendingOrders.length > 0) {
            try { await cancelPendingOrders(); } catch { return; }
            toast.success('تم إلغاء الطلبية الموجودة، سيتم تسجيل بيع مباشر جديد');
        }
        switch (action) {
            case 'order': onOrder?.(selectedCustomer); break;
            case 'sale': onSale?.(selectedCustomer); break;
            case 'delivery': onDelivery?.(selectedCustomer); break;
            case 'visit': onVisitOnly?.(selectedCustomer); break;
        }
        onOpenChange(false);
    };

    const handleCustomerSelect = async (customer: Customer) => {
        setCheckingOrders(true);
        const orders = await fetchPendingOrdersForCustomer(customer.id);
        setCheckingOrders(false);
        setPendingOrders(orders);

        const hasPending = orders.length > 0;
        const interceptDirect = directAction && hasPending && (directAction === 'sale' || directAction === 'delivery');

        if (directAction && !interceptDirect) {
            switch (directAction) {
                case 'order': onOrder?.(customer); break;
                case 'sale': onSale?.(customer); break;
                case 'delivery': onDelivery?.(customer); break;
                case 'visit': onVisitOnly?.(customer); break;
            }
            onOpenChange(false);
            return;
        }
        setSelectedCustomer(customer);
    };

    if (open && !selectedCustomer) {
        return (
            <CustomerPickerDialog
                open={open}
                onOpenChange={onOpenChange}
                customers={customers}
                sectors={sectors}
                isLoading={isLoading || checkingOrders}
                onSelect={handleCustomerSelect}
            />
        );
    }

    // Once customer is selected, show action buttons
    return (
        <Dialog open={open && !!selectedCustomer} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md" dir={dir}>
                <div className="space-y-4 py-2">
                    {/* Selected customer info */}
                    <div className="p-3 bg-muted/50 rounded-lg">
                        <CustomerSummary
                            customer={{
                                name: selectedCustomer?.name,
                                store_name: selectedCustomer?.store_name,
                                customer_type: selectedCustomer?.customer_type,
                                sector_name: selectedCustomer?.sector_id
                                    ? sectors.find((s) => s.id === selectedCustomer?.sector_id)?.name
                                    : undefined,
                                phone: selectedCustomer?.phone,
                                wilaya: selectedCustomer?.wilaya,
                            }}
                            avatarSize="md"
                            rightSlot={(
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => setSelectedCustomer(null)}
                                >
                                    تغيير
                                </Button>
                            )}
                        />
                        {/*
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm">{selectedCustomer?.store_name || selectedCustomer?.name}</p>
                            <p className="text-xs text-muted-foreground">
                                {[selectedCustomer?.store_name ? selectedCustomer?.name : null, selectedCustomer?.phone].filter(Boolean).join(' • ')}
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => setSelectedCustomer(null)}
                        >
                            تغيير
                        </Button>
                        */}
                    </div>

                    {/* Pending order alert */}
                    {pendingOrders.length > 0 && (
                        <div className="rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-3">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="text-sm">
                                    <p className="font-bold text-amber-900 dark:text-amber-200">
                                        لهذا الزبون {pendingOrders.length} طلبية مفتوحة اليوم
                                    </p>
                                    <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mt-0.5">
                                        أكمل التوصيل، أو سجّل بيعاً مباشراً جديداً (سيُلغى الطلب الحالي تلقائياً).
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {allowedActions.includes('delivery') && (
                                    <Button
                                        onClick={() => handleAction('delivery')}
                                        disabled={cancelling}
                                        className="h-12 gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                        <Truck className="w-5 h-5" />
                                        توصيل الطلبية الموجودة
                                    </Button>
                                )}
                                {allowedActions.includes('sale') && (
                                    <Button
                                        onClick={() => handleAction('sale')}
                                        disabled={cancelling}
                                        variant="outline"
                                        className="h-12 gap-2 border-amber-600 text-amber-900 hover:bg-amber-100 dark:text-amber-100"
                                    >
                                        <Banknote className="w-5 h-5" />
                                        بيع مباشر جديد (إلغاء الطلب)
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Action buttons */}
                    {pendingOrders.length === 0 && (
                        <div className="grid grid-cols-1 gap-3">
                            {allowedActions.includes('order') && (
                                <Button onClick={() => handleAction('order')} className="h-14 text-lg gap-3" variant="default">
                                    <ShoppingCart className="w-6 h-6" />
                                    {t('orders.new')}
                                </Button>
                            )}
                            {allowedActions.includes('sale') && (
                                <Button onClick={() => handleAction('sale')} className="h-14 text-lg gap-3 bg-green-600 hover:bg-green-700 text-white" variant="outline">
                                    <Banknote className="w-6 h-6" />
                                    {t('stock.direct_sale')}
                                </Button>
                            )}
                            {allowedActions.includes('delivery') && (
                                <Button onClick={() => handleAction('delivery')} className="h-14 text-lg gap-3 bg-blue-600 hover:bg-blue-700 text-white" variant="outline">
                                    <Truck className="w-6 h-6" />
                                    {t('deliveries.start_delivery')}
                                </Button>
                            )}
                            {allowedActions.includes('visit') && (
                                <Button onClick={() => handleAction('visit')} className="h-14 text-lg gap-3" variant="secondary">
                                    <Ban className="w-6 h-6" />
                                    {t('common.visit_only')}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CustomerActionDialog;
