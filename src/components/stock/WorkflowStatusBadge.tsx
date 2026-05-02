import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  useWorkflowStatusLabels,
  workflowColorClasses,
  type WorkflowDocumentType,
} from '@/hooks/useWorkflowStatusLabels';
import * as LucideIcons from 'lucide-react';

interface WorkflowStatusBadgeProps {
  documentType: WorkflowDocumentType;
  statusCode: string | null | undefined;
  locale?: 'ar' | 'en';
  showIcon?: boolean;
  className?: string;
}

/**
 * Renders a localized status badge based on stock_workflow_status_labels.
 * Falls back gracefully to the raw status_code if the label is missing.
 */
const WorkflowStatusBadge: React.FC<WorkflowStatusBadgeProps> = ({
  documentType,
  statusCode,
  locale = 'ar',
  showIcon = true,
  className,
}) => {
  const { data } = useWorkflowStatusLabels(documentType, locale);

  if (!statusCode) {
    return (
      <Badge variant="outline" className={cn('font-normal', className)}>
        —
      </Badge>
    );
  }

  const meta = data?.byCode[statusCode];
  const label = meta?.label ?? statusCode;
  const color = meta?.color ?? 'muted';
  const iconName = meta?.icon;

  // Resolve a Lucide icon by name (safe optional lookup).
  const IconComp =
    showIcon && iconName
      ? ((LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[iconName] ?? null)
      : null;

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1 font-medium border',
        workflowColorClasses(color),
        className,
      )}
    >
      {IconComp ? <IconComp className="h-3.5 w-3.5" /> : null}
      <span>{label}</span>
    </Badge>
  );
};

export default WorkflowStatusBadge;
