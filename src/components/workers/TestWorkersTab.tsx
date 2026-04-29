import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader2, FlaskConical, Trash2, Shield, Building2, PackageCheck, AlertTriangle, RefreshCw, MapPin, ShieldCheck, Wallet, FileText, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/types/database';

interface TestWorker {
  id: string;
  username: string;
  full_name: string;
  role: AppRole;
  is_active: boolean;
  is_test: boolean;
  branch_id: string | null;
}

interface TestBranch {
  id: string;
  name: string;
  wilaya: string;
  is_active: boolean;
}

interface RealBranch {
  id: string;
  name: string;
  wilaya: string;
}

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'مدير النظام',
  branch_admin: 'مدير فرع',
  supervisor: 'مشرف',
  worker: 'عامل',
  project_manager: 'مدير المشروع',
  accountant: 'المحاسب',
  admin_assistant: 'عون إداري',
  warehouse_manager: 'مسؤول المخزن',
  company_manager: 'مساعد المدير العام',
  internal_supervisor: 'مشرف داخلي',
};

interface DataCloneOption {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultChecked: boolean;
}

const CLONE_OPTIONS: DataCloneOption[] = [
  { key: 'stock', label: 'المخزون', description: 'نسخ أرصدة المخزون (warehouse_stock)', icon: <PackageCheck className="w-4 h-4" />, defaultChecked: true },
  { key: 'sectors', label: 'القطاعات والمناطق', description: 'نسخ القطاعات (sectors) والمناطق (zones)', icon: <MapPin className="w-4 h-4" />, defaultChecked: true },
  { key: 'workers', label: 'العمال (نسخ تجريبية)', description: 'إنشاء نسخ تجريبية من عمال الفرع المرجعي', icon: <Shield className="w-4 h-4" />, defaultChecked: true },
  { key: 'permissions', label: 'الصلاحيات والأدوار', description: 'نسخ أدوار وصلاحيات العمال', icon: <ShieldCheck className="w-4 h-4" />, defaultChecked: true },
  { key: 'treasury', label: 'الخزينة', description: 'نسخ بيانات الخزينة (manager_treasury)', icon: <Wallet className="w-4 h-4" />, defaultChecked: false },
  { key: 'customers', label: 'العملاء', description: 'نسخ عملاء الفرع المرجعي', icon: <FileText className="w-4 h-4" />, defaultChecked: false },
  { key: 'debts', label: 'الديون', description: 'نسخ ديون العملاء (customer_debts) مرتبطة بالعملاء المنسوخين', icon: <Banknote className="w-4 h-4" />, defaultChecked: false },
];

