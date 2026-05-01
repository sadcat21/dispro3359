-- ============================================================
-- Aroma2 Database Schema (public schema)
-- Run this in a fresh Supabase project's SQL editor.
-- ============================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'admin','worker','supervisor','branch_admin','project_manager',
    'accountant','admin_assistant','warehouse_manager','company_manager','internal_supervisor'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low','medium','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('todo','doing','done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_type AS ENUM ('task','request');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public."6666666666" (
  id uuid NOT NULL DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.accounting_session_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  item_type text NOT NULL,
  expected_amount numeric NOT NULL DEFAULT 0,
  actual_amount numeric NOT NULL DEFAULT 0,
  difference numeric,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.accounting_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  branch_id uuid,
  manager_id uuid NOT NULL,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'open'::text,
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  review_session_id uuid,
  is_treasury_posted boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  branch_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid,
  key text NOT NULL,
  value text NOT NULL,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  branch_id uuid,
  action_type text NOT NULL,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  latitude double precision,
  longitude double precision,
  distance_meters double precision,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.backup_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  backup_type text NOT NULL DEFAULT 'manual'::text,
  status text NOT NULL DEFAULT 'running'::text,
  total_rows integer DEFAULT 0,
  tables_count integer DEFAULT 0,
  table_details jsonb DEFAULT '{}'::jsonb,
  google_sheet_url text,
  google_sheet_id text,
  date_from timestamp with time zone,
  date_to timestamp with time zone,
  selected_tables public.text[],
  error_message text,
  triggered_by text DEFAULT 'system'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.branch_pallets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.branches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  wilaya text NOT NULL,
  address text,
  admin_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coin_exchange_returns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  amount numeric NOT NULL,
  received_by uuid NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coin_exchange_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid,
  manager_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  coin_amount numeric NOT NULL DEFAULT 0,
  returned_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric,
  status text NOT NULL DEFAULT 'active'::text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  last_read_at timestamp with time zone DEFAULT now(),
  is_muted boolean DEFAULT false,
  joined_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'direct'::text,
  name text,
  created_by uuid NOT NULL,
  branch_id uuid,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_message_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.custom_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name_ar text NOT NULL,
  description_ar text,
  is_system boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE TABLE IF NOT EXISTS public.customer_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid,
  username text NOT NULL,
  password_hash text NOT NULL,
  phone text NOT NULL,
  full_name text NOT NULL,
  address text,
  wilaya text,
  store_name text NOT NULL,
  business_type text,
  status text NOT NULL DEFAULT 'pending'::text,
  approved_by uuid,
  approved_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_approval_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  operation_type text NOT NULL,
  customer_id uuid,
  payload jsonb NOT NULL,
  requested_by uuid NOT NULL,
  branch_id uuid,
  status text NOT NULL DEFAULT 'pending'::text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  credit_type text NOT NULL DEFAULT 'financial'::text,
  amount numeric NOT NULL DEFAULT 0,
  product_id uuid,
  product_quantity integer DEFAULT 0,
  product_reason text,
  status text NOT NULL DEFAULT 'approved'::text,
  approved_by uuid,
  approved_at timestamp with time zone,
  rejection_reason text,
  order_id uuid,
  worker_id uuid NOT NULL,
  branch_id uuid,
  notes text,
  is_used boolean NOT NULL DEFAULT false,
  used_at timestamp with time zone,
  used_in_order_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_debts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  order_id uuid,
  worker_id uuid NOT NULL,
  branch_id uuid,
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric,
  status text NOT NULL DEFAULT 'active'::text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  due_date date,
  collection_type text DEFAULT 'none'::text,
  collection_amount numeric,
  collection_days public.text[]
);

CREATE TABLE IF NOT EXISTS public.customer_special_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  product_id uuid NOT NULL,
  special_price numeric NOT NULL,
  price_type text NOT NULL DEFAULT 'fixed'::text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  wilaya text,
  branch_id uuid,
  latitude double precision,
  longitude double precision,
  location_type text DEFAULT 'store'::text,
  is_trusted boolean DEFAULT false,
  trust_notes text,
  internal_name text,
  default_payment_type text DEFAULT 'without_invoice'::text,
  default_price_subtype text DEFAULT 'gros'::text,
  store_name text,
  sector_id uuid,
  sales_rep_name text,
  sales_rep_phone text,
  status text NOT NULL DEFAULT 'active'::text,
  pending_changes jsonb,
  name_fr text,
  zone_id uuid,
  store_name_fr text,
  customer_type text,
  is_registered boolean DEFAULT false,
  default_delivery_worker_id uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.debt_collections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  debt_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  collection_date date NOT NULL DEFAULT CURRENT_DATE,
  action text NOT NULL DEFAULT 'no_payment'::text,
  amount_collected numeric NOT NULL DEFAULT 0,
  payment_method text,
  next_due_date date,
  status text NOT NULL DEFAULT 'pending'::text,
  approved_by uuid,
  approved_at timestamp with time zone,
  rejection_reason text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.debt_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  debt_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash'::text,
  notes text,
  collected_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_route_sectors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL,
  sector_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_routes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  branch_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_collections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  collection_date date NOT NULL DEFAULT CURRENT_DATE,
  action text NOT NULL DEFAULT 'no_collection'::text,
  next_due_date date,
  status text NOT NULL DEFAULT 'pending'::text,
  approved_by uuid,
  approved_at timestamp with time zone,
  rejection_reason text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_points_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  task_id uuid,
  penalty_id uuid,
  points numeric NOT NULL DEFAULT 0,
  point_type text NOT NULL DEFAULT 'reward'::text,
  source_entity text,
  source_entity_id uuid,
  notes text,
  point_date date NOT NULL DEFAULT CURRENT_DATE,
  branch_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text DEFAULT 'Receipt'::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  name_fr text,
  name_en text,
  visible_to_roles public.text[]
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  branch_id uuid,
  category_id uuid NOT NULL,
  amount numeric NOT NULL,
  description text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_url text,
  status text NOT NULL DEFAULT 'pending'::text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  receipt_urls public.text[] DEFAULT '{}'::text[],
  payment_method text DEFAULT 'cash'::text
);

CREATE TABLE IF NOT EXISTS public.factory_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  factory_order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  product_quantity numeric NOT NULL DEFAULT 0,
  pallet_quantity numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  lot_number text,
  manufacturing_date date,
  manufacturing_time text,
  delivery_date date
);

CREATE TABLE IF NOT EXISTS public.factory_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_type text NOT NULL DEFAULT 'receiving'::text,
  branch_id uuid,
  status text NOT NULL DEFAULT 'pending'::text,
  notes text,
  created_by uuid,
  confirmed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  pallet_count integer DEFAULT 0,
  branch_approved_by uuid,
  branch_approved_at timestamp with time zone,
  assistant_approved_by uuid,
  assistant_approved_at timestamp with time zone,
  frozen_at timestamp with time zone,
  frozen_by uuid,
  rejection_note text,
  linked_receipt_id uuid
);

CREATE TABLE IF NOT EXISTS public.handover_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  handover_id uuid NOT NULL,
  order_id uuid,
  treasury_entry_id uuid,
  payment_method text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  customer_name text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loading_session_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  gift_quantity numeric NOT NULL DEFAULT 0,
  gift_unit text DEFAULT 'piece'::text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  surplus_quantity numeric NOT NULL DEFAULT 0,
  is_custom_load boolean NOT NULL DEFAULT false,
  custom_load_note text,
  previous_quantity numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.loading_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  manager_id uuid NOT NULL,
  branch_id uuid,
  status text NOT NULL DEFAULT 'open'::text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  unloading_details jsonb
);

CREATE TABLE IF NOT EXISTS public.manager_handovers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid,
  manager_id uuid NOT NULL,
  received_by uuid,
  payment_method text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  check_count integer DEFAULT 0,
  receipt_count integer DEFAULT 0,
  notes text,
  handover_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  cash_invoice1 numeric NOT NULL DEFAULT 0,
  cash_invoice2 numeric NOT NULL DEFAULT 0,
  checks_amount numeric NOT NULL DEFAULT 0,
  receipts_amount numeric NOT NULL DEFAULT 0,
  transfers_amount numeric NOT NULL DEFAULT 0,
  transfer_count integer DEFAULT 0,
  stamp_amount numeric NOT NULL DEFAULT 0,
  delivery_method text NOT NULL DEFAULT 'direct'::text,
  intermediary_name text,
  bank_transfer_reference text,
  bank_account_id uuid,
  receipt_image_url text,
  receiver_name text,
  unified_cash boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.manager_review_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  branch_id uuid,
  status text NOT NULL DEFAULT 'completed'::text,
  notes text,
  period_start timestamp with time zone,
  period_end timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.manager_treasury (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid,
  manager_id uuid NOT NULL,
  session_id uuid,
  source_type text NOT NULL DEFAULT 'accounting_session'::text,
  payment_method text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  check_number text,
  check_bank text,
  receipt_number text,
  transfer_reference text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  invoice_number text,
  check_date date,
  customer_name text,
  invoice_date date
);

CREATE TABLE IF NOT EXISTS public.manager_workers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

CREATE TABLE IF NOT EXISTS public.manual_invoice_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  branch_id uuid,
  products jsonb NOT NULL DEFAULT '[]'::jsonb,
  payment_method text,
  whatsapp_contact text,
  invoice_number text,
  status text NOT NULL DEFAULT 'sent'::text,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  received_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  branch_approved_by uuid,
  branch_approved_at timestamp with time zone,
  assistant_approved_by uuid,
  assistant_approved_at timestamp with time zone,
  order_id uuid,
  invoice_file_url text,
  invoice_file_name text,
  invoice_uploaded_at timestamp with time zone,
  invoice_uploaded_by uuid,
  created_by_role text,
  invoice_scope text DEFAULT 'public'::text,
  total_amount numeric DEFAULT 0,
  received_by_assistant_at timestamp with time zone,
  received_by_assistant_id uuid,
  merged_into_request_id uuid,
  merged_request_ids public.uuid[],
  is_merged_parent boolean DEFAULT false,
  postponed_at timestamp with time zone,
  postponed_by uuid
);

CREATE TABLE IF NOT EXISTS public.monthly_bonus_summary (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  month date NOT NULL,
  total_points numeric NOT NULL DEFAULT 0,
  reward_points numeric NOT NULL DEFAULT 0,
  penalty_points numeric NOT NULL DEFAULT 0,
  point_value numeric,
  bonus_amount numeric DEFAULT 0,
  capped_amount numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'::text,
  branch_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.navbar_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  tab_paths public.text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  event_type text NOT NULL,
  old_value text,
  new_value text,
  details jsonb,
  performed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  unit_price numeric DEFAULT 0,
  total_price numeric DEFAULT 0,
  gift_quantity integer NOT NULL DEFAULT 0,
  gift_offer_id uuid,
  payment_type text,
  invoice_payment_method text,
  price_subtype text,
  pricing_unit text DEFAULT 'box'::text,
  weight_per_box numeric,
  pieces_per_box integer,
  gift_pieces integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  created_by uuid NOT NULL,
  assigned_worker_id uuid,
  branch_id uuid,
  status text NOT NULL DEFAULT 'pending'::text,
  notes text,
  delivery_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  payment_type text DEFAULT 'with_invoice'::text,
  total_amount numeric DEFAULT 0,
  payment_status text DEFAULT 'pending'::text,
  partial_amount numeric,
  invoice_payment_method text,
  created_by_customer uuid,
  invoice_sent_at timestamp with time zone,
  invoice_number text,
  invoice_received_at timestamp with time zone,
  prepaid_amount numeric DEFAULT 0,
  document_status text DEFAULT 'none'::text,
  document_verification jsonb,
  check_due_date date,
  doc_collection_type text DEFAULT 'none'::text,
  doc_collection_days public.text[],
  doc_due_date date,
  postpone_count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.pallet_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  quantity integer NOT NULL,
  movement_type text NOT NULL,
  reference_id uuid,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pallet_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid,
  boxes_per_pallet integer NOT NULL DEFAULT 1,
  branch_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  boxes_per_layer integer NOT NULL DEFAULT 1,
  name text
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name_ar text NOT NULL,
  description_ar text,
  category text NOT NULL,
  resource text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pricing_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_offer_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL,
  min_quantity integer NOT NULL DEFAULT 1,
  max_quantity integer,
  min_quantity_unit text DEFAULT 'piece'::text,
  gift_quantity integer NOT NULL DEFAULT 1,
  gift_quantity_unit text DEFAULT 'piece'::text,
  gift_type text NOT NULL DEFAULT 'same_product'::text,
  gift_product_id uuid,
  discount_percentage numeric,
  worker_reward_type text DEFAULT 'none'::text,
  worker_reward_amount numeric DEFAULT 0,
  tier_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  discount_amount numeric,
  discount_prices jsonb,
  is_stackable boolean NOT NULL DEFAULT false,
  conditions jsonb
);

CREATE TABLE IF NOT EXISTS public.product_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  min_quantity integer NOT NULL DEFAULT 1,
  max_quantity integer,
  gift_quantity integer NOT NULL DEFAULT 0,
  gift_type text NOT NULL DEFAULT 'same_product'::text,
  gift_product_id uuid,
  discount_percentage numeric,
  worker_reward_type text DEFAULT 'fixed'::text,
  worker_reward_amount numeric DEFAULT 0,
  is_stackable boolean NOT NULL DEFAULT false,
  is_auto_apply boolean NOT NULL DEFAULT true,
  start_date date,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  branch_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  min_quantity_unit text DEFAULT 'piece'::text,
  gift_quantity_unit text DEFAULT 'piece'::text,
  condition_type text NOT NULL DEFAULT 'range'::text,
  discount_amount numeric,
  discount_prices jsonb
);

CREATE TABLE IF NOT EXISTS public.product_pricing_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  group_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_shortage_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  order_id uuid,
  worker_id uuid NOT NULL,
  branch_id uuid,
  quantity_needed integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending'::text,
  notes text,
  marked_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  pieces_per_box integer NOT NULL DEFAULT 1,
  price_super_gros numeric DEFAULT 0,
  price_gros numeric DEFAULT 0,
  price_invoice numeric DEFAULT 0,
  price_retail numeric DEFAULT 0,
  price_no_invoice numeric DEFAULT 0,
  pricing_unit text NOT NULL DEFAULT 'box'::text,
  weight_per_box numeric,
  allow_unit_sale boolean NOT NULL DEFAULT true,
  image_url text,
  sort_order integer DEFAULT 0,
  product_code text,
  app_name text,
  price_invoice_official numeric,
  allow_invoice_sale boolean NOT NULL DEFAULT true,
  allow_invoice2_sale boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.promo_split_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  split_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  allocated_quantity numeric NOT NULL DEFAULT 0,
  delivered_quantity numeric NOT NULL DEFAULT 0,
  gift_share numeric NOT NULL DEFAULT 0,
  gift_delivered boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promo_split_installments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  split_customer_id uuid NOT NULL,
  scheduled_date date NOT NULL,
  planned_quantity numeric NOT NULL DEFAULT 0,
  actual_quantity numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'::text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promo_splits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  offer_id uuid,
  product_id uuid NOT NULL,
  split_type text NOT NULL DEFAULT 'quantity_accumulation'::text,
  name text NOT NULL,
  target_quantity numeric NOT NULL DEFAULT 0,
  target_quantity_unit text NOT NULL DEFAULT 'box'::text,
  gift_quantity numeric NOT NULL DEFAULT 0,
  gift_quantity_unit text NOT NULL DEFAULT 'box'::text,
  adjusted_gift_quantity numeric,
  gift_product_id uuid,
  status text NOT NULL DEFAULT 'active'::text,
  notes text,
  branch_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  product_id uuid NOT NULL,
  vente_quantity integer NOT NULL,
  promo_date timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  gratuite_quantity integer NOT NULL DEFAULT 0,
  has_bonus boolean DEFAULT false,
  bonus_amount integer DEFAULT 0,
  offer_id uuid,
  offer_tier_id uuid,
  offer_detail text,
  gift_quantity_unit text NOT NULL DEFAULT 'piece'::text
);

CREATE TABLE IF NOT EXISTS public.quantity_price_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  min_quantity integer NOT NULL,
  max_quantity integer,
  tier_price numeric NOT NULL,
  price_type text NOT NULL DEFAULT 'unit_price'::text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.receipt_modifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL,
  modified_by uuid NOT NULL,
  modification_type text NOT NULL DEFAULT 'edit'::text,
  original_data jsonb NOT NULL,
  modified_data jsonb NOT NULL,
  changes_summary text,
  is_reviewed boolean NOT NULL DEFAULT false,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  receipt_number integer NOT NULL DEFAULT nextval('receipts_receipt_number_seq'::regclass),
  receipt_type text NOT NULL DEFAULT 'delivery'::text,
  order_id uuid,
  debt_id uuid,
  customer_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  branch_id uuid,
  customer_name text NOT NULL,
  customer_phone text,
  worker_name text NOT NULL,
  worker_phone text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  print_count integer NOT NULL DEFAULT 0,
  last_printed_at timestamp with time zone,
  is_modified boolean NOT NULL DEFAULT false,
  original_data jsonb,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reward_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid,
  point_value numeric NOT NULL DEFAULT 10,
  monthly_budget numeric NOT NULL DEFAULT 0,
  auto_percentage numeric NOT NULL DEFAULT 70,
  competition_percentage numeric NOT NULL DEFAULT 20,
  reserve_percentage numeric NOT NULL DEFAULT 10,
  minimum_threshold numeric NOT NULL DEFAULT 40,
  top1_bonus_pct numeric NOT NULL DEFAULT 50,
  top2_bonus_pct numeric NOT NULL DEFAULT 30,
  top3_bonus_pct numeric NOT NULL DEFAULT 20,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reward_disputes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  points_log_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_notes text,
  branch_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reward_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  target_worker_id uuid NOT NULL,
  notification_type text NOT NULL,
  title text NOT NULL,
  message text,
  is_read boolean NOT NULL DEFAULT false,
  related_entity_id uuid,
  branch_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reward_penalties (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_fr text,
  penalty_points numeric NOT NULL DEFAULT 0,
  trigger_event text,
  is_automatic boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  branch_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  applicable_roles public.text[]
);

CREATE TABLE IF NOT EXISTS public.reward_reserve_fund (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid,
  month date NOT NULL,
  carried_balance numeric NOT NULL DEFAULT 0,
  surplus_added numeric NOT NULL DEFAULT 0,
  used_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reward_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_fr text,
  category text NOT NULL DEFAULT 'sales'::text,
  data_source text NOT NULL DEFAULT 'visits'::text,
  condition_logic jsonb NOT NULL DEFAULT '{}'::jsonb,
  reward_points numeric NOT NULL DEFAULT 0,
  penalty_points numeric NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'daily'::text,
  is_cumulative boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  branch_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  applicable_roles public.text[]
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_ui_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL,
  element_type text NOT NULL,
  element_key text NOT NULL,
  is_hidden boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.sector_coverage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL,
  absent_worker_id uuid NOT NULL,
  substitute_worker_id uuid NOT NULL,
  coverage_type text NOT NULL DEFAULT 'full'::text,
  schedule_type text NOT NULL DEFAULT 'delivery'::text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  created_by uuid,
  branch_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  coverage_mode text NOT NULL DEFAULT 'merge'::text,
  approval_status text NOT NULL DEFAULT 'approved'::text,
  manager_approved_by uuid,
  manager_approved_at timestamp with time zone,
  system_approved_by uuid,
  system_approved_at timestamp with time zone,
  approval_notes text
);

CREATE TABLE IF NOT EXISTS public.sector_schedule_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  worker_type text NOT NULL,
  original_day text NOT NULL,
  new_day text NOT NULL,
  week_start date NOT NULL,
  is_permanent boolean NOT NULL DEFAULT false,
  created_by uuid,
  branch_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sector_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL,
  schedule_type text NOT NULL,
  day text NOT NULL,
  worker_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sector_zones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name_fr text
);

CREATE TABLE IF NOT EXISTS public.sectors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  branch_id uuid,
  visit_day_sales text,
  visit_day_delivery text,
  sales_worker_id uuid,
  delivery_worker_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  name_fr text,
  sector_type text NOT NULL DEFAULT 'prevente'::text
);

