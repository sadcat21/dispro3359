import React from 'react';
import {
  Rocket, BarChart3, CalendarClock, Route, Megaphone, GraduationCap,
  Share2, FileSpreadsheet, Bell, Layers, TrendingUp, Building2,
  Timer, Star, Receipt, Banknote, UserCog, Map, ClipboardList, Repeat
} from 'lucide-react';
import { useLandingLang } from '@/contexts/LandingLanguageContext';

const AdvancedFeaturesSection: React.FC = () => {
  const { t } = useLandingLang();

  const managerControlFeatures = [
    { icon: BarChart3, title: t('mgr_dashboard_title'), desc: t('mgr_dashboard_desc') },
    { icon: CalendarClock, title: t('mgr_review_title'), desc: t('mgr_review_desc') },
    { icon: Banknote, title: t('mgr_treasury_title'), desc: t('mgr_treasury_desc') },
    { icon: UserCog, title: t('mgr_permissions_title'), desc: t('mgr_permissions_desc') },
  ];

  const fieldOpsFeatures = [
    { icon: Route, title: t('fld_routes_title'), desc: t('fld_routes_desc') },
    { icon: Map, title: t('fld_tours_title'), desc: t('fld_tours_desc') },
    { icon: Timer, title: t('fld_attendance_title'), desc: t('fld_attendance_desc') },
    { icon: Bell, title: t('fld_tracking_title'), desc: t('fld_tracking_desc') },
  ];

  const smartFeatures = [
    { icon: Megaphone, title: t('smt_promos_title'), desc: t('smt_promos_desc') },
    { icon: Star, title: t('smt_rewards_title'), desc: t('smt_rewards_desc') },
    { icon: Receipt, title: t('smt_invoices_title'), desc: t('smt_invoices_desc') },
    { icon: Repeat, title: t('smt_returns_title'), desc: t('smt_returns_desc') },
  ];

  const growthFeatures = [
    { icon: Building2, title: t('grw_branches_title'), desc: t('grw_branches_desc') },
    { icon: FileSpreadsheet, title: t('grw_backup_title'), desc: t('grw_backup_desc') },
    { icon: Share2, title: t('grw_share_title'), desc: t('grw_share_desc') },
    { icon: GraduationCap, title: t('grw_training_title'), desc: t('grw_training_desc') },
  ];

  return (
    <>
      {/* Manager Control */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Layers className="h-4 w-4" />
              {t('manager_badge')}
            </div>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t('manager_title')}</h2>
            <p className="text-muted-foreground">{t('manager_subtitle')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {managerControlFeatures.map((f, i) => (
              <div key={i} className="flex gap-3 rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="mb-1 font-bold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Field Operations */}
      <section className="bg-accent/5 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Rocket className="h-4 w-4" />
              {t('field_badge')}
            </div>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t('field_title')}</h2>
            <p className="text-muted-foreground">{t('field_subtitle')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {fieldOpsFeatures.map((f, i) => (
              <div key={i} className="flex gap-3 rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="mb-1 font-bold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Smart Features */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <TrendingUp className="h-4 w-4" />
              {t('smart_badge')}
            </div>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t('smart_title')}</h2>
            <p className="text-muted-foreground">{t('smart_subtitle')}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {smartFeatures.map((f, i) => (
              <div key={i} className="rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-bold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Growth & Scalability */}
      <section className="bg-primary/5 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Building2 className="h-4 w-4" />
              {t('growth_badge')}
            </div>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t('growth_title')}</h2>
            <p className="text-muted-foreground">{t('growth_subtitle')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {growthFeatures.map((f, i) => (
              <div key={i} className="flex gap-3 rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="mb-1 font-bold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default AdvancedFeaturesSection;
