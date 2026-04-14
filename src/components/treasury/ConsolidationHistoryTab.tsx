import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wallet, Pencil, Trash2, Receipt, Banknote, Coins } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';

interface ConsolidationGroup {
  id: string;
  amount: number;
  customer_name: string;
  created_at: string;
  notes: string;
  debits: Array<{ id: string; payment_method: string; amount: number }>;
}

const MoneyValue = ({ value, className = '' }: { value: number; className?: string }) => (
  <bdi dir="ltr" className={`inline-block whitespace-nowrap tabular-nums ${className}`.trim()}>
    {value.toLocaleString()} DA
  </bdi>
);

const ConsolidationHistoryTab = () => {
  const { activeBranch } = useAuth();
  const queryClient = useQueryClient();
  const [editGroup, setEditGroup] = useState<ConsolidationGroup | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: consolidations, isLoading } = useQuery({
    queryKey: ['consolidation-history', activeBranch?.id],
    queryFn: async () => {
      let query = supabase
        .from('manager_treasury')
        .select('*')
        .in('source_type', ['cash_consolidation', 'cash_consolidation_debit'])
        .order('created_at', { ascending: false });
      if (activeBranch?.id) query = query.eq('branch_id', activeBranch.id);
      const { data, error } = await query;
      if (error) throw error;

      // Group: positive entry + its debits (same customer_name, within 10s)
      const positives = (data || []).filter((e: any) => e.source_type === 'cash_consolidation');
      const negatives = (data || []).filter((e: any) => e.source_type === 'cash_consolidation_debit');

      const groups: ConsolidationGroup[] = positives.map((pos: any) => {
        const posTime = new Date(pos.created_at).getTime();
        const relatedDebits = negatives.filter((neg: any) => {
          const negTime = new Date(neg.created_at).getTime();
          return neg.customer_name === pos.customer_name && Math.abs(negTime - posTime) < 10000;
        });
        return {
          id: pos.id,
          amount: Number(pos.amount),
          customer_name: pos.customer_name || '',
          created_at: pos.created_at,
          notes: pos.notes || '',
          debits: relatedDebits.map((d: any) => ({
            id: d.id,
            payment_method: d.payment_method,
            amount: Math.abs(Number(d.amount)),
          })),
        };
      });
      return groups;
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['consolidation-history'] });
    queryClient.invalidateQueries({ queryKey: ['manager-treasury'] });
    queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
    queryClient.invalidateQueries({ queryKey: ['treasury-details'] });
    queryClient.invalidateQueries({ queryKey: ['treasury-remaining-counts'] });
  };

  const handleDelete = async (group: ConsolidationGroup) => {
    if (!confirm('هل تريد إلغاء هذا التجميع؟ سيتم استرجاع جميع المبالغ إلى مصادرها الأصلية.')) return;
    try {
      const allIds = [group.id, ...group.debits.map(d => d.id)];
      const { error } = await supabase.from('manager_treasury').delete().in('id', allIds);
      if (error) throw error;
      toast.success('تم إلغاء التجميع بنجاح');
      invalidateAll();
    } catch (err: any) {
      toast.error('خطأ: ' + (err.message || ''));
    }
  };

  const openEdit = (group: ConsolidationGroup) => {
    setEditGroup(group);
    setEditCustomerName(group.customer_name);
  };

  const handleSaveEdit = async () => {
    if (!editGroup || !editCustomerName.trim()) return;
    setSaving(true);
    try {
      const allIds = [editGroup.id, ...editGroup.debits.map(d => d.id)];
      const { error } = await supabase
        .from('manager_treasury')
        .update({ customer_name: editCustomerName.trim() })
        .in('id', allIds);
      if (error) throw error;
      toast.success('تم تحديث التجميع بنجاح');
      invalidateAll();
      setEditGroup(null);
    } catch (err: any) {
      toast.error('خطأ: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const methodLabel: Record<string, { label: string; icon: typeof Banknote }> = {
    cash_invoice1: { label: 'كاش فاتورة 1 + طابع', icon: Banknote },
    receipt_cash: { label: 'Versement Cash', icon: Receipt },
    cash_invoice2: { label: 'كاش فاتورة 2', icon: Coins },
  };

  if (isLoading) {
    return <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>;
  }

  if (!consolidations || consolidations.length === 0) {
    return <p className="text-center text-muted-foreground py-8">لا توجد تجميعات سابقة</p>;
  }

  return (
    <div className="space-y-2">
      {consolidations.map(group => (
        <Card key={group.id} className="border-amber-200/50">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-600" />
                <span className="font-bold"><MoneyValue value={group.amount} className="text-base" /></span>
                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">💰 تجميع كاش</Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(group)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(group)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>العميل: <span className="font-medium text-foreground">{group.customer_name}</span></span>
              <span>{format(new Date(group.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}</span>
            </div>

            {/* Debit breakdown */}
            <div className="grid grid-cols-1 gap-1">
              {group.debits.map(debit => {
                const method = methodLabel[debit.payment_method];
                return (
                  <div key={debit.id} className="flex items-center justify-between text-xs bg-muted/40 rounded px-2 py-1">
                    <div className="flex items-center gap-1.5">
                      {method?.icon && <method.icon className="w-3 h-3 text-muted-foreground" />}
                      <span>{method?.label || debit.payment_method}</span>
                    </div>
                    <MoneyValue value={debit.amount} className="text-xs font-medium" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Edit Dialog */}
      <Dialog open={!!editGroup} onOpenChange={(v) => !v && setEditGroup(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              تعديل التجميع
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">اسم العميل</Label>
              <Input
                value={editCustomerName}
                onChange={e => setEditCustomerName(e.target.value)}
                className="mt-1"
              />
            </div>
            {editGroup && (
              <div className="text-sm text-muted-foreground">
                المبلغ: <MoneyValue value={editGroup.amount} className="font-bold text-foreground" />
              </div>
            )}
            <Button onClick={handleSaveEdit} disabled={saving || !editCustomerName.trim()} className="w-full">
              {saving ? 'جاري الحفظ...' : 'حفظ التعديل'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsolidationHistoryTab;