CREATE TABLE IF NOT EXISTS public.settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  branch_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shared_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  pdf_url text NOT NULL,
  pdf_path text NOT NULL,
  target_branch_id uuid,
  uploaded_by uuid,
  notes text,
  downloaded_at timestamp with time zone,
  downloaded_by uuid,
  printed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stamp_price_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  min_amount numeric NOT NULL,
  max_amount numeric,
  percentage numeric NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE TABLE IF NOT EXISTS public.stock_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  product_id uuid NOT NULL,
  min_quantity integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_confirmations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  operation_type text NOT NULL,
  worker_id uuid NOT NULL,
  manager_id uuid NOT NULL,
  branch_id uuid,
  status text NOT NULL DEFAULT 'pending'::text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  previous_items jsonb,
  source_session_id uuid,
  rejection_note text,
  amendment_note text,
  parent_confirmation_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  frozen_at timestamp with time zone,
  frozen_by uuid
);

CREATE TABLE IF NOT EXISTS public.stock_discrepancies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  product_id uuid NOT NULL,
  branch_id uuid,
  discrepancy_type text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  remaining_quantity numeric NOT NULL DEFAULT 0,
  price_per_unit numeric DEFAULT 0,
  total_value numeric DEFAULT 0,
  pricing_method text,
  source_session_id uuid,
  accounting_session_id uuid,
  status text NOT NULL DEFAULT 'pending'::text,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_disputes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid,
  raised_by uuid NOT NULL,
  warehouse_worker_id uuid NOT NULL,
  delivery_worker_id uuid NOT NULL,
  session_type text NOT NULL DEFAULT 'loading'::text,
  session_id uuid,
  product_id uuid,
  product_name text,
  warehouse_qty numeric NOT NULL DEFAULT 0,
  delivery_qty numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'::text,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  guilty_worker_id uuid,
  guilty_accepted boolean DEFAULT false,
  guilty_accepted_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid,
  product_id uuid NOT NULL,
  movement_type text NOT NULL,
  quantity numeric NOT NULL,
  worker_id uuid,
  order_id uuid,
  receipt_id uuid,
  return_reason text,
  notes text,
  status text NOT NULL DEFAULT 'approved'::text,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_receipt_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity numeric NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  pallet_quantity integer NOT NULL DEFAULT 0,
  lot_number text,
  manufacturing_date date,
  manufacturing_time text,
  delivery_date date
);

CREATE TABLE IF NOT EXISTS public.stock_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid,
  created_by uuid NOT NULL,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  invoice_number text,
  invoice_photo_url text,
  notes text,
  total_items numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'confirmed'::text,
  approved_by uuid,
  approved_at timestamp with time zone,
  assistant_approved_by uuid,
  assistant_approved_at timestamp with time zone,
  branch_approved_by uuid,
  branch_approved_at timestamp with time zone,
  frozen_at timestamp with time zone,
  frozen_by uuid,
  rejection_note text,
  linked_delivery_id uuid,
  pallet_count integer NOT NULL DEFAULT 0,
  receipt_expenses numeric NOT NULL DEFAULT 0,
  expenses_description text
);

CREATE TABLE IF NOT EXISTS public.supervisor_workers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  supervisor_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  priority public.task_priority NOT NULL DEFAULT 'medium'::task_priority,
  status public.task_status NOT NULL DEFAULT 'todo'::task_status,
  due_date date,
  assigned_to uuid,
  branch_id uuid,
  created_by uuid NOT NULL,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  type public.task_type NOT NULL DEFAULT 'task'::task_type
);

CREATE TABLE IF NOT EXISTS public.test_55555555520262026 (
  id uuid NOT NULL DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.treasury_bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_holder text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.treasury_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid,
  contact_type text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  phone text,
  name_fr text
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  worker_id uuid,
  role public.app_role NOT NULL
);

CREATE TABLE IF NOT EXISTS public.verification_checklist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_type text NOT NULL,
  group_title text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'checkbox'::text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  uses_company_info boolean NOT NULL DEFAULT false,
  company_info_template text,
  branch_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.visit_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  customer_id uuid,
  branch_id uuid,
  operation_type text NOT NULL,
  operation_id uuid,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  address text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.warehouse_review_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  item_type text NOT NULL DEFAULT 'product'::text,
  product_id uuid,
  expected_quantity numeric NOT NULL DEFAULT 0,
  actual_quantity numeric NOT NULL DEFAULT 0,
  difference numeric,
  status text NOT NULL DEFAULT 'matched'::text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  boxes_quantity numeric NOT NULL DEFAULT 0,
  pieces_quantity numeric NOT NULL DEFAULT 0,
  hall_quantity numeric NOT NULL DEFAULT 0,
  damaged_quantity numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.warehouse_review_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'completed'::text,
  notes text,
  include_damaged boolean DEFAULT false,
  include_pallets boolean DEFAULT false,
  total_products integer DEFAULT 0,
  total_discrepancies integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.warehouse_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  damaged_quantity numeric NOT NULL DEFAULT 0,
  factory_return_quantity numeric NOT NULL DEFAULT 0,
  compensation_quantity numeric NOT NULL DEFAULT 0,
  pallet_quantity numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.worker_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  branch_id uuid,
  attendance_date date NOT NULL DEFAULT CURRENT_DATE,
  clock_in_at timestamp with time zone,
  clock_in_latitude double precision,
  clock_in_longitude double precision,
  clock_out_at timestamp with time zone,
  clock_out_latitude double precision,
  clock_out_longitude double precision,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_attendance_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  max_distance_meters integer NOT NULL DEFAULT 50,
  label text,
  set_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_debt_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_debt_id uuid NOT NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash'::text,
  notes text,
  collected_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_debts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  branch_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  debt_type text NOT NULL DEFAULT 'advance'::text,
  session_id uuid,
  description text,
  status text NOT NULL DEFAULT 'active'::text,
  paid_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_liability_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  branch_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  adjustment_type text NOT NULL DEFAULT 'add'::text,
  reason text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_load_request_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  order_id uuid,
  product_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_load_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  branch_id uuid,
  status text NOT NULL DEFAULT 'pending'::text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  branch_id uuid,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  heading double precision,
  speed double precision,
  is_tracking boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  idle_since timestamp with time zone,
  stops jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.worker_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  granted_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  granted boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.worker_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  role public.app_role NOT NULL,
  branch_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  custom_role_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  valid_from timestamp with time zone,
  valid_until timestamp with time zone,
  assigned_by uuid,
  notes text,
  is_primary boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.worker_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  branch_id uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_ui_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  element_type text NOT NULL,
  element_key text NOT NULL,
  is_hidden boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.workers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'worker'::app_role,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  branch_id uuid,
  salary numeric DEFAULT 0,
  bonus_cap_percentage numeric DEFAULT 20,
  department text,
  full_name_fr text,
  print_name text,
  work_phone text,
  personal_phone text,
  last_device_id text,
  last_device_info jsonb,
  device_locked boolean DEFAULT false,
  is_test boolean NOT NULL DEFAULT false
);


-- ============================================================
-- VIEWS
-- ============================================================

CREATE OR REPLACE VIEW public.workers_safe AS
 SELECT id, username, full_name, full_name_fr, role, branch_id, is_active, is_test,
        department, personal_phone, work_phone, print_name, bonus_cap_percentage,
        salary, device_locked, last_device_id, last_device_info, created_at, updated_at
   FROM public.workers;


-- ============================================================
-- FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public."55555555520262026"()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN 'ok';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.apply_automatic_penalty()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_penalty RECORD;
  v_worker_id uuid;
  v_branch_id uuid;
  v_trigger text;
  v_today DATE;
BEGIN
  v_trigger := TG_ARGV[0];
  v_today := CURRENT_DATE;

  CASE TG_TABLE_NAME
    WHEN 'orders' THEN
      v_worker_id := COALESCE(NEW.assigned_worker_id, NEW.created_by);
      v_branch_id := NEW.branch_id;
    WHEN 'visit_tracking' THEN
      v_worker_id := NEW.worker_id;
      v_branch_id := NEW.branch_id;
    WHEN 'accounting_session_items' THEN
      SELECT s.worker_id, s.branch_id INTO v_worker_id, v_branch_id
      FROM public.accounting_sessions s WHERE s.id = NEW.session_id;
    WHEN 'customer_debts' THEN
      v_worker_id := NEW.worker_id;
      v_branch_id := NEW.branch_id;
    WHEN 'debt_collections' THEN
      v_worker_id := NEW.worker_id;
      v_branch_id := (SELECT cd.branch_id FROM public.customer_debts cd WHERE cd.id = NEW.debt_id);
    ELSE
      RETURN NEW;
  END CASE;

  IF v_worker_id IS NULL THEN RETURN NEW; END IF;

  FOR v_penalty IN
    SELECT * FROM public.reward_penalties
    WHERE is_active = true
      AND is_automatic = true
      AND trigger_event = v_trigger
      AND (branch_id IS NULL OR branch_id = v_branch_id)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.employee_points_log
      WHERE worker_id = v_worker_id
        AND penalty_id = v_penalty.id
        AND point_date = v_today
        AND point_type = 'penalty'
        AND source_entity_id = NEW.id
    ) THEN
      INSERT INTO public.employee_points_log
        (worker_id, penalty_id, points, point_type, point_date, branch_id, source_entity, source_entity_id, notes)
      VALUES
        (v_worker_id, v_penalty.id, v_penalty.penalty_points, 'penalty', v_today, v_branch_id,
         TG_TABLE_NAME, NEW.id, 'عقوبة تلقائية: ' || v_penalty.name);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_stock_receipt_two_stage(p_receipt_id uuid, p_stage text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid;
  v_receipt public.stock_receipts%ROWTYPE;
  v_item RECORD;
  v_existing_qty numeric;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_receipt FROM public.stock_receipts WHERE id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt not found';
  END IF;

  IF p_stage = 'branch' THEN
    IF NOT (public.is_admin() OR public.is_branch_admin()) THEN
      RAISE EXCEPTION 'Only branch admin can approve stage 1';
    END IF;
    IF v_receipt.status NOT IN ('pending', 'pending_branch') THEN
      RAISE EXCEPTION 'Receipt not in branch-pending state';
    END IF;
    UPDATE public.stock_receipts
    SET status = 'pending_assistant',
        branch_approved_by = v_actor,
        branch_approved_at = now(),
        updated_at = now()
    WHERE id = p_receipt_id;
    RETURN jsonb_build_object('ok', true, 'next_status', 'pending_assistant');

  ELSIF p_stage = 'assistant' THEN
    IF NOT (public.is_admin() OR public.has_custom_role('company_manager')) THEN
      RAISE EXCEPTION 'Only assistant general manager can approve stage 2';
    END IF;
    IF v_receipt.status <> 'pending_assistant' THEN
      RAISE EXCEPTION 'Receipt not awaiting assistant approval';
    END IF;

    -- تحديث مخزون الفرع
    FOR v_item IN
      SELECT product_id, COALESCE(quantity,0) AS quantity
      FROM public.stock_receipt_items
      WHERE receipt_id = p_receipt_id
    LOOP
      SELECT quantity INTO v_existing_qty
      FROM public.warehouse_stock
      WHERE branch_id = v_receipt.branch_id AND product_id = v_item.product_id
      FOR UPDATE;

      IF FOUND THEN
        UPDATE public.warehouse_stock
        SET quantity = COALESCE(v_existing_qty,0) + v_item.quantity,
            updated_at = now()
        WHERE branch_id = v_receipt.branch_id AND product_id = v_item.product_id;
      ELSE
        INSERT INTO public.warehouse_stock(branch_id, product_id, quantity, updated_at)
        VALUES (v_receipt.branch_id, v_item.product_id, v_item.quantity, now());
      END IF;
    END LOOP;

    UPDATE public.stock_receipts
    SET status = 'approved',
        assistant_approved_by = v_actor,
        assistant_approved_at = now(),
        approved_by = v_actor,
        approved_at = now(),
        updated_at = now()
    WHERE id = p_receipt_id;

    RETURN jsonb_build_object('ok', true, 'next_status', 'approved');
  ELSE
    RAISE EXCEPTION 'Invalid stage: %', p_stage;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_create_manual_invoice_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_branch_id uuid;
  v_products jsonb;
BEGIN
  -- نعمل فقط على الطلبيات بفاتورة
  IF NEW.payment_type IS DISTINCT FROM 'with_invoice' THEN
    RETURN NEW;
  END IF;

  -- تجنّب التكرار
  IF EXISTS (SELECT 1 FROM public.manual_invoice_requests WHERE order_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- استنتاج فرع الطلب: من الطلبية، أو من المنشئ، أو من المندوب المسؤول
  v_branch_id := NEW.branch_id;
  IF v_branch_id IS NULL THEN
    SELECT branch_id INTO v_branch_id FROM public.workers
      WHERE id = COALESCE(NEW.created_by, NEW.assigned_worker_id) LIMIT 1;
  END IF;

  -- بناء قائمة المنتجات من order_items
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id', oi.product_id,
    'product_name', p.name,
    'quantity', oi.quantity,
    'unit_price', oi.unit_price,
    'total', oi.total_price
  )), '[]'::jsonb)
  INTO v_products
  FROM public.order_items oi
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = NEW.id;

  INSERT INTO public.manual_invoice_requests (
    order_id, customer_id, worker_id, branch_id,
    products, payment_method, status, total_amount, created_by_role
  ) VALUES (
    NEW.id,
    NEW.customer_id,
    COALESCE(NEW.created_by, NEW.assigned_worker_id),
    v_branch_id,
    v_products,
    NEW.invoice_payment_method,
    'pending_branch',
    COALESCE(NEW.total_amount, 0),
    'worker'
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_freeze_stock_confirmation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('pending', 'amended') THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
      NEW.frozen_at := COALESCE(NEW.frozen_at, now());
      NEW.frozen_by := COALESCE(NEW.frozen_by, public.get_worker_id());
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_debt_remaining_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.remaining_amount := NEW.total_amount - NEW.paid_amount;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_create_stock_confirmation_for_session(_worker_id uuid, _manager_id uuid, _source_session_id uuid, _branch_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.loading_sessions ls
    JOIN public.workers manager_worker
      ON manager_worker.id = _manager_id
     AND manager_worker.is_active = true
    JOIN public.workers target_worker
      ON target_worker.id = _worker_id
     AND target_worker.is_active = true
    WHERE ls.id = _source_session_id
      AND ls.manager_id = _manager_id
      AND ls.worker_id = _worker_id
      AND (
        _branch_id IS NULL
        OR ls.branch_id IS NULL
        OR ls.branch_id = _branch_id
      )
      AND (
        _branch_id IS NULL
        OR target_worker.branch_id = _branch_id
        OR manager_worker.branch_id = _branch_id
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.can_finalize_sector_coverage()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND public.get_worker_id() IS NOT NULL
    AND (
      public.is_admin()
      OR public.has_custom_role('company_manager')
      OR public.get_user_role() = 'company_manager'::public.app_role
    );
$function$
;

CREATE OR REPLACE FUNCTION public.can_insert_stock_confirmation(_worker_id uuid, _manager_id uuid, _source_session_id uuid, _branch_id uuid, _operation_type text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_worker_id uuid;
  v_actor_role public.app_role;
BEGIN
  v_actor_worker_id := public.get_worker_id();
  v_actor_role := public.get_user_role();

  IF auth.uid() IS NULL OR v_actor_worker_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.workers target_worker
    LEFT JOIN public.workers manager_worker ON manager_worker.id = _manager_id
    LEFT JOIN public.loading_sessions ls ON ls.id = _source_session_id
    WHERE target_worker.id = _worker_id
      AND target_worker.is_active = true
      AND COALESCE(manager_worker.is_active, true) = true
      AND (_manager_id IS NULL OR manager_worker.id = _manager_id)
      AND (
        _source_session_id IS NULL
        OR (
          ls.id = _source_session_id
          AND ls.worker_id = _worker_id
          AND (
            ls.manager_id = _manager_id
            OR _manager_id = v_actor_worker_id
          )
        )
      )
      AND (
        _branch_id IS NULL
        OR target_worker.branch_id = _branch_id
        OR manager_worker.branch_id = _branch_id
        OR ls.branch_id = _branch_id
      )
      AND (
        public.is_admin()
        OR public.is_branch_admin()
        OR EXISTS (
          SELECT 1
          FROM public.branches b
          WHERE b.admin_id = v_actor_worker_id
            AND b.is_active = true
            AND (
              _branch_id IS NULL
              OR b.id = _branch_id
              OR b.id = target_worker.branch_id
              OR b.id = manager_worker.branch_id
              OR b.id = ls.branch_id
            )
        )
        OR (
          _manager_id = v_actor_worker_id
          AND (
            v_actor_role IN ('warehouse_manager'::public.app_role, 'supervisor'::public.app_role)
            OR public.worker_has_custom_role(v_actor_worker_id, 'warehouse_manager')
            OR public.worker_has_custom_role(v_actor_worker_id, 'supervisor')
          )
          AND (
            _branch_id IS NULL
            OR target_worker.branch_id = _branch_id
            OR EXISTS (
              SELECT 1
              FROM public.worker_roles wr
              WHERE wr.worker_id = v_actor_worker_id
                AND (wr.branch_id IS NULL OR wr.branch_id = _branch_id OR wr.branch_id = target_worker.branch_id)
            )
          )
        )
      )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_insert_stock_confirmation(_worker_id uuid, _manager_id uuid, _source_session_id uuid, _branch_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_worker_id uuid;
BEGIN
  v_actor_worker_id := public.get_worker_id();

  IF auth.uid() IS NULL OR v_actor_worker_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.workers manager_worker
    JOIN public.workers target_worker ON target_worker.id = _worker_id
    WHERE manager_worker.id = _manager_id
      AND manager_worker.is_active = true
      AND target_worker.is_active = true
      AND (
        _branch_id IS NULL
        OR target_worker.branch_id = _branch_id
        OR manager_worker.branch_id = _branch_id
      )
      AND (
        _source_session_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.loading_sessions ls
          WHERE ls.id = _source_session_id
            AND ls.worker_id = _worker_id
            AND ls.manager_id = _manager_id
            AND (
              _branch_id IS NULL
              OR ls.branch_id IS NULL
              OR ls.branch_id = _branch_id
            )
        )
      )
      AND (
        public.is_admin()
        OR EXISTS (
          SELECT 1
          FROM public.branches b
          WHERE b.admin_id = v_actor_worker_id
            AND b.is_active = true
            AND (
              _branch_id IS NULL
              OR b.id = _branch_id
              OR b.id = target_worker.branch_id
              OR b.id = manager_worker.branch_id
            )
        )
        OR (
          _manager_id = v_actor_worker_id
          AND (
            public.get_user_role() IN ('warehouse_manager'::public.app_role, 'supervisor'::public.app_role)
            OR public.worker_has_custom_role(v_actor_worker_id, 'warehouse_manager')
            OR public.worker_has_custom_role(v_actor_worker_id, 'supervisor')
          )
        )
      )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_manage_product_offers(p_worker_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.workers w
    where w.id = p_worker_id
      and w.is_active = true
      and w.role in ('admin'::public.app_role, 'branch_admin'::public.app_role)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.can_manage_sector_coverage_branch(p_branch_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p_branch_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND public.get_worker_id() IS NOT NULL
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.workers w
        WHERE w.id = public.get_worker_id()
          AND w.is_active = true
          AND w.branch_id = p_branch_id
          AND w.role = 'branch_admin'::public.app_role
      )
      OR EXISTS (
        SELECT 1
        FROM public.worker_roles wr
        LEFT JOIN public.custom_roles cr ON cr.id = wr.custom_role_id
        LEFT JOIN public.workers w ON w.id = wr.worker_id
        WHERE wr.worker_id = public.get_worker_id()
          AND public.is_worker_role_active(wr.is_active, wr.valid_from, wr.valid_until)
          AND COALESCE(w.branch_id, wr.branch_id) = p_branch_id
          AND (
            wr.role = 'branch_admin'::public.app_role
            OR cr.code = 'branch_admin'
          )
      )
    );
$function$
;

CREATE OR REPLACE FUNCTION public.confirm_loading_session_atomic(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_worker_id uuid;
  v_session public.loading_sessions%ROWTYPE;
  v_item RECORD;
  v_warehouse_row RECORD;
  v_worker_row RECORD;
  v_pieces_per_box numeric;
  v_item_qty_rounded numeric;
  v_item_boxes numeric;
  v_item_piece_part numeric;
  v_gift_pieces numeric;
  v_total_load_pieces numeric;
  v_new_warehouse_pieces numeric;
  v_new_worker_pieces numeric;
  v_is_warehouse_manager boolean;
BEGIN
  v_actor_worker_id := public.get_worker_id();
  IF v_actor_worker_id IS NULL THEN
    RAISE EXCEPTION 'No active worker session';
  END IF;

  v_is_warehouse_manager := EXISTS (
    SELECT 1
    FROM public.worker_roles wr
    JOIN public.custom_roles cr ON cr.id = wr.custom_role_id
    WHERE wr.worker_id = v_actor_worker_id
      AND cr.code = 'warehouse_manager'
  );

  IF NOT (
    public.is_admin()
    OR public.is_branch_admin()
    OR public.get_user_role() IN ('warehouse_manager'::public.app_role, 'supervisor'::public.app_role)
    OR v_is_warehouse_manager
    OR v_actor_worker_id = (SELECT worker_id FROM public.loading_sessions WHERE id = p_session_id)
  ) THEN
    RAISE EXCEPTION 'You are not allowed to confirm loading sessions';
  END IF;

  SELECT * INTO v_session
  FROM public.loading_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loading session not found';
  END IF;

  IF v_session.status = 'completed' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'session_id', v_session.id,
      'status', v_session.status
    );
  END IF;

  -- Accept both 'open' and 'pending_confirmation' statuses
  IF v_session.status NOT IN ('open', 'pending_confirmation') THEN
    RAISE EXCEPTION 'Loading session is not in a confirmable state (current: %)', v_session.status;
  END IF;

  IF v_session.branch_id IS NULL THEN
    RAISE EXCEPTION 'Loading session branch is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.loading_session_items WHERE session_id = p_session_id
  ) THEN
    RAISE EXCEPTION 'Loading session has no items';
  END IF;

  FOR v_item IN
    SELECT lsi.*, p.name AS product_name, COALESCE(p.pieces_per_box, 20) AS pieces_per_box
    FROM public.loading_session_items lsi
    JOIN public.products p ON p.id = lsi.product_id
    WHERE lsi.session_id = p_session_id
    ORDER BY lsi.created_at, lsi.id
  LOOP
    v_pieces_per_box := COALESCE(v_item.pieces_per_box, 20);
    v_item_qty_rounded := ROUND(COALESCE(v_item.quantity, 0)::numeric, 2);
    v_item_boxes := FLOOR(v_item_qty_rounded);
    v_item_piece_part := ROUND((v_item_qty_rounded - v_item_boxes) * 100);

    v_gift_pieces := CASE
      WHEN COALESCE(v_item.gift_unit, 'piece') = 'box'
        THEN COALESCE(v_item.gift_quantity, 0)::numeric * v_pieces_per_box
      ELSE COALESCE(v_item.gift_quantity, 0)::numeric
    END;

    v_total_load_pieces := (v_item_boxes * v_pieces_per_box) + v_item_piece_part + v_gift_pieces;

    SELECT ws.id, ws.quantity,
      (FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2)) * v_pieces_per_box
       + ROUND((ROUND(COALESCE(ws.quantity, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2))) * 100)
      ) AS total_pieces
    INTO v_warehouse_row
    FROM public.warehouse_stock ws
    WHERE ws.branch_id = v_session.branch_id
      AND ws.product_id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND OR v_warehouse_row.total_pieces < v_total_load_pieces THEN
      RAISE EXCEPTION 'Insufficient warehouse stock for %', COALESCE(v_item.product_name, v_item.product_id::text);
    END IF;

    v_new_warehouse_pieces := v_warehouse_row.total_pieces - v_total_load_pieces;

    UPDATE public.warehouse_stock
    SET quantity = FLOOR(v_new_warehouse_pieces / v_pieces_per_box)
                   + MOD(v_new_warehouse_pieces, v_pieces_per_box) / 100.0,
        updated_at = now()
    WHERE id = v_warehouse_row.id;

    SELECT ws.id, ws.quantity,
      (FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2)) * v_pieces_per_box
       + ROUND((ROUND(COALESCE(ws.quantity, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2))) * 100)
      ) AS total_pieces
    INTO v_worker_row
    FROM public.worker_stock ws
    WHERE ws.worker_id = v_session.worker_id
      AND ws.product_id = v_item.product_id
    FOR UPDATE;

    IF FOUND THEN
      v_new_worker_pieces := v_worker_row.total_pieces + v_total_load_pieces;
      UPDATE public.worker_stock
      SET quantity = FLOOR(v_new_worker_pieces / v_pieces_per_box)
                     + MOD(v_new_worker_pieces, v_pieces_per_box) / 100.0,
          updated_at = now()
      WHERE id = v_worker_row.id;
    ELSE
      INSERT INTO public.worker_stock (worker_id, product_id, branch_id, quantity, updated_at)
      VALUES (
        v_session.worker_id,
        v_item.product_id,
        v_session.branch_id,
        FLOOR(v_total_load_pieces / v_pieces_per_box) + MOD(v_total_load_pieces, v_pieces_per_box) / 100.0,
        now()
      );
    END IF;

    INSERT INTO public.stock_movements (product_id, branch_id, quantity, movement_type, status, created_by, worker_id, notes)
    VALUES (
      v_item.product_id,
      v_session.branch_id,
      FLOOR(v_total_load_pieces / v_pieces_per_box) + MOD(v_total_load_pieces, v_pieces_per_box) / 100.0,
      'load',
      'approved',
      v_actor_worker_id,
      v_session.worker_id,
      'شحن من جلسة - ' || COALESCE(v_item.product_name, '')
    );
  END LOOP;

  UPDATE public.loading_sessions
  SET status = 'completed', completed_at = now()
  WHERE id = p_session_id AND status IN ('open', 'pending_confirmation');

  RETURN jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'session_id', v_session.id,
    'status', 'completed'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.current_worker_manages_branch(p_branch_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p_branch_id IS NOT NULL
    AND public.get_worker_id() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.branches b
        WHERE b.id = p_branch_id AND b.admin_id = public.get_worker_id()
      )
      OR EXISTS (
        SELECT 1 FROM public.workers w
        WHERE w.id = public.get_worker_id()
          AND w.is_active = true
          AND w.branch_id = p_branch_id
          AND w.role = 'branch_admin'::public.app_role
      )
      OR EXISTS (
        SELECT 1
        FROM public.worker_roles wr
        LEFT JOIN public.custom_roles cr ON cr.id = wr.custom_role_id
        LEFT JOIN public.workers w ON w.id = wr.worker_id
        WHERE wr.worker_id = public.get_worker_id()
          AND public.is_worker_role_active(wr.is_active, wr.valid_from, wr.valid_until)
          AND COALESCE(wr.branch_id, w.branch_id) = p_branch_id
          AND (wr.role = 'branch_admin'::public.app_role OR cr.code = 'branch_admin')
      )
    );
