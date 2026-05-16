import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Navbar preferences are shared by ROLE (not per worker), so e.g. every
 * Branch Manager — across all branches (Oran, Mostaganem, …) — sees the
 * same bottom-bar buttons. When the active role has a custom_role_code,
 * we scope by that; otherwise we scope by the base AppRole.
 *
 * Read:  pick the most recently-updated tab_paths among all workers that
 *        share the same role identity.
 * Save:  propagate the same tab_paths to every worker sharing that role
 *        identity, so all members of the role stay in sync.
 */
export const useNavbarPreferences = () => {
  const { workerId, role, activeRole } = useAuth();
  const queryClient = useQueryClient();

  const customRoleCode = activeRole?.custom_role_code || null;
  const roleKey = customRoleCode ? `custom:${customRoleCode}` : `base:${role ?? ''}`;

  // Resolve the set of worker ids that share this role identity
  const resolveWorkerIds = async (): Promise<string[]> => {
    if (customRoleCode) {
      // Workers carrying this custom role via worker_roles -> custom_roles
      const { data, error } = await supabase
        .from('worker_roles')
        .select('worker_id, custom_roles!inner(code)')
        .eq('custom_roles.code', customRoleCode);
      if (error) throw error;
      const ids = (data || []).map((r: any) => r.worker_id).filter(Boolean);
      return Array.from(new Set(ids));
    }
    if (!role) return workerId ? [workerId] : [];
    const { data, error } = await supabase
      .from('workers')
      .select('id')
      .eq('role', role);
    if (error) throw error;
    const ids = (data || []).map((r: any) => r.id);
    return Array.from(new Set(ids));
  };

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['navbar-preferences', roleKey],
    queryFn: async () => {
      const ids = await resolveWorkerIds();
      if (ids.length === 0) return null;
      const { data, error } = await supabase
        .from('navbar_preferences')
        .select('*')
        .in('worker_id', ids)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!(workerId && (role || customRoleCode)),
  });

  const savePreferences = useMutation({
    mutationFn: async (tabPaths: string[]) => {
      if (!workerId) throw new Error('No worker');
      const ids = await resolveWorkerIds();
      const targets = ids.length > 0 ? ids : [workerId];

      // Find which targets already have a row
      const { data: existing, error: exErr } = await supabase
        .from('navbar_preferences')
        .select('worker_id')
        .in('worker_id', targets);
      if (exErr) throw exErr;
      const existingSet = new Set((existing || []).map((r: any) => r.worker_id));
      const updatedAt = new Date().toISOString();

      const toUpdate = targets.filter(id => existingSet.has(id));
      const toInsert = targets.filter(id => !existingSet.has(id));

      if (toUpdate.length > 0) {
        const { error } = await supabase
          .from('navbar_preferences')
          .update({ tab_paths: tabPaths, updated_at: updatedAt })
          .in('worker_id', toUpdate);
        if (error) throw error;
      }
      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('navbar_preferences')
          .insert(toInsert.map(id => ({ worker_id: id, tab_paths: tabPaths })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navbar-preferences'] });
    },
  });

  return {
    tabPaths: preferences?.tab_paths as string[] | null,
    isLoading,
    savePreferences,
  };
};
