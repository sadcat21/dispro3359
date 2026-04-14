import React, { useState } from 'react';
import { Shield, Loader2, Eye, EyeOff, ChevronRight, Layout, MousePointer, Layers, Zap, Bell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRoleUIOverrides, useToggleRoleUIOverride, UI_ELEMENTS } from '@/hooks/useUIOverrides';
import { useRolesWithPermissions } from '@/hooks/usePermissions';

const CATEGORIES = [
  { key: 'pages', label: 'الصفحات', icon: Layout, type: 'page', items: UI_ELEMENTS.pages },
  { key: 'tabs', label: 'التبويبات', icon: Layers, type: 'tab', items: UI_ELEMENTS.tabs },
  { key: 'buttons', label: 'الأزرار', icon: MousePointer, type: 'button', items: UI_ELEMENTS.buttons },
  { key: 'actions', label: 'الإجراءات', icon: Zap, type: 'action', items: UI_ELEMENTS.actions },
  { key: 'notifications', label: 'الإشعارات', icon: Bell, type: 'notification', items: UI_ELEMENTS.notifications },
];

const RoleUIOverridesSection: React.FC = () => {
  const { data: roles, isLoading: rolesLoading } = useRolesWithPermissions();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const { data: overrides, isLoading: overridesLoading } = useRoleUIOverrides(selectedRoleId);
  const toggleOverride = useToggleRoleUIOverride();

  const selectedRole = roles?.find(r => r.id === selectedRoleId);

  const isElementHidden = (elementType: string, elementKey: string): boolean => {
    return overrides?.some(o => o.element_type === elementType && o.element_key === elementKey && (o as any).is_hidden) ?? false;
  };

  const handleToggle = async (elementType: string, elementKey: string) => {
    if (!selectedRoleId) return;
    const currentlyHidden = isElementHidden(elementType, elementKey);
    await toggleOverride.mutateAsync({
      roleId: selectedRoleId,
      elementType,
      elementKey,
      isHidden: !currentlyHidden,
    });
  };

  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!selectedRoleId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">اختر دور لتخصيص العناصر المرئية لجميع العمال بهذا الدور</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {roles?.map(role => (
            <Card
              key={role.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedRoleId(role.id)}
            >
              <CardContent className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{role.name_ar}</p>
                    <p className="text-xs text-muted-foreground">{role.code}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground rtl:rotate-180" />
              </CardContent>
            </Card>
          ))}
          {(!roles || roles.length === 0) && (
            <div className="col-span-full p-6 text-center text-sm text-muted-foreground">
              لا توجد أدوار
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card
        className="cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => setSelectedRoleId(null)}
      >
        <CardContent className="flex items-center gap-2.5 p-3">
          <ChevronRight className="w-4 h-4 text-muted-foreground rtl:rotate-0 rotate-180" />
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{selectedRole?.name_ar}</p>
            <p className="text-xs text-muted-foreground">{selectedRole?.code}</p>
          </div>
        </CardContent>
      </Card>

      {overridesLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="pages" dir="rtl">
          <TabsList className="w-full grid grid-cols-5">
            {CATEGORIES.map(cat => {
              const hiddenInCat = overrides?.filter(o => o.element_type === cat.type && (o as any).is_hidden).length || 0;
              return (
                <TabsTrigger key={cat.key} value={cat.key} className="text-xs gap-1 relative">
                  <cat.icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                  {hiddenInCat > 0 && (
                    <Badge variant="destructive" className="absolute -top-1.5 -left-1.5 h-4 min-w-4 text-[9px] p-0 flex items-center justify-center">
                      {hiddenInCat}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {CATEGORIES.map(cat => {
            const hasGroups = cat.items.some((item: any) => item.group);
            const groups = hasGroups
              ? Object.entries(
                  cat.items.reduce((acc: Record<string, typeof cat.items>, item: any) => {
                    const g = item.group || 'أخرى';
                    if (!acc[g]) acc[g] = [];
                    acc[g].push(item);
                    return acc;
                  }, {} as Record<string, typeof cat.items>)
                )
              : [['', cat.items] as [string, typeof cat.items]];

            return (
              <TabsContent key={cat.key} value={cat.key}>
                <ScrollArea className="h-[calc(100vh-22rem)]">
                  <div className="space-y-3">
                    {groups.map(([groupName, items]) => (
                      <Card key={groupName || 'all'}>
                        <CardContent className="p-3 space-y-1">
                          {groupName && (
                            <p className="text-xs font-semibold text-primary mb-2 pb-1 border-b border-primary/20">
                              📍 {groupName}
                            </p>
                          )}
                          {items.map(item => {
                            const hidden = isElementHidden(cat.type, item.key);
                            return (
                              <div key={item.key} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  {hidden ? (
                                    <EyeOff className="w-3.5 h-3.5 text-destructive shrink-0" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                  )}
                                  <span className="text-xs truncate">{item.label}</span>
                                </div>
                                <Switch
                                  checked={!hidden}
                                  onCheckedChange={() => handleToggle(cat.type, item.key)}
                                  disabled={toggleOverride.isPending}
                                />
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
};

export default RoleUIOverridesSection;