$function$
;

CREATE OR REPLACE FUNCTION public.forward_manual_invoice_request_to_management(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request public.manual_invoice_requests%ROWTYPE;
  v_worker_id uuid;
  v_request_worker_branch uuid;
  v_allowed boolean;
BEGIN
  v_worker_id := public.get_worker_id();

  SELECT * INTO v_request
  FROM public.manual_invoice_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invoice_request_not_found';
  END IF;

  IF v_request.status <> 'pending_branch' THEN
    RAISE EXCEPTION 'invoice_request_not_pending_branch';
  END IF;

  SELECT branch_id INTO v_request_worker_branch
  FROM public.workers WHERE id = v_request.worker_id;

  v_allowed :=
    public.is_admin()
    OR public.has_custom_role('company_manager')
    OR public.current_worker_manages_branch(v_request.branch_id)
    OR public.current_worker_manages_branch(v_request_worker_branch);

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'not_allowed_to_forward_invoice_request';
  END IF;

  UPDATE public.manual_invoice_requests
  SET
    status = 'pending_assistant',
    branch_approved_by = v_worker_id,
    branch_approved_at = now()
  WHERE id = p_request_id;

  IF v_request.order_id IS NOT NULL THEN
    UPDATE public.orders
    SET status = 'pending_assistant'
    WHERE id = v_request.order_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'next_status', 'pending_assistant');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_customer_account_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT id FROM public.customer_accounts 
    WHERE id = (current_setting('app.customer_account_id', true))::uuid
    AND status = 'approved'
$function$
;

