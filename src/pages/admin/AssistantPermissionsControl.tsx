import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Loader2,
  Search,
  Shield,
  ShieldCheck,
  ShieldOff,
  UserCog,
  Users,
  ArrowLeft,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  usePermissions,
  useIndividualWorkerPermissions,
  useToggleWorkerPermission,
  useRolesWithPermissions,
} from '@/hooks/usePermissions';
import { PERMISSION_CATEGORIES, RESOURCE_NAMES, type PermissionCategory } from '@/types/permissions';

interface AssistantWorker {
  id: string;
  full_name: string;
  username: string;
  branch_name: string | null;
}

const ASSISTANT_ROLE_CODE = 'company_manager';

const AssistantPermissionsControl: React.FC = () => {
  const [selectedWorker, setSelectedWorker] = useState<AssistantWorker | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [permSearch, setPermSearch] = useState('');

  const { data: permissions, isLoading: permsLoading } = usePermissions();
  const { data: roles } = useRolesWithPermissions();
  const { data: individualPerms } = useIndividualWorkerPermissions(selectedWorker?.id ?? null);
  const togglePerm = useToggleWorkerPermission();

  // Fetch all workers who have the assistant general manager role
  const { data: assistants, isLoading: assistantsLoading } = useQuery({
    queryKey: ['assistant-workers'],
    queryFn: async () => {
      const { data: customRole } = await supabase
        .from('custom_roles')
        .select('id')
        .eq('code', ASSISTANT_ROLE_CODE)
        .maybeSingle();

      // استعلامان منفصلان ثم دمج النتائج (أكثر موثوقية من .or مع enum)
      const [byRole, byCustom] = await Promise.all([
        supabase.from('worker_roles').select('worker_id').eq('role', 'company_manager' as any),
        customRole?.id
          ? supabase.from('worker_roles').select('worker_id').eq('custom_role_id', customRole.id)
          : Promise.resolve({ data: [] as { worker_id: string }[], error: null } as any),
      ]);
      if (byRole.error) throw byRole.error;
      if (byCustom.error) throw byCustom.error;

      const ids = Array.from(
        new Set([
          ...(byRole.data ?? []).map((r: any) => r.worker_id),
          ...(byCustom.data ?? []).map((r: any) => r.worker_id),
        ])
      );
      if (ids.length === 0) return [] as AssistantWorker[];

      const { data: workers, error: wErr } = await supabase
        .from('workers')
        .select('id, full_name, username, branch_id, branches(name)')
        .in('id', ids)
        .eq('is_active', true)
        .order('full_name');
      if (wErr) throw wErr;

      return (workers ?? []).map((w: any) => ({
        id: w.id,
        full_name: w.full_name,
        username: w.username,
        branch_name: w.branches?.name ?? null,
      })) as AssistantWorker[];
    },
  });

  // Permissions assigned to the assistant role (the 75 baseline)
  const assistantRole = useMemo(
    () => roles?.find((r) => r.code === ASSISTANT_ROLE_CODE) ?? null,
    [roles]
  );
  const rolePermissionIds = useMemo(
    () => new Set((assistantRole?.permissions ?? []).map((p) => p.id)),
    [assistantRole]
  );

  // Permissions are "effectively granted" if granted by role AND not denied by individual override,
  // OR explicitly granted individually.
  const individualMap = useMemo(() => {
    // We need to know granted=true vs granted=false per permission.
    // useIndividualWorkerPermissions returns just IDs that exist as overrides.
    // We re-query here for granted flag.
    return individualPerms ?? [];
  }, [individualPerms]);

  // Re-query individual overrides with granted flag
  const { data: individualOverrides } = useQuery({
    queryKey: ['worker-individual-overrides-detailed', selectedWorker?.id],
    queryFn: async () => {
      if (!selectedWorker) return [] as { permission_id: string; granted: boolean }[];
      const { data, error } = await supabase
        .from('worker_permissions')
        .select('permission_id, granted')
        .eq('worker_id', selectedWorker.id);
      if (error) throw error;
      return data as { permission_id: string; granted: boolean }[];
    },
    enabled: !!selectedWorker,
  });

  const overrideMap = useMemo(() => {
    const m = new Map<string, boolean>();
    (individualOverrides ?? []).forEach((o) => m.set(o.permission_id, o.granted));
    return m;
  }, [individualOverrides]);

  const isEffectivelyGranted = (permId: string) => {
    if (overrideMap.has(permId)) return overrideMap.get(permId)!;
    return rolePermissionIds.has(permId);
  };

  const filteredAssistants = useMemo(() => {
    if (!assistants) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return assistants;
    return assistants.filter(
      (w) =>
        w.full_name.toLowerCase().includes(q) ||
        w.username.toLowerCase().includes(q) ||
        (w.branch_name ?? '').toLowerCase().includes(q)
    );
  }, [assistants, searchQuery]);

  // Group permissions by category and resource
  const grouped = useMemo(() => {
    const out: Record<PermissionCategory, Record<string, typeof permissions>> = {
      page_access: {},
      crud: {},
      data_scope: {},
    };
    const q = permSearch.trim().toLowerCase();
    (permissions ?? []).forEach((p) => {
      if (q && !p.name_ar.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) return;
      const cat = p.category as PermissionCategory;
      if (!out[cat]) return;
      if (!out[cat][p.resource]) out[cat][p.resource] = [];
      out[cat][p.resource]!.push(p);
    });
    return out;
  }, [permissions, permSearch]);

  const stats = useMemo(() => {
    if (!permissions) return { total: 0, granted: 0, page: 0, crud: 0, scope: 0 };
    let granted = 0;
    let page = 0;
    let crud = 0;
    let scope = 0;
    permissions.forEach((p) => {
      const on = isEffectivelyGranted(p.id);
      if (on) {
        granted++;
        if (p.category === 'page_access') page++;
        else if (p.category === 'crud') crud++;
        else if (p.category === 'data_scope') scope++;
      }
    });
    return { total: permissions.length, granted, page, crud, scope };
  }, [permissions, overrideMap, rolePermissionIds]);

  const handleToggle = async (permId: string, currentlyOn: boolean) => {
    if (!selectedWorker) return;
    try {
      await togglePerm.mutateAsync({
        workerId: selectedWorker.id,
        permissionId: permId,
        grant: !currentlyOn,
      });
      toast.success(currentlyOn ? 'تم إلغاء الصلاحية' : 'تم تفعيل الصلاحية');
    } catch (e: any) {
      toast.error(e?.message ?? 'تعذّر تحديث الصلاحية');
    }
  };

  return (
    <div dir="rtl" className="container mx-auto p-4 space-y-4 max-w-7xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <UserCog className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">التحكم في صلاحيات مساعدي المدير العام</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                اختر مساعد المدير العام وقم بتفعيل أو إلغاء صلاحياته فردياً
              </p>
            </div>
          </div>

          <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Users className="h-4 w-4" />
                {selectedWorker ? 'تغيير المساعد' : 'اختر مساعد المدير العام'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>اختر مساعد المدير العام</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ابحث بالاسم أو اسم المستخدم أو الفرع..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10"
                  />
                </div>
                {assistantsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : filteredAssistants.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    لا يوجد مساعدون مطابقون
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] pr-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filteredAssistants.map((w) => {
                        const isSelected = selectedWorker?.id === w.id;
                        return (
                          <button
                            key={w.id}
                            onClick={() => {
                              setSelectedWorker(w);
                              setPickerOpen(false);
                            }}
                            className={`text-right p-4 rounded-lg border-2 transition-all hover:border-primary hover:shadow-md ${
                              isSelected
                                ? 'border-primary bg-primary/5'
                                : 'border-border bg-card'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{w.full_name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  @{w.username}
                                </p>
                                {w.branch_name && (
                                  <Badge variant="secondary" className="mt-2 text-xs">
                                    {w.branch_name}
                                  </Badge>
                                )}
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      {!selectedWorker ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-lg font-medium">لم يتم اختيار مساعد بعد</p>
            <p className="text-sm text-muted-foreground">
              اضغط على "اختر مساعد المدير العام" لعرض قائمة المساعدين والبدء في تعديل صلاحياتهم.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Selected worker summary */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/15">
                    <UserCog className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{selectedWorker.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      @{selectedWorker.username}
                      {selectedWorker.branch_name ? ` • ${selectedWorker.branch_name}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Shield className="h-3 w-3" />
                    إجمالي: {stats.total}
                  </Badge>
                  <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                    <ShieldCheck className="h-3 w-3" />
                    مفعّلة: {stats.granted}
                  </Badge>
                  <Badge variant="secondary">صفحات: {stats.page}</Badge>
                  <Badge variant="secondary">CRUD: {stats.crud}</Badge>
                  <Badge variant="secondary">نطاق البيانات: {stats.scope}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Permissions tabs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="text-base">الصلاحيات</CardTitle>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ابحث في الصلاحيات..."
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    className="pr-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {permsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <Tabs defaultValue="page_access" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="page_access">
                      صفحات ({stats.page}/{Object.values(grouped.page_access).flat().length})
                    </TabsTrigger>
                    <TabsTrigger value="crud">
                      CRUD ({stats.crud}/{Object.values(grouped.crud).flat().length})
                    </TabsTrigger>
                    <TabsTrigger value="data_scope">
                      نطاق البيانات ({stats.scope}/{Object.values(grouped.data_scope).flat().length})
                    </TabsTrigger>
                  </TabsList>

                  {(['page_access', 'crud', 'data_scope'] as PermissionCategory[]).map((cat) => (
                    <TabsContent key={cat} value={cat} className="mt-4 space-y-4">
                      {Object.keys(grouped[cat]).length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          لا توجد صلاحيات في هذه الفئة
                        </div>
                      ) : (
                        Object.entries(grouped[cat]).map(([resource, perms]) => (
                          <div key={resource} className="border rounded-lg overflow-hidden">
                            <div className="bg-muted/50 px-4 py-2 border-b font-semibold text-sm">
                              {RESOURCE_NAMES[resource] ?? resource}
                              <Badge variant="outline" className="mr-2 text-xs">
                                {perms!.length}
                              </Badge>
                            </div>
                            <div className="divide-y">
                              {perms!.map((p) => {
                                const on = isEffectivelyGranted(p.id);
                                const inRole = rolePermissionIds.has(p.id);
                                const overridden = overrideMap.has(p.id);
                                return (
                                  <div
                                    key={p.id}
                                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-medium text-sm">{p.name_ar}</p>
                                        {overridden && (
                                          <Badge variant="outline" className="text-[10px] h-5">
                                            تخصيص فردي
                                          </Badge>
                                        )}
                                        {!inRole && !overridden && (
                                          <Badge variant="outline" className="text-[10px] h-5 border-dashed">
                                            غير ضمن الدور
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                        {p.code}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {on ? (
                                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                      ) : (
                                        <ShieldOff className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <Switch
                                        checked={on}
                                        disabled={togglePerm.isPending}
                                        onCheckedChange={() => handleToggle(p.id, on)}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AssistantPermissionsControl;
