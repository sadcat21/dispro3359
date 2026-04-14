import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Customer, Worker, Branch } from '@/types/database';

// Shared query keys for cache coordination
export const queryKeys = {
  customers: ['customers'] as const,
  branches: ['branches'] as const,
  activeBranches: ['branches', 'active'] as const,
  workers: ['workers'] as const,
  workersSafe: ['workers-safe'] as const,
  workersSafeByRole: (role: string) => ['workers-safe', role] as const,
  customRoles: ['custom-roles'] as const,
  workerRoles: ['worker-roles'] as const,
  sectorZones: ['sector-zones'] as const,
  products: ['products'] as const,
};

export function useCustomersQuery() {
  return useQuery({
    queryKey: queryKeys.customers,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as Customer[];
    },
  });
}

export function useBranchesQuery(activeOnly = true) {
  return useQuery({
    queryKey: activeOnly ? queryKeys.activeBranches : queryKeys.branches,
    queryFn: async () => {
      let query = supabase.from('branches').select('*').order('name');
      if (activeOnly) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Branch[];
    },
  });
}

export function useWorkersQuery() {
  return useQuery({
    queryKey: queryKeys.workers,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Worker[];
    },
  });
}

export function useWorkersSafeQuery(role?: string) {
  return useQuery({
    queryKey: role ? queryKeys.workersSafeByRole(role) : queryKeys.workersSafe,
    queryFn: async () => {
      let query = supabase.from('workers_safe').select('*');
      if (role) query = query.eq('role', role);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Worker[];
    },
  });
}

export function useAllBranchesQuery() {
  return useQuery({
    queryKey: queryKeys.branches,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Branch[];
    },
  });
}

export function useSectorZonesQuery() {
  return useQuery({
    queryKey: queryKeys.sectorZones,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sector_zones')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });
}
