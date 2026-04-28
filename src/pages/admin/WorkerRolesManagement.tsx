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
import { Loader2, Plus, Trash2, Calendar, ShieldCheck, ShieldOff, ArrowRight, HardHat, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
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
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
        throw new Error(t('worker_roles.select_worker_and_role'));
      }
      const cr = customRoles?.find(c => c.id === newCustomRoleId);
      if (!cr) throw new Error(t('worker_roles.invalid_role'));

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
      toast.success(t('worker_roles.add_success'));
      qc.invalidateQueries({ queryKey: ['worker-roles-mgmt'] });
      setAddOpen(false);
      setNewCustomRoleId('');
      setNewValidFrom('');
      setNewValidUntil('');
      setNewNotes('');
    },
    onError: (e: any) => toast.error(e.message || t('worker_roles.add_failed')),
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
      toast.success(t('worker_roles.status_updated'));
    },
    onError: (e: any) => toast.error(e.message || t('worker_roles.update_failed')),
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
      toast.success(t('worker_roles.period_updated'));
    },
    onError: (e: any) => toast.error(e.message || t('worker_roles.update_failed')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('worker_roles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-roles-mgmt'] });
      toast.success(t('worker_roles.delete_success'));
    },
    onError: (e: any) => toast.error(e.message || t('worker_roles.delete_failed')),
  });

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        {t('worker_roles.admin_only')}
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

  const WORKER_CARD_COLORS = [
    { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', icon: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400', accent: 'text-blue-600 dark:text-blue-400' },
    { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', icon: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400', accent: 'text-emerald-600 dark:text-emerald-400' },
    { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400', accent: 'text-amber-600 dark:text-amber-400' },
    { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800', icon: 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400', accent: 'text-violet-600 dark:text-violet-400' },
    { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800', icon: 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400', accent: 'text-rose-600 dark:text-rose-400' },
    { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', icon: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400', accent: 'text-cyan-600 dark:text-cyan-400' },
    { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', icon: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400', accent: 'text-orange-600 dark:text-orange-400' },
    { bg: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-200 dark:border-teal-800', icon: 'bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400', accent: 'text-teal-600 dark:text-teal-400' },
    { bg: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-200 dark:border-indigo-800', icon: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400', accent: 'text-indigo-600 dark:text-indigo-400' },
    { bg: 'bg-pink-50 dark:bg-pink-950/30', border: 'border-pink-200 dark:border-pink-800', icon: 'bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-400', accent: 'text-pink-600 dark:text-pink-400' },
  ];

  const selectedWorker = workers?.find(w => w.id === selectedWorkerId) || null;
  const q = searchQuery.trim().toLowerCase();
  const filteredWorkers = (workers || []).filter(w =>
    !q || w.full_name.toLowerCase().includes(q) || w.username.toLowerCase().includes(q)
  );

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        {selectedWorkerId && (
          <button
            onClick={() => setSelectedWorkerId(null)}
            className="p-1.5 rounded-lg hover:bg-muted"
            aria-label={t('common.back')}
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-2xl font-bold">
          {selectedWorker ? selectedWorker.full_name : t('worker_roles.title')}
        </h1>
      </div>

      {!selectedWorkerId && (
        <>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('worker_roles.search_worker')}
              className="pr-9"
            />
          </div>

          {workersLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredWorkers.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">{t('worker_roles.no_workers')}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredWorkers.map((w, index) => {
                const colorSet = WORKER_CARD_COLORS[index % WORKER_CARD_COLORS.length];
                return (
                  <div
                    key={w.id}
                    className={`flex flex-col items-center justify-center p-3 gap-1.5 rounded-xl border-2 cursor-pointer active:scale-95 transition-all hover:shadow-lg ${colorSet.bg} ${colorSet.border}`}
                    onClick={() => setSelectedWorkerId(w.id)}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorSet.icon}`}>
                      <HardHat className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-center leading-tight text-foreground">{w.full_name}</span>
                    <span className={`text-[10px] font-medium ${colorSet.accent}`}>{w.username}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {selectedWorkerId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('worker_roles.assigned_roles')}</CardTitle>
            <Button onClick={() => setAddOpen(true)} size="sm">
              <Plus className="w-4 h-4 ml-1" />
              {t('worker_roles.add_role')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {rolesLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : workerRoles?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">{t('worker_roles.no_roles')}</p>
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
                        {!r.is_active && <Badge variant="outline">{t('worker_roles.disabled_manually')}</Badge>}
                        {r.valid_until && new Date(r.valid_until) < new Date() && (
                          <Badge variant="destructive">{t('worker_roles.expired')}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">{t('worker_roles.enabled')}</Label>
                        <Switch
                          checked={r.is_active}
                          onCheckedChange={(checked) => toggleMutation.mutate({ id: r.id, is_active: checked })}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(t('worker_roles.confirm_delete'))) deleteMutation.mutate(r.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {t('worker_roles.from_date')}
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
                          <Calendar className="w-3 h-3" /> {t('worker_roles.to_date')}
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
            <DialogTitle>{t('worker_roles.add_role_title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('worker_roles.role')}</Label>
              <Select value={newCustomRoleId} onValueChange={setNewCustomRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('worker_roles.role_placeholder')} />
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
              <Label>{t('worker_roles.from_date_optional')}</Label>
              <Input type="datetime-local" value={newValidFrom} onChange={(e) => setNewValidFrom(e.target.value)} />
            </div>
            <div>
              <Label>{t('worker_roles.to_date_optional')}</Label>
              <Input type="datetime-local" value={newValidUntil} onChange={(e) => setNewValidUntil(e.target.value)} />
            </div>
            <div>
              <Label>{t('worker_roles.notes')}</Label>
              <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder={t('worker_roles.notes_placeholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !newCustomRoleId}>
              {addMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-1" />}
              {t('common.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkerRolesManagement;