CREATE OR REPLACE FUNCTION public.get_customer_sales_rep_statuses(p_worker_ids uuid[], p_customer_ids uuid[], p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS TABLE(customer_id uuid, status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT (public.is_admin() OR public.is_worker() OR public.get_user_role() = 'supervisor'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF COALESCE(array_length(p_worker_ids, 1), 0) = 0
     OR COALESCE(array_length(p_customer_ids, 1), 0) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT unnest(p_customer_ids) AS customer_id
  ),
  latest_visits AS (
    SELECT DISTINCT ON (v.customer_id)
      v.customer_id,
      COALESCE(v.notes, '') AS notes
    FROM public.visit_tracking v
    WHERE v.customer_id = ANY(p_customer_ids)
      AND v.worker_id = ANY(p_worker_ids)
      AND v.operation_type = 'visit'
      AND v.created_at >= p_start
      AND v.created_at <= p_end
    ORDER BY v.customer_id, v.created_at DESC
  ),
  ordered_customers AS (
    SELECT DISTINCT o.customer_id
    FROM public.orders o
    WHERE o.customer_id = ANY(p_customer_ids)
      AND o.created_by = ANY(p_worker_ids)
      AND o.created_at >= p_start
      AND o.created_at <= p_end
      AND o.status <> 'cancelled'
  )
  SELECT
    b.customer_id,
    CASE
      WHEN oc.customer_id IS NOT NULL THEN 'ordered'
      WHEN lv.customer_id IS NULL THEN 'not_visited'
      WHEN lv.notes ILIKE '%مغلق%' THEN 'closed'
      WHEN lv.notes ILIKE '%غير متاح%' THEN 'unavailable'
      ELSE 'visited'
    END AS status
  FROM base b
  LEFT JOIN latest_visits lv ON lv.customer_id = b.customer_id
  LEFT JOIN ordered_customers oc ON oc.customer_id = b.customer_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$function$
;

CREATE OR REPLACE FUNCTION public.get_worker_branch_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT branch_id FROM public.workers WHERE id = get_worker_id()
$function$
;

CREATE OR REPLACE FUNCTION public.get_worker_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT worker_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$function$
;

CREATE OR REPLACE FUNCTION public.get_worker_permissions(p_worker_id uuid)
 RETURNS TABLE(permission_code text, permission_name text, category text, resource text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    -- Get role-based permissions MINUS individually denied ones
    SELECT DISTINCT p.code, p.name_ar, p.category, p.resource
    FROM public.worker_roles wr
    LEFT JOIN public.custom_roles cr_direct ON cr_direct.id = wr.custom_role_id
    LEFT JOIN public.custom_roles cr_by_role ON cr_by_role.code = wr.role::text AND wr.custom_role_id IS NULL
    JOIN public.role_permissions rp ON rp.role_id = COALESCE(cr_direct.id, cr_by_role.id)
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE wr.worker_id = p_worker_id
    AND NOT EXISTS (
        SELECT 1 FROM public.worker_permissions wp
        WHERE wp.worker_id = p_worker_id
        AND wp.permission_id = p.id
        AND wp.granted = false
    )
    
    UNION
    
    -- Individual worker permissions that are explicitly granted
    SELECT DISTINCT p.code, p.name_ar, p.category, p.resource
    FROM public.worker_permissions wp
    JOIN public.permissions p ON p.id = wp.permission_id
    WHERE wp.worker_id = p_worker_id
    AND wp.granted = true
$function$
;

CREATE OR REPLACE FUNCTION public.get_worker_permissions_for_role(p_worker_id uuid, p_custom_role_code text DEFAULT NULL::text, p_base_role app_role DEFAULT NULL::app_role)
 RETURNS TABLE(permission_code text, permission_name text, category text, resource text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT p.code, p.name_ar, p.category, p.resource
  FROM public.worker_roles wr
  LEFT JOIN public.custom_roles cr_direct ON cr_direct.id = wr.custom_role_id
  LEFT JOIN public.custom_roles cr_by_role ON cr_by_role.code = wr.role::text AND wr.custom_role_id IS NULL
  JOIN public.role_permissions rp ON rp.role_id = COALESCE(cr_direct.id, cr_by_role.id)
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE wr.worker_id = p_worker_id
    AND public.is_worker_role_active(wr.is_active, wr.valid_from, wr.valid_until)
    AND (
      (p_custom_role_code IS NOT NULL AND (
         cr_direct.code = p_custom_role_code
         OR (wr.custom_role_id IS NULL AND wr.role::text = p_custom_role_code)
      ))
      OR (p_custom_role_code IS NULL AND p_base_role IS NOT NULL AND wr.role = p_base_role AND wr.custom_role_id IS NULL)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.worker_permissions wp
      WHERE wp.worker_id = p_worker_id
        AND wp.permission_id = p.id
        AND wp.granted = false
    )

  UNION

  SELECT DISTINCT p.code, p.name_ar, p.category, p.resource
  FROM public.worker_permissions wp
  JOIN public.permissions p ON p.id = wp.permission_id
  WHERE wp.worker_id = p_worker_id
    AND wp.granted = true;
$function$
;

CREATE OR REPLACE FUNCTION public.get_worker_roles(p_worker_id uuid)
 RETURNS TABLE(role app_role, branch_id uuid, branch_name text, custom_role_id uuid, custom_role_code text, custom_role_name text, is_primary boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    wr.role,
    wr.branch_id,
    b.name AS branch_name,
    cr.id AS custom_role_id,
    cr.code AS custom_role_code,
    cr.name_ar AS custom_role_name,
    COALESCE(wr.is_primary, false) AS is_primary
  FROM public.worker_roles wr
  LEFT JOIN public.branches b ON b.id = wr.branch_id
  LEFT JOIN public.custom_roles cr ON cr.id = wr.custom_role_id
  WHERE wr.worker_id = p_worker_id
    AND public.is_worker_role_active(wr.is_active, wr.valid_from, wr.valid_until)
  ORDER BY COALESCE(wr.is_primary, false) DESC, wr.created_at ASC NULLS LAST;
$function$
;

CREATE OR REPLACE FUNCTION public.has_custom_role(p_role_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.worker_roles wr
    JOIN public.custom_roles cr ON cr.id = wr.custom_role_id
    WHERE wr.worker_id = public.get_worker_id()
      AND cr.code = p_role_code
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','project_manager','company_manager')
    LIMIT 1
  )
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin_of_branch(p_branch_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.branches 
        WHERE id = p_branch_id AND admin_id = get_worker_id() AND is_active = true
    )
$function$
;

CREATE OR REPLACE FUNCTION public.is_approved_customer()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.customer_accounts 
        WHERE id = (current_setting('app.customer_account_id', true))::uuid
        AND status = 'approved'
    )
$function$
;

CREATE OR REPLACE FUNCTION public.is_branch_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.branches 
        WHERE admin_id = (SELECT worker_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) 
        AND is_active = true
        LIMIT 1
    )
$function$
;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.worker_id = public.get_worker_id()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_worker()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','worker','branch_admin','supervisor','project_manager','accountant','admin_assistant','company_manager')
    LIMIT 1
  )
$function$
;

CREATE OR REPLACE FUNCTION public.is_worker_role_active(p_is_active boolean, p_valid_from timestamp with time zone, p_valid_until timestamp with time zone)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT COALESCE(p_is_active, true)
    AND (p_valid_from IS NULL OR p_valid_from <= now())
    AND (p_valid_until IS NULL OR p_valid_until >= now());
$function$
;

CREATE OR REPLACE FUNCTION public.log_order_creation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.order_events (order_id, event_type, new_value, performed_by, details)
  VALUES (NEW.id, 'created', NEW.status, NEW.created_by,
    jsonb_build_object('customer_id', NEW.customer_id, 'total_amount', NEW.total_amount));
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_worker_id uuid;
BEGIN
  v_worker_id := public.get_worker_id();

  -- Log status change
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_events (order_id, event_type, old_value, new_value, performed_by)
    VALUES (NEW.id, 'status_change', OLD.status, NEW.status, v_worker_id);
  END IF;

  -- Log worker assignment change
  IF OLD.assigned_worker_id IS DISTINCT FROM NEW.assigned_worker_id THEN
    INSERT INTO public.order_events (order_id, event_type, old_value, new_value, performed_by, details)
    VALUES (NEW.id, 'worker_changed', OLD.assigned_worker_id::text, NEW.assigned_worker_id::text, v_worker_id,
      jsonb_build_object('old_worker', OLD.assigned_worker_id, 'new_worker', NEW.assigned_worker_id));
  END IF;

  -- Log payment type change (with_invoice / without_invoice)
  IF OLD.payment_type IS DISTINCT FROM NEW.payment_type THEN
    INSERT INTO public.order_events (order_id, event_type, old_value, new_value, performed_by, details)
    VALUES (NEW.id, 'payment_updated', OLD.payment_type, NEW.payment_type, v_worker_id,
      jsonb_build_object(
        'old_payment_type', OLD.payment_type,
        'new_payment_type', NEW.payment_type,
        'payment_type_change', true
      ));
  END IF;

  -- Log invoice_payment_method change (e.g., gros, retail, super_gros)
  IF OLD.invoice_payment_method IS DISTINCT FROM NEW.invoice_payment_method THEN
    INSERT INTO public.order_events (order_id, event_type, old_value, new_value, performed_by, details)
    VALUES (NEW.id, 'payment_updated', OLD.invoice_payment_method, NEW.invoice_payment_method, v_worker_id,
      jsonb_build_object(
        'old_invoice_method', OLD.invoice_payment_method,
        'new_invoice_method', NEW.invoice_payment_method,
        'invoice_method_change', true
      ));
  END IF;

  -- Log amount change with payment context
  IF OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
    INSERT INTO public.order_events (order_id, event_type, old_value, new_value, performed_by, details)
    VALUES (NEW.id, 'amount_changed', OLD.total_amount::text, NEW.total_amount::text, v_worker_id,
      jsonb_build_object(
        'old_amount', OLD.total_amount,
        'new_amount', NEW.total_amount,
        'payment_type', NEW.payment_type,
        'invoice_payment_method', NEW.invoice_payment_method
      ));
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reward_on_debt_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task RECORD;
  v_today DATE;
  v_payment_count INT;
  v_total_collected NUMERIC;
BEGIN
  v_today := CURRENT_DATE;

  FOR v_task IN
    SELECT * FROM public.reward_tasks
    WHERE is_active = true AND data_source = 'collections' AND frequency = 'daily'
  LOOP
    SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_payment_count, v_total_collected
    FROM public.debt_payments
    WHERE worker_id = NEW.worker_id
      AND collected_at::date = CURRENT_DATE;

    IF (
      (v_task.condition_logic->>'min_amount' IS NOT NULL AND v_total_collected >= (v_task.condition_logic->>'min_amount')::numeric)
      OR
      (v_task.condition_logic->>'min_amount' IS NULL AND v_payment_count >= COALESCE((v_task.condition_logic->>'min_count')::int, 1))
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.employee_points_log
        WHERE worker_id = NEW.worker_id AND task_id = v_task.id AND point_date = v_today AND point_type = 'reward'
      ) THEN
        INSERT INTO public.employee_points_log (worker_id, task_id, points, point_type, point_date, branch_id, source_entity, notes)
        VALUES (NEW.worker_id, v_task.id, v_task.reward_points, 'reward', v_today,
                (SELECT branch_id FROM public.workers WHERE id = NEW.worker_id),
                'collections', 'تلقائي: ' || v_task.name);
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reward_on_new_customer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task RECORD;
  v_today DATE;
  v_new_count INT;
BEGIN
  IF NEW.created_by IS NULL THEN RETURN NEW; END IF;
  
  v_today := CURRENT_DATE;

  FOR v_task IN
    SELECT * FROM public.reward_tasks
    WHERE is_active = true AND data_source = 'new_customers' AND frequency = 'daily'
  LOOP
    SELECT COUNT(*) INTO v_new_count
    FROM public.customers
    WHERE created_by = NEW.created_by
      AND created_at::date = CURRENT_DATE;

    IF v_new_count >= COALESCE((v_task.condition_logic->>'min_count')::int, 1) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.employee_points_log
        WHERE worker_id = NEW.created_by AND task_id = v_task.id AND point_date = v_today AND point_type = 'reward'
      ) THEN
        INSERT INTO public.employee_points_log (worker_id, task_id, points, point_type, point_date, branch_id, source_entity, notes)
        VALUES (NEW.created_by, v_task.id, v_task.reward_points, 'reward', v_today,
                NEW.branch_id, 'new_customers', 'تلقائي: ' || v_task.name);
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reward_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task RECORD;
  v_today DATE;
  v_order_count INT;
  v_total_sales NUMERIC;
  v_worker_id uuid;
BEGIN
  IF NEW.status NOT IN ('delivered', 'completed', 'confirmed') THEN
    RETURN NEW;
  END IF;

  -- Use assigned_worker_id or created_by as the worker
  v_worker_id := COALESCE(NEW.assigned_worker_id, NEW.created_by);
  IF v_worker_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_today := CURRENT_DATE;

  FOR v_task IN
    SELECT * FROM public.reward_tasks
    WHERE is_active = true AND data_source = 'sales' AND frequency = 'daily'
  LOOP
    SELECT COUNT(*), COALESCE(SUM(total_amount), 0) INTO v_order_count, v_total_sales
    FROM public.orders
    WHERE COALESCE(assigned_worker_id, created_by) = v_worker_id
      AND created_at::date = CURRENT_DATE
      AND status IN ('delivered', 'completed', 'confirmed');

    IF (
      (v_task.condition_logic->>'min_amount' IS NOT NULL AND v_total_sales >= (v_task.condition_logic->>'min_amount')::numeric)
      OR
      (v_task.condition_logic->>'min_amount' IS NULL AND v_order_count >= COALESCE((v_task.condition_logic->>'min_count')::int, 1))
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.employee_points_log
        WHERE worker_id = v_worker_id AND task_id = v_task.id AND point_date = v_today AND point_type = 'reward'
      ) THEN
        INSERT INTO public.employee_points_log (worker_id, task_id, points, point_type, point_date, branch_id, source_entity, notes)
        VALUES (v_worker_id, v_task.id, v_task.reward_points, 'reward', v_today,
                NEW.branch_id, 'sales', 'تلقائي: ' || v_task.name || ' (' || v_order_count || ' طلب)');
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reward_on_visit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task RECORD;
  v_today DATE;
  v_visit_count INT;
BEGIN
  v_today := CURRENT_DATE;
  
  FOR v_task IN
    SELECT * FROM public.reward_tasks
    WHERE is_active = true AND data_source = 'visits' AND frequency = 'daily'
  LOOP
    SELECT COUNT(*) INTO v_visit_count
    FROM public.visit_tracking
    WHERE worker_id = NEW.worker_id
      AND created_at::date = CURRENT_DATE;

    IF v_visit_count >= COALESCE((v_task.condition_logic->>'min_count')::int, 1) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.employee_points_log
        WHERE worker_id = NEW.worker_id AND task_id = v_task.id AND point_date = v_today AND point_type = 'reward'
      ) THEN
        INSERT INTO public.employee_points_log (worker_id, task_id, points, point_type, point_date, branch_id, source_entity, notes)
        VALUES (NEW.worker_id, v_task.id, v_task.reward_points, 'reward', v_today,
                NEW.branch_id, 'visits', 'تلقائي: ' || v_task.name);
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.search_orders_by_prefix(p_prefix text, p_limit integer DEFAULT 10)
 RETURNS TABLE(order_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  clean_prefix text;
BEGIN
  clean_prefix := lower(trim(p_prefix));
  
  -- If empty, return nothing
  IF clean_prefix = '' OR length(clean_prefix) < 2 THEN
    RETURN;
  END IF;
  
  -- Check if it looks like a UUID or UUID fragment (hex characters and dashes)
  IF clean_prefix ~ '^[0-9a-f-]+$' THEN
    -- First try: Search by order ID prefix (fast exact match from start)
    RETURN QUERY
    SELECT o.id
    FROM public.orders o
    WHERE o.id::text LIKE (clean_prefix || '%')
    ORDER BY o.created_at DESC
    LIMIT p_limit;
    
    -- If found results, return them
    IF FOUND THEN
      RETURN;
    END IF;
    
    -- Second try: Search by partial UUID match (contains) - useful for corrupted scans
    RETURN QUERY
    SELECT o.id
    FROM public.orders o
    WHERE o.id::text LIKE ('%' || clean_prefix || '%')
    ORDER BY o.created_at DESC
    LIMIT p_limit;
    
    -- If found results, return them
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;
  
  -- Otherwise search by customer name or phone
  RETURN QUERY
  SELECT DISTINCT o.id
  FROM public.orders o
  INNER JOIN public.customers c ON c.id = o.customer_id
  WHERE c.name ILIKE ('%' || clean_prefix || '%')
     OR c.phone ILIKE ('%' || clean_prefix || '%')
  ORDER BY o.id
  LIMIT p_limit;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_worker_session(p_worker_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: missing auth.uid()';
  END IF;

  SELECT w.role INTO v_role
  FROM public.workers w
  WHERE w.id = p_worker_id
    AND w.is_active = true;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Invalid worker or inactive';
  END IF;

  -- Ensure a single row per user_id
  DELETE FROM public.user_roles ur
  WHERE ur.user_id = auth.uid();

  INSERT INTO public.user_roles (user_id, worker_id, role)
  VALUES (auth.uid(), p_worker_id, v_role);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.start_loading_session_atomic(p_worker_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_manager_id uuid;
  v_branch_id uuid;
  v_session_id uuid;
  v_session jsonb;
BEGIN
  -- Get current worker (manager) from session
  v_manager_id := public.get_worker_id();
  IF v_manager_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: no active session';
  END IF;

  -- Get worker's branch
  SELECT branch_id INTO v_branch_id
  FROM public.workers
  WHERE id = p_worker_id AND is_active = true;

  IF v_branch_id IS NULL THEN
    -- fallback: use manager's branch
    SELECT branch_id INTO v_branch_id
    FROM public.workers
    WHERE id = v_manager_id;
  END IF;

  -- Create the loading session
  INSERT INTO public.loading_sessions (worker_id, manager_id, branch_id, status, notes)
  VALUES (p_worker_id, v_manager_id, v_branch_id, 'open', p_notes)
  RETURNING id INTO v_session_id;

  -- Build session JSON to return
  v_session := jsonb_build_object(
    'session', jsonb_build_object(
      'id', v_session_id,
      'worker_id', p_worker_id,
      'manager_id', v_manager_id,
      'branch_id', v_branch_id,
      'status', 'open',
      'notes', p_notes,
      'created_at', now()
    )
  );

  RETURN v_session;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_worker_stock_from_review_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_worker_id uuid;
  v_branch_id uuid;
  v_is_review boolean;
BEGIN
  SELECT s.worker_id, s.branch_id, (s.status = 'review')
  INTO v_worker_id, v_branch_id, v_is_review
  FROM public.loading_sessions s
  WHERE s.id = NEW.session_id;

  IF NOT COALESCE(v_is_review, false) THEN
    RETURN NEW;
  END IF;

  UPDATE public.worker_stock
  SET quantity = COALESCE(NEW.quantity, 0),
      updated_at = now()
  WHERE worker_id = v_worker_id
    AND product_id = NEW.product_id;

  IF NOT FOUND THEN
    INSERT INTO public.worker_stock (worker_id, product_id, quantity, branch_id, updated_at)
    VALUES (v_worker_id, NEW.product_id, COALESCE(NEW.quantity, 0), v_branch_id, now());
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_sector_coverage_dates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.start_date > NEW.end_date THEN
    -- Auto-swap instead of rejecting
    DECLARE tmp date;
    BEGIN
      tmp := NEW.start_date;
      NEW.start_date := NEW.end_date;
      NEW.end_date := tmp;
    END;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_customer_password(p_username text, p_password_hash text)
 RETURNS TABLE(id uuid, customer_id uuid, username text, full_name text, phone text, store_name text, status text, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT ca.id, ca.customer_id, ca.username, ca.full_name, ca.phone, ca.store_name, ca.status, ca.created_at
    FROM public.customer_accounts ca
    WHERE lower(ca.username) = lower(p_username)
    AND ca.password_hash = p_password_hash;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_worker_password(p_username text, p_password_hash text)
 RETURNS TABLE(id uuid, username text, full_name text, role app_role, branch_id uuid, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT w.id, w.username, w.full_name, w.role, w.branch_id, w.is_active, w.created_at, w.updated_at
  FROM public.workers w
  WHERE lower(w.username) = lower(p_username)
    AND w.password_hash = p_password_hash;
$function$
;

CREATE OR REPLACE FUNCTION public.worker_has_custom_role(p_worker_id uuid, p_role_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.worker_roles wr
    JOIN public.custom_roles cr ON cr.id = wr.custom_role_id
    WHERE wr.worker_id = p_worker_id
      AND cr.code = p_role_code
  );
$function$
;

CREATE OR REPLACE FUNCTION public.worker_has_permission(p_worker_id uuid, p_permission_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM public.worker_permissions wp
            JOIN public.permissions p ON p.id = wp.permission_id
            WHERE wp.worker_id = p_worker_id AND p.code = p_permission_code
        ) THEN (
            SELECT wp.granted FROM public.worker_permissions wp
            JOIN public.permissions p ON p.id = wp.permission_id
            WHERE wp.worker_id = p_worker_id AND p.code = p_permission_code
            LIMIT 1
        )
        ELSE EXISTS (
            SELECT 1 
            FROM public.worker_roles wr
            LEFT JOIN public.custom_roles cr_direct ON cr_direct.id = wr.custom_role_id
            LEFT JOIN public.custom_roles cr_by_role ON cr_by_role.code = wr.role::text AND wr.custom_role_id IS NULL
            JOIN public.role_permissions rp ON rp.role_id = COALESCE(cr_direct.id, cr_by_role.id)
            JOIN public.permissions p ON p.id = rp.permission_id
            WHERE wr.worker_id = p_worker_id AND p.code = p_permission_code
        )
    END
$function$
;


-- ============================================================
-- CONSTRAINTS (PK, UNIQUE, CHECK, FK)
-- ============================================================

ALTER TABLE stock_confirmations ADD CONSTRAINT stock_confirmations_operation_type_check CHECK ((operation_type = ANY (ARRAY['load'::text, 'unload'::text, 'deficit'::text, 'surplus'::text, 'damaged'::text, 'review'::text, 'exchange'::text])));
ALTER TABLE stock_confirmations ADD CONSTRAINT stock_confirmations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'amended'::text])));
ALTER TABLE manual_invoice_requests ADD CONSTRAINT manual_invoice_requests_invoice_scope_check CHECK ((invoice_scope = ANY (ARRAY['public'::text, 'private'::text])));
ALTER TABLE product_shortage_tracking ADD CONSTRAINT product_shortage_tracking_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE product_shortage_tracking ADD CONSTRAINT product_shortage_tracking_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE customers ADD CONSTRAINT customers_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE CASCADE;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE product_shortage_tracking ADD CONSTRAINT product_shortage_tracking_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE promos ADD CONSTRAINT promos_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE promos ADD CONSTRAINT promos_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE orders ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE customer_debts ADD CONSTRAINT customer_debts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE debt_collections ADD CONSTRAINT debt_collections_debt_id_fkey FOREIGN KEY (debt_id) REFERENCES customer_debts(id) ON DELETE CASCADE;
ALTER TABLE debt_payments ADD CONSTRAINT debt_payments_debt_id_fkey FOREIGN KEY (debt_id) REFERENCES customer_debts(id) ON DELETE CASCADE;
ALTER TABLE accounting_session_items ADD CONSTRAINT accounting_session_items_session_id_fkey FOREIGN KEY (session_id) REFERENCES accounting_sessions(id) ON DELETE CASCADE;
ALTER TABLE product_offer_tiers ADD CONSTRAINT product_offer_tiers_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES product_offers(id) ON DELETE CASCADE;
ALTER TABLE product_offer_tiers ADD CONSTRAINT product_offer_tiers_gift_product_id_fkey FOREIGN KEY (gift_product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE product_offers ADD CONSTRAINT product_offers_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE product_offers ADD CONSTRAINT product_offers_gift_product_id_fkey FOREIGN KEY (gift_product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE order_items ADD CONSTRAINT order_items_gift_offer_id_fkey FOREIGN KEY (gift_offer_id) REFERENCES product_offers(id) ON DELETE CASCADE;
ALTER TABLE customer_special_prices ADD CONSTRAINT customer_special_prices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE customer_special_prices ADD CONSTRAINT customer_special_prices_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE customer_accounts ADD CONSTRAINT customer_accounts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE quantity_price_tiers ADD CONSTRAINT quantity_price_tiers_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE product_pricing_groups ADD CONSTRAINT product_pricing_groups_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE product_shortage_tracking ADD CONSTRAINT product_shortage_tracking_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE product_shortage_tracking ADD CONSTRAINT product_shortage_tracking_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE navbar_preferences ADD CONSTRAINT navbar_preferences_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE customer_approval_requests ADD CONSTRAINT customer_approval_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE customer_approval_requests ADD CONSTRAINT customer_approval_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE customer_approval_requests ADD CONSTRAINT customer_approval_requests_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE customer_approval_requests ADD CONSTRAINT customer_approval_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE visit_tracking ADD CONSTRAINT visit_tracking_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE receipts ADD CONSTRAINT receipts_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE receipts ADD CONSTRAINT receipts_debt_id_fkey FOREIGN KEY (debt_id) REFERENCES customer_debts(id) ON DELETE CASCADE;
ALTER TABLE receipts ADD CONSTRAINT receipts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE receipts ADD CONSTRAINT receipts_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE receipts ADD CONSTRAINT receipts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE receipt_modifications ADD CONSTRAINT receipt_modifications_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE;
ALTER TABLE receipt_modifications ADD CONSTRAINT receipt_modifications_modified_by_fkey FOREIGN KEY (modified_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE receipt_modifications ADD CONSTRAINT receipt_modifications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE sector_zones ADD CONSTRAINT sector_zones_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE CASCADE;
ALTER TABLE customers ADD CONSTRAINT customers_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES sector_zones(id) ON DELETE CASCADE;
ALTER TABLE worker_permissions ADD CONSTRAINT worker_permissions_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE worker_permissions ADD CONSTRAINT worker_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;
ALTER TABLE worker_permissions ADD CONSTRAINT worker_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE worker_ui_overrides ADD CONSTRAINT worker_ui_overrides_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE worker_ui_overrides ADD CONSTRAINT worker_ui_overrides_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE treasury_contacts ADD CONSTRAINT treasury_contacts_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE manager_handovers ADD CONSTRAINT manager_handovers_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES treasury_bank_accounts(id) ON DELETE CASCADE;
ALTER TABLE manager_treasury ADD CONSTRAINT manager_treasury_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE manager_treasury ADD CONSTRAINT manager_treasury_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE manager_handovers ADD CONSTRAINT manager_handovers_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE manager_handovers ADD CONSTRAINT manager_handovers_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE manager_handovers ADD CONSTRAINT manager_handovers_received_by_fkey FOREIGN KEY (received_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE handover_items ADD CONSTRAINT handover_items_handover_id_fkey FOREIGN KEY (handover_id) REFERENCES manager_handovers(id) ON DELETE CASCADE;
ALTER TABLE handover_items ADD CONSTRAINT handover_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE handover_items ADD CONSTRAINT handover_items_treasury_entry_id_fkey FOREIGN KEY (treasury_entry_id) REFERENCES manager_treasury(id) ON DELETE CASCADE;
ALTER TABLE treasury_contacts ADD CONSTRAINT treasury_contacts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE worker_liability_adjustments ADD CONSTRAINT worker_liability_adjustments_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE coin_exchange_tasks ADD CONSTRAINT coin_exchange_tasks_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE coin_exchange_tasks ADD CONSTRAINT coin_exchange_tasks_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE coin_exchange_tasks ADD CONSTRAINT coin_exchange_tasks_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE coin_exchange_returns ADD CONSTRAINT coin_exchange_returns_task_id_fkey FOREIGN KEY (task_id) REFERENCES coin_exchange_tasks(id) ON DELETE CASCADE;
ALTER TABLE coin_exchange_returns ADD CONSTRAINT coin_exchange_returns_received_by_fkey FOREIGN KEY (received_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE manual_invoice_requests ADD CONSTRAINT manual_invoice_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE manual_invoice_requests ADD CONSTRAINT manual_invoice_requests_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE manual_invoice_requests ADD CONSTRAINT manual_invoice_requests_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE delivery_routes ADD CONSTRAINT delivery_routes_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE delivery_routes ADD CONSTRAINT delivery_routes_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE delivery_route_sectors ADD CONSTRAINT delivery_route_sectors_route_id_fkey FOREIGN KEY (route_id) REFERENCES delivery_routes(id) ON DELETE CASCADE;
ALTER TABLE delivery_route_sectors ADD CONSTRAINT delivery_route_sectors_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE CASCADE;
ALTER TABLE manager_treasury ADD CONSTRAINT manager_treasury_session_id_fkey FOREIGN KEY (session_id) REFERENCES accounting_sessions(id) ON DELETE CASCADE;
ALTER TABLE loading_sessions ADD CONSTRAINT loading_sessions_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE loading_sessions ADD CONSTRAINT loading_sessions_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE loading_sessions ADD CONSTRAINT loading_sessions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE loading_session_items ADD CONSTRAINT loading_session_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE customers ADD CONSTRAINT customers_default_delivery_worker_id_fkey FOREIGN KEY (default_delivery_worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE customer_credits ADD CONSTRAINT customer_credits_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE customer_credits ADD CONSTRAINT customer_credits_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE customer_credits ADD CONSTRAINT customer_credits_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE customer_credits ADD CONSTRAINT customer_credits_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE customer_credits ADD CONSTRAINT customer_credits_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE customer_credits ADD CONSTRAINT customer_credits_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE customer_credits ADD CONSTRAINT customer_credits_used_in_order_id_fkey FOREIGN KEY (used_in_order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE verification_checklist_items ADD CONSTRAINT verification_checklist_items_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE verification_checklist_items ADD CONSTRAINT verification_checklist_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE document_collections ADD CONSTRAINT document_collections_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE document_collections ADD CONSTRAINT document_collections_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE document_collections ADD CONSTRAINT document_collections_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE worker_debts ADD CONSTRAINT worker_debts_session_id_fkey FOREIGN KEY (session_id) REFERENCES accounting_sessions(id) ON DELETE CASCADE;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES stock_receipts(id) ON DELETE CASCADE;
ALTER TABLE employee_points_log ADD CONSTRAINT employee_points_log_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE pallet_settings ADD CONSTRAINT pallet_settings_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE pallet_settings ADD CONSTRAINT pallet_settings_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE pallet_settings ADD CONSTRAINT pallet_settings_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE factory_orders ADD CONSTRAINT factory_orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE factory_orders ADD CONSTRAINT factory_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE factory_order_items ADD CONSTRAINT factory_order_items_factory_order_id_fkey FOREIGN KEY (factory_order_id) REFERENCES factory_orders(id) ON DELETE CASCADE;
ALTER TABLE factory_order_items ADD CONSTRAINT factory_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE branch_pallets ADD CONSTRAINT branch_pallets_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE pallet_movements ADD CONSTRAINT pallet_movements_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE pallet_movements ADD CONSTRAINT pallet_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE reward_tasks ADD CONSTRAINT reward_tasks_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE reward_tasks ADD CONSTRAINT reward_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE reward_penalties ADD CONSTRAINT reward_penalties_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE reward_penalties ADD CONSTRAINT reward_penalties_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE employee_points_log ADD CONSTRAINT employee_points_log_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE employee_points_log ADD CONSTRAINT employee_points_log_task_id_fkey FOREIGN KEY (task_id) REFERENCES reward_tasks(id) ON DELETE CASCADE;
ALTER TABLE employee_points_log ADD CONSTRAINT employee_points_log_penalty_id_fkey FOREIGN KEY (penalty_id) REFERENCES reward_penalties(id) ON DELETE CASCADE;
ALTER TABLE monthly_bonus_summary ADD CONSTRAINT monthly_bonus_summary_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE monthly_bonus_summary ADD CONSTRAINT monthly_bonus_summary_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE reward_config ADD CONSTRAINT reward_config_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE reward_config ADD CONSTRAINT reward_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE reward_reserve_fund ADD CONSTRAINT reward_reserve_fund_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE reward_disputes ADD CONSTRAINT reward_disputes_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE reward_disputes ADD CONSTRAINT reward_disputes_points_log_id_fkey FOREIGN KEY (points_log_id) REFERENCES employee_points_log(id) ON DELETE CASCADE;
ALTER TABLE reward_disputes ADD CONSTRAINT reward_disputes_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE reward_disputes ADD CONSTRAINT reward_disputes_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE reward_notifications ADD CONSTRAINT reward_notifications_target_worker_id_fkey FOREIGN KEY (target_worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE reward_notifications ADD CONSTRAINT reward_notifications_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE conversations ADD CONSTRAINT conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE conversations ADD CONSTRAINT conversations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE conversation_participants ADD CONSTRAINT conversation_participants_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE worker_attendance ADD CONSTRAINT worker_attendance_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE worker_attendance ADD CONSTRAINT worker_attendance_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE attendance_logs ADD CONSTRAINT attendance_logs_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE attendance_logs ADD CONSTRAINT attendance_logs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE worker_attendance_locations ADD CONSTRAINT worker_attendance_locations_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE worker_attendance_locations ADD CONSTRAINT worker_attendance_locations_set_by_fkey FOREIGN KEY (set_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE worker_load_requests ADD CONSTRAINT worker_load_requests_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE worker_load_requests ADD CONSTRAINT worker_load_requests_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE worker_load_request_items ADD CONSTRAINT worker_load_request_items_request_id_fkey FOREIGN KEY (request_id) REFERENCES worker_load_requests(id) ON DELETE CASCADE;
ALTER TABLE worker_load_request_items ADD CONSTRAINT worker_load_request_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE worker_load_request_items ADD CONSTRAINT worker_load_request_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE sector_schedule_overrides ADD CONSTRAINT sector_schedule_overrides_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE CASCADE;
ALTER TABLE sector_schedule_overrides ADD CONSTRAINT sector_schedule_overrides_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE sector_schedule_overrides ADD CONSTRAINT sector_schedule_overrides_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE sector_schedule_overrides ADD CONSTRAINT sector_schedule_overrides_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE sector_schedules ADD CONSTRAINT sector_schedules_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE CASCADE;
ALTER TABLE sector_schedules ADD CONSTRAINT sector_schedules_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE warehouse_review_sessions ADD CONSTRAINT warehouse_review_sessions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE warehouse_review_sessions ADD CONSTRAINT warehouse_review_sessions_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE warehouse_review_items ADD CONSTRAINT warehouse_review_items_session_id_fkey FOREIGN KEY (session_id) REFERENCES warehouse_review_sessions(id) ON DELETE CASCADE;
ALTER TABLE warehouse_review_items ADD CONSTRAINT warehouse_review_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE supervisor_workers ADD CONSTRAINT supervisor_workers_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE supervisor_workers ADD CONSTRAINT supervisor_workers_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE supervisor_workers ADD CONSTRAINT supervisor_workers_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE promo_splits ADD CONSTRAINT promo_splits_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES product_offers(id) ON DELETE CASCADE;
ALTER TABLE promo_splits ADD CONSTRAINT promo_splits_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE promo_splits ADD CONSTRAINT promo_splits_gift_product_id_fkey FOREIGN KEY (gift_product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE promo_splits ADD CONSTRAINT promo_splits_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE promo_splits ADD CONSTRAINT promo_splits_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE promo_split_customers ADD CONSTRAINT promo_split_customers_split_id_fkey FOREIGN KEY (split_id) REFERENCES promo_splits(id) ON DELETE CASCADE;
ALTER TABLE promo_split_customers ADD CONSTRAINT promo_split_customers_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE promo_split_installments ADD CONSTRAINT promo_split_installments_split_customer_id_fkey FOREIGN KEY (split_customer_id) REFERENCES promo_split_customers(id) ON DELETE CASCADE;
ALTER TABLE promos ADD CONSTRAINT promos_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES product_offers(id) ON DELETE CASCADE;
ALTER TABLE promos ADD CONSTRAINT promos_offer_tier_id_fkey FOREIGN KEY (offer_tier_id) REFERENCES product_offer_tiers(id) ON DELETE CASCADE;
ALTER TABLE sector_coverage ADD CONSTRAINT sector_coverage_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE CASCADE;
ALTER TABLE sector_coverage ADD CONSTRAINT sector_coverage_absent_worker_id_fkey FOREIGN KEY (absent_worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE sector_coverage ADD CONSTRAINT sector_coverage_substitute_worker_id_fkey FOREIGN KEY (substitute_worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE sector_coverage ADD CONSTRAINT sector_coverage_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE sector_coverage ADD CONSTRAINT sector_coverage_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE manager_workers ADD CONSTRAINT manager_workers_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE manager_workers ADD CONSTRAINT manager_workers_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE manager_workers ADD CONSTRAINT manager_workers_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE stock_receipts ADD CONSTRAINT stock_receipts_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE order_events ADD CONSTRAINT order_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE order_events ADD CONSTRAINT order_events_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE manager_review_sessions ADD CONSTRAINT manager_review_sessions_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE manager_review_sessions ADD CONSTRAINT manager_review_sessions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE accounting_sessions ADD CONSTRAINT accounting_sessions_review_session_id_fkey FOREIGN KEY (review_session_id) REFERENCES manager_review_sessions(id) ON DELETE CASCADE;
ALTER TABLE role_ui_overrides ADD CONSTRAINT role_ui_overrides_role_id_fkey FOREIGN KEY (role_id) REFERENCES custom_roles(id) ON DELETE CASCADE;
ALTER TABLE role_ui_overrides ADD CONSTRAINT role_ui_overrides_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE stock_disputes ADD CONSTRAINT stock_disputes_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE stock_disputes ADD CONSTRAINT stock_disputes_raised_by_fkey FOREIGN KEY (raised_by) REFERENCES workers(id);
ALTER TABLE stock_disputes ADD CONSTRAINT stock_disputes_warehouse_worker_id_fkey FOREIGN KEY (warehouse_worker_id) REFERENCES workers(id);
ALTER TABLE stock_disputes ADD CONSTRAINT stock_disputes_delivery_worker_id_fkey FOREIGN KEY (delivery_worker_id) REFERENCES workers(id);
ALTER TABLE stock_disputes ADD CONSTRAINT stock_disputes_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);
ALTER TABLE customers ADD CONSTRAINT customers_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE products ADD CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE promos ADD CONSTRAINT promos_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE treasury_bank_accounts ADD CONSTRAINT treasury_bank_accounts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE treasury_bank_accounts ADD CONSTRAINT treasury_bank_accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE branches ADD CONSTRAINT branches_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE workers ADD CONSTRAINT workers_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE customers ADD CONSTRAINT customers_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE worker_roles ADD CONSTRAINT worker_roles_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE worker_roles ADD CONSTRAINT worker_roles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE custom_roles ADD CONSTRAINT custom_roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES custom_roles(id) ON DELETE CASCADE;
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;
ALTER TABLE orders ADD CONSTRAINT orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE orders ADD CONSTRAINT orders_assigned_worker_id_fkey FOREIGN KEY (assigned_worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE orders ADD CONSTRAINT orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE worker_roles ADD CONSTRAINT worker_roles_custom_role_id_fkey FOREIGN KEY (custom_role_id) REFERENCES custom_roles(id) ON DELETE CASCADE;
ALTER TABLE visit_tracking ADD CONSTRAINT visit_tracking_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE visit_tracking ADD CONSTRAINT visit_tracking_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE worker_liability_adjustments ADD CONSTRAINT worker_liability_adjustments_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE worker_liability_adjustments ADD CONSTRAINT worker_liability_adjustments_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE settings ADD CONSTRAINT settings_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE pricing_groups ADD CONSTRAINT pricing_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE product_pricing_groups ADD CONSTRAINT product_pricing_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES pricing_groups(id) ON DELETE CASCADE;
ALTER TABLE customer_special_prices ADD CONSTRAINT customer_special_prices_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE quantity_price_tiers ADD CONSTRAINT quantity_price_tiers_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE stamp_price_tiers ADD CONSTRAINT stamp_price_tiers_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE customer_accounts ADD CONSTRAINT customer_accounts_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE orders ADD CONSTRAINT orders_created_by_customer_fkey FOREIGN KEY (created_by_customer) REFERENCES customer_accounts(id) ON DELETE CASCADE;
ALTER TABLE product_offers ADD CONSTRAINT product_offers_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE product_offers ADD CONSTRAINT product_offers_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE expenses ADD CONSTRAINT expenses_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE expenses ADD CONSTRAINT expenses_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE expenses ADD CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE CASCADE;
ALTER TABLE expenses ADD CONSTRAINT expenses_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE stock_receipts ADD CONSTRAINT stock_receipts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE stock_receipts ADD CONSTRAINT stock_receipts_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE stock_receipt_items ADD CONSTRAINT stock_receipt_items_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES stock_receipts(id) ON DELETE CASCADE;
ALTER TABLE stock_receipt_items ADD CONSTRAINT stock_receipt_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE worker_debt_payments ADD CONSTRAINT worker_debt_payments_collected_by_fkey FOREIGN KEY (collected_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE sectors ADD CONSTRAINT sectors_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE warehouse_stock ADD CONSTRAINT warehouse_stock_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE warehouse_stock ADD CONSTRAINT warehouse_stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE worker_stock ADD CONSTRAINT worker_stock_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE worker_stock ADD CONSTRAINT worker_stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE worker_stock ADD CONSTRAINT worker_stock_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE stock_alerts ADD CONSTRAINT stock_alerts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE stock_alerts ADD CONSTRAINT stock_alerts_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE customer_debts ADD CONSTRAINT customer_debts_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE customer_debts ADD CONSTRAINT customer_debts_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE customer_debts ADD CONSTRAINT customer_debts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE debt_payments ADD CONSTRAINT debt_payments_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE accounting_sessions ADD CONSTRAINT accounting_sessions_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE accounting_sessions ADD CONSTRAINT accounting_sessions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE accounting_sessions ADD CONSTRAINT accounting_sessions_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE worker_debts ADD CONSTRAINT worker_debts_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE worker_locations ADD CONSTRAINT worker_locations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE sectors ADD CONSTRAINT sectors_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE sectors ADD CONSTRAINT sectors_sales_worker_id_fkey FOREIGN KEY (sales_worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE sectors ADD CONSTRAINT sectors_delivery_worker_id_fkey FOREIGN KEY (delivery_worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD CONSTRAINT tasks_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE worker_debt_payments ADD CONSTRAINT worker_debt_payments_worker_debt_id_fkey FOREIGN KEY (worker_debt_id) REFERENCES worker_debts(id) ON DELETE CASCADE;
ALTER TABLE debt_collections ADD CONSTRAINT debt_collections_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE debt_collections ADD CONSTRAINT debt_collections_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE worker_debts ADD CONSTRAINT worker_debts_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE worker_debts ADD CONSTRAINT worker_debts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE product_shortage_tracking ADD CONSTRAINT product_shortage_tracking_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE stock_confirmations ADD CONSTRAINT stock_confirmations_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE stock_confirmations ADD CONSTRAINT stock_confirmations_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE stock_confirmations ADD CONSTRAINT stock_confirmations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE stock_confirmations ADD CONSTRAINT stock_confirmations_parent_confirmation_id_fkey FOREIGN KEY (parent_confirmation_id) REFERENCES stock_confirmations(id);
ALTER TABLE stock_disputes ADD CONSTRAINT stock_disputes_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES workers(id);
ALTER TABLE stock_disputes ADD CONSTRAINT stock_disputes_guilty_worker_id_fkey FOREIGN KEY (guilty_worker_id) REFERENCES workers(id);
ALTER TABLE stock_confirmations ADD CONSTRAINT stock_confirmations_frozen_by_fkey FOREIGN KEY (frozen_by) REFERENCES workers(id) ON DELETE SET NULL;
ALTER TABLE stock_receipts ADD CONSTRAINT stock_receipts_assistant_approved_by_fkey FOREIGN KEY (assistant_approved_by) REFERENCES workers(id);
ALTER TABLE stock_receipts ADD CONSTRAINT stock_receipts_branch_approved_by_fkey FOREIGN KEY (branch_approved_by) REFERENCES workers(id);
ALTER TABLE factory_orders ADD CONSTRAINT factory_orders_branch_approved_by_fkey FOREIGN KEY (branch_approved_by) REFERENCES workers(id);
ALTER TABLE factory_orders ADD CONSTRAINT factory_orders_assistant_approved_by_fkey FOREIGN KEY (assistant_approved_by) REFERENCES workers(id);
ALTER TABLE manual_invoice_requests ADD CONSTRAINT manual_invoice_requests_branch_approved_by_fkey FOREIGN KEY (branch_approved_by) REFERENCES workers(id);
ALTER TABLE manual_invoice_requests ADD CONSTRAINT manual_invoice_requests_assistant_approved_by_fkey FOREIGN KEY (assistant_approved_by) REFERENCES workers(id);
ALTER TABLE shared_invoices ADD CONSTRAINT shared_invoices_target_branch_id_fkey FOREIGN KEY (target_branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE shared_invoices ADD CONSTRAINT shared_invoices_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES workers(id);
ALTER TABLE shared_invoices ADD CONSTRAINT shared_invoices_downloaded_by_fkey FOREIGN KEY (downloaded_by) REFERENCES workers(id);
ALTER TABLE manual_invoice_requests ADD CONSTRAINT manual_invoice_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE manual_invoice_requests ADD CONSTRAINT manual_invoice_requests_merged_into_request_id_fkey FOREIGN KEY (merged_into_request_id) REFERENCES manual_invoice_requests(id) ON DELETE SET NULL;


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_accounting_session_items_session ON public.accounting_session_items USING btree (session_id);
CREATE INDEX idx_session_items_session ON public.accounting_session_items USING btree (session_id);
CREATE INDEX idx_accounting_sessions_branch ON public.accounting_sessions USING btree (branch_id);
CREATE INDEX idx_accounting_sessions_review ON public.accounting_sessions USING btree (review_session_id);
CREATE INDEX idx_accounting_sessions_status ON public.accounting_sessions USING btree (status);
CREATE INDEX idx_accounting_sessions_worker ON public.accounting_sessions USING btree (worker_id);
CREATE INDEX idx_accounting_sessions_worker_status ON public.accounting_sessions USING btree (worker_id, status, completed_at DESC);
CREATE INDEX idx_activity_logs_action_type ON public.activity_logs USING btree (action_type);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at DESC);
CREATE INDEX idx_activity_logs_entity_type ON public.activity_logs USING btree (entity_type);
CREATE INDEX idx_activity_logs_worker_id ON public.activity_logs USING btree (worker_id);
CREATE INDEX idx_attendance_logs_date ON public.attendance_logs USING btree (recorded_at DESC);
CREATE INDEX idx_attendance_logs_worker ON public.attendance_logs USING btree (worker_id, recorded_at DESC);
CREATE INDEX idx_branches_admin_id ON public.branches USING btree (admin_id);
CREATE INDEX idx_conv_participants_conv ON public.conversation_participants USING btree (conversation_id);
CREATE INDEX idx_conv_participants_worker ON public.conversation_participants USING btree (worker_id);
CREATE INDEX idx_conversations_last_message ON public.conversations USING btree (last_message_at DESC);
CREATE INDEX idx_customer_accounts_status ON public.customer_accounts USING btree (status);
CREATE INDEX idx_customer_accounts_username ON public.customer_accounts USING btree (username);
CREATE INDEX idx_customer_credits_customer ON public.customer_credits USING btree (customer_id);
CREATE INDEX idx_customer_credits_is_used ON public.customer_credits USING btree (is_used);
CREATE INDEX idx_customer_credits_status ON public.customer_credits USING btree (status);
CREATE INDEX idx_customer_credits_type ON public.customer_credits USING btree (credit_type);
CREATE INDEX idx_customer_debts_branch ON public.customer_debts USING btree (branch_id);
CREATE INDEX idx_customer_debts_branch_id ON public.customer_debts USING btree (branch_id);
CREATE INDEX idx_customer_debts_customer ON public.customer_debts USING btree (customer_id);
CREATE INDEX idx_customer_debts_customer_id ON public.customer_debts USING btree (customer_id);
CREATE INDEX idx_customer_debts_due_date ON public.customer_debts USING btree (due_date);
CREATE INDEX idx_customer_debts_order ON public.customer_debts USING btree (order_id);
CREATE INDEX idx_customer_debts_status ON public.customer_debts USING btree (status);
CREATE INDEX idx_customer_debts_worker ON public.customer_debts USING btree (worker_id);
CREATE INDEX idx_customer_debts_worker_id ON public.customer_debts USING btree (worker_id);
CREATE INDEX idx_customers_branch ON public.customers USING btree (branch_id);
CREATE INDEX idx_customers_created_by ON public.customers USING btree (created_by);
CREATE INDEX idx_customers_name_lower ON public.customers USING btree (lower(name));
CREATE INDEX idx_customers_phone ON public.customers USING btree (phone);
CREATE INDEX idx_customers_sector ON public.customers USING btree (sector_id);
CREATE INDEX idx_customers_sector_id ON public.customers USING btree (sector_id);
CREATE INDEX idx_debt_collections_debt_id ON public.debt_collections USING btree (debt_id);
CREATE INDEX idx_debt_collections_status ON public.debt_collections USING btree (status);
CREATE INDEX idx_debt_collections_worker_id ON public.debt_collections USING btree (worker_id);
CREATE INDEX idx_debt_payments_debt_id ON public.debt_payments USING btree (debt_id);
CREATE INDEX idx_debt_payments_worker_id ON public.debt_payments USING btree (worker_id);
CREATE INDEX idx_delivery_route_sectors_route ON public.delivery_route_sectors USING btree (route_id, sort_order);
CREATE INDEX idx_document_collections_order_id ON public.document_collections USING btree (order_id);
CREATE INDEX idx_document_collections_status ON public.document_collections USING btree (status);
CREATE INDEX idx_handover_items_handover_id ON public.handover_items USING btree (handover_id);
CREATE INDEX idx_handover_items_order_id ON public.handover_items USING btree (order_id);
CREATE INDEX idx_loading_session_items_session ON public.loading_session_items USING btree (session_id);
CREATE INDEX idx_loading_sessions_branch ON public.loading_sessions USING btree (branch_id);
CREATE INDEX idx_loading_sessions_worker ON public.loading_sessions USING btree (worker_id);
CREATE INDEX idx_manager_handovers_branch ON public.manager_handovers USING btree (branch_id);
CREATE INDEX idx_manager_handovers_manager ON public.manager_handovers USING btree (manager_id);
CREATE INDEX idx_manager_review_sessions_branch ON public.manager_review_sessions USING btree (branch_id);
CREATE INDEX idx_manager_review_sessions_manager ON public.manager_review_sessions USING btree (manager_id);
CREATE INDEX idx_manager_treasury_branch ON public.manager_treasury USING btree (branch_id);
CREATE INDEX idx_manager_treasury_manager ON public.manager_treasury USING btree (manager_id);
CREATE INDEX idx_manager_treasury_session ON public.manager_treasury USING btree (session_id);
CREATE INDEX idx_manual_invoice_requests_branch_status ON public.manual_invoice_requests USING btree (branch_id, status);
CREATE INDEX idx_manual_invoice_requests_order_id ON public.manual_invoice_requests USING btree (order_id);
CREATE INDEX idx_manual_invoice_requests_scope ON public.manual_invoice_requests USING btree (invoice_scope);
CREATE INDEX idx_manual_invoice_requests_status ON public.manual_invoice_requests USING btree (status);
CREATE INDEX idx_mir_merged_into ON public.manual_invoice_requests USING btree (merged_into_request_id);
CREATE INDEX idx_mir_status ON public.manual_invoice_requests USING btree (status);
CREATE INDEX idx_navbar_preferences_worker_id ON public.navbar_preferences USING btree (worker_id);
CREATE INDEX idx_order_events_created_at ON public.order_events USING btree (created_at DESC);
CREATE INDEX idx_order_events_event_type ON public.order_events USING btree (event_type);
CREATE INDEX idx_order_events_order_id ON public.order_events USING btree (order_id);
CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_id);
CREATE INDEX idx_orders_assigned_worker ON public.orders USING btree (assigned_worker_id);
CREATE INDEX idx_orders_assigned_worker_status ON public.orders USING btree (assigned_worker_id, status, created_at DESC);
CREATE INDEX idx_orders_branch_id ON public.orders USING btree (branch_id);
CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);
CREATE INDEX idx_orders_created_by ON public.orders USING btree (created_by);
CREATE INDEX idx_orders_created_by_customer ON public.orders USING btree (created_by_customer);
CREATE INDEX idx_orders_created_by_status ON public.orders USING btree (created_by, status, created_at DESC);
CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id);
CREATE INDEX idx_orders_doc_due_date ON public.orders USING btree (doc_due_date) WHERE (document_status = 'pending'::text);
CREATE INDEX idx_orders_document_status ON public.orders USING btree (document_status) WHERE (document_status = 'pending'::text);
CREATE INDEX idx_orders_status ON public.orders USING btree (status);
CREATE INDEX idx_orders_updated_at ON public.orders USING btree (updated_at DESC);
CREATE INDEX idx_offer_tiers_offer_id ON public.product_offer_tiers USING btree (offer_id);
CREATE INDEX idx_offer_tiers_order ON public.product_offer_tiers USING btree (offer_id, tier_order);
CREATE INDEX idx_product_offers_active ON public.product_offers USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_product_offers_dates ON public.product_offers USING btree (start_date, end_date);
CREATE INDEX idx_product_offers_product_id ON public.product_offers USING btree (product_id);
CREATE INDEX idx_shortage_branch ON public.product_shortage_tracking USING btree (branch_id, status);
CREATE INDEX idx_shortage_product_status ON public.product_shortage_tracking USING btree (product_id, status);
CREATE INDEX idx_products_product_code ON public.products USING btree (product_code);
CREATE INDEX idx_products_sort_order ON public.products USING btree (sort_order);
CREATE INDEX idx_promo_split_customers_customer ON public.promo_split_customers USING btree (customer_id);
CREATE INDEX idx_promo_split_customers_split ON public.promo_split_customers USING btree (split_id);
CREATE INDEX idx_promo_split_installments_customer ON public.promo_split_installments USING btree (split_customer_id);
CREATE INDEX idx_promo_split_installments_date ON public.promo_split_installments USING btree (scheduled_date);
CREATE INDEX idx_promo_splits_branch ON public.promo_splits USING btree (branch_id);
CREATE INDEX idx_promo_splits_offer ON public.promo_splits USING btree (offer_id);
CREATE INDEX idx_promo_splits_product ON public.promo_splits USING btree (product_id);
CREATE INDEX idx_promo_splits_status ON public.promo_splits USING btree (status);
CREATE INDEX idx_promos_customer ON public.promos USING btree (customer_id);
CREATE INDEX idx_promos_date ON public.promos USING btree (promo_date);
CREATE INDEX idx_promos_offer_id ON public.promos USING btree (offer_id);
CREATE INDEX idx_promos_offer_tier_id ON public.promos USING btree (offer_tier_id);
CREATE INDEX idx_promos_product ON public.promos USING btree (product_id);
CREATE INDEX idx_promos_worker ON public.promos USING btree (worker_id);
CREATE INDEX idx_promos_worker_promo_date ON public.promos USING btree (worker_id, promo_date DESC);
CREATE INDEX idx_receipt_modifications_is_reviewed ON public.receipt_modifications USING btree (is_reviewed);
CREATE INDEX idx_receipt_modifications_receipt_id ON public.receipt_modifications USING btree (receipt_id);
CREATE INDEX idx_receipts_branch_id ON public.receipts USING btree (branch_id);
CREATE INDEX idx_receipts_created_at ON public.receipts USING btree (created_at DESC);
CREATE INDEX idx_receipts_customer_id ON public.receipts USING btree (customer_id);
CREATE INDEX idx_receipts_order_id ON public.receipts USING btree (order_id);
CREATE INDEX idx_receipts_receipt_type ON public.receipts USING btree (receipt_type);
CREATE INDEX idx_receipts_worker_id ON public.receipts USING btree (worker_id);
CREATE INDEX idx_role_ui_overrides_role ON public.role_ui_overrides USING btree (role_id);
CREATE INDEX idx_sector_coverage_absent ON public.sector_coverage USING btree (absent_worker_id, is_active);
CREATE INDEX idx_sector_coverage_active ON public.sector_coverage USING btree (is_active, start_date, end_date);
CREATE INDEX idx_sector_coverage_approval_status ON public.sector_coverage USING btree (approval_status);
CREATE INDEX idx_sector_coverage_pending_approval ON public.sector_coverage USING btree (approval_status, branch_id) WHERE (is_active = true);
CREATE INDEX idx_sector_coverage_substitute ON public.sector_coverage USING btree (substitute_worker_id, is_active);
CREATE INDEX idx_sectors_branch_id ON public.sectors USING btree (branch_id);
CREATE INDEX idx_shared_invoices_branch ON public.shared_invoices USING btree (target_branch_id);
CREATE INDEX idx_shared_invoices_uploader ON public.shared_invoices USING btree (uploaded_by);
CREATE INDEX idx_stock_confirmations_manager ON public.stock_confirmations USING btree (manager_id);
CREATE INDEX idx_stock_confirmations_worker ON public.stock_confirmations USING btree (worker_id, status);
CREATE INDEX idx_stock_discrepancies_product ON public.stock_discrepancies USING btree (product_id);
CREATE INDEX idx_stock_discrepancies_status ON public.stock_discrepancies USING btree (status);
CREATE INDEX idx_stock_discrepancies_worker ON public.stock_discrepancies USING btree (worker_id);
CREATE INDEX idx_stock_movements_branch ON public.stock_movements USING btree (branch_id);
CREATE INDEX idx_stock_movements_created ON public.stock_movements USING btree (created_at DESC);
CREATE INDEX idx_stock_movements_order ON public.stock_movements USING btree (order_id);
CREATE INDEX idx_stock_movements_product ON public.stock_movements USING btree (product_id);
CREATE INDEX idx_stock_movements_status ON public.stock_movements USING btree (status);
CREATE INDEX idx_stock_movements_type ON public.stock_movements USING btree (movement_type);
CREATE INDEX idx_stock_movements_worker ON public.stock_movements USING btree (worker_id);
CREATE INDEX idx_stock_receipts_status ON public.stock_receipts USING btree (status);
CREATE INDEX idx_tasks_assigned_to ON public.tasks USING btree (assigned_to);
CREATE INDEX idx_tasks_branch_id ON public.tasks USING btree (branch_id);
CREATE INDEX idx_tasks_created_by ON public.tasks USING btree (created_by);
CREATE INDEX idx_tasks_status ON public.tasks USING btree (status);
CREATE INDEX idx_tasks_type ON public.tasks USING btree (type);
CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role);
CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);
CREATE INDEX idx_user_roles_worker_id ON public.user_roles USING btree (worker_id);
CREATE INDEX idx_visit_tracking_created_at ON public.visit_tracking USING btree (created_at DESC);
CREATE INDEX idx_visit_tracking_customer ON public.visit_tracking USING btree (customer_id);
CREATE INDEX idx_visit_tracking_operation_type ON public.visit_tracking USING btree (operation_type);
CREATE INDEX idx_visit_tracking_worker ON public.visit_tracking USING btree (worker_id);
CREATE INDEX idx_visit_tracking_worker_date ON public.visit_tracking USING btree (worker_id, created_at DESC);
CREATE INDEX idx_warehouse_review_items_session ON public.warehouse_review_items USING btree (session_id);
CREATE INDEX idx_warehouse_review_sessions_branch ON public.warehouse_review_sessions USING btree (branch_id);
CREATE INDEX idx_warehouse_stock_branch ON public.warehouse_stock USING btree (branch_id);
CREATE INDEX idx_warehouse_stock_product ON public.warehouse_stock USING btree (product_id);
CREATE INDEX idx_warehouse_stock_product_branch ON public.warehouse_stock USING btree (product_id, branch_id);
CREATE UNIQUE INDEX warehouse_stock_branch_product_uniq ON public.warehouse_stock USING btree (branch_id, product_id);
CREATE INDEX idx_worker_debt_payments_debt_id ON public.worker_debt_payments USING btree (worker_debt_id);
CREATE INDEX idx_worker_debts_session_id ON public.worker_debts USING btree (session_id);
CREATE INDEX idx_worker_debts_worker_id ON public.worker_debts USING btree (worker_id);
CREATE INDEX idx_worker_load_request_items_request ON public.worker_load_request_items USING btree (request_id);
CREATE INDEX idx_worker_load_requests_status ON public.worker_load_requests USING btree (status);
CREATE INDEX idx_worker_load_requests_worker ON public.worker_load_requests USING btree (worker_id);
CREATE INDEX idx_worker_roles_custom_role_id ON public.worker_roles USING btree (custom_role_id);
CREATE UNIQUE INDEX idx_worker_roles_one_primary_active ON public.worker_roles USING btree (worker_id) WHERE ((is_primary = true) AND (is_active = true));
CREATE INDEX idx_worker_stock_product ON public.worker_stock USING btree (product_id);
CREATE INDEX idx_worker_stock_product_branch ON public.worker_stock USING btree (product_id, branch_id);
CREATE INDEX idx_worker_stock_worker ON public.worker_stock USING btree (worker_id);
CREATE INDEX idx_worker_ui_overrides_worker ON public.worker_ui_overrides USING btree (worker_id);
CREATE INDEX idx_workers_branch ON public.workers USING btree (branch_id);
CREATE INDEX idx_workers_is_active ON public.workers USING btree (is_active);
CREATE INDEX idx_workers_is_test ON public.workers USING btree (is_test) WHERE (is_test = true);
CREATE INDEX idx_workers_role ON public.workers USING btree (role);


-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER trg_calculate_debt_remaining BEFORE INSERT OR UPDATE OF total_amount, paid_amount ON public.customer_debts FOR EACH ROW EXECUTE FUNCTION calculate_debt_remaining_amount();
CREATE TRIGGER trg_auto_create_manual_invoice_request AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION auto_create_manual_invoice_request();
CREATE TRIGGER set_shared_invoices_updated_at BEFORE UPDATE ON public.shared_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auto_freeze_stock_confirmation BEFORE INSERT OR UPDATE OF status ON public.stock_confirmations FOR EACH ROW EXECUTE FUNCTION auto_freeze_stock_confirmation();
CREATE TRIGGER update_stock_confirmations_updated_at BEFORE UPDATE ON public.stock_confirmations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stock_disputes_updated_at BEFORE UPDATE ON public.stock_disputes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public."6666666666" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_session_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_pallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_exchange_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_exchange_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_special_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_route_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_points_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loading_session_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_treasury ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_invoice_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_bonus_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navbar_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pallet_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pallet_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_offer_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_pricing_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_shortage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_split_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_split_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quantity_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_reserve_fund ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_ui_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sector_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sector_schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sector_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sector_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stamp_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_discrepancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisor_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_55555555520262026 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_attendance_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_liability_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_load_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_load_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_ui_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- RLS POLICIES
-- ============================================================

CREATE POLICY "Admins can manage session_items" ON public.accounting_session_items AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM accounting_sessions s
  WHERE ((s.id = accounting_session_items.session_id) AND (is_admin() OR is_branch_admin())))));
CREATE POLICY "Workers can view their session items" ON public.accounting_session_items AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM accounting_sessions s
  WHERE ((s.id = accounting_session_items.session_id) AND (s.worker_id = get_worker_id())))));
CREATE POLICY "Admins can manage accounting_sessions" ON public.accounting_sessions AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view their own sessions" ON public.accounting_sessions AS PERMISSIVE FOR SELECT TO public USING ((worker_id = get_worker_id()));
CREATE POLICY "Admins can delete activity_logs" ON public.activity_logs AS PERMISSIVE FOR DELETE TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "View activity logs based on role" ON public.activity_logs AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR (get_user_role() = 'supervisor'::app_role) OR has_custom_role('internal_supervisor'::text) OR has_custom_role('company_manager'::text) OR (is_branch_admin() AND (branch_id IN ( SELECT branches.id
   FROM branches
  WHERE (branches.admin_id = get_worker_id())))) OR (worker_id = get_worker_id())));
CREATE POLICY "Workers can insert their own logs" ON public.activity_logs AS PERMISSIVE FOR INSERT TO public WITH CHECK (((worker_id = get_worker_id()) OR is_admin()));
CREATE POLICY "Admins can insert app settings" ON public.app_settings AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admins can update app settings" ON public.app_settings AS PERMISSIVE FOR UPDATE TO public USING (true);
CREATE POLICY "Everyone can read app settings" ON public.app_settings AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Admins can view all attendance" ON public.attendance_logs AS PERMISSIVE FOR SELECT TO authenticated USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can insert own attendance" ON public.attendance_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((worker_id = get_worker_id()));
CREATE POLICY "Workers can view own attendance" ON public.attendance_logs AS PERMISSIVE FOR SELECT TO authenticated USING ((worker_id = get_worker_id()));
CREATE POLICY "Authenticated users can insert backup logs" ON public.backup_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update backup logs" ON public.backup_logs AS PERMISSIVE FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can view backup logs" ON public.backup_logs AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage branch_pallets" ON public.branch_pallets AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view branch_pallets" ON public.branch_pallets AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can manage all branches" ON public.branches AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Allow read access to branches" ON public.branches AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage coin_exchange_returns" ON public.coin_exchange_returns AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view their own returns" ON public.coin_exchange_returns AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM coin_exchange_tasks t
  WHERE ((t.id = coin_exchange_returns.task_id) AND (t.worker_id = get_worker_id())))));
