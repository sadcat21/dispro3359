import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

/**
 * زر مزامنة مميز في الهيدر — مفيد بشكل خاص في وضع PWA/التطبيق
 * حيث لا يوجد زر تحديث في المتصفح.
 */
const RefreshButton: React.FC = () => {
  const queryClient = useQueryClient();
  const [spinning, setSpinning] = useState(false);

  const handleRefresh = async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      // إبطال جميع استعلامات React Query لإعادة جلب البيانات
      await queryClient.invalidateQueries();
      toast.success('تمت المزامنة بنجاح', { duration: 1500 });
    } catch (e) {
      // كحل احتياطي: إعادة تحميل كاملة للصفحة
      window.location.reload();
      return;
    } finally {
      setTimeout(() => setSpinning(false), 800);
    }
  };

  const handleHardReload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.reload();
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleRefresh}
          onContextMenu={handleHardReload}
          aria-label="تحديث الصفحة"
          className="relative flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-emerald-400/90 to-teal-500/90 hover:from-emerald-400 hover:to-teal-500 transition-colors shadow-md ring-1 ring-white/30"
        >
          <RefreshCw
            className={`w-4 h-4 text-white ${spinning ? 'animate-spin' : ''}`}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>تحديث / مزامنة (ضغطة طويلة: إعادة تحميل كاملة)</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default RefreshButton;