const TestWorkersTab: React.FC = () => {
  const { t } = useLanguage();
  const { activeBranch } = useAuth();
  const [testWorkers, setTestWorkers] = useState<TestWorker[]>([]);
  const [realWorkers, setRealWorkers] = useState<TestWorker[]>([]);
  const [testBranch, setTestBranch] = useState<TestBranch | null>(null);
  const [realBranches, setRealBranches] = useState<RealBranch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deleteWorker, setDeleteWorker] = useState<TestWorker | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [stockCount, setStockCount] = useState(0);

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedSourceBranch, setSelectedSourceBranch] = useState<string>('');
  const [selectedCloneOptions, setSelectedCloneOptions] = useState<Record<string, boolean>>(
    Object.fromEntries(CLONE_OPTIONS.map(o => [o.key, o.defaultChecked]))
  );

  // Sync dialog state
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [syncSourceBranch, setSyncSourceBranch] = useState<string>('');
  const [syncOptions, setSyncOptions] = useState<Record<string, boolean>>(
    Object.fromEntries(CLONE_OPTIONS.map(o => [o.key, o.defaultChecked]))
  );

  const referenceBranches = useMemo<RealBranch[]>(() => {
    const merged: RealBranch[] = [...realBranches];

    if (activeBranch && !String(activeBranch.name || '').includes('تجريبي')) {
      merged.unshift({
        id: activeBranch.id,
        name: activeBranch.name,
        wilaya: activeBranch.wilaya,
      });
    }

    const seen = new Set<string>();
    return merged.filter((branch) => {
      if (!branch?.id || !branch?.name || seen.has(branch.id)) return false;
      seen.add(branch.id);
      return branch.id !== testBranch?.id && !branch.name.includes('تجريبي');
    });
  }, [realBranches, activeBranch, testBranch?.id]);

  useEffect(() => {
    if (showCreateDialog && !selectedSourceBranch && referenceBranches.length > 0) {
      setSelectedSourceBranch(referenceBranches[0].id);
    }
  }, [showCreateDialog, selectedSourceBranch, referenceBranches]);

  useEffect(() => {
    if (showSyncDialog && !syncSourceBranch && referenceBranches.length > 0) {
      setSyncSourceBranch(referenceBranches[0].id);
    }
  }, [showSyncDialog, syncSourceBranch, referenceBranches]);

  const fetchAll = async () => {
    try {
      const [testRes, realRes, branchRes, allBranchesRes] = await Promise.all([
        supabase.from('workers').select('id, username, full_name, role, is_active, is_test, branch_id').eq('is_test', true).order('full_name'),
        supabase.from('workers').select('id, username, full_name, role, is_active, is_test, branch_id').eq('is_test', false).eq('is_active', true).order('full_name'),
        supabase.from('branches').select('id, name, wilaya, is_active').ilike('name', '%تجريبي%').limit(1),
        supabase.from('branches').select('id, name, wilaya').not('name', 'ilike', '%تجريبي%').eq('is_active', true).order('name'),
      ]);
      setTestWorkers((testRes.data || []) as TestWorker[]);
      setRealWorkers((realRes.data || []) as TestWorker[]);
      setRealBranches((allBranchesRes.data || []) as RealBranch[]);

      const tb = (branchRes.data || [])[0] as TestBranch | undefined;
      setTestBranch(tb || null);

      if (tb) {
        const { count } = await supabase.from('warehouse_stock').select('id', { count: 'exact', head: true }).eq('branch_id', tb.id);
        setStockCount(count || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  // ─── إنشاء فرع تجريبي مع نسخ البيانات ───
  const createTestBranch = async () => {
    if (!selectedSourceBranch) {
      toast.error('اختر الفرع المرجعي أولاً');
      return;
    }
    setIsCreatingBranch(true);
    try {
      const sourceBranch = realBranches.find(b => b.id === selectedSourceBranch);

      // 1. Create the test branch
      const { data: newBranch, error } = await supabase.from('branches').insert({
        name: `فرع تجريبي - ${sourceBranch?.name || ''}`,
        wilaya: sourceBranch?.wilaya || 'تجريبي',
        is_active: true,
      }).select().single();

      if (error) throw error;
      const testBranchId = newBranch.id;

      // 2. Clone selected data
      await cloneData(selectedSourceBranch, testBranchId, selectedCloneOptions);

      setTestBranch(newBranch as TestBranch);
      setShowCreateDialog(false);
      toast.success('تم إنشاء الفرع التجريبي ونسخ البيانات بنجاح');
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'فشل في إنشاء الفرع التجريبي');
    } finally {
      setIsCreatingBranch(false);
    }
  };

  // ─── نسخ/تحديث البيانات من فرع مرجعي ───
  const cloneData = async (sourceBranchId: string, testBranchId: string, options: Record<string, boolean>) => {
    const results: string[] = [];

    // نسخ المخزون
    if (options.stock) {
      const { data: realStock } = await supabase
        .from('warehouse_stock')
        .select('product_id, quantity, damaged_quantity, factory_return_quantity, compensation_quantity')
        .eq('branch_id', sourceBranchId);

      if (realStock && realStock.length > 0) {
        await supabase.from('warehouse_stock').delete().eq('branch_id', testBranchId);
        const stockRows = realStock.map(s => ({
          branch_id: testBranchId,
          product_id: s.product_id,
          quantity: s.quantity,
          damaged_quantity: s.damaged_quantity || 0,
          factory_return_quantity: s.factory_return_quantity || 0,
          compensation_quantity: s.compensation_quantity || 0,
        }));
        await supabase.from('warehouse_stock').insert(stockRows);
        results.push(`المخزون: ${stockRows.length} منتج`);
      }
    }

    // نسخ القطاعات
    // Build mapping tables for sector IDs and zone IDs (old → new)
    const sectorIdMap = new Map<string, string>(); // sourceSectorId → testSectorId
    const zoneIdMap = new Map<string, string>(); // sourceZoneId → testZoneId

    if (options.sectors) {
      const { data: sourceSectors } = await supabase
        .from('sectors')
        .select('*, sector_zones(*)')
        .eq('branch_id', sourceBranchId);

      if (sourceSectors && sourceSectors.length > 0) {
        // Delete old test sectors and their schedules
        const { data: oldSectors } = await supabase.from('sectors').select('id').eq('branch_id', testBranchId);
        if (oldSectors && oldSectors.length > 0) {
          const oldIds = oldSectors.map(s => s.id);
          await supabase.from('sector_schedules').delete().in('sector_id', oldIds);
          await supabase.from('sector_zones').delete().in('sector_id', oldIds);
          await supabase.from('sectors').delete().eq('branch_id', testBranchId);
        }

        for (const sector of sourceSectors) {
          const { data: newSector } = await supabase.from('sectors').insert({
            name: sector.name,
            name_fr: sector.name_fr,
            branch_id: testBranchId,
            visit_day_sales: sector.visit_day_sales,
            visit_day_delivery: sector.visit_day_delivery,
            sector_type: sector.sector_type,
          }).select().single();

          if (newSector) {
            sectorIdMap.set(sector.id, newSector.id);

            if (sector.sector_zones && sector.sector_zones.length > 0) {
              for (const z of (sector.sector_zones as any[])) {
                const { data: newZone } = await supabase.from('sector_zones').insert({
                  sector_id: newSector.id,
                  name: z.name,
                  name_fr: z.name_fr,
                }).select().single();
                if (newZone) zoneIdMap.set(z.id, newZone.id);
              }
            }
          }
        }

        // Clone sector_schedules with mapped sector IDs and worker IDs
        const sourceSectorIds = sourceSectors.map(s => s.id);
        const { data: sourceSchedules } = await supabase
          .from('sector_schedules')
          .select('*')
          .in('sector_id', sourceSectorIds);

        if (sourceSchedules && sourceSchedules.length > 0) {
          // Build worker ID mapping (source worker → test worker)
          const workerIdMap = new Map<string, string>();
          const { data: sourceWorkers } = await supabase
            .from('workers')
            .select('id, username')
            .eq('branch_id', sourceBranchId)
            .eq('is_test', false);
          const { data: testBranchWorkers } = await supabase
            .from('workers')
            .select('id, username')
            .eq('branch_id', testBranchId)
            .eq('is_test', true);

          if (sourceWorkers && testBranchWorkers) {
            for (const sw of sourceWorkers) {
              const testWorker = testBranchWorkers.find(tw => tw.username === `test_${sw.username}`);
              if (testWorker) workerIdMap.set(sw.id, testWorker.id);
            }
          }

          const scheduleRows = sourceSchedules
            .filter(sc => sectorIdMap.has(sc.sector_id))
            .map(sc => ({
              sector_id: sectorIdMap.get(sc.sector_id)!,
              schedule_type: sc.schedule_type,
              day: sc.day,
              worker_id: (sc.worker_id && workerIdMap.has(sc.worker_id)) ? workerIdMap.get(sc.worker_id)! : sc.worker_id,
            }));

          if (scheduleRows.length > 0) {
            await supabase.from('sector_schedules').insert(scheduleRows);
          }
          results.push(`القطاعات: ${sourceSectors.length} قطاع + ${scheduleRows.length} جدول`);
        } else {
          results.push(`القطاعات: ${sourceSectors.length} قطاع`);
        }
      }
    }

    // نسخ العمال
    if (options.workers) {
      const { data: branchWorkers } = await supabase
        .from('workers')
        .select('id, username, full_name, role, is_active')
        .eq('branch_id', sourceBranchId)
        .eq('is_test', false)
        .eq('is_active', true);

      if (branchWorkers && branchWorkers.length > 0) {
        const existingTestUsernames = testWorkers.map(tw => tw.username.replace('test_', ''));
        const workersToClone = branchWorkers.filter(w => !existingTestUsernames.includes(w.username));

        if (workersToClone.length > 0) {
          const newTestWorkers = workersToClone.map(w => ({
            username: `test_${w.username}`,
            full_name: `[تجريبي] ${w.full_name}`,
            role: w.role,
            branch_id: testBranchId,
            is_active: true,
            is_test: true,
            password_hash: btoa(`test_${w.username}`),
          }));

          const { error } = await supabase.from('workers').insert(newTestWorkers);
          if (!error) {
            // Create worker_roles
            if (options.permissions) {
              const { data: insertedWorkers } = await supabase
                .from('workers')
                .select('id, username, role, branch_id')
                .eq('is_test', true)
                .in('username', newTestWorkers.map(w => w.username));

              if (insertedWorkers && insertedWorkers.length > 0) {
                // Copy roles from source workers
                for (const tw of insertedWorkers) {
                  const originalUsername = tw.username.replace('test_', '');
                  const originalWorker = branchWorkers.find(w => w.username === originalUsername);
                  if (originalWorker) {
                    const { data: originalRoles } = await supabase
                      .from('worker_roles')
                      .select('role, custom_role_id')
                      .eq('worker_id', originalWorker.id);

                    if (originalRoles && originalRoles.length > 0) {
                      const rolesToInsert = originalRoles.map(r => ({
                        worker_id: tw.id,
                        role: r.role as AppRole,
                        branch_id: testBranchId,
                        custom_role_id: r.custom_role_id,
                      }));
                      await supabase.from('worker_roles').insert(rolesToInsert);
                    } else {
                      await supabase.from('worker_roles').insert({
                        worker_id: tw.id,
                        role: tw.role as AppRole,
                        branch_id: tw.branch_id,
                      });
                    }
                  }
                }
              }
            }
            results.push(`العمال: ${newTestWorkers.length} عامل`);
          }
        }
      }
    }

    // نسخ العملاء
    if (options.customers) {
      const { data: sourceCustomers } = await supabase
        .from('customers')
        .select('name, name_fr, phone, address, wilaya, store_name, store_name_fr, customer_type, default_payment_type, default_price_subtype, sector_id, zone_id, latitude, longitude, location_type')
        .eq('branch_id', sourceBranchId)
        .eq('status', 'active')
        .limit(500);

      if (sourceCustomers && sourceCustomers.length > 0) {
        await supabase.from('customers').delete().eq('branch_id', testBranchId);
        const customerRows = sourceCustomers.map(c => ({
          ...c,
          branch_id: testBranchId,
          status: 'active',
          internal_name: `[تجريبي] ${c.name}`,
          // Map sector_id and zone_id to cloned test IDs if available
          sector_id: (c.sector_id && sectorIdMap.has(c.sector_id)) ? sectorIdMap.get(c.sector_id) : c.sector_id,
          zone_id: (c.zone_id && zoneIdMap.has(c.zone_id)) ? zoneIdMap.get(c.zone_id) : c.zone_id,
        }));
        await supabase.from('customers').insert(customerRows);
        results.push(`العملاء: ${customerRows.length} عميل`);
      }
    }

    // نسخ الخزينة
    if (options.treasury) {
      const { data: sourceTreasury } = await supabase
        .from('manager_treasury')
        .select('manager_id, source_type, payment_method, amount, notes')
        .eq('branch_id', sourceBranchId)
        .limit(100);

      if (sourceTreasury && sourceTreasury.length > 0) {
        await supabase.from('manager_treasury').delete().eq('branch_id', testBranchId);
        // Find test manager
        const { data: testManagers } = await supabase
          .from('workers')
          .select('id')
          .eq('branch_id', testBranchId)
          .eq('is_test', true)
          .in('role', ['admin', 'branch_admin'])
          .limit(1);

        const testManagerId = testManagers?.[0]?.id;
        if (testManagerId) {
          const treasuryRows = sourceTreasury.map(t => ({
            branch_id: testBranchId,
            manager_id: testManagerId,
            source_type: t.source_type,
            payment_method: t.payment_method,
            amount: t.amount,
            notes: `[تجريبي] ${t.notes || ''}`,
          }));
          await supabase.from('manager_treasury').insert(treasuryRows);
          results.push(`الخزينة: ${treasuryRows.length} سجل`);
        }
      }
    }

    // نسخ الديون
    if (options.debts) {
      // Build customer ID mapping: source customer → test customer (by name match)
      const { data: sourceCustomersList } = await supabase
        .from('customers')
        .select('id, name')
        .eq('branch_id', sourceBranchId)
        .eq('status', 'active');

      const { data: testCustomersList } = await supabase
        .from('customers')
        .select('id, name, internal_name')
        .eq('branch_id', testBranchId);

      const customerIdMap = new Map<string, string>();
      if (sourceCustomersList && testCustomersList) {
        for (const sc of sourceCustomersList) {
          const tc = testCustomersList.find(t => t.internal_name === `[تجريبي] ${sc.name}` || t.name === sc.name);
          if (tc) customerIdMap.set(sc.id, tc.id);
        }
      }

      if (customerIdMap.size > 0) {
        // Delete old test debts
        await supabase.from('customer_debts').delete().eq('branch_id', testBranchId);

        // Fetch source debts
        const { data: sourceDebts } = await supabase
          .from('customer_debts')
          .select('*')
          .eq('branch_id', sourceBranchId);

        if (sourceDebts && sourceDebts.length > 0) {
          // Build worker ID mapping
          const workerIdMap = new Map<string, string>();
          const { data: srcWorkers } = await supabase
            .from('workers')
            .select('id, username')
            .eq('branch_id', sourceBranchId)
            .eq('is_test', false);
          const { data: tstWorkers } = await supabase
            .from('workers')
            .select('id, username')
            .eq('branch_id', testBranchId)
            .eq('is_test', true);
          if (srcWorkers && tstWorkers) {
            for (const sw of srcWorkers) {
              const tw = tstWorkers.find(t => t.username === `test_${sw.username}`);
              if (tw) workerIdMap.set(sw.id, tw.id);
            }
          }

          const debtRows = sourceDebts
            .filter(d => customerIdMap.has(d.customer_id))
            .map(d => ({
              customer_id: customerIdMap.get(d.customer_id)!,
              worker_id: workerIdMap.get(d.worker_id) || d.worker_id,
              branch_id: testBranchId,
              total_amount: d.total_amount,
              paid_amount: d.paid_amount,
              remaining_amount: d.remaining_amount,
              status: d.status,
              notes: `[تجريبي] ${d.notes || ''}`,
              due_date: d.due_date,
              collection_type: d.collection_type,
              collection_amount: d.collection_amount,
              collection_days: d.collection_days,
            }));

          if (debtRows.length > 0) {
            await supabase.from('customer_debts').insert(debtRows);
            results.push(`الديون: ${debtRows.length} دين`);
          }
        }
      } else {
        results.push('الديون: يجب نسخ العملاء أولاً');
      }
    }

    if (results.length > 0) {
      toast.success(`تم نسخ: ${results.join(' | ')}`);
    }
  };

  // ─── تحديث البيانات من فرع مرجعي ───
  const syncFromBranch = async () => {
    if (!testBranch || !syncSourceBranch) {
      toast.error('اختر الفرع المرجعي');
      return;
    }
    setIsSyncing(true);
    try {
      await cloneData(syncSourceBranch, testBranch.id, syncOptions);
      setShowSyncDialog(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'فشل في التحديث');
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleTestWorkerStatus = async (worker: TestWorker) => {
    const { error } = await supabase.from('workers').update({ is_active: !worker.is_active }).eq('id', worker.id);
    if (error) { toast.error('فشل في تحديث الحالة'); return; }
    setTestWorkers(prev => prev.map(w => w.id === worker.id ? { ...w, is_active: !w.is_active } : w));
  };

  const handleDeleteTestWorker = async (worker: TestWorker) => {
    try {
      await supabase.from('worker_roles').delete().eq('worker_id', worker.id);
      const { error } = await supabase.from('workers').delete().eq('id', worker.id);
      if (error) throw error;
      toast.success(`تم حذف ${worker.full_name}`);
      setTestWorkers(prev => prev.filter(w => w.id !== worker.id));
    } catch (err: any) {
      toast.error(err.message || 'فشل في الحذف');
    }
  };

  const deleteAllTestWorkers = async () => {
    try {
      const ids = testWorkers.map(w => w.id);
      if (ids.length === 0) return;
      await supabase.from('worker_roles').delete().in('worker_id', ids);
      const { error } = await supabase.from('workers').delete().in('id', ids);
      if (error) throw error;
      toast.success('تم حذف جميع العمال التجريبيين');
      setTestWorkers([]);
    } catch (err: any) {
      toast.error(err.message || 'فشل في الحذف');
    }
  };

  const renderCloneOptions = (options: Record<string, boolean>, setOptions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) => (
    <div className="space-y-3">
      {CLONE_OPTIONS.map(opt => (
        <label key={opt.key} className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors">
          <Checkbox
            checked={options[opt.key]}
            onCheckedChange={(checked) => setOptions(prev => ({ ...prev, [opt.key]: !!checked }))}
            className="mt-0.5"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {opt.icon}
              <span className="font-medium text-sm">{opt.label}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{opt.description}</p>
          </div>
        </label>
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── الفرع التجريبي ─── */}
      <Card className="border-dashed border-2 border-primary/30">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">الفرع التجريبي</p>
              {testBranch ? (
                <p className="text-xs text-muted-foreground">
                  {testBranch.name} - {testBranch.wilaya}
                  <Badge variant="outline" className="mr-2 text-[10px]">
                    {testBranch.is_active ? 'نشط' : 'غير نشط'}
                  </Badge>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">لم يتم إنشاء فرع تجريبي بعد</p>
              )}
            </div>
          </div>

          {!testBranch ? (
            <Button onClick={() => setShowCreateDialog(true)} size="sm" className="w-full">
              <Building2 className="w-4 h-4 ml-2" />
              إنشاء فرع تجريبي
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => { setSyncSourceBranch(''); setShowSyncDialog(true); }} size="sm" variant="outline">
                <RefreshCw className="w-4 h-4 ml-2" />
                تحديث البيانات من فرع حقيقي
              </Button>
              <span className="text-xs text-muted-foreground self-center">({stockCount} منتج في المخزون)</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── تنبيه العزل ─── */}
      {testBranch && (
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-bold">بيئة تجريبية معزولة</p>
              <p>جميع العمال التجريبيين مربوطون بالفرع التجريبي. أي طلبيات أو عمليات مخزون ستتم فقط على بيانات الفرع التجريبي ولن تؤثر على الفرع الحقيقي.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── أزرار العمال ─── */}
      {testBranch && (
        <div className="flex flex-wrap gap-2">
          {testWorkers.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteAllConfirm(true)}>
              <Trash2 className="w-4 h-4 ml-2" />
              حذف الكل
            </Button>
          )}
        </div>
      )}

      {/* ─── إحصائيات ─── */}
      <Card className="bg-secondary">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <FlaskConical className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">عمال تجريبيون</p>
            <p className="text-2xl font-bold">{testWorkers.length}</p>
          </div>
        </CardContent>
      </Card>

      {testWorkers.length > 0 && (
        <p className="text-xs text-muted-foreground">
          🔑 كلمة السر لكل عامل تجريبي = اسم المستخدم (مثال: test_zinou27 / test_zinou27)
        </p>
      )}

      {/* ─── قائمة العمال ─── */}
      <div className="space-y-3">
        {testWorkers.map((worker) => (
          <Card key={worker.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{worker.full_name}</p>
                  <p className="text-sm text-muted-foreground">@{worker.username}</p>
                  <Badge variant="secondary" className="mt-2">
                    <Shield className="w-3 h-3 ml-1" />
                    {ROLE_LABELS[worker.role]}
                  </Badge>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2 py-1 rounded font-medium ${worker.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {worker.is_active ? t('common.active') : t('common.inactive')}
                  </span>
                  <Switch checked={worker.is_active} onCheckedChange={() => toggleTestWorkerStatus(worker)} />
                  <Button
                    variant="outline" size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/30"
                    onClick={() => setDeleteWorker(worker)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {testWorkers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>لا يوجد عمال تجريبيون</p>
            <p className="text-xs mt-1">{testBranch ? 'استخدم "تحديث البيانات" لنسخ العمال والبيانات' : 'أنشئ فرع تجريبي أولاً'}</p>
          </div>
        )}
      </div>

      {/* ─── نافذة إنشاء الفرع التجريبي ─── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              إنشاء فرع تجريبي
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-bold">الفرع المرجعي (الحقيقي) * {referenceBranches.length > 0 && <span className="text-xs text-muted-foreground">({referenceBranches.length})</span>}</Label>
              <div className="space-y-2">
                {referenceBranches.map((branch) => (
                  <Button
                    key={branch.id}
                    type="button"
                    variant={selectedSourceBranch === branch.id ? 'default' : 'outline'}
                    className="h-auto w-full justify-start px-4 py-3 text-start whitespace-normal"
                    onClick={() => setSelectedSourceBranch(branch.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="text-start">
                        <div className="font-medium">{branch.name}</div>
                        <div className="text-xs opacity-80">{branch.wilaya}</div>
                      </div>
                    </div>
                  </Button>
                ))}
                {referenceBranches.length === 0 && (
                  <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                    لا توجد فروع حقيقية متاحة للاختيار الآن.
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">سيتم إنشاء فرع تجريبي كنسخة من هذا الفرع</p>
            </div>

            <div className="space-y-2">
              <Label className="font-bold">البيانات المراد نسخها</Label>
              {renderCloneOptions(selectedCloneOptions, setSelectedCloneOptions)}
            </div>

            <Button onClick={createTestBranch} disabled={isCreatingBranch || !selectedSourceBranch} className="w-full">
              {isCreatingBranch ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Building2 className="w-4 h-4 ml-2" />}
              إنشاء ونسخ البيانات
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── نافذة تحديث البيانات ─── */}
      <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              تحديث بيانات الفرع التجريبي
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-bold">الفرع المرجعي * {referenceBranches.length > 0 && <span className="text-xs text-muted-foreground">({referenceBranches.length})</span>}</Label>
              <div className="space-y-2">
                {referenceBranches.map((branch) => (
                  <Button
                    key={branch.id}
                    type="button"
                    variant={syncSourceBranch === branch.id ? 'default' : 'outline'}
                    className="h-auto w-full justify-start px-4 py-3 text-start whitespace-normal"
                    onClick={() => setSyncSourceBranch(branch.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="text-start">
                        <div className="font-medium">{branch.name}</div>
                        <div className="text-xs opacity-80">{branch.wilaya}</div>
                      </div>
                    </div>
                  </Button>
                ))}
                {referenceBranches.length === 0 && (
                  <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                    لا توجد فروع حقيقية متاحة للاختيار الآن.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold">البيانات المراد تحديثها</Label>
              <p className="text-xs text-destructive">⚠️ سيتم استبدال البيانات الحالية في الفرع التجريبي</p>
              {renderCloneOptions(syncOptions, setSyncOptions)}
            </div>

            <Button onClick={syncFromBranch} disabled={isSyncing || !syncSourceBranch} className="w-full">
              {isSyncing ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <RefreshCw className="w-4 h-4 ml-2" />}
              تحديث البيانات
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── تأكيد حذف عامل ─── */}
      <AlertDialog open={!!deleteWorker} onOpenChange={() => setDeleteWorker(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العامل التجريبي</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف "{deleteWorker?.full_name}"؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => { if (deleteWorker) handleDeleteTestWorker(deleteWorker); setDeleteWorker(null); }}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── تأكيد حذف الكل ─── */}
      <AlertDialog open={showDeleteAllConfirm} onOpenChange={setShowDeleteAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف جميع العمال التجريبيين</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف {testWorkers.length} عامل تجريبي نهائياً. هل تريد المتابعة؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => { deleteAllTestWorkers(); setShowDeleteAllConfirm(false); }}>حذف الكل</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TestWorkersTab;