CREATE POLICY "Admins can manage coin_exchange_tasks" ON public.coin_exchange_tasks AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view their own coin tasks" ON public.coin_exchange_tasks AS PERMISSIVE FOR SELECT TO public USING ((worker_id = get_worker_id()));
CREATE POLICY "Workers can insert participants" ON public.conversation_participants AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_worker());
CREATE POLICY "Workers can update their own participation" ON public.conversation_participants AS PERMISSIVE FOR UPDATE TO authenticated USING ((worker_id = get_worker_id()));
CREATE POLICY "Workers can view their participations" ON public.conversation_participants AS PERMISSIVE FOR SELECT TO authenticated USING (((worker_id = get_worker_id()) OR is_conversation_participant(conversation_id)));
CREATE POLICY "Participants can update conversations" ON public.conversations AS PERMISSIVE FOR UPDATE TO authenticated USING (is_conversation_participant(id)) WITH CHECK (is_conversation_participant(id));
CREATE POLICY "Workers can create conversations" ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_worker());
CREATE POLICY "Workers can view their conversations" ON public.conversations AS PERMISSIVE FOR SELECT TO authenticated USING (((created_by = get_worker_id()) OR is_conversation_participant(id)));
CREATE POLICY "Admins can manage custom_roles" ON public.custom_roles AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Allow read access to custom_roles" ON public.custom_roles AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Admins can delete customer_accounts" ON public.customer_accounts AS PERMISSIVE FOR DELETE TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Allow read access to customer_accounts" ON public.customer_accounts AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Allow update customer_accounts" ON public.customer_accounts AS PERMISSIVE FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can register" ON public.customer_accounts AS PERMISSIVE FOR INSERT TO public WITH CHECK ((status = 'pending'::text));
CREATE POLICY "Customers can update own basic info" ON public.customer_accounts AS PERMISSIVE FOR UPDATE TO public USING (((id = (current_setting('app.customer_account_id'::text, true))::uuid) AND (status = 'approved'::text)));
CREATE POLICY "Customers can view own account" ON public.customer_accounts AS PERMISSIVE FOR SELECT TO public USING ((id = (current_setting('app.customer_account_id'::text, true))::uuid));
CREATE POLICY "Admins can view all requests" ON public.customer_approval_requests AS PERMISSIVE FOR SELECT TO public USING (is_admin());
CREATE POLICY "Admins/Managers can update requests" ON public.customer_approval_requests AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR ((get_user_role() = 'branch_admin'::app_role) AND (branch_id IN ( SELECT branches.id
   FROM branches
  WHERE (branches.admin_id = get_worker_id()))))));
