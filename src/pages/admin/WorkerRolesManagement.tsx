import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Calendar, ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/types/database';

interface WorkerRow {
  id: string;
  full_name: string;
  username: string;
  role: AppRole;
}

interface CustomRoleRow {
  id: string;
  code: string;
  name_ar: string;
}

interface WorkerRoleRow {
  id: string;
  worker_id: string;
  role: AppRole;
  branch_id: string | null;
  custom_role_id: string | null;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  custom_roles?: { code: string; name_ar: string } | null;
}

const WorkerRolesManagement: React.FC = () => {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newCustomRoleId, setNewCustomRoleId] = useState<string>('');
  const [newValidFrom, setNewValidFrom] = useState<string>('');
  const [newValidUntil, setNewValidUntil] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');

  const isAdmin = role === 'admin' || role === 'project_manager';

  const { data: workers, isLoading: workersLoading } = useQuery({
    queryKey: ['workers-list-roles-mgmt'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workers')
        .select('id, full_name, username, role')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data as WorkerRow[];
    },
  });

  const { data: customRoles } = useQuery({
    queryKey: ['custom-roles-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_roles')
        .select('id, code, name_ar')
        .order('name_ar');
      if (error) throw error;
      return data as CustomRoleRow[];
    },
  });

  const { data: workerRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ['worker-roles-mgmt', selectedWorkerId],
    enabled: !!selectedWorkerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_roles')
        .select('*, custom_roles(code, name_ar)')
        .eq('worker_id', selectedWorkerId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WorkerRoleRow[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWorkerId || !newCustomRoleId) {
        throw new Error('اختر عاملاً ودوراً');
      }
      const cr = customRoles?.find(c => c.id === newCustomRoleId);
      if (!cr) throw new Error('دور غير صالح');

      // map custom role code to base app_role when possible (fallback: 'worker')
      const baseRoleMap: Record<string, AppRole> = {
        admin: 'admin',
        branch_admin: 'branch_admin',
        supervisor: 'supervisor',
        worker: 'worker',
        project_manager: 'project_manager',
        accountant: 'accountant',
        admin_assistant: 'admin_assistant',
      };
      const baseRole: AppRole = baseRoleMap[cr.code] || 'worker';

      const { error } = await supabase.from('worker_roles').insert({
        worker_id: selectedWorkerId,
        role: baseRole,
        custom_role_id: cr.id,
        is_active: true,
        valid_from: newValidFrom ? new Date(newValidFrom).toISOString() : null,
        valid_until: newValidUntil ? new Date(newValidUntil).toISOString() : null,
        notes: newNotes || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم إضافة الدور بنجاح');
      qc.invalidateQueries({ queryKey: ['worker-roles-mgmt'] });
      setAddOpen(false);
      setNewCustomRoleId('');
      setNewValidFrom('');
      setNewValidUntil('');
      setNewNotes('');
    },
    onError: (e: any) => toast.error(e.message || 'فشل إضافة الدور'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('worker_roles')
        .update({ is_active } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-roles-mgmt'] });
      toast.success('تم تحديث الحالة');
    },
    onError: (e: any) => toast.error(e.message || 'فشل التحديث'),
  });

  const updateDatesMutation = useMutation({
    mutationFn: async ({ id, valid_from, valid_until }: { id: string; valid_from: string | null; valid_until: string | null }) => {
      const { error } = await supabase
        .from('worker_roles')
        .update({ valid_from, valid_until } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-roles-mgmt'] });
      toast.success('تم تحديث الفترة');
    },
    onError: (e: any) => toast.error(e.message || 'فشل التحديث'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('worker_roles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-roles-mgmt'] });
      toast.success('تم حذف الدور');
    },
    onError: (e: any) => toast.error(e.message || 'فشل الحذف'),
  });

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        هذه الصفحة مخصصة لمدير النظام فقط
      </div>
    );
  }

  const isRoleEffective = (r: WorkerRoleRow) => {
    if (!r.is_active) return false;
    const now = new Date();
    if (r.valid_from && new Date(r.valid_from) > now) return false;
    if (r.valid_until && new Date(r.valid_until) < now) return false;
    return true;
  };

  const formatDateInput = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">إدارة أدوار العمال</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>اختر عاملاً</CardTitle>
        </CardHeader>
        <CardContent>
          {workersLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Select value={selectedWorkerId || ''} onValueChange={setSelectedWorkerId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر العامل..." />
              </SelectTrigger>
              <SelectContent>
                {workers?.map(w => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.full_name} ({w.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedWorkerId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>الأدوار المُسندة</CardTitle>
            <Button onClick={() => setAddOpen(true)} size="sm">
              <Plus className="w-4 h-4 ml-1" />
              إضافة دور
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {rolesLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : workerRoles?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">لا توجد أدوار مُسندة</p>
            ) : (
              workerRoles?.map(r => {
                const effective = isRoleEffective(r);
                const roleName = r.custom_roles?.name_ar || r.role;
                return (
                  <div key={r.id} className="border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={effective ? 'default' : 'secondary'}>
                          {effective ? <ShieldCheck className="w-3 h-3 ml-1" /> : <ShieldOff className="w-3 h-3 ml-1" />}
                          {roleName}
                        </Badge>
                        {!r.is_active && <Badge variant="outline">معطّل يدوياً</Badge>}
                        {r.valid_until && new Date(r.valid_until) < new Date() && (
                          <Badge variant="destructive">منتهي</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">مفعّل</Label>
                        <Switch
                          checked={r.is_active}
                          onCheckedChange={(checked) => toggleMutation.mutate({ id: r.id, is_active: checked })}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('حذف هذا الدور؟')) deleteMutation.mutate(r.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> من تاريخ
                        </Label>
                        <Input
                          type="datetime-local"
                          defaultValue={formatDateInput(r.valid_from)}
                          onBlur={(e) => {
                            const newVal = e.target.value ? new Date(e.target.value).toISOString() : null;
                            const oldVal = r.valid_from;
                            if (newVal !== oldVal) {
                              updateDatesMutation.mutate({ id: r.id, valid_from: newVal, valid_until: r.valid_until });
                            }
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> إلى تاريخ
                        </Label>
                        <Input
                          type="datetime-local"
                          defaultValue={formatDateInput(r.valid_until)}
                          onBlur={(e) => {
                            const newVal = e.target.value ? new Date(e.target.value).toISOString() : null;
                            const oldVal = r.valid_until;
                            if (newVal !== oldVal) {
                              updateDatesMutation.mutate({ id: r.id, valid_from: r.valid_from, valid_until: newVal });
                            }
                          }}
                        />
                      </div>
                    </div>

                    {r.notes && <p className="text-xs text-muted-foreground">📝 {r.notes}</p>}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة دور جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الدور</Label>
              <Select value={newCustomRoleId} onValueChange={setNewCustomRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الدور..." />
                </SelectTrigger>
                <SelectContent>
                  {customRoles?.map(cr => (
                    <SelectItem key={cr.id} value={cr.id}>
                      {cr.name_ar} ({cr.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>من تاريخ (اختياري)</Label>
              <Input type="datetime-local" value={newValidFrom} onChange={(e) => setNewValidFrom(e.target.value)} />
            </div>
            <div>
              <Label>إلى تاريخ (اختياري)</Label>
              <Input type="datetime-local" value={newValidUntil} onChange={(e) => setNewValidUntil(e.target.value)} />
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="اختياري" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !newCustomRoleId}>
              {addMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-1" />}
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkerRolesManagement;
