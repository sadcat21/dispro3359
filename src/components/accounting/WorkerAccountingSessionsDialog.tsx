import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Calculator, Calendar, ClipboardList, TrendingUp, TrendingDown, Banknote, ArrowDownCircle, CreditCard, AlertTriangle, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import SessionDetailsDialog from './SessionDetailsDialog';
import type { AccountingSession, AccountingSessionItem } from '@/hooks/useAccountingSessions';
import { useSessionCalculations } from '@/hooks/useSessionCalculations';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId?: string;
  workerName?: string;
}

const fmt = (n: number) => n.toLocaleString();

const getItemAmount = (items: AccountingSessionItem[] | undefined, type: string, field: 'expected_amount' | 'actual_amount' = 'actual_amount') => {
  if (!items) return 0;
  const item = items.find(i => i.item_type === type);
  return item ? Number(item[field]) : 0;
};

const statusColor = (s: string) => {
  switch (s) {
    case 'open': return 'bg-blue-100 text-blue-800';
    case 'completed': return 'bg-green-100 text-green-800';
    case 'disputed': return 'bg-red-100 text-red-800';
    default: return '';
  }
};

const WorkerAccountingSessionsDialog: React.FC<Props> = ({ open, onOpenChange, workerId, workerName }) => {
  const { t } = useLanguage();
  const { activeBranch } = useAuth();
  const [selectedSession, setSelectedSession] = useState<AccountingSession | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['worker-accounting-sessions', workerId, activeBranch?.id],
    queryFn: async () => {
      if (!workerId) return [];
      let query = supabase
        .from('accounting_sessions')
        .select(`
          *,
          worker:workers!accounting_sessions_worker_id_fkey(id, full_name, username),
          manager:workers!accounting_sessions_manager_id_fkey(id, full_name),
          items:accounting_session_items(*)
        `)
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (activeBranch?.id) {
        query = query.eq('branch_id', activeBranch.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as AccountingSession[];
    },
    enabled: open && !!workerId,
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85dvh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Calculator className="w-5 h-5 text-primary" />
              {t('worker_accounting_sessions.title')} — {workerName}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-2.5">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">{t('accounting.no_sessions')}</p>
              </div>
            ) : (
              sessions.map(session => {
                return (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onOpen={() => setSelectedSession(session)}
                    t={t}
                  />
                );

              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedSession && (
        <SessionDetailsDialog
          open={!!selectedSession}
          onOpenChange={(o) => !o && setSelectedSession(null)}
          session={selectedSession}
        />
      )}
    </>
  );
};

const MiniStat: React.FC<{ icon: React.ReactNode; label: string; value: number; color?: string }> = ({ icon, label, value, color }) => (
  <div className={`rounded-lg p-2 text-center ${color === 'green' ? 'bg-green-50' : color === 'red' ? 'bg-red-50' : color === 'orange' ? 'bg-orange-50' : 'bg-muted/30'}`}>
    <p className="text-[9px] text-muted-foreground flex items-center justify-center gap-0.5">{icon}{label}</p>
    <p className={`text-xs font-bold ${color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-600' : color === 'orange' ? 'text-orange-600' : ''}`}>{fmt(value)}</p>
  </div>
);

export default WorkerAccountingSessionsDialog;