CREATE POLICY "Branch admins can view branch requests" ON public.customer_approval_requests AS PERMISSIVE FOR SELECT TO public USING ((((get_user_role() = 'branch_admin'::app_role) AND (branch_id IN ( SELECT branches.id
   FROM branches
  WHERE (branches.admin_id = get_worker_id())))) OR ((get_user_role() = 'supervisor'::app_role) AND (branch_id IN ( SELECT branches.id
   FROM branches
  WHERE (branches.admin_id = get_worker_id()))))));
CREATE POLICY "Workers can insert requests" ON public.customer_approval_requests AS PERMISSIVE FOR INSERT TO public WITH CHECK ((requested_by = get_worker_id()));
CREATE POLICY "Workers can view own requests" ON public.customer_approval_requests AS PERMISSIVE FOR SELECT TO public USING ((requested_by = get_worker_id()));
CREATE POLICY "Admins can manage customer_credits" ON public.customer_credits AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can insert customer_credits" ON public.customer_credits AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_worker() AND (worker_id = get_worker_id())));
CREATE POLICY "Workers can update customer_credits" ON public.customer_credits AS PERMISSIVE FOR UPDATE TO public USING (is_worker());
CREATE POLICY "Workers can view customer_credits" ON public.customer_credits AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can do everything on customer_debts" ON public.customer_debts AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can insert debts" ON public.customer_debts AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_worker());
CREATE POLICY "Workers can update debts" ON public.customer_debts AS PERMISSIVE FOR UPDATE TO public USING (is_worker()) WITH CHECK (is_worker());
CREATE POLICY "Workers can view debts" ON public.customer_debts AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Customers can view own special prices" ON public.customer_special_prices AS PERMISSIVE FOR SELECT TO public USING ((customer_id = ( SELECT customer_accounts.customer_id
   FROM customer_accounts
  WHERE (customer_accounts.id = (current_setting('app.customer_account_id'::text, true))::uuid))));
CREATE POLICY "Manage customer special prices" ON public.customer_special_prices AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin())) WITH CHECK ((is_admin() OR is_branch_admin()));
CREATE POLICY "View customer special prices" ON public.customer_special_prices AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR is_branch_admin() OR (get_user_role() = 'supervisor'::app_role) OR has_custom_role('internal_supervisor'::text) OR has_custom_role('company_manager'::text)));
CREATE POLICY "Admins can delete customers" ON public.customers AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admins can update customers" ON public.customers AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Allow insert customers" ON public.customers AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow read access to customers" ON public.customers AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Update customer trust badge" ON public.customers AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR (is_branch_admin() AND (branch_id IN ( SELECT branches.id
   FROM branches
  WHERE (branches.admin_id = get_worker_id()))))));
CREATE POLICY "Workers can delete their customers" ON public.customers AS PERMISSIVE FOR DELETE TO public USING ((is_admin() OR (is_worker() AND (created_by = get_worker_id())) OR (is_branch_admin() AND (branch_id IN ( SELECT b.id
   FROM branches b
  WHERE (b.admin_id = get_worker_id()))))));
