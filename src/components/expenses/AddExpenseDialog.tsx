import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useExpenseCategories, useCreateExpense, useUpdateExpense } from '@/hooks/useExpenses';
import { useCreateWorkerDebt } from '@/hooks/useWorkerDebts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Upload, X } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCategoryName } from '@/utils/categoryName';
import { isAdminRole } from '@/lib/utils';
import { toast } from 'sonner';
import type { ExpenseWithDetails } from '@/types/expense';

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: ExpenseWithDetails;
  initialCategoryId?: string;
}

const AddExpenseDialog: React.FC<AddExpenseDialogProps> = ({ open, onOpenChange, expense, initialCategoryId }) => {
  const { data: categories } = useExpenseCategories();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const isEdit = !!expense;

  const createWorkerDebt = useCreateWorkerDebt();
  const { language, t, dir } = useLanguage();
  const { role, activeRole, activeBranch, user } = useAuth();
  const effectiveBranchId = activeBranch?.id || activeRole?.branch_id || (user as any)?.branch_id || null;

  // Filter categories based on user's active role
  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    // Admin always sees all categories
    if (isAdminRole(role)) return categories;
    
    const userRoleCode = activeRole?.custom_role_code;
    const userSystemRole = role; // 'branch_admin', 'supervisor', 'worker'
    
    return categories.filter(cat => {
      const visibleRoles = (cat as any).visible_to_roles as string[] | null;
      // NULL or empty = visible to all
      if (!visibleRoles || visibleRoles.length === 0) return true;
      // Check system role (branch_admin, supervisor)
      if (userSystemRole && visibleRoles.includes(userSystemRole)) return true;
      // Check functional role
      return userRoleCode ? visibleRoles.includes(userRoleCode) : false;
    });
  }, [categories, role, activeRole]);

  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [advanceWorkerId, setAdvanceWorkerId] = useState('');
  const [justification, setJustification] = useState('');
  const [justificationCategoryId, setJustificationCategoryId] = useState<string | null>(null);

  // Check if selected category is fuel / advance
  const selectedCategory = filteredCategories.find(c => c.id === categoryId);
  const isFuelCategory = selectedCategory?.name?.includes('وقود') || 
    selectedCategory?.name_fr?.toLowerCase().includes('carburant') || 
    selectedCategory?.name_en?.toLowerCase().includes('fuel');
  const isAdvanceCategory = selectedCategory?.name?.includes('مسبق') ||
    selectedCategory?.name_fr?.toLowerCase().includes('avance') ||
    selectedCategory?.name_en?.toLowerCase().includes('advance');
  const isPeerHandoverCategory = selectedCategory?.name?.includes('تسليم لزميل') ||
    selectedCategory?.name_fr?.toLowerCase().includes('collègue') ||
    selectedCategory?.name_fr?.toLowerCase().includes('collegue') ||
    selectedCategory?.name_en?.toLowerCase().includes('colleague') ||
    selectedCategory?.name_en?.toLowerCase().includes('handover to');
  const needsWorkerPick = isAdvanceCategory || isPeerHandoverCategory;

  // Load workers of the current branch (for advance / peer-handover category)
  const { data: branchWorkers } = useQuery({
    queryKey: ['expense-advance-workers', effectiveBranchId],
    enabled: open && needsWorkerPick && !!effectiveBranchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workers')
        .select('id, full_name, role')
        .eq('branch_id', effectiveBranchId!)
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
  });

  const [workerPickerOpen, setWorkerPickerOpen] = useState(false);

  const resetForm = () => {
    setCategoryId('');
    setAmount('');
    setDescription('');
    setExpenseDate(format(new Date(), 'yyyy-MM-dd'));
    setReceiptFiles([]);
    setPaymentMethod('cash');
    setAdvanceWorkerId('');
    setJustification('');
    setJustificationCategoryId(null);
  };

  // Justification options = expense categories minus the peer-handover one
  const justificationOptions = useMemo(
    () => filteredCategories.filter(c => {
      const n = c.name || '';
      const nf = (c.name_fr || '').toLowerCase();
      const ne = (c.name_en || '').toLowerCase();
      return !(n.includes('تسليم لزميل') || nf.includes('collègue') || nf.includes('collegue') || ne.includes('colleague') || ne.includes('handover to'));
    }),
    [filteredCategories],
  );
  const selectedJustification = justificationOptions.find(c => c.id === justificationCategoryId);
  const isJustificationAdvance = !!(selectedJustification && (
    selectedJustification.name?.includes('مسبق') ||
    selectedJustification.name_fr?.toLowerCase().includes('avance') ||
    selectedJustification.name_en?.toLowerCase().includes('advance')
  ));

  // Receiver's salary-advance status for the current month (used to color the
  // "advance" justification button and clamp the amount). No values are exposed
  // in the UI — only a tier color, to preserve the receiver's privacy.
  const monthStartISO = useMemo(() => {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.toISOString();
  }, []);
  const { data: receiverAdvance } = useQuery({
    queryKey: ['receiver-advance-status', advanceWorkerId, monthStartISO],
    enabled: open && isPeerHandoverCategory && !!advanceWorkerId,
    queryFn: async () => {
      const [{ data: w }, { data: debts }] = await Promise.all([
        supabase.from('workers').select('max_monthly_salary_advance').eq('id', advanceWorkerId).maybeSingle(),
        supabase.from('worker_debts').select('amount').eq('worker_id', advanceWorkerId).eq('debt_type', 'advance').gte('created_at', monthStartISO),
      ]);
      const limit = Number((w as any)?.max_monthly_salary_advance || 0);
      const used = (debts || []).reduce((s, d: any) => s + Number(d.amount || 0), 0);
      return { limit, used, remaining: Math.max(0, limit - used), pct: limit > 0 ? Math.min(100, (used / limit) * 100) : 0 };
    },
  });

  const advanceTierClass = !receiverAdvance || receiverAdvance.limit <= 0
    ? 'bg-card border-border text-foreground'
    : receiverAdvance.pct >= 100
      ? 'bg-red-50 border-red-300 text-red-700'
      : receiverAdvance.pct >= 75
        ? 'bg-orange-50 border-orange-300 text-orange-700'
        : receiverAdvance.pct >= 50
          ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
          : 'bg-emerald-50 border-emerald-300 text-emerald-700';

  useEffect(() => {
    if (!needsWorkerPick) setAdvanceWorkerId('');
  }, [needsWorkerPick]);

  // Auto-open the colleague picker as soon as the peer-handover category is chosen
  useEffect(() => {
    if (open && isPeerHandoverCategory && !advanceWorkerId) {
      setWorkerPickerOpen(true);
    }
  }, [open, isPeerHandoverCategory, advanceWorkerId]);

  useEffect(() => {
    if (open && expense) {
      setCategoryId(expense.category_id || '');
      setAmount(String(expense.amount ?? ''));
      const desc = expense.description || '';
      setDescription(desc.startsWith('مسبق أجرة:') ? desc.replace(/^مسبق أجرة:[^—]*(—\s*)?/, '') : desc);
      setExpenseDate(expense.expense_date || format(new Date(), 'yyyy-MM-dd'));
      setReceiptFiles([]);
      setPaymentMethod(expense.payment_method || 'cash');
    } else if (open && !expense) {
      resetForm();
      if (initialCategoryId) setCategoryId(initialCategoryId);
    }
  }, [open, expense, initialCategoryId]);


  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setReceiptFiles(prev => [...prev, ...Array.from(files)]);
  };

  const removeFile = (index: number) => {
    setReceiptFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !amount || parseFloat(amount) <= 0) return;
    if (needsWorkerPick && !advanceWorkerId) {
      toast.error(isPeerHandoverCategory ? 'يرجى اختيار الزميل المستلِم' : 'يرجى اختيار العامل المستفيد من المسبق');
      return;
    }

    const receiptUrls: string[] = [];

    if (receiptFiles.length > 0) {
      setUploading(true);
      for (const file of receiptFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { data, error } = await supabase.storage
          .from('receipts')
          .upload(fileName, file);

        if (error) {
          console.error('Upload error:', error);
          continue;
        }
        const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(data.path);
        receiptUrls.push(urlData.publicUrl);
      }
      setUploading(false);
    }

    const workerName = needsWorkerPick
      ? (branchWorkers?.find(w => w.id === advanceWorkerId)?.full_name || '')
      : '';
    const finalDescription = isAdvanceCategory
      ? `مسبق أجرة: ${workerName}${description ? ` — ${description}` : ''}`
      : isPeerHandoverCategory
        ? `تسليم لزميل: ${workerName}${justification ? ` — مبرر: ${justification}` : ''}${description ? ` — ${description}` : ''}`
        : (description || undefined);

    if (isEdit && expense) {
      await updateExpense.mutateAsync({
        id: expense.id,
        category_id: categoryId,
        amount: parseFloat(amount),
        description: finalDescription ?? null,
        expense_date: expenseDate,
        ...(receiptUrls.length > 0 ? { receipt_url: receiptUrls[0], receipt_urls: receiptUrls } : {}),
        payment_method: isFuelCategory ? paymentMethod : 'cash',
      });
    } else {
      await createExpense.mutateAsync({
        category_id: categoryId,
        amount: parseFloat(amount),
        description: finalDescription,
        expense_date: expenseDate,
        receipt_url: receiptUrls[0],
        receipt_urls: receiptUrls,
        payment_method: isFuelCategory ? paymentMethod : 'cash',
      });

      if (isAdvanceCategory && advanceWorkerId) {
        try {
          await createWorkerDebt.mutateAsync({
            worker_id: advanceWorkerId,
            amount: parseFloat(amount),
            debt_type: 'advance',
            description: `مسبق أجرة بتاريخ ${expenseDate}${description ? ` — ${description}` : ''}`,
          });
          toast.success('تم تسجيل المسبق ضمن ديون العامل');
        } catch (err: any) {
          toast.error('تعذر تسجيل دين العامل: ' + (err?.message || ''));
        }
      }
    }


    resetForm();
    onOpenChange(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir={dir}>
        <DialogHeader>
          <DialogTitle>{isEdit ? t('common.edit') : t('expenses.add_expense')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!(initialCategoryId && !isEdit) && (
            <div className="space-y-2">
              <Label>{t('expenses.category')}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('expenses.select_category')} />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {getCategoryName(cat as any, language)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Worker selector for advance / peer handover category */}
          {needsWorkerPick && (
            <div className="space-y-2">
              <Label>{isPeerHandoverCategory ? 'الزميل المستلِم' : 'العامل المستفيد من المسبق'}</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
                onClick={() => setWorkerPickerOpen(true)}
              >
                <span className="truncate">
                  {advanceWorkerId
                    ? (branchWorkers?.find(w => w.id === advanceWorkerId)?.full_name || 'تم الاختيار')
                    : 'اختر العامل'}
                </span>
                <span className="text-xs text-muted-foreground">{isPeerHandoverCategory ? 'تسليم لزميل' : 'مسبق'}</span>
              </Button>
              <p className="text-[10px] text-muted-foreground">
                {isPeerHandoverCategory
                  ? 'سيتم تسجيل المبلغ كتسليم نقدي للزميل'
                  : 'سيتم تسجيل المبلغ ضمن ديون العامل تلقائياً'}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('expenses.amount')}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          {/* Fuel Payment Method */}
          {isFuelCategory && (
            <div className="space-y-2">
              <Label>{t('expenses.payment_method')}</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t('expenses.payment_cash')}</SelectItem>
                  <SelectItem value="card">{t('expenses.payment_card')}</SelectItem>
                </SelectContent>
              </Select>
              {paymentMethod === 'card' && (
                <p className="text-xs text-muted-foreground">{t('expenses.card_note')}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('expenses.date')}</Label>
            <Input
              type="date"
              value={expenseDate}
              onChange={e => setExpenseDate(e.target.value)}
              required
            />
          </div>

          {isPeerHandoverCategory && (
            <div className="space-y-2">
              <Label>المبرر <span className="text-[10px] text-muted-foreground">(اختياري)</span></Label>
              <Textarea
                value={justification}
                onChange={e => setJustification(e.target.value)}
                placeholder="المبرر الذي قدّمه الزميل لطلب المبلغ"
                rows={2}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('expenses.description')}</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('expenses.description_placeholder')}
              rows={2}
            />
          </div>

          {!isPeerHandoverCategory && (
            <div className="space-y-2">
              <Label>{t('expenses.receipts')}</Label>

              {receiptFiles.length > 0 && (
                <div className="space-y-1">
                  {receiptFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                      <span className="text-sm truncate flex-1">{file.name}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-2 p-3 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{t('expenses.click_upload')}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => addFiles(e.target.files)}
                />
              </label>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!categoryId || !amount || createExpense.isPending || updateExpense.isPending || uploading || createWorkerDebt.isPending || (!isEdit && needsWorkerPick && !advanceWorkerId)}
          >
            {(createExpense.isPending || updateExpense.isPending || uploading) && <Loader2 className="w-4 h-4 animate-spin me-2" />}
            {isEdit ? t('common.save') : t('expenses.add_button')}

          </Button>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={workerPickerOpen} onOpenChange={setWorkerPickerOpen}>
      <DialogContent className="max-w-md" dir={dir}>
        <DialogHeader>
          <DialogTitle>{isPeerHandoverCategory ? 'اختر الزميل المستلِم' : 'اختر العامل المستفيد'}</DialogTitle>
        </DialogHeader>
        {(!branchWorkers || branchWorkers.length === 0) ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            لا يوجد عمال في هذا الفرع
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-2 max-h-[60vh] overflow-y-auto">
            {branchWorkers.map(w => {
              const selected = advanceWorkerId === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => { setAdvanceWorkerId(w.id); setWorkerPickerOpen(false); }}
                  className={`rounded-lg border p-3 text-center text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                    selected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                      : 'border-border hover:border-primary/40 hover:bg-muted/40'
                  }`}
                >
                  <span className="line-clamp-2">{w.full_name}</span>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
};

export default AddExpenseDialog;
