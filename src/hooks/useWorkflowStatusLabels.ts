import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type WorkflowStatusCategory =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'terminal'
  | 'cancelled';

export type WorkflowStatusColor =
  | 'muted'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info';

export interface WorkflowStatusLabel {
  id: string;
  document_type: string;
  status_code: string;
  locale: string;
  label: string;
  description: string | null;
  category: WorkflowStatusCategory;
  color: WorkflowStatusColor;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

export type WorkflowDocumentType =
  | 'factory_order'
  | 'stock_receipt'
  | 'worker_load_request'
  | 'loading_session'
  | 'warehouse_review'
  | 'stock_dispute'
  | 'stock_movement';

/**
 * Fetches all status labels for a given document type & locale.
 * Returns a map { [status_code]: WorkflowStatusLabel } for fast lookup.
 */
export function useWorkflowStatusLabels(
  documentType: WorkflowDocumentType,
  locale: 'ar' | 'en' = 'ar',
) {
  return useQuery({
    queryKey: ['workflow-status-labels', documentType, locale],
    staleTime: 1000 * 60 * 30, // labels rarely change
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_workflow_status_labels')
        .select('*')
        .eq('document_type', documentType)
        .eq('locale', locale)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const list = (data ?? []) as WorkflowStatusLabel[];
      const byCode = list.reduce<Record<string, WorkflowStatusLabel>>((acc, row) => {
        acc[row.status_code] = row;
        return acc;
      }, {});

      return { list, byCode };
    },
  });
}

/**
 * Maps a semantic color name to Tailwind classes used across the app.
 * Keeps Badge/Chip colors consistent with the design system.
 */
export function workflowColorClasses(color: WorkflowStatusColor): string {
  switch (color) {
    case 'success':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300';
    case 'warning':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300';
    case 'destructive':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300';
    case 'info':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300';
    case 'primary':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'secondary':
      return 'bg-secondary text-secondary-foreground border-secondary';
    case 'accent':
      return 'bg-accent text-accent-foreground border-accent';
    case 'muted':
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}
