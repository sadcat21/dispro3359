import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { User, AlertTriangle, CheckCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface WorkerOption {
  id: string;
  full_name: string;
  username: string;
}

interface WorkerPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workers: WorkerOption[];
  selectedWorkerId: string;
  onSelect: (workerId: string) => void;
  stockAlerts?: { worker_id: string; deficit: number }[];
}

const AVATAR_COLORS = [
  'from-blue-500 to-cyan-400',
  'from-purple-500 to-pink-400',
  'from-amber-500 to-orange-400',
  'from-emerald-500 to-teal-400',
  'from-rose-500 to-red-400',
  'from-indigo-500 to-violet-400',
  'from-lime-500 to-green-400',
  'from-fuchsia-500 to-purple-400',
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getColorIndex(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return Math.abs(hash) % AVATAR_COLORS.length;
}

const WorkerPickerDialog: React.FC<WorkerPickerDialogProps> = ({
  open,
  onOpenChange,
  workers,
  selectedWorkerId,
  onSelect,
  stockAlerts = [],
}) => {
  const { t } = useLanguage();

  const getWorkerDeficit = (workerId: string) => {
    return stockAlerts
      .filter(a => a.worker_id === workerId)
      .reduce((sum, a) => sum + a.deficit, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md z-[10100]">

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            {t('stock.select_worker')}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {workers.map(w => {
              const deficit = getWorkerDeficit(w.id);
              const isSelected = w.id === selectedWorkerId;
              const colorClass = AVATAR_COLORS[getColorIndex(w.id)];
              return (
                <button
                  key={w.id}
                  className={`group relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5
                    ${isSelected
                      ? 'bg-primary/10 border-primary ring-2 ring-primary/30 shadow-primary/20'
                      : 'border-border/60 hover:border-primary/40 bg-card'
                    }
                  `}
                  onClick={() => {
                    onSelect(w.id);
                    onOpenChange(false);
                    
                  }}
                >
                  {isSelected && (
                    <div className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow">
                      <CheckCircle className="w-3.5 h-3.5 text-primary-foreground" />
                    </div>
                  )}
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center text-white font-bold text-sm shadow-md group-hover:scale-105 transition-transform`}>
                    {getInitials(w.full_name)}
                  </div>
                  <div className="font-semibold text-xs leading-tight truncate w-full text-foreground">{w.full_name}</div>
                  {deficit > 0 ? (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 animate-pulse">
                      <AlertTriangle className="w-3 h-3 me-0.5" />
                      {deficit}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600 border-emerald-300 bg-emerald-50">
                      <CheckCircle className="w-3 h-3 me-0.5" />
                      جاهز
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
          {workers.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-4">
              {t('common.no_results')}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkerPickerDialog;