CREATE POLICY "Workers can update branch customers" ON public.customers AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_admin() OR is_branch_admin() OR (is_worker() AND (branch_id = get_worker_branch_id())) OR (created_by = get_worker_id()))) WITH CHECK ((is_admin() OR is_branch_admin() OR (is_worker() AND (branch_id = get_worker_branch_id())) OR (created_by = get_worker_id())));
CREATE POLICY "Admins can update collections" ON public.debt_collections AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can create collections" ON public.debt_collections AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_worker() AND (worker_id = get_worker_id())));
CREATE POLICY "Workers can view their collections" ON public.debt_collections AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can do everything on debt_payments" ON public.debt_payments AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can insert debt_payments" ON public.debt_payments AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_worker());
CREATE POLICY "Workers can view debt_payments" ON public.debt_payments AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can manage delivery_route_sectors" ON public.delivery_route_sectors AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view delivery_route_sectors" ON public.delivery_route_sectors AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can manage delivery_routes" ON public.delivery_routes AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view delivery_routes" ON public.delivery_routes AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can manage document_collections" ON public.document_collections AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Admins can update document_collections" ON public.document_collections AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can create document_collections" ON public.document_collections AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_worker() AND (worker_id = get_worker_id())));
CREATE POLICY "Workers can view document_collections" ON public.document_collections AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can manage employee_points_log" ON public.employee_points_log AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view own points" ON public.employee_points_log AS PERMISSIVE FOR SELECT TO public USING ((worker_id = get_worker_id()));
CREATE POLICY "Admins can manage expense categories" ON public.expense_categories AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin())) WITH CHECK ((is_admin() OR is_branch_admin()));
CREATE POLICY "Anyone can read expense categories" ON public.expense_categories AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Admins can delete expenses" ON public.expenses AS PERMISSIVE FOR DELETE TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can create own expenses" ON public.expenses AS PERMISSIVE FOR INSERT TO public WITH CHECK ((worker_id = get_worker_id()));
CREATE POLICY "Workers can delete own pending expenses" ON public.expenses AS PERMISSIVE FOR DELETE TO public USING (((worker_id = get_worker_id()) AND (status = 'pending'::text)));
CREATE POLICY "Workers can update own pending expenses" ON public.expenses AS PERMISSIVE FOR UPDATE TO public USING ((((worker_id = get_worker_id()) AND (status = 'pending'::text)) OR is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view own expenses" ON public.expenses AS PERMISSIVE FOR SELECT TO public USING (((worker_id = get_worker_id()) OR is_admin() OR is_branch_admin()));
CREATE POLICY "Admin/branch_admin/warehouse can create factory order items" ON public.factory_order_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((get_user_role() = ANY (ARRAY['admin'::app_role, 'branch_admin'::app_role])) OR has_custom_role('warehouse_manager'::text)));
CREATE POLICY "Admins can manage factory_order_items" ON public.factory_order_items AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM factory_orders fo
  WHERE ((fo.id = factory_order_items.factory_order_id) AND (is_admin() OR is_branch_admin())))));
CREATE POLICY "Workers can view factory_order_items" ON public.factory_order_items AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM factory_orders fo
  WHERE ((fo.id = factory_order_items.factory_order_id) AND is_worker()))));
CREATE POLICY "Admin/branch_admin/warehouse can create factory orders" ON public.factory_orders AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((get_user_role() = ANY (ARRAY['admin'::app_role, 'branch_admin'::app_role])) OR has_custom_role('warehouse_manager'::text)));
CREATE POLICY "Admin/branch_admin/warehouse can update factory orders" ON public.factory_orders AS PERMISSIVE FOR UPDATE TO authenticated USING (((get_user_role() = ANY (ARRAY['admin'::app_role, 'branch_admin'::app_role])) OR has_custom_role('warehouse_manager'::text)));
CREATE POLICY "Admins can manage factory_orders" ON public.factory_orders AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view factory_orders" ON public.factory_orders AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can manage handover_items" ON public.handover_items AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view handover_items" ON public.handover_items AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM manager_handovers h
  WHERE ((h.id = handover_items.handover_id) AND (h.manager_id = get_worker_id())))));
CREATE POLICY "Admins and managers can manage loading_session_items" ON public.loading_session_items AS PERMISSIVE FOR ALL TO authenticated USING ((is_admin() OR is_branch_admin() OR (get_user_role() = ANY (ARRAY['warehouse_manager'::app_role, 'supervisor'::app_role])) OR has_custom_role('warehouse_manager'::text) OR has_custom_role('supervisor'::text) OR (EXISTS ( SELECT 1
   FROM loading_sessions ls
  WHERE ((ls.id = loading_session_items.session_id) AND (ls.worker_id = get_worker_id())))))) WITH CHECK ((is_admin() OR is_branch_admin() OR (get_user_role() = ANY (ARRAY['warehouse_manager'::app_role, 'supervisor'::app_role])) OR has_custom_role('warehouse_manager'::text) OR has_custom_role('supervisor'::text) OR (EXISTS ( SELECT 1
   FROM loading_sessions ls
  WHERE ((ls.id = loading_session_items.session_id) AND (ls.worker_id = get_worker_id()))))));
CREATE POLICY "Workers can view their session items" ON public.loading_session_items AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM loading_sessions s
  WHERE ((s.id = loading_session_items.session_id) AND (s.worker_id = get_worker_id())))));
CREATE POLICY "Admins and managers can manage loading_sessions" ON public.loading_sessions AS PERMISSIVE FOR ALL TO authenticated USING ((is_admin() OR is_branch_admin() OR (get_user_role() = ANY (ARRAY['warehouse_manager'::app_role, 'supervisor'::app_role])) OR has_custom_role('warehouse_manager'::text) OR has_custom_role('supervisor'::text))) WITH CHECK ((is_admin() OR is_branch_admin() OR (get_user_role() = ANY (ARRAY['warehouse_manager'::app_role, 'supervisor'::app_role])) OR has_custom_role('warehouse_manager'::text) OR has_custom_role('supervisor'::text)));
CREATE POLICY "Workers can view their own loading sessions" ON public.loading_sessions AS PERMISSIVE FOR SELECT TO public USING ((worker_id = get_worker_id()));
CREATE POLICY "Admins can manage manager_handovers" ON public.manager_handovers AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view handovers" ON public.manager_handovers AS PERMISSIVE FOR SELECT TO public USING ((manager_id = get_worker_id()));
CREATE POLICY "Admins can delete review sessions" ON public.manager_review_sessions AS PERMISSIVE FOR DELETE TO authenticated USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Admins can insert review sessions" ON public.manager_review_sessions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_admin() OR is_branch_admin()));
CREATE POLICY "Admins can update review sessions" ON public.manager_review_sessions AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view review sessions" ON public.manager_review_sessions AS PERMISSIVE FOR SELECT TO authenticated USING (is_worker());
CREATE POLICY "Admins can manage manager_treasury" ON public.manager_treasury AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view treasury" ON public.manager_treasury AS PERMISSIVE FOR SELECT TO public USING ((manager_id = get_worker_id()));
CREATE POLICY "Admins can manage manager assignments" ON public.manager_workers AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Workers can view manager assignments" ON public.manager_workers AS PERMISSIVE FOR SELECT TO authenticated USING (is_worker());
CREATE POLICY "Workers can insert manual_invoice_requests" ON public.manual_invoice_requests AS PERMISSIVE FOR INSERT TO public WITH CHECK ((worker_id = get_worker_id()));
CREATE POLICY "Workers can view own manual_invoice_requests" ON public.manual_invoice_requests AS PERMISSIVE FOR SELECT TO public USING ((worker_id = get_worker_id()));
CREATE POLICY manual_invoice_requests_select_workflow ON public.manual_invoice_requests AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR has_custom_role('company_manager'::text) OR (worker_id = get_worker_id()) OR current_worker_manages_branch(branch_id) OR (EXISTS ( SELECT 1
   FROM workers w
  WHERE ((w.id = manual_invoice_requests.worker_id) AND current_worker_manages_branch(w.branch_id))))));
CREATE POLICY manual_invoice_requests_update_workflow ON public.manual_invoice_requests AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR has_custom_role('company_manager'::text) OR current_worker_manages_branch(branch_id) OR (EXISTS ( SELECT 1
   FROM workers w
  WHERE ((w.id = manual_invoice_requests.worker_id) AND current_worker_manages_branch(w.branch_id)))))) WITH CHECK ((is_admin() OR has_custom_role('company_manager'::text) OR current_worker_manages_branch(branch_id) OR (EXISTS ( SELECT 1
   FROM workers w
  WHERE ((w.id = manual_invoice_requests.worker_id) AND current_worker_manages_branch(w.branch_id))))));
CREATE POLICY "Admins can manage monthly_bonus_summary" ON public.monthly_bonus_summary AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view own bonus summary" ON public.monthly_bonus_summary AS PERMISSIVE FOR SELECT TO public USING ((worker_id = get_worker_id()));
CREATE POLICY "Admins can manage all navbar preferences" ON public.navbar_preferences AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can insert own navbar preferences" ON public.navbar_preferences AS PERMISSIVE FOR INSERT TO public WITH CHECK ((worker_id = get_worker_id()));
CREATE POLICY "Workers can update own navbar preferences" ON public.navbar_preferences AS PERMISSIVE FOR UPDATE TO public USING ((worker_id = get_worker_id()));
CREATE POLICY "Workers can view own navbar preferences" ON public.navbar_preferences AS PERMISSIVE FOR SELECT TO public USING ((worker_id = get_worker_id()));
CREATE POLICY "Workers can insert order events" ON public.order_events AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_worker());
CREATE POLICY "Workers can view order events" ON public.order_events AS PERMISSIVE FOR SELECT TO authenticated USING (is_worker());
CREATE POLICY "Customers can insert order items" ON public.order_items AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.created_by_customer = (current_setting('app.customer_account_id'::text, true))::uuid) AND (o.status = 'pending'::text)))));
CREATE POLICY "Customers can view own order items" ON public.order_items AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.created_by_customer = (current_setting('app.customer_account_id'::text, true))::uuid)))));
CREATE POLICY "Delete order items" ON public.order_items AS PERMISSIVE FOR DELETE TO public USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (is_admin() OR ((o.created_by = get_worker_id()) AND (o.status = ANY (ARRAY['pending'::text, 'assigned'::text, 'in_progress'::text, 'delivered'::text]))) OR ((o.assigned_worker_id = get_worker_id()) AND (o.status = ANY (ARRAY['assigned'::text, 'in_progress'::text, 'delivered'::text]))) OR (is_branch_admin() AND (o.branch_id IN ( SELECT branches.id
           FROM branches
          WHERE (branches.admin_id = get_worker_id())))))))));
CREATE POLICY "Insert order items" ON public.order_items AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (is_admin() OR ((o.created_by = get_worker_id()) AND (o.status = ANY (ARRAY['pending'::text, 'assigned'::text, 'in_progress'::text, 'delivered'::text]))) OR ((o.assigned_worker_id = get_worker_id()) AND (o.status = ANY (ARRAY['assigned'::text, 'in_progress'::text, 'delivered'::text]))) OR (is_branch_admin() AND (o.branch_id IN ( SELECT branches.id
           FROM branches
          WHERE (branches.admin_id = get_worker_id())))))))));
CREATE POLICY "Update order items" ON public.order_items AS PERMISSIVE FOR UPDATE TO public USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (is_admin() OR ((o.created_by = get_worker_id()) AND (o.status = ANY (ARRAY['pending'::text, 'assigned'::text, 'in_progress'::text, 'delivered'::text]))) OR ((o.assigned_worker_id = get_worker_id()) AND (o.status = ANY (ARRAY['assigned'::text, 'in_progress'::text, 'delivered'::text]))) OR (is_branch_admin() AND (o.branch_id IN ( SELECT branches.id
           FROM branches
          WHERE (branches.admin_id = get_worker_id())))))))));
CREATE POLICY "View order items" ON public.order_items AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (is_admin() OR has_custom_role('company_manager'::text) OR has_custom_role('internal_supervisor'::text) OR (get_user_role() = 'supervisor'::app_role) OR (o.created_by = get_worker_id()) OR (o.assigned_worker_id = get_worker_id()) OR (is_branch_admin() AND (o.branch_id IN ( SELECT branches.id
           FROM branches
          WHERE (branches.admin_id = get_worker_id())))) OR (EXISTS ( SELECT 1
           FROM workers w
          WHERE (((w.id = o.created_by) OR (w.id = o.assigned_worker_id)) AND current_worker_manages_branch(w.branch_id)))))))));
CREATE POLICY "Customers can cancel pending orders" ON public.orders AS PERMISSIVE FOR UPDATE TO public USING (((created_by_customer = (current_setting('app.customer_account_id'::text, true))::uuid) AND (status = 'pending'::text)));
CREATE POLICY "Customers can create orders" ON public.orders AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_approved_customer() AND (created_by_customer = (current_setting('app.customer_account_id'::text, true))::uuid)));
CREATE POLICY "Customers can view own orders" ON public.orders AS PERMISSIVE FOR SELECT TO public USING ((created_by_customer = (current_setting('app.customer_account_id'::text, true))::uuid));
CREATE POLICY "Delete orders" ON public.orders AS PERMISSIVE FOR DELETE TO public USING ((is_admin() OR ((created_by = get_worker_id()) AND (status = 'pending'::text))));
CREATE POLICY "Sales rep can create orders" ON public.orders AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_admin() OR (is_worker() AND (created_by = get_worker_id()))));
CREATE POLICY "Update orders based on role" ON public.orders AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR (is_branch_admin() AND (branch_id IN ( SELECT branches.id
   FROM branches
  WHERE (branches.admin_id = get_worker_id())))) OR (get_user_role() = 'supervisor'::app_role) OR (created_by = get_worker_id()) OR (assigned_worker_id = get_worker_id())));
CREATE POLICY "View orders based on role" ON public.orders AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR has_custom_role('company_manager'::text) OR has_custom_role('internal_supervisor'::text) OR (get_user_role() = 'supervisor'::app_role) OR (is_branch_admin() AND (branch_id IN ( SELECT branches.id
   FROM branches
  WHERE (branches.admin_id = get_worker_id())))) OR (created_by = get_worker_id()) OR (assigned_worker_id = get_worker_id()) OR (EXISTS ( SELECT 1
   FROM workers w
  WHERE (((w.id = orders.created_by) OR (w.id = orders.assigned_worker_id)) AND current_worker_manages_branch(w.branch_id))))));
CREATE POLICY "Admins can manage pallet_movements" ON public.pallet_movements AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view pallet_movements" ON public.pallet_movements AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Workers can manage pallet_settings in own branch" ON public.pallet_settings AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR (is_worker() AND (branch_id = get_worker_branch_id())))) WITH CHECK ((is_admin() OR (is_worker() AND (branch_id = get_worker_branch_id()))));
CREATE POLICY "Workers can view pallet_settings" ON public.pallet_settings AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can manage permissions" ON public.permissions AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Allow read access to permissions" ON public.permissions AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage pricing_groups" ON public.pricing_groups AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Allow read access to pricing_groups" ON public.pricing_groups AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Allow delete for admins and branch admins" ON public.product_offer_tiers AS PERMISSIVE FOR DELETE TO public USING (can_manage_product_offers(get_worker_id()));
CREATE POLICY "Allow insert for admins and branch admins" ON public.product_offer_tiers AS PERMISSIVE FOR INSERT TO public WITH CHECK (can_manage_product_offers(get_worker_id()));
CREATE POLICY "Allow read access to all workers" ON public.product_offer_tiers AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Allow update for admins and branch admins" ON public.product_offer_tiers AS PERMISSIVE FOR UPDATE TO public USING (can_manage_product_offers(get_worker_id()));
CREATE POLICY "Admins can create product offers" ON public.product_offers AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_admin() OR is_branch_admin()));
CREATE POLICY "Admins can delete product offers" ON public.product_offers AS PERMISSIVE FOR DELETE TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Admins can update product offers" ON public.product_offers AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Manage offers" ON public.product_offers AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR (is_branch_admin() AND ((branch_id IS NULL) OR (branch_id IN ( SELECT branches.id
   FROM branches
  WHERE (branches.admin_id = get_worker_id()))))))) WITH CHECK ((is_admin() OR (is_branch_admin() AND ((branch_id IS NULL) OR (branch_id IN ( SELECT branches.id
   FROM branches
  WHERE (branches.admin_id = get_worker_id())))))));
