import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Accounting profile classification for workers.
 *
 * - `full_with_stock`  → دور تشغيلي يتعامل مع البضاعة (تحميل / تفريغ / مراجعة)
 *   مثال: مندوب التوصيل، مسؤول المخزن.
 *   يخضع لكل بنود الجلسة المحاسبية + متابعة الشاحنة والمخزون.
 *
 * - `financial_only`   → دور لا يقوم بالشحن والتفريغ
 *   مثال: مندوب المبيعات، المشرف الداخلي/الخارجي، مساعد المدير عند التحصيل.
 *   يحاسب فقط على: النقد، الوثائق، التحصيلات، المصاريف والديون.
 */
export type AccountingProfile = 'financial_only' | 'full_with_stock';

const FULL_STOCK_CUSTOM_CODES = new Set(['delivery_rep', 'warehouse_manager']);
const FINANCIAL_ONLY_CUSTOM_CODES = new Set([
  'sales_rep',
  'internal_supervisor',
  'external_supervisor',
  'company_manager',
]);

/**
 * يحدد البروفايل من قائمة أكواد الأدوار المخصصة + الدور الأساسي.
 * إذا كان للعامل أيُّ دور من فئة "كاملة"، تُغلَّب الفئة الكاملة.
 */
export function classifyAccountingProfile(opts: {
  baseRole?: string | null;
  customRoleCodes?: string[];
}): AccountingProfile {
  const codes = opts.customRoleCodes || [];
  if (codes.some((c) => FULL_STOCK_CUSTOM_CODES.has(c))) return 'full_with_stock';
  if (codes.some((c) => FINANCIAL_ONLY_CUSTOM_CODES.has(c))) return 'financial_only';
  // Fallback على الدور الأساسي:
  // العمال الافتراضيون (role='worker') يُعتبرون موصِّلين كاملين ما لم يُحدَّد عكس ذلك.
  if (opts.baseRole === 'worker') return 'full_with_stock';
  return 'financial_only';
}

/**
 * Hook لجلب بروفايل عامل محدد من قاعدة البيانات.
 */
export function useWorkerAccountingProfile(workerId: string | null | undefined) {
  return useQuery({
    queryKey: ['worker-accounting-profile', workerId],
    enabled: !!workerId,
    queryFn: async (): Promise<{ profile: AccountingProfile; baseRole: string | null; customRoleCodes: string[] }> => {
      const [workerRes, rolesRes] = await Promise.all([
        supabase.from('workers').select('role').eq('id', workerId!).maybeSingle(),
        supabase
          .from('worker_roles')
          .select('custom_roles!inner(code)')
          .eq('worker_id', workerId!)
          .eq('is_active', true),
      ]);
      const baseRole = (workerRes.data as any)?.role ?? null;
      const customRoleCodes: string[] = ((rolesRes.data as any[]) || [])
        .map((r) => r?.custom_roles?.code)
        .filter(Boolean);
      const profile = classifyAccountingProfile({ baseRole, customRoleCodes });
      return { profile, baseRole, customRoleCodes };
    },
  });
}

export const ACCOUNTING_PROFILE_LABELS_AR: Record<AccountingProfile, string> = {
  financial_only: 'محاسبة مالية فقط',
  full_with_stock: 'محاسبة كاملة (مالية + بضاعة)',
};
