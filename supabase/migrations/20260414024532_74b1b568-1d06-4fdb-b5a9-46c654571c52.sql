
CREATE INDEX IF NOT EXISTS idx_orders_assigned_worker_status ON public.orders(assigned_worker_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created_by_status ON public.orders(created_by, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON public.orders(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_accounting_sessions_worker_status ON public.accounting_sessions(worker_id, status, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_session_items_session ON public.accounting_session_items(session_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_product_branch ON public.warehouse_stock(product_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_worker_stock_product_branch ON public.worker_stock(product_id, branch_id);