CREATE POLICY "Managers can delete product offers" ON public.product_offers AS PERMISSIVE FOR DELETE TO anon, authenticated USING (can_manage_product_offers(created_by));
CREATE POLICY "Managers can insert product offers" ON public.product_offers AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (can_manage_product_offers(created_by));
CREATE POLICY "Managers can update product offers" ON public.product_offers AS PERMISSIVE FOR UPDATE TO anon, authenticated USING (can_manage_product_offers(created_by)) WITH CHECK (can_manage_product_offers(created_by));
CREATE POLICY "Product offers are readable" ON public.product_offers AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "View active offers" ON public.product_offers AS PERMISSIVE FOR SELECT TO public USING (((is_active = true) OR is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view all product offers" ON public.product_offers AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage product_pricing_groups" ON public.product_pricing_groups AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Allow read access to product_pricing_groups" ON public.product_pricing_groups AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Workers can delete shortage tracking" ON public.product_shortage_tracking AS PERMISSIVE FOR DELETE TO public USING (is_worker());
CREATE POLICY "Workers can insert shortage tracking" ON public.product_shortage_tracking AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_worker());
CREATE POLICY "Workers can update shortage tracking" ON public.product_shortage_tracking AS PERMISSIVE FOR UPDATE TO public USING (is_worker());
CREATE POLICY "Workers can view shortage tracking" ON public.product_shortage_tracking AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins and branch admins can delete products" ON public.products AS PERMISSIVE FOR DELETE TO public USING ((is_admin() OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'branch_admin'::app_role))))));
CREATE POLICY "Admins and branch admins can insert products" ON public.products AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_admin() OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'branch_admin'::app_role))))));
CREATE POLICY "Admins and branch admins can update products" ON public.products AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'branch_admin'::app_role))))));
CREATE POLICY "Allow read access to products" ON public.products AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Customers can view active products" ON public.products AS PERMISSIVE FOR SELECT TO public USING ((is_active = true));
CREATE POLICY "Admin/branch_admin manage promo_split_customers" ON public.promo_split_customers AS PERMISSIVE FOR ALL TO authenticated USING ((is_admin() OR is_branch_admin())) WITH CHECK ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view promo_split_customers" ON public.promo_split_customers AS PERMISSIVE FOR SELECT TO authenticated USING (is_worker());
CREATE POLICY "Admin/branch_admin manage promo_split_installments" ON public.promo_split_installments AS PERMISSIVE FOR ALL TO authenticated USING ((is_admin() OR is_branch_admin())) WITH CHECK ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view promo_split_installments" ON public.promo_split_installments AS PERMISSIVE FOR SELECT TO authenticated USING (is_worker());
CREATE POLICY "Admin/branch_admin manage promo_splits" ON public.promo_splits AS PERMISSIVE FOR ALL TO authenticated USING ((is_admin() OR is_branch_admin())) WITH CHECK ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view promo_splits" ON public.promo_splits AS PERMISSIVE FOR SELECT TO authenticated USING (is_worker());
CREATE POLICY "Admins can delete promos" ON public.promos AS PERMISSIVE FOR DELETE TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Allow read access to promos" ON public.promos AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert promos" ON public.promos AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_admin() OR (is_worker() AND (worker_id = get_worker_id()))));
CREATE POLICY "Workers can delete their own promos" ON public.promos AS PERMISSIVE FOR DELETE TO public USING ((is_admin() OR (is_worker() AND (worker_id = get_worker_id()))));
CREATE POLICY "Workers can update their own promos" ON public.promos AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR (is_worker() AND (worker_id = get_worker_id()))));
CREATE POLICY "Manage quantity price tiers" ON public.quantity_price_tiers AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin())) WITH CHECK ((is_admin() OR is_branch_admin()));
CREATE POLICY "View quantity price tiers" ON public.quantity_price_tiers AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Admins can do everything on receipt_modifications" ON public.receipt_modifications AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can insert modifications" ON public.receipt_modifications AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_worker() AND (modified_by = get_worker_id())));
CREATE POLICY "Workers can view modifications" ON public.receipt_modifications AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can do everything on receipts" ON public.receipts AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can insert receipts" ON public.receipts AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_worker() AND (worker_id = get_worker_id())));
CREATE POLICY "Workers can update own receipts" ON public.receipts AS PERMISSIVE FOR UPDATE TO public USING ((worker_id = get_worker_id()));
CREATE POLICY "Workers can view receipts" ON public.receipts AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can manage reward config" ON public.reward_config AS PERMISSIVE FOR ALL TO public USING (is_admin());
CREATE POLICY "Workers can view reward config" ON public.reward_config AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can manage disputes" ON public.reward_disputes AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can create own disputes" ON public.reward_disputes AS PERMISSIVE FOR INSERT TO public WITH CHECK ((worker_id = get_worker_id()));
CREATE POLICY "Workers can view own disputes" ON public.reward_disputes AS PERMISSIVE FOR SELECT TO public USING ((worker_id = get_worker_id()));
CREATE POLICY "Admins can manage notifications" ON public.reward_notifications AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can update own notifications" ON public.reward_notifications AS PERMISSIVE FOR UPDATE TO public USING ((target_worker_id = get_worker_id()));
CREATE POLICY "Workers can view own notifications" ON public.reward_notifications AS PERMISSIVE FOR SELECT TO public USING ((target_worker_id = get_worker_id()));
CREATE POLICY "Admins can manage reward_penalties" ON public.reward_penalties AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view active reward_penalties" ON public.reward_penalties AS PERMISSIVE FOR SELECT TO public USING ((is_worker() AND (is_active = true)));
CREATE POLICY "Admins can manage reserve fund" ON public.reward_reserve_fund AS PERMISSIVE FOR ALL TO public USING (is_admin());
CREATE POLICY "Workers can view reserve fund" ON public.reward_reserve_fund AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can manage reward_tasks" ON public.reward_tasks AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view active reward_tasks" ON public.reward_tasks AS PERMISSIVE FOR SELECT TO public USING ((is_worker() AND (is_active = true)));
CREATE POLICY "Admins can manage role_permissions" ON public.role_permissions AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Allow read access to role_permissions" ON public.role_permissions AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage role ui overrides" ON public.role_ui_overrides AS PERMISSIVE FOR ALL TO authenticated USING ((is_admin() OR is_branch_admin())) WITH CHECK ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view role ui overrides" ON public.role_ui_overrides AS PERMISSIVE FOR SELECT TO authenticated USING (is_worker());
CREATE POLICY "Authorized users can delete sector coverage" ON public.sector_coverage AS PERMISSIVE FOR DELETE TO authenticated USING (can_manage_sector_coverage_branch(branch_id));
CREATE POLICY "Authorized users can insert sector coverage" ON public.sector_coverage AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (can_manage_sector_coverage_branch(branch_id));
CREATE POLICY "Authorized users can update sector coverage" ON public.sector_coverage AS PERMISSIVE FOR UPDATE TO public USING ((can_manage_sector_coverage_branch(branch_id) OR can_finalize_sector_coverage())) WITH CHECK ((can_manage_sector_coverage_branch(branch_id) OR can_finalize_sector_coverage()));
CREATE POLICY "Workers can view sector coverage" ON public.sector_coverage AS PERMISSIVE FOR SELECT TO authenticated USING (is_worker());
CREATE POLICY "Admins can manage overrides" ON public.sector_schedule_overrides AS PERMISSIVE FOR ALL TO authenticated USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view overrides" ON public.sector_schedule_overrides AS PERMISSIVE FOR SELECT TO authenticated USING (is_worker());
CREATE POLICY "Admins can manage sector schedules" ON public.sector_schedules AS PERMISSIVE FOR ALL TO authenticated USING ((is_admin() OR is_branch_admin())) WITH CHECK ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view sector schedules" ON public.sector_schedules AS PERMISSIVE FOR SELECT TO authenticated USING (is_worker());
CREATE POLICY "Admins can manage sector_zones" ON public.sector_zones AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin())) WITH CHECK ((is_admin() OR is_branch_admin()));
CREATE POLICY "Allow read access to sector_zones" ON public.sector_zones AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Workers can insert sector_zones" ON public.sector_zones AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_worker());
CREATE POLICY "Admins and branch admins can manage sectors" ON public.sectors AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin() OR (get_user_role() = 'supervisor'::app_role))) WITH CHECK ((is_admin() OR is_branch_admin() OR (get_user_role() = 'supervisor'::app_role)));
CREATE POLICY "Allow read access to sectors" ON public.sectors AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage all settings" ON public.settings AS PERMISSIVE FOR ALL TO public USING (is_admin());
CREATE POLICY "Admins can read all settings" ON public.settings AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Branch admins can manage branch settings" ON public.settings AS PERMISSIVE FOR ALL TO public USING ((is_branch_admin() AND ((branch_id IS NULL) OR is_admin_of_branch(branch_id))));
CREATE POLICY shared_invoices_delete ON public.shared_invoices AS PERMISSIVE FOR DELETE TO public USING ((is_admin() OR has_custom_role('company_manager'::text)));
CREATE POLICY shared_invoices_insert ON public.shared_invoices AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_admin() OR has_custom_role('company_manager'::text)));
CREATE POLICY shared_invoices_select ON public.shared_invoices AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR has_custom_role('company_manager'::text) OR (is_branch_admin() AND (target_branch_id IN ( SELECT branches.id
   FROM branches
  WHERE (branches.admin_id = get_worker_id()))))));
CREATE POLICY shared_invoices_update ON public.shared_invoices AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR has_custom_role('company_manager'::text) OR (is_branch_admin() AND (target_branch_id IN ( SELECT branches.id
   FROM branches
  WHERE (branches.admin_id = get_worker_id()))))));
CREATE POLICY "Admins and branch admins can manage stamp_price_tiers" ON public.stamp_price_tiers AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR (get_user_role() = 'branch_admin'::app_role))) WITH CHECK ((is_admin() OR (get_user_role() = 'branch_admin'::app_role)));
CREATE POLICY "Allow read access to stamp_price_tiers" ON public.stamp_price_tiers AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Admin can manage stock alerts" ON public.stock_alerts AS PERMISSIVE FOR ALL TO public USING ((get_user_role() = ANY (ARRAY['admin'::app_role, 'branch_admin'::app_role])));
CREATE POLICY "Workers can view stock alerts" ON public.stock_alerts AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Delete confirmations" ON public.stock_confirmations AS PERMISSIVE FOR DELETE TO authenticated USING (((manager_id = get_worker_id()) OR is_admin()));
CREATE POLICY "Managers can create confirmations" ON public.stock_confirmations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_admin() OR is_branch_admin() OR has_custom_role('company_manager'::text) OR ((manager_id = get_worker_id()) AND ((get_user_role() = ANY (ARRAY['warehouse_manager'::app_role, 'supervisor'::app_role])) OR has_custom_role('warehouse_manager'::text) OR has_custom_role('supervisor'::text)) AND (EXISTS ( SELECT 1
   FROM workers tw
  WHERE ((tw.id = stock_confirmations.worker_id) AND (tw.is_active = true) AND ((stock_confirmations.branch_id IS NULL) OR (tw.branch_id = stock_confirmations.branch_id) OR (EXISTS ( SELECT 1
           FROM workers mw
          WHERE ((mw.id = get_worker_id()) AND (mw.branch_id = stock_confirmations.branch_id)))))))))));
CREATE POLICY "Update confirmations" ON public.stock_confirmations AS PERMISSIVE FOR UPDATE TO authenticated USING ((((manager_id = get_worker_id()) AND (status = ANY (ARRAY['pending'::text, 'rejected'::text, 'amended'::text])) AND (frozen_at IS NULL)) OR (worker_id = get_worker_id()) OR is_admin())) WITH CHECK ((((manager_id = get_worker_id()) AND (status = ANY (ARRAY['pending'::text, 'rejected'::text, 'amended'::text, 'approved'::text])) AND (frozen_at IS NULL)) OR (worker_id = get_worker_id()) OR is_admin()));
CREATE POLICY "Workers can view own confirmations" ON public.stock_confirmations AS PERMISSIVE FOR SELECT TO authenticated USING (((worker_id = get_worker_id()) OR (manager_id = get_worker_id()) OR is_admin() OR is_branch_admin()));
CREATE POLICY "Admins can manage stock_discrepancies" ON public.stock_discrepancies AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Managers can update discrepancies" ON public.stock_discrepancies AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_admin() OR is_branch_admin() OR has_custom_role('warehouse_manager'::text))) WITH CHECK ((is_admin() OR is_branch_admin() OR has_custom_role('warehouse_manager'::text)));
CREATE POLICY "Workers and managers can insert discrepancies" ON public.stock_discrepancies AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_admin() OR is_branch_admin() OR has_custom_role('warehouse_manager'::text) OR (worker_id = get_worker_id())));
CREATE POLICY "Workers can view their own discrepancies" ON public.stock_discrepancies AS PERMISSIVE FOR SELECT TO public USING ((worker_id = get_worker_id()));
CREATE POLICY "Admins and guilty can update disputes" ON public.stock_disputes AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR is_branch_admin() OR (get_worker_id() = guilty_worker_id) OR (branch_id = get_worker_branch_id())));
CREATE POLICY "Workers can create disputes" ON public.stock_disputes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_worker());
CREATE POLICY "Workers can view their disputes" ON public.stock_disputes AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR is_branch_admin() OR (get_worker_id() = warehouse_worker_id) OR (get_worker_id() = delivery_worker_id) OR (get_worker_id() = raised_by) OR (branch_id = get_worker_branch_id())));
CREATE POLICY "Admin/branch_admin can update movements" ON public.stock_movements AS PERMISSIVE FOR UPDATE TO public USING ((get_user_role() = ANY (ARRAY['admin'::app_role, 'branch_admin'::app_role])));
CREATE POLICY "Admins can delete stock_movements" ON public.stock_movements AS PERMISSIVE FOR DELETE TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can create stock movements" ON public.stock_movements AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_worker());
CREATE POLICY "Workers can view stock movements" ON public.stock_movements AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admin/branch_admin can delete receipt items" ON public.stock_receipt_items AS PERMISSIVE FOR DELETE TO public USING ((get_user_role() = ANY (ARRAY['admin'::app_role, 'branch_admin'::app_role])));
CREATE POLICY "Admin/branch_admin can manage receipt items" ON public.stock_receipt_items AS PERMISSIVE FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::app_role, 'branch_admin'::app_role])));
CREATE POLICY "Admin/branch_admin/warehouse can create stock receipt items" ON public.stock_receipt_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((get_user_role() = ANY (ARRAY['admin'::app_role, 'branch_admin'::app_role])) OR has_custom_role('warehouse_manager'::text)));
CREATE POLICY "Admins can delete stock_receipt_items" ON public.stock_receipt_items AS PERMISSIVE FOR DELETE TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view receipt items" ON public.stock_receipt_items AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admin/branch_admin/warehouse can create stock receipts" ON public.stock_receipts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((get_user_role() = ANY (ARRAY['admin'::app_role, 'branch_admin'::app_role])) OR has_custom_role('warehouse_manager'::text)));
CREATE POLICY "Admin/branch_admin/warehouse can update stock receipts" ON public.stock_receipts AS PERMISSIVE FOR UPDATE TO authenticated USING (((get_user_role() = ANY (ARRAY['admin'::app_role, 'branch_admin'::app_role])) OR has_custom_role('warehouse_manager'::text)));
CREATE POLICY "Admins can delete stock_receipts" ON public.stock_receipts AS PERMISSIVE FOR DELETE TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view stock receipts" ON public.stock_receipts AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can manage supervisor_workers" ON public.supervisor_workers AS PERMISSIVE FOR ALL TO authenticated USING ((is_admin() OR is_branch_admin())) WITH CHECK ((is_admin() OR is_branch_admin()));
CREATE POLICY "Supervisors can view their assignments" ON public.supervisor_workers AS PERMISSIVE FOR SELECT TO authenticated USING ((supervisor_id = get_worker_id()));
CREATE POLICY "Workers can view if assigned" ON public.supervisor_workers AS PERMISSIVE FOR SELECT TO authenticated USING ((worker_id = get_worker_id()));
CREATE POLICY tasks_delete ON public.tasks AS PERMISSIVE FOR DELETE TO public USING ((is_admin() OR (created_by = get_worker_id())));
CREATE POLICY tasks_insert ON public.tasks AS PERMISSIVE FOR INSERT TO public WITH CHECK (((get_user_role() = ANY (ARRAY['admin'::app_role, 'branch_admin'::app_role, 'supervisor'::app_role])) OR ((get_user_role() = 'worker'::app_role) AND (created_by = get_worker_id()) AND ((assigned_to IS NULL) OR (assigned_to = get_worker_id())))));
CREATE POLICY tasks_select ON public.tasks AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR (assigned_to = get_worker_id()) OR (created_by = get_worker_id()) OR ((assigned_to IS NULL) AND ((branch_id IS NULL) OR (branch_id = get_worker_branch_id())))));
CREATE POLICY tasks_update ON public.tasks AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR (assigned_to = get_worker_id()) OR (created_by = get_worker_id())));
CREATE POLICY "Admins can manage treasury_bank_accounts" ON public.treasury_bank_accounts AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view treasury_bank_accounts" ON public.treasury_bank_accounts AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can manage treasury_contacts" ON public.treasury_contacts AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view treasury_contacts" ON public.treasury_contacts AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can manage roles" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "Users can view own role" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR is_admin()));
CREATE POLICY "Admins can manage verification items" ON public.verification_checklist_items AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin())) WITH CHECK ((is_admin() OR is_branch_admin()));
CREATE POLICY "Everyone can read verification items" ON public.verification_checklist_items AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert visits" ON public.visit_tracking AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_admin() OR is_branch_admin() OR (get_user_role() = 'supervisor'::app_role)));
CREATE POLICY "Admins can view all visits" ON public.visit_tracking AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR is_branch_admin() OR (get_user_role() = 'supervisor'::app_role) OR has_custom_role('internal_supervisor'::text) OR has_custom_role('company_manager'::text)));
CREATE POLICY "Workers can insert visits" ON public.visit_tracking AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_worker() AND (worker_id = get_worker_id())));
CREATE POLICY "Workers can view own visits" ON public.visit_tracking AS PERMISSIVE FOR SELECT TO public USING ((worker_id = get_worker_id()));
CREATE POLICY "Workers can manage warehouse review items" ON public.warehouse_review_items AS PERMISSIVE FOR ALL TO authenticated USING (is_worker()) WITH CHECK (is_worker());
CREATE POLICY "Workers can manage warehouse reviews" ON public.warehouse_review_sessions AS PERMISSIVE FOR ALL TO authenticated USING (is_worker()) WITH CHECK (is_worker());
CREATE POLICY "System can manage warehouse stock" ON public.warehouse_stock AS PERMISSIVE FOR ALL TO public USING (is_worker());
CREATE POLICY "Workers can view warehouse stock" ON public.warehouse_stock AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Workers can insert own attendance" ON public.worker_attendance AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((worker_id = get_worker_id()));
CREATE POLICY "Workers can update own attendance" ON public.worker_attendance AS PERMISSIVE FOR UPDATE TO authenticated USING (((worker_id = get_worker_id()) OR (get_user_role() = ANY (ARRAY['admin'::app_role, 'branch_admin'::app_role]))));
CREATE POLICY "Workers can view own attendance" ON public.worker_attendance AS PERMISSIVE FOR SELECT TO authenticated USING (((worker_id = get_worker_id()) OR (get_user_role() = ANY (ARRAY['admin'::app_role, 'branch_admin'::app_role]))));
CREATE POLICY "Admins can manage worker attendance locations" ON public.worker_attendance_locations AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'branch_admin'::app_role])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'branch_admin'::app_role]))))));
CREATE POLICY "Workers can view their own attendance location" ON public.worker_attendance_locations AS PERMISSIVE FOR SELECT TO authenticated USING ((worker_id = get_worker_id()));
CREATE POLICY "Admins can insert debt payments" ON public.worker_debt_payments AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_worker());
CREATE POLICY "Workers can view debt payments" ON public.worker_debt_payments AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can insert worker debts" ON public.worker_debts AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_worker());
CREATE POLICY "Admins can update worker debts" ON public.worker_debts AS PERMISSIVE FOR UPDATE TO public USING (is_worker());
CREATE POLICY "Workers can view worker debts" ON public.worker_debts AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can manage worker_liability_adjustments" ON public.worker_liability_adjustments AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view own adjustments" ON public.worker_liability_adjustments AS PERMISSIVE FOR SELECT TO public USING ((worker_id = get_worker_id()));
CREATE POLICY "Workers can manage load request items" ON public.worker_load_request_items AS PERMISSIVE FOR ALL TO authenticated USING (is_worker()) WITH CHECK (is_worker());
CREATE POLICY "Workers can manage load requests" ON public.worker_load_requests AS PERMISSIVE FOR ALL TO authenticated USING (is_worker()) WITH CHECK (is_worker());
CREATE POLICY "Admins can view worker locations" ON public.worker_locations AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can manage own location" ON public.worker_locations AS PERMISSIVE FOR ALL TO public USING ((worker_id = get_worker_id())) WITH CHECK ((worker_id = get_worker_id()));
CREATE POLICY "Admins can manage worker_permissions" ON public.worker_permissions AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin())) WITH CHECK ((is_admin() OR is_branch_admin()));
CREATE POLICY "Workers can view own permissions" ON public.worker_permissions AS PERMISSIVE FOR SELECT TO public USING ((worker_id = get_worker_id()));
CREATE POLICY "Admins and managers can manage worker_roles" ON public.worker_roles AS PERMISSIVE FOR ALL TO public USING ((is_admin() OR is_branch_admin() OR has_custom_role('company_manager'::text) OR has_custom_role('project_manager'::text))) WITH CHECK ((is_admin() OR is_branch_admin() OR has_custom_role('company_manager'::text) OR has_custom_role('project_manager'::text)));
CREATE POLICY "Allow read access to worker_roles" ON public.worker_roles AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "System can manage worker stock" ON public.worker_stock AS PERMISSIVE FOR ALL TO public USING (is_worker());
CREATE POLICY "Workers can view worker stock" ON public.worker_stock AS PERMISSIVE FOR SELECT TO public USING (is_worker());
CREATE POLICY "Admins can manage ui overrides" ON public.worker_ui_overrides AS PERMISSIVE FOR ALL TO authenticated USING (((auth.uid() IS NOT NULL) AND (worker_has_permission(get_worker_id(), 'page_permissions'::text) OR (( SELECT user_roles.role
   FROM user_roles
  WHERE (user_roles.user_id = auth.uid())) = ANY (ARRAY['admin'::app_role, 'project_manager'::app_role, 'branch_admin'::app_role, 'supervisor'::app_role, 'accountant'::app_role, 'admin_assistant'::app_role, 'warehouse_manager'::app_role]))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (worker_has_permission(get_worker_id(), 'page_permissions'::text) OR (( SELECT user_roles.role
   FROM user_roles
  WHERE (user_roles.user_id = auth.uid())) = ANY (ARRAY['admin'::app_role, 'project_manager'::app_role, 'branch_admin'::app_role, 'supervisor'::app_role, 'accountant'::app_role, 'admin_assistant'::app_role, 'warehouse_manager'::app_role])))));
CREATE POLICY "Workers can view own ui overrides" ON public.worker_ui_overrides AS PERMISSIVE FOR SELECT TO public USING ((worker_id = get_worker_id()));
CREATE POLICY "Admins can delete workers" ON public.workers AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admins can insert workers" ON public.workers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Authenticated users can view workers" ON public.workers AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Branch admins can insert workers" ON public.workers AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_admin() OR (is_branch_admin() AND (branch_id IN ( SELECT branches.id
   FROM branches
  WHERE (branches.admin_id = get_worker_id()))))));
CREATE POLICY "Update workers based on role" ON public.workers AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR (is_branch_admin() AND (branch_id IN ( SELECT branches.id
   FROM branches
  WHERE (branches.admin_id = get_worker_id()))))));
CREATE POLICY "View workers based on role" ON public.workers AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR (is_branch_admin() AND (branch_id IN ( SELECT b.id
   FROM branches b
  WHERE ((b.admin_id = get_worker_id()) AND (b.is_active = true))))) OR (id = get_worker_id()) OR (auth.uid() IS NULL)));


-- ============================================================
-- DONE
-- ============================================================
