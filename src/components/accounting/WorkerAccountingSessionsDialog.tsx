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
              سجل جلسات المحاسبة — {workerName}
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
                const totalSales = getItemAmount(session.items, 'total_sales');
                const physicalCashExpected = getItemAmount(session.items, 'physical_cash', 'expected_amount');
                const physicalCashActual = getItemAmount(session.items, 'physical_cash', 'actual_amount');
                const newDebts = getItemAmount(session.items, 'new_debts');
                const debtCollections = getItemAmount(session.items, 'debt_collections_total');
                const expenses = getItemAmount(session.items, 'expenses');
                const cashDiff = physicalCashActual - physicalCashExpected;

                return (
                  <Card
                    key={session.id}
                    className="cursor-pointer hover:shadow-md transition-all active:scale-[0.99] rounded-xl border-2 hover:border-primary/20"
                    onClick={() => setSelectedSession(session)}
                  >
                    <CardContent className="p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={`${statusColor(session.status)} text-[11px] px-2.5 py-0.5 rounded-full`}>
                            {t(`accounting.status_${session.status}`)}
                          </Badge>
                          {session.manager?.full_name && (
                            <span className="text-[11px] text-muted-foreground">بواسطة {session.manager.full_name}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{format(new Date(session.session_date), 'dd/MM/yyyy')}</span>
                        <span className="text-muted-foreground/40">|</span>
                        <span>{format(new Date(session.period_start), 'dd/MM HH:mm')} → {format(new Date(session.period_end), 'dd/MM HH:mm')}</span>
                      </div>

                      {session.items && session.items.length > 0 && (
                        <Collapsible>
                          <CollapsibleTrigger
                            className="w-full flex items-center justify-center gap-1.5 pt-2.5 mt-2.5 border-t text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ChevronDown className="w-3.5 h-3.5 transition-transform [[data-state=open]>&]:rotate-180" />
                            <span className="font-medium">{t('accounting.financial_summary') || 'ملخص مالي'}</span>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="grid grid-cols-3 gap-2 pt-2.5">
                              <MiniStat icon={<TrendingUp className="w-3 h-3" />} label={t('accounting.total_sales')} value={totalSales} />
                              <MiniStat icon={<Banknote className="w-3 h-3" />} label={t('accounting.physical_cash')} value={physicalCashActual} color="green" />
                              <MiniStat icon={<TrendingDown className="w-3 h-3" />} label={t('accounting.new_debts')} value={newDebts} color="red" />
                              <MiniStat icon={<ArrowDownCircle className="w-3 h-3" />} label={t('accounting.debt_collections')} value={debtCollections} color="orange" />
                              <MiniStat icon={<CreditCard className="w-3 h-3" />} label={t('accounting.expenses')} value={expenses} />
                              <div className={`rounded-lg p-2 text-center ${cashDiff >= 0 ? 'bg-green-50' : 'bg-destructive/10'}`}>
                                <p className="text-[9px] text-muted-foreground flex items-center justify-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  {cashDiff >= 0 ? t('accounting.surplus') || 'فائض' : t('accounting.deficit') || 'عجز'}
                                </p>
                                <p className={`text-xs font-bold ${cashDiff >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                  {cashDiff >= 0 ? '+' : ''}{fmt(cashDiff)}
                                </p>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {session.notes && (
                        <p className="text-xs text-muted-foreground mt-2 truncate bg-muted/30 rounded px-2 py-1">{session.notes}</p>
                      )}
                    </CardContent>
                  </Card>
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
