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
  if (!data?.isFrozen) return null;

  if (variant === 'badge') {
    return (
      <Badge variant="destructive" className={className}>
        <Lock className="w-3 h-3 me-1" />
        مجمَّد - عجز {formatNumber(data.totalRemaining, language)} دج
      </Badge>
    );
  }

  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        هذا الموظف مجمَّد بسبب عجز غير مسدَّد قدره{' '}
        <strong>{formatNumber(data.totalRemaining, language)} دج</strong>{' '}
        من مراجعة المخزون. لا يمكن تعديل الطلبيات المسلَّمة أو عروض الأسعار أو
        تأكيدات الهدايا المعلَّقة حتى تتم تسوية المحاسبة.
      </AlertDescription>
    </Alert>
  );
};

export default FrozenWorkerBadge;
