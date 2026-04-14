import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Task, TaskStatus, TaskType } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import TaskCard from './TaskCard';

const statusColors: Record<TaskStatus, string> = {
  todo: 'data-[state=active]:bg-red-500 data-[state=active]:text-white',
  doing: 'data-[state=active]:bg-orange-500 data-[state=active]:text-white',
  done: 'data-[state=active]:bg-green-500 data-[state=active]:text-white',
};

const statusTabs: TaskStatus[] = ['todo', 'doing', 'done'];

interface StatusTabsProps {
  tasks: Task[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  t: (key: string) => string;
  title: string;
  translationPrefix?: string;
}

const StatusTabs: React.FC<StatusTabsProps> = ({ tasks, onStatusChange, onDelete, onAdd, t, title, translationPrefix = 'tasks' }) => {
  const [activeTab, setActiveTab] = useState<string>('todo');
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-bold text-sm">{title}</h3>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onAdd}>
          <Plus className="w-4 h-4 mr-1" />
          {t(`${translationPrefix}.add`)}
        </Button>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="shrink-0 w-full grid grid-cols-3 rounded-none border-b bg-muted/50">
          {statusTabs.map(s => (
            <TabsTrigger key={s} value={s} className={cn('text-xs', statusColors[s])}>
              {t(`${translationPrefix}.status_${s}`)}
              <span className="ml-1 opacity-70">
                ({tasks.filter(task => task.status === s).length})
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {statusTabs.map(s => {
          const tasksForStatus = tasks.filter(task => task.status === s);

          return (
          <TabsContent
            key={s}
            value={s}
            className="m-0 flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-3 space-y-2"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {tasksForStatus.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">{t(`${translationPrefix}.no_tasks`)}</p>
            ) : (
              tasksForStatus.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                  t={t}
                  translationPrefix={translationPrefix}
                />
              ))
            )}
          </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
};

export default StatusTabs;
