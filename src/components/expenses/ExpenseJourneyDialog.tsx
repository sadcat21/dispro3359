import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { ExpenseWithDetails } from '@/types/expense';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDate } from '@/utils/formatters';
import {
  Check,
  CircleDot,
  Clock,
  FilePlus2,
  ShieldCheck,
  XCircle,
  Wallet,
  Loader2,
} from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: ExpenseWithDetails;
}

interface Step {
  key: string;
  title: string;
  subtitle?: string;
  date?: string | null;
  icon: React.ReactNode;
  state: 'done' | 'current' | 'pending' | 'rejected';
}

const ExpenseJourneyDialog: React.FC<Props> = ({ open, onOpenChange, expense }) => {
  const { t, language, dir } = useLanguage();

  const { data: session, isLoading } = useQuery({
    queryKey: ['expense-accounting-session', expense.worker_id, expense.expense_date],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_sessions')
        .select('id, status, session_date, period_start, period_end, completed_at')
        .eq('worker_id', expense.worker_id)
        .lte('period_start', expense.expense_date)
        .gte('period_end', expense.expense_date)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const fmt = (d?: string | null) =>
    d ? formatDate(d, 'dd MMM yyyy HH:mm', language as any) : '';

  const steps: Step[] = [
    {
      key: 'created',
      title: t('expense_journey.created'),
      subtitle: expense.worker?.full_name,
      date: expense.created_at,
      icon: <FilePlus2 className="w-4 h-4" />,
      state: 'done',
    },
    expense.status === 'rejected'
      ? {
          key: 'rejected',
          title: t('expense_journey.rejected'),
          subtitle: expense.reviewer?.full_name,
          date: expense.reviewed_at,
          icon: <XCircle className="w-4 h-4" />,
          state: 'rejected',
        }
      : {
          key: 'approved',
          title: t('expense_journey.approved'),
          subtitle: expense.reviewer?.full_name,
          date: expense.reviewed_at,
          icon: <ShieldCheck className="w-4 h-4" />,
          state: expense.status === 'approved' ? 'done' : 'pending',
        },
    {
      key: 'session',
      title: session
        ? session.status === 'completed'
          ? t('expense_journey.session_closed')
          : t('expense_journey.session_open')
        : t('expense_journey.session_pending'),
      subtitle: session
        ? `${fmt(session.period_start)} → ${fmt(session.period_end)}`
        : undefined,
      date: session?.completed_at || null,
      icon: session?.status === 'completed' ? <Check className="w-4 h-4" /> : <Wallet className="w-4 h-4" />,
      state: session
        ? session.status === 'completed'
          ? 'done'
          : 'current'
        : 'pending',
    },
  ];

  const stateClasses = (s: Step['state']) => {
    switch (s) {
      case 'done':
        return 'bg-green-500 text-white border-green-500';
      case 'current':
        return 'bg-amber-500 text-white border-amber-500';
      case 'rejected':
        return 'bg-destructive text-destructive-foreground border-destructive';
      default:
        return 'bg-muted text-muted-foreground border-muted';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={dir} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('expense_journey.title')}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="relative ps-6 space-y-5 py-2">
            <div className="absolute top-2 bottom-2 start-[14px] w-px bg-border" />
            {steps.map((step) => (
              <div key={step.key} className="relative">
                <div
                  className={`absolute -start-6 top-0 w-7 h-7 rounded-full flex items-center justify-center border-2 ${stateClasses(
                    step.state,
                  )}`}
                >
                  {step.state === 'pending' ? <Clock className="w-3.5 h-3.5" /> : step.icon}
                </div>
                <div className="ms-3">
                  <p className="font-semibold text-sm">{step.title}</p>
                  {step.subtitle && (
                    <p className="text-xs text-muted-foreground">{step.subtitle}</p>
                  )}
                  {step.date && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{fmt(step.date)}</p>
                  )}
                  {step.key === 'rejected' && expense.rejection_reason && (
                    <p className="text-xs text-destructive bg-destructive/10 p-2 rounded mt-1.5">
                      {expense.rejection_reason}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseJourneyDialog;
