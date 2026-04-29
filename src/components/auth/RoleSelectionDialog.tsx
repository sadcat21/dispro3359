import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Shield,
  Users,
  Eye,
  Briefcase,
  Building2,
  Calculator,
  ClipboardList,
  Crown,
  Star,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from 'lucide-react';
import { AppRole } from '@/types/database';

interface WorkerRole {
  role: AppRole;
  branch_id: string | null;
  branch_name: string | null;
  custom_role_id?: string | null;
  custom_role_code?: string | null;
  custom_role_name?: string | null;
  is_primary?: boolean;
}

interface RoleSelectionDialogProps {
  open: boolean;
  roles: WorkerRole[];
  onSelectRole: (role: WorkerRole) => void;
}

type RoleStyle = {
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
  iconColor: string;
  ring: string;
  accent: string;
};

const RoleSelectionDialog: React.FC<RoleSelectionDialogProps> = ({
  open,
  roles,
  onSelectRole,
}) => {
  const { t, dir } = useLanguage();
  const ChevronIcon = dir === 'rtl' ? ChevronLeft : ChevronRight;

  const getRoleStyle = (role: AppRole, isCompanyManager: boolean): RoleStyle => {
    if (isCompanyManager) {
      return {
        icon: <Crown className="w-6 h-6" />,
        gradient: 'from-emerald-50 via-amber-50 to-emerald-50 dark:from-emerald-950/40 dark:via-amber-950/30 dark:to-emerald-950/40',
        iconBg: 'bg-gradient-to-br from-emerald-500 to-amber-500',
        iconColor: 'text-white',
        ring: 'ring-amber-400/40 hover:ring-amber-500/60',
        accent: 'text-amber-700 dark:text-amber-300',
      };
    }
    switch (role) {
      case 'admin':
        return {
          icon: <Shield className="w-6 h-6" />,
          gradient: 'from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30',
          iconBg: 'bg-gradient-to-br from-red-500 to-rose-600',
          iconColor: 'text-white',
          ring: 'ring-red-200 dark:ring-red-900/50 hover:ring-red-400',
          accent: 'text-red-700 dark:text-red-300',
        };
      case 'project_manager':
        return {
          icon: <Crown className="w-6 h-6" />,
          gradient: 'from-purple-50 to-fuchsia-50 dark:from-purple-950/30 dark:to-fuchsia-950/30',
          iconBg: 'bg-gradient-to-br from-purple-500 to-fuchsia-600',
          iconColor: 'text-white',
          ring: 'ring-purple-200 dark:ring-purple-900/50 hover:ring-purple-400',
          accent: 'text-purple-700 dark:text-purple-300',
        };
      case 'branch_admin':
        return {
          icon: <Building2 className="w-6 h-6" />,
          gradient: 'from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30',
          iconBg: 'bg-gradient-to-br from-orange-500 to-amber-600',
          iconColor: 'text-white',
          ring: 'ring-orange-200 dark:ring-orange-900/50 hover:ring-orange-400',
          accent: 'text-orange-700 dark:text-orange-300',
        };
      case 'supervisor':
        return {
          icon: <Eye className="w-6 h-6" />,
          gradient: 'from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30',
          iconBg: 'bg-gradient-to-br from-blue-500 to-sky-600',
          iconColor: 'text-white',
          ring: 'ring-blue-200 dark:ring-blue-900/50 hover:ring-blue-400',
          accent: 'text-blue-700 dark:text-blue-300',
        };
      case 'worker':
        return {
          icon: <Briefcase className="w-6 h-6" />,
          gradient: 'from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30',
          iconBg: 'bg-gradient-to-br from-emerald-500 to-green-600',
          iconColor: 'text-white',
          ring: 'ring-emerald-200 dark:ring-emerald-900/50 hover:ring-emerald-400',
          accent: 'text-emerald-700 dark:text-emerald-300',
        };
      case 'accountant':
        return {
          icon: <Calculator className="w-6 h-6" />,
          gradient: 'from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30',
          iconBg: 'bg-gradient-to-br from-teal-500 to-cyan-600',
          iconColor: 'text-white',
          ring: 'ring-teal-200 dark:ring-teal-900/50 hover:ring-teal-400',
          accent: 'text-teal-700 dark:text-teal-300',
        };
      case 'admin_assistant':
        return {
          icon: <ClipboardList className="w-6 h-6" />,
          gradient: 'from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30',
          iconBg: 'bg-gradient-to-br from-indigo-500 to-violet-600',
          iconColor: 'text-white',
          ring: 'ring-indigo-200 dark:ring-indigo-900/50 hover:ring-indigo-400',
          accent: 'text-indigo-700 dark:text-indigo-300',
        };
      default:
        return {
          icon: <Users className="w-6 h-6" />,
          gradient: 'from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30',
          iconBg: 'bg-gradient-to-br from-slate-500 to-gray-600',
          iconColor: 'text-white',
          ring: 'ring-slate-200 dark:ring-slate-900/50 hover:ring-slate-400',
          accent: 'text-slate-700 dark:text-slate-300',
        };
    }
  };

  const getRoleLabel = (role: AppRole) => {
    switch (role) {
      case 'admin': return t('workers.role_admin');
      case 'project_manager': return t('workers.role_project_manager');
      case 'branch_admin': return t('workers.role_branch_admin');
      case 'supervisor': return t('workers.role_supervisor');
      case 'worker': return t('workers.role_worker');
      case 'accountant': return t('workers.role_accountant');
      case 'admin_assistant': return t('workers.role_admin_assistant');
      default: return role;
    }
  };

  const getRoleDescription = (role: AppRole, isCompanyManager: boolean) => {
    if (isCompanyManager) return t('role_selection.company_manager_desc');
    switch (role) {
      case 'admin': return t('role_selection.admin_desc');
      case 'project_manager': return t('role_selection.project_manager_desc');
      case 'branch_admin': return t('role_selection.branch_admin_desc');
      case 'supervisor': return t('role_selection.supervisor_desc');
      case 'worker': return t('role_selection.worker_desc');
      case 'accountant': return t('role_selection.accountant_desc');
      case 'admin_assistant': return t('role_selection.admin_assistant_desc');
      default: return '';
    }
  };

  // Sort: primary role first, then the rest in original order
  const sortedRoles = [...roles].sort((a, b) => {
    const ap = a.is_primary ? 1 : 0;
    const bp = b.is_primary ? 1 : 0;
    return bp - ap;
  });
  const hasExplicitPrimary = sortedRoles.some(r => r.is_primary);
  const effectivePrimaryIndex = hasExplicitPrimary
    ? sortedRoles.findIndex(r => r.is_primary)
    : 0;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg" dir={dir} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">{t('role_selection.title')}</DialogTitle>
          <DialogDescription className="text-center">
            {t('role_selection.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {sortedRoles.map((roleData, index) => {
            const isCompanyManager = roleData.custom_role_code === 'company_manager';
            const isPrimary = index === effectivePrimaryIndex;
            const style = getRoleStyle(roleData.role, isCompanyManager);
            const label = roleData.custom_role_name || getRoleLabel(roleData.role);
            const description = getRoleDescription(roleData.role, isCompanyManager);

            return (
              <button
                key={[
                  roleData.custom_role_id || roleData.custom_role_code || roleData.role,
                  roleData.branch_id || 'global',
                  roleData.is_primary ? 'primary' : 'secondary',
                  index,
                ].join('-')}
                onClick={() => onSelectRole(roleData)}
                className={`group relative w-full overflow-hidden rounded-xl bg-gradient-to-br ${style.gradient} ring-2 ${style.ring} transition-all duration-200 hover:scale-[1.015] hover:shadow-lg active:scale-[0.99] text-start ${
                  isPrimary ? 'ring-[3px] shadow-md' : ''
                }`}
              >
                {/* Primary badge */}
                {isPrimary && (
                  <div className={`absolute top-0 ${dir === 'rtl' ? 'left-0' : 'right-0'} z-10`}>
                    <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl shadow-md flex items-center gap-1">
                      <Star className="w-3 h-3 fill-white" />
                      {t('role_selection.primary_badge')}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-4">
                  {/* Icon */}
                  <div className={`shrink-0 ${style.iconBg} ${style.iconColor} w-12 h-12 rounded-xl flex items-center justify-center shadow-md ring-2 ring-white/50 dark:ring-white/10`}>
                    {style.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold text-base ${style.accent} truncate`}>
                      {label}
                    </div>
                    {roleData.branch_name && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{roleData.branch_name}</span>
                      </div>
                    )}
                    {description && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {description}
                      </div>
                    )}
                  </div>

                  {/* Chevron */}
                  <div className={`shrink-0 ${style.accent} opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 ${dir === 'rtl' ? 'group-hover:-translate-x-0.5' : ''} transition-all`}>
                    <ChevronIcon className="w-5 h-5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RoleSelectionDialog;
