import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import WorkerGiftsSummaryDialog from '@/components/accounting/WorkerGiftsSummaryDialog';

/**
 * Standalone page wrapper for the promo tracking experience.
 * Reuses the existing WorkerGiftsSummaryDialog UI but exposes it as a
 * dedicated route ( /promo-tracking ) so branch managers, internal
 * supervisors and admin assistants can deep-link to it from the sidebar
 * and from their home dashboards. Branch filtering is handled inside the
 * dialog via the active branch from AuthContext.
 */
const PromoTracking: React.FC = () => {
  const navigate = useNavigate();
  const { activeBranch } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="رجوع">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold truncate">{t('admin.promo_tracking') || 'تتبع العروض'}</h1>
              {activeBranch?.name && (
                <p className="text-xs text-muted-foreground truncate">{activeBranch.name}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* The dialog renders fullscreen-modal style; keeping it always open
          turns this route into a page-like experience. Closing navigates back. */}
      <WorkerGiftsSummaryDialog
        open
        onOpenChange={(o) => { if (!o) navigate(-1); }}
      />
    </div>
  );
};

export default PromoTracking;
