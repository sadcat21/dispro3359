import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useExpenses, useDeleteExpense, useWorkerAccountedRanges } from '@/hooks/useExpenses';
import { ExpenseWithDetails } from '@/types/expense';
import AddExpenseDialog from '@/components/expenses/AddExpenseDialog';
import CategoryPickerDialog from '@/components/expenses/CategoryPickerDialog';
import SalaryAdvanceBar from '@/components/expenses/SalaryAdvanceBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Loader2, Receipt, Image, Filter, Pencil, CheckCircle2, XCircle, ArrowDownLeft } from 'lucide-react';
import { getCategoryName } from '@/utils/categoryName';
import { formatDate, formatNumber } from '@/utils/formatters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useIsElementHidden } from '@/hooks/useUIOverrides';
import ReceiptViewerDialog from '@/components/expenses/ReceiptViewerDialog';
import { isAdminRole } from '@/lib/utils';
import {
  usePendingPeerHandoversForMe,
  useRespondPeerHandover,
  type PeerCashHandoverRow,
} from '@/hooks/usePeerCashHandovers';

const Expenses: React.FC = () => {
  const { workerId, role } = useAuth();
  const { language, t, dir } = useLanguage();
  const isManager = isAdminRole(role);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [pickedCategoryId, setPickedCategoryId] = useState<string | undefined>(undefined);
  const [showAdd, setShowAdd] = useState(false);
  const [editExpense, setEditExpense] = useState<ExpenseWithDetails | null>(null);
  const [tab, setTab] = useState('expenses');

  const { data: expenses, isLoading } = useExpenses(isManager ? null : workerId);
  const deleteExpense = useDeleteExpense();
  const { data: accountedRanges } = useWorkerAccountedRanges(isManager ? null : workerId);
  const { data: peerHandovers = [], isLoading: peerLoading } = usePendingPeerHandoversForMe(workerId);

  const isAddExpenseHidden = useIsElementHidden('button', 'add_expense');
  const isDeleteExpenseHidden = useIsElementHidden('action', 'delete_expense');

  const pendingPeerCount = peerHandovers.filter((h) => h.status === 'pending').length;

  const isAccounted = (createdAt: string) => {
    if (!accountedRanges?.length) return false;
    const t = new Date(createdAt).getTime();
    return accountedRanges.some(r => t > r.start && t <= r.end);
  };

  const filtered = expenses?.filter(e => {
    if (!isManager && isAccounted(e.created_at)) return false;
    return statusFilter === 'all' ? true : e.status === statusFilter;
  });

  return (
    <div className="p-4 space-y-4" dir={dir}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {isManager ? t('expenses.title') : t('expenses.my_expenses')}
        </h1>
        {!isAddExpenseHidden && tab === 'expenses' && (
          <Button size="sm" onClick={() => { setPickedCategoryId(undefined); setShowCategoryPicker(true); }}>
            <Plus className="w-4 h-4 me-1" />
            {t('expenses.add')}
          </Button>
        )}
      </div>

      {workerId && (
        <SalaryAdvanceBar workerId={workerId} language={language} />
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="expenses" className="flex-1">
            {isManager ? t('expenses.title') : t('expenses.my_expenses')}
          </TabsTrigger>
          {!isManager && (
            <TabsTrigger value="peer" className="flex-1 gap-1">
              تحويلات بانتظار تأكيدي
              {pendingPeerCount > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 px-1 text-[10px]">
                  {pendingPeerCount}
                </Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="expenses" className="space-y-4 mt-4">
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="w-4 h-4 me-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('expenses.all')}</SelectItem>
                <SelectItem value="pending">{t('expenses.pending')}</SelectItem>
                <SelectItem value="approved">{t('expenses.approved')}</SelectItem>
                <SelectItem value="rejected">{t('expenses.rejected')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t('expenses.no_expenses')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered?.map(expense => {
                const accounted = isAccounted(expense.created_at);
                return (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    isManager={isManager}
                    isOwner={expense.worker_id === workerId}
                    accounted={accounted}
                    onDelete={() => deleteExpense.mutate(expense.id)}
                    onEdit={() => setEditExpense(expense)}
                    language={language}
                    t={t}
                    hideDelete={isDeleteExpenseHidden}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        {!isManager && (
          <TabsContent value="peer" className="space-y-3 mt-4">
            {peerLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : peerHandovers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ArrowDownLeft className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد تحويلات</p>
              </div>
            ) : (
              peerHandovers.map((h) => (
                <PeerHandoverCard key={h.id} h={h} language={language} />
              ))
            )}
          </TabsContent>
        )}
      </Tabs>

      <CategoryPickerDialog
        open={showCategoryPicker}
        onOpenChange={setShowCategoryPicker}
        onPick={(id) => { setPickedCategoryId(id); setShowAdd(true); }}
      />
      <AddExpenseDialog
        open={showAdd}
        onOpenChange={(o) => { setShowAdd(o); if (!o) setPickedCategoryId(undefined); }}
        initialCategoryId={pickedCategoryId}
      />
      <AddExpenseDialog
        open={!!editExpense}
        onOpenChange={(o) => { if (!o) setEditExpense(null); }}
        expense={editExpense || undefined}
      />
    </div>
  );
};


const PeerHandoverCard: React.FC<{ h: PeerCashHandoverRow; language: string }> = ({ h, language }) => {
  const respond = useRespondPeerHandover();
  const [note, setNote] = useState('');
  const isPending = h.status === 'pending';
  const variant: 'default' | 'secondary' | 'destructive' =
    h.status === 'approved' ? 'default' : h.status === 'rejected' ? 'destructive' : 'secondary';
  const statusLabel =
    h.status === 'approved' ? 'تمت الموافقة' : h.status === 'rejected' ? 'مرفوض' : 'بانتظار تأكيدك';

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4 text-primary" />
            <span className="font-semibold text-lg">
              {formatNumber(Number(h.amount), language as any)} DA
            </span>
            <Badge variant={variant}>{statusLabel}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            من الزميل: <b>{h.sender?.full_name ?? '—'}</b>
          </p>
          {h.notes && <p className="text-xs">{h.notes}</p>}
        </div>
        <div className="text-[11px] text-muted-foreground whitespace-nowrap">
          {formatDate(h.created_at, 'dd MMM yyyy', language as any)}
        </div>
      </div>

      {isPending ? (
        <div className="space-y-2 pt-1">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="ملاحظة (اختياري)..."
            className="text-xs"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 gap-1"
              disabled={respond.isPending}
              onClick={() =>
                respond.mutate({ handover_id: h.id, decision: 'approved', note: note || undefined })
              }
            >
              <CheckCircle2 className="w-4 h-4" /> أوافق على الاستلام
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 gap-1"
              disabled={respond.isPending}
              onClick={() =>
                respond.mutate({ handover_id: h.id, decision: 'rejected', note: note || undefined })
              }
            >
              <XCircle className="w-4 h-4" /> أرفض
            </Button>
          </div>
        </div>
      ) : (
        h.response_note && (
          <p className="text-[11px] text-muted-foreground">ملاحظتك: {h.response_note}</p>
        )
      )}
    </Card>
  );
};


const STATUS_MAP_KEYS: Record<string, { labelKey: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  pending: { labelKey: 'expenses.pending', variant: 'secondary' },
  approved: { labelKey: 'expenses.approved', variant: 'default' },
  rejected: { labelKey: 'expenses.rejected', variant: 'destructive' },
};

const ExpenseCard: React.FC<{
  expense: ExpenseWithDetails;
  isManager: boolean;
  isOwner: boolean;
  accounted: boolean;
  onDelete: () => void;
  onEdit: () => void;
  language: string;
  t: (key: string) => string;
  hideDelete?: boolean;
}> = ({ expense, isManager, isOwner, accounted, onDelete, onEdit, language, t, hideDelete }) => {
  const status = STATUS_MAP_KEYS[expense.status] || STATUS_MAP_KEYS.pending;
  const receiptUrls = expense.receipt_urls?.length ? expense.receipt_urls : (expense.receipt_url ? [expense.receipt_url] : []);
  const [showReceipt, setShowReceipt] = useState(false);
  const canModify = isOwner && !accounted && expense.status !== 'rejected';

  return (
    <>
      <Card className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg">{formatNumber(Number(expense.amount), language as any)} {t('common.currency')}</span>
              <Badge variant={status.variant}>{t(status.labelKey)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {getCategoryName(expense.category as any, language as any) || t('expenses.uncategorized')}
            </p>
            {isManager && expense.worker && (
              <p className="text-xs text-muted-foreground">
                👤 {expense.worker.full_name}
              </p>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDate(expense.expense_date, 'dd MMM yyyy', language as any)}
          </div>
        </div>

        {expense.description?.startsWith('مسبق أجرة:') && (
          <p className="text-xs font-medium text-primary bg-primary/10 rounded px-2 py-1 inline-block">
            🧾 المستفيد من المسبق: {expense.description.replace(/^مسبق أجرة:\s*/, '').split(' — ')[0]}
          </p>
        )}
        {expense.description && (
          <p className="text-sm text-foreground/80">{expense.description}</p>
        )}

        {receiptUrls.length > 0 && (
          <button
            onClick={() => setShowReceipt(true)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Image className="w-3 h-3" />
            {receiptUrls.length > 1 ? `${t('expenses.has_receipts')} (${receiptUrls.length})` : t('expenses.view_receipt')}
          </button>
        )}

        {expense.status === 'rejected' && expense.rejection_reason && (
          <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
            {t('expenses.rejection_reason')}: {expense.rejection_reason}
          </p>
        )}

        {expense.reviewer && (
          <p className="text-xs text-muted-foreground">
            {t('expenses.reviewed_by')}: {expense.reviewer.full_name}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          {canModify && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="w-3 h-3 me-1" />
              {t('common.edit')}
            </Button>
          )}
          {canModify && !hideDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="w-3 h-3 me-1" />
              {t('common.delete')}
            </Button>
          )}
          {isOwner && accounted && (
            <span className="text-[10px] text-muted-foreground">{t('expenses.locked_accounted')}</span>
          )}
        </div>
      </Card>


      <ReceiptViewerDialog
        open={showReceipt}
        onOpenChange={setShowReceipt}
        receiptUrls={receiptUrls}
      />
    </>
  );
};

export default Expenses;
