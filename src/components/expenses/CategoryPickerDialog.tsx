import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useExpenseCategories } from '@/hooks/useExpenses';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCategoryName } from '@/utils/categoryName';
import { isAdminRole } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';
import { Tag } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (categoryId: string) => void;
}

const CategoryPickerDialog: React.FC<Props> = ({ open, onOpenChange, onPick }) => {
  const { data: categories } = useExpenseCategories();
  const { language, t, dir } = useLanguage();
  const { role, activeRole } = useAuth();

  const filtered = useMemo(() => {
    if (!categories) return [];
    if (isAdminRole(role)) return categories;
    const userRoleCode = activeRole?.custom_role_code;
    return categories.filter((cat: any) => {
      const visibleRoles = cat.visible_to_roles as string[] | null;
      if (!visibleRoles || visibleRoles.length === 0) return true;
      if (role && visibleRoles.includes(role)) return true;
      return userRoleCode ? visibleRoles.includes(userRoleCode) : false;
    });
  }, [categories, role, activeRole]);

  const getIcon = (name?: string | null) => {
    if (!name) return Tag;
    const Icon = (LucideIcons as any)[name];
    return Icon || Tag;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir={dir}>
        <DialogHeader>
          <DialogTitle>{t('expenses.select_category')}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 pt-2">
          {filtered.map((cat: any) => {
            const Icon = getIcon(cat.icon);
            return (
              <Button
                key={cat.id}
                type="button"
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-1 p-2 hover:bg-primary hover:text-primary-foreground"
                onClick={() => {
                  onPick(cat.id);
                  onOpenChange(false);
                }}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] text-center leading-tight line-clamp-2">
                  {getCategoryName(cat, language)}
                </span>
              </Button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-3 text-center text-sm text-muted-foreground py-6">
              لا توجد تصنيفات متاحة
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryPickerDialog;
