import React, { useState, useEffect } from 'react';
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
import { Loader2, Plus, Trash2, Calendar, ShieldCheck, ShieldOff, ArrowRight, HardHat, Search, Shield, Check } from 'lucide-react';
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
  is_primary: boolean;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  custom_roles?: { code: string; name_ar: string } | null;
}

// تصنيف الأدوار حسب الرتبة (أعلى رقم = صلاحية أعلى)
const ROLE_RANK: Record<string, number> = {
  worker: 1,
  accountant: 2,
  admin_assistant: 2,
  warehouse_manager: 2,
  sales_rep: 2,
  delivery_rep: 2,
  supervisor: 3,
  branch_admin: 4,
  company_manager: 5,
  project_manager: 6,
  admin: 7,
};

const getRoleRank = (code: string | null | undefined): number => {
  if (!code) return 0;
  return ROLE_RANK[code] ?? 1;
};

const WorkerRolesManagement: React.FC = () => {
  const { role, activeBranch, activeRole } = useAuth();
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const qc = useQueryClient();
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [primaryRoleId, setPrimaryRoleId] = useState<string | null>(null);
  const [newValidFrom, setNewValidFrom] = useState<string>('');
  const [newValidUntil, setNewValidUntil] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');

  const isAdmin = role === 'admin' || role === 'project_manager' || activeRole?.custom_role_code === 'company_manager';

  // أعلى رتبة للمستخدم الحالي = max(دوره الأساسي, دوره النشط المخصص)
  const currentUserRank = Math.max(
    getRoleRank(role || undefined),
    getRoleRank(activeRole?.custom_role_code || undefined)
  );

  const { data: workers, isLoading: workersLoading } = useQuery({
    queryKey: ['workers-list-roles-mgmt', activeBranch?.id ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('workers')
        .select('id, full_name, username, role, branch_id')
        .eq('is_active', true)
        .order('full_name');
      if (activeBranch?.id) {
        query = query.eq('branch_id', activeBranch.id);
      }
      const { data, error } = await query;
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

  // عند فتح الديالوغ: تحديد الأدوار المسندة سابقًا (النشطة) تلقائيًا + الدور الرئيسي
  useEffect(() => {
    if (addOpen && workerRoles) {
      const existingActive = workerRoles
        .filter(wr => wr.is_active && wr.custom_role_id)
        .map(wr => wr.custom_role_id as string);
      setSelectedRoleIds(existingActive);
      const primary = workerRoles.find(wr => wr.is_active && wr.is_primary && wr.custom_role_id);
      setPrimaryRoleId(primary?.custom_role_id ?? (existingActive[0] ?? null));
    }
  }, [addOpen, workerRoles]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWorkerId) {
        throw new Error(t('worker_roles.select_worker_and_role'));
      }

      const baseRoleMap: Record<string, AppRole> = {
        admin: 'admin',
        branch_admin: 'branch_admin',
        supervisor: 'supervisor',
        worker: 'worker',
        project_manager: 'project_manager',
        accountant: 'accountant',
        admin_assistant: 'admin_assistant',
      };

      // منع منح صلاحية >= صلاحية المستخدم الحالي
      // (admin يستطيع منح كل شيء فقط لو كان admin؛ غيره ممنوع منح ما يساويه أو يفوقه)
      const isFullAdmin = role === 'admin';
      for (const rid of selectedRoleIds) {
        const cr = customRoles?.find(c => c.id === rid);
        if (!cr) continue;
        const targetRank = getRoleRank(cr.code);
        if (!isFullAdmin && targetRank >= currentUserRank) {
          throw new Error(t('worker_roles.cannot_grant_higher'));
        }
      }

      // الأدوار النشطة الحالية للعامل
      const currentActive = (workerRoles || []).filter(wr => wr.is_active && wr.custom_role_id);
      const currentActiveIds = currentActive.map(wr => wr.custom_role_id as string);

      const toDeactivate = currentActive.filter(wr => !selectedRoleIds.includes(wr.custom_role_id as string));
      const toInsertIds = selectedRoleIds.filter(id => !currentActiveIds.includes(id));

      if (toDeactivate.length > 0) {
        const { error: deactErr } = await supabase
          .from('worker_roles')
          .update({ is_active: false } as any)
          .in('id', toDeactivate.map(wr => wr.id));
        if (deactErr) throw deactErr;
      }

      if (toInsertIds.length > 0) {
        const rows = toInsertIds.map(rid => {
          const cr = customRoles?.find(c => c.id === rid);
          const baseRole: AppRole = (cr && baseRoleMap[cr.code]) || 'worker';
          return {
            worker_id: selectedWorkerId,
            role: baseRole,
            custom_role_id: rid,
            is_active: true,
            valid_from: newValidFrom ? new Date(newValidFrom).toISOString() : null,
            valid_until: newValidUntil ? new Date(newValidUntil).toISOString() : null,
            notes: newNotes || null,
          };
        });
        const { error } = await supabase.from('worker_roles').insert(rows as any);
        if (error) throw error;
      }

      // مزامنة الدور الرئيسي: نزع is_primary عن الجميع ثم تعيينه للمختار
      // (نقوم بهذه الخطوة دائمًا حتى لو لم تتغير القائمة)
      const { error: clearErr } = await supabase
        .from('worker_roles')
        .update({ is_primary: false } as any)
        .eq('worker_id', selectedWorkerId);
      if (clearErr) throw clearErr;

      if (primaryRoleId && selectedRoleIds.includes(primaryRoleId)) {
        const { error: setErr } = await supabase
          .from('worker_roles')
          .update({ is_primary: true } as any)
          .eq('worker_id', selectedWorkerId)
          .eq('custom_role_id', primaryRoleId)
          .eq('is_active', true);
        if (setErr) throw setErr;
      }
    },
    onSuccess: () => {
      toast.success(t('worker_roles.add_success'));
      qc.invalidateQueries({ queryKey: ['worker-roles-mgmt'] });
      setAddOpen(false);
      setSelectedRoleIds([]);
      setPrimaryRoleId(null);
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
    <div className="container mx-auto p-4 space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
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
          <CardContent>
            {rolesLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : workerRoles?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">{t('worker_roles.no_roles')}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {workerRoles?.map((r, index) => {
                  const effective = isRoleEffective(r);
                  const roleName = r.custom_roles?.name_ar || r.role;
                  const colorSet = WORKER_CARD_COLORS[index % WORKER_CARD_COLORS.length];
                  const isPrimary = r.is_primary && r.is_active;
                  const isExpired = r.valid_until && new Date(r.valid_until) < new Date();

                  return (
                    <div
                      key={r.id}
                      className={`relative rounded-2xl border-2 overflow-hidden transition-all hover:shadow-xl ${
                        isPrimary
                          ? 'border-red-500 bg-gradient-to-br from-red-50 via-rose-50 to-orange-50 dark:from-red-950/40 dark:via-rose-950/30 dark:to-orange-950/40 shadow-lg shadow-red-300/60 ring-2 ring-red-400/40'
                          : !r.is_active
                          ? 'border-muted bg-muted/30 opacity-70'
                          : `${colorSet.border} ${colorSet.bg}`
                      }`}
                    >
                      {/* شريط علوي للدور الرئيسي */}
                      {isPrimary && (
                        <>
                          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-500 via-rose-500 to-orange-500" />
                          {/* شارة "الدور الرئيسي" البارزة */}
                          <div className={`absolute top-2 ${isRtl ? 'left-2' : 'right-2'} z-10`}>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-bold shadow-md animate-pulse">
                              ⭐ {t('worker_roles.primary_role')}
                            </span>
                          </div>
                        </>
                      )}

                      {/* رأس البطاقة */}
                      <div className="p-4 pb-3">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                              isPrimary
                                ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md'
                                : effective ? colorSet.icon : 'bg-muted text-muted-foreground'
                            }`}>
                              {isPrimary ? <span className="text-2xl">⭐</span> : effective ? <ShieldCheck className="w-6 h-6" /> : <ShieldOff className="w-6 h-6" />}
                            </div>
                            <div className={`min-w-0 flex-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                              <h3 className="font-bold text-sm leading-tight truncate text-foreground">{roleName}</h3>
                              <div className={`flex flex-wrap gap-1 mt-1 ${isRtl ? 'justify-end' : 'justify-start'}`}>
                                {!r.is_primary && r.is_active && (
                                  <span className="text-[10px] font-medium text-muted-foreground">{t('worker_roles.secondary_role')}</span>
                                )}
                                {!r.is_active && (
                                  <span className="text-[10px] font-medium text-muted-foreground">{t('worker_roles.disabled_manually')}</span>
                                )}
                                {isExpired && (
                                  <span className="text-[10px] font-bold text-destructive">• {t('worker_roles.expired')}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => {
                              if (confirm(t('worker_roles.confirm_delete'))) deleteMutation.mutate(r.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>

                        {/* أزرار التحكم */}
                        <div className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-background/60 backdrop-blur-sm border">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={r.is_active}
                              onCheckedChange={(checked) => toggleMutation.mutate({ id: r.id, is_active: checked })}
                            />
                            <Label className="text-xs font-semibold">{t('worker_roles.enabled')}</Label>
                          </div>
                          {r.is_active && !r.is_primary && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] px-2 border-amber-400 text-amber-700 hover:bg-amber-50"
                              onClick={async () => {
                                await supabase.from('worker_roles').update({ is_primary: false } as any).eq('worker_id', r.worker_id);
                                await supabase.from('worker_roles').update({ is_primary: true } as any).eq('id', r.id);
                                qc.invalidateQueries({ queryKey: ['worker-roles-mgmt'] });
                                toast.success(t('worker_roles.set_primary'));
                              }}
                            >
                              ⭐ {t('worker_roles.set_primary')}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* قسم التواريخ */}
                      <div className="px-4 pb-4 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px] flex items-center gap-1 text-muted-foreground mb-1">
                              <Calendar className="w-3 h-3" /> {t('worker_roles.from_date')}
                            </Label>
                            <Input
                              type="datetime-local"
                              className="h-8 text-xs"
                              defaultValue={formatDateInput(r.valid_from)}
                              onBlur={(e) => {
                                const newVal = e.target.value ? new Date(e.target.value).toISOString() : null;
                                if (newVal !== r.valid_from) {
                                  updateDatesMutation.mutate({ id: r.id, valid_from: newVal, valid_until: r.valid_until });
                                }
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] flex items-center gap-1 text-muted-foreground mb-1">
                              <Calendar className="w-3 h-3" /> {t('worker_roles.to_date')}
                            </Label>
                            <Input
                              type="datetime-local"
                              className="h-8 text-xs"
                              defaultValue={formatDateInput(r.valid_until)}
                              onBlur={(e) => {
                                const newVal = e.target.value ? new Date(e.target.value).toISOString() : null;
                                if (newVal !== r.valid_until) {
                                  updateDatesMutation.mutate({ id: r.id, valid_from: r.valid_from, valid_until: newVal });
                                }
                              }}
                            />
                          </div>
                        </div>
                        {r.notes && (
                          <p className="text-[11px] text-muted-foreground bg-background/60 rounded-md p-2 border">
                            📝 {r.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir={isRtl ? 'rtl' : 'ltr'} className="max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-6 pb-3 border-b shrink-0">
            <DialogTitle>{t('worker_roles.add_role_title')}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            <div>
              <Label>{t('worker_roles.role')}</Label>
              <p className="text-[11px] text-muted-foreground mt-1">{t('worker_roles.choose_primary_hint')}</p>
              {!customRoles || customRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{t('worker_roles.no_roles')}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 p-1">
                  {customRoles.map((cr, index) => {
                    const colorSet = WORKER_CARD_COLORS[index % WORKER_CARD_COLORS.length];
                    const isSelected = selectedRoleIds.includes(cr.id);
                    const isPrimary = primaryRoleId === cr.id;
                    const targetRank = getRoleRank(cr.code);
                    const isFullAdmin = role === 'admin';
                    const isForbidden = !isFullAdmin && targetRank >= currentUserRank;
                    return (
                      <div
                        key={cr.id}
                        onClick={() => {
                          if (isForbidden) {
                            toast.error(t('worker_roles.cannot_grant_higher'));
                            return;
                          }
                          setSelectedRoleIds(prev => {
                            const next = prev.includes(cr.id) ? prev.filter(id => id !== cr.id) : [...prev, cr.id];
                            // إذا أُزيل الدور الرئيسي، اختر أول دور متبقٍ
                            if (!next.includes(primaryRoleId || '')) {
                              setPrimaryRoleId(next[0] ?? null);
                            } else if (!primaryRoleId && next.length > 0) {
                              setPrimaryRoleId(next[0]);
                            }
                            return next;
                          });
                        }}
                        onDoubleClick={() => {
                          if (isForbidden || !isSelected) return;
                          setPrimaryRoleId(cr.id);
                        }}
                        className={`relative flex flex-col items-center justify-center p-3 gap-1.5 rounded-xl border-2 transition-all ${
                          isForbidden
                            ? 'opacity-40 cursor-not-allowed bg-muted border-muted'
                            : `cursor-pointer active:scale-95 hover:shadow-md ${colorSet.bg} ${isSelected ? 'border-primary ring-2 ring-primary/40' : colorSet.border}`
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                        {isSelected && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setPrimaryRoleId(cr.id); }}
                            className={`absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                              isPrimary ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground hover:bg-amber-200'
                            }`}
                            title={t('worker_roles.set_primary')}
                          >
                            ⭐
                          </button>
                        )}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorSet.icon}`}>
                          <Shield className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-center leading-tight text-foreground">{cr.name_ar}</span>
                        <span className={`text-[10px] font-medium ${colorSet.accent}`}>{cr.code}</span>
                      </div>
                    );
                  })}
                </div>
              )}
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
          <DialogFooter className="p-4 border-t bg-background shrink-0 sticky bottom-0">
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
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
