import React from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { useWorkerFrozenStatus } from '@/hooks/useWorkerFrozenStatus';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/utils/formatters';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  workerId?: string | null;
  variant?: 'alert' | 'badge';
  className?: string;
}

/**
 * شارة/تنبيه يظهر عندما يكون الموظف مجمَّداً بسبب عجز غير مسدَّد
 * في مراجعة المخزون. يُخفى تلقائياً عند سداد الدين.
 */
export const FrozenWorkerBadge: React.FC<Props> = ({ workerId, variant = 'alert', className }) => {
  const { language } = useLanguage();
  const { data } = useWorkerFrozenStatus(workerId);
  if (!data || data.debtsCount === 0 || data.totalRemaining <= 0) return null;

  if (variant === 'badge') {
    return (
      <Badge variant="outline" className={`border-amber-500 text-amber-700 dark:text-amber-400 ${className || ''}`}>
        <AlertTriangle className="w-3 h-3 me-1" />
        تنبيه: عجز {formatNumber(data.totalRemaining, language)} DA
      </Badge>
    );
  }

  return (
    <Alert className={`border-amber-500 text-amber-800 dark:text-amber-300 ${className || ''}`}>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        تنبيه: على هذا الموظف عجز غير مسدد بقيمة{' '}
        <strong>{formatNumber(data.totalRemaining, language)} DA</strong>{' '}
        من مراجعة المخزون. يُرجى تسوية الحساب في أقرب وقت.
      </AlertDescription>
    </Alert>
  );
};

export default FrozenWorkerBadge;
