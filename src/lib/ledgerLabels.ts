// Translations for ledger code values shown in UI

export const CASH_MOVEMENT_LABELS: Record<string, string> = {
  collection: 'تحصيل',
  debt_payment_in: 'تسديد دين (وارد)',
  sale_cash: 'بيع نقدي',
  deposit: 'إيداع',
  withdrawal: 'سحب',
  transfer_in: 'تحويل وارد',
  transfer_out: 'تحويل صادر',
  payment: 'دفع',
  expense: 'مصروف',
  debt_payment_out: 'تسديد دين (صادر)',
  adjustment: 'تسوية',
};

export const DEBT_MOVEMENT_LABELS: Record<string, string> = {
  debt_created: 'إنشاء دين',
  debt_increase: 'زيادة دين',
  partial_payment: 'تسديد جزئي',
  full_payment: 'تسديد كامل',
  debt_writeoff: 'شطب دين',
  debt_adjustment: 'تسوية دين',
  discount: 'خصم',
  interest: 'فوائد',
};

export const STOCK_MOVEMENT_LABELS: Record<string, string> = {
  load: 'تحميل',
  delivery: 'تسليم',
  receipt: 'استلام',
  return: 'مرتجع',
  transfer_in: 'تحويل وارد',
  transfer_out: 'تحويل صادر',
  customer_return: 'مرتجع زبون',
  damage: 'تلف',
  exchange: 'استبدال',
  adjustment: 'تسوية',
};

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  worker_treasury: 'خزينة موظف',
  manager_treasury: 'خزينة مدير',
  branch_safe: 'خزنة الفرع',
  customer_account: 'حساب زبون',
  expense_pool: 'حساب مصروفات',
  external: 'خارجي',
  warehouse: 'المستودع',
};

export const DEBTOR_TYPE_LABELS: Record<string, string> = {
  customer: 'زبون',
  worker: 'موظف',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'نقداً',
  check: 'شيك',
  transfer: 'تحويل',
  card: 'بطاقة',
  credit: 'آجل',
  other: 'أخرى',
};

export const LOCATION_TYPE_LABELS: Record<string, string> = {
  warehouse: 'مستودع',
  worker: 'موظف',
  customer: 'زبون',
  external: 'خارجي',
  branch: 'فرع',
};

export const REASON_LABELS: Record<string, string> = {
  historical_backfill: 'ترحيل تاريخي',
  branch_transfer: 'تحويل بين الفروع',
  inventory_count: 'جرد',
  customer_return: 'مرتجع زبون',
  manual: 'يدوي',
  order: 'طلبية',
  payment: 'تسديد',
  loading: 'تحميل',
  delivery: 'تسليم',
  reconciliation: 'مطابقة',
};

export const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  pending_branch: 'بانتظار الفرع',
  pending_assistant: 'بانتظار مساعد المدير',
  approved: 'معتمد',
  rejected: 'مرفوض',
  cancelled: 'ملغي',
  completed: 'مكتمل',
  delivered: 'مُسلَّم',
  confirmed: 'مؤكد',
  amended: 'مُعدَّل',
  draft: 'مسودة',
  review: 'قيد المراجعة',
};

// Generic helper: returns the translation if found, otherwise the original code.
export const tr = (map: Record<string, string>, value?: string | null) =>
  value ? map[value] ?? value : '—';
