import React, { useState } from 'react';
import { 
  Shield, Lock, Server, Zap, BarChart3, Users, Truck, Package, 
  Wallet, MapPin, Clock, CheckCircle2, ArrowLeft, ChevronDown, ChevronUp,
  ShieldCheck, Database, Cloud, Eye, Star, TrendingUp, AlertTriangle,
  Target, Award, Phone, MessageCircle, ArrowRight, Sparkles, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import OperationalGapsSection from '@/components/landing/OperationalGapsSection';
import AdvancedFeaturesSection from '@/components/landing/AdvancedFeaturesSection';
import { LandingLanguageProvider, useLandingLang } from '@/contexts/LandingLanguageContext';

const LandingContent: React.FC = () => {
  const navigate = useNavigate();
  const { lang, setLang, t, dir } = useLandingLang();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const problems = [
    { icon: AlertTriangle, title: t('prob_stock_title'), desc: t('prob_stock_desc') },
    { icon: Clock, title: t('prob_time_title'), desc: t('prob_time_desc') },
    { icon: Eye, title: t('prob_visibility_title'), desc: t('prob_visibility_desc') },
    { icon: Wallet, title: t('prob_debt_title'), desc: t('prob_debt_desc') },
    { icon: Users, title: t('prob_team_title'), desc: t('prob_team_desc') },
    { icon: Target, title: t('prob_data_title'), desc: t('prob_data_desc') },
  ];

  const solutions = [
    { icon: Package, title: t('sol_stock_title'), desc: t('sol_stock_desc'), color: 'from-emerald-500 to-teal-600' },
    { icon: Truck, title: t('sol_dist_title'), desc: t('sol_dist_desc'), color: 'from-blue-500 to-indigo-600' },
    { icon: Wallet, title: t('sol_accounting_title'), desc: t('sol_accounting_desc'), color: 'from-amber-500 to-orange-600' },
    { icon: MapPin, title: t('sol_gps_title'), desc: t('sol_gps_desc'), color: 'from-sky-500 to-blue-600' },
    { icon: BarChart3, title: t('sol_stats_title'), desc: t('sol_stats_desc'), color: 'from-violet-500 to-purple-600' },
    { icon: Award, title: t('sol_rewards_title'), desc: t('sol_rewards_desc'), color: 'from-rose-500 to-pink-600' },
  ];

  const results = [
    { value: '70%', label: t('result_accounting'), icon: Clock },
    { value: '95%', label: t('result_stock'), icon: Package },
    { value: '50%', label: t('result_debt'), icon: TrendingUp },
    { value: '100%', label: t('result_visibility'), icon: Eye },
  ];

  const securityFeatures = [
    { icon: Lock, title: t('sec_encrypt_title'), desc: t('sec_encrypt_desc') },
    { icon: Shield, title: t('sec_roles_title'), desc: t('sec_roles_desc') },
    { icon: Server, title: t('sec_servers_title'), desc: t('sec_servers_desc') },
    { icon: Database, title: t('sec_backup_title'), desc: t('sec_backup_desc') },
    { icon: ShieldCheck, title: t('sec_rls_title'), desc: t('sec_rls_desc') },
    { icon: Cloud, title: t('sec_uptime_title'), desc: t('sec_uptime_desc') },
  ];

  const faqs = [
    { q: t('faq_q1'), a: t('faq_a1') },
    { q: t('faq_q2'), a: t('faq_a2') },
    { q: t('faq_q3'), a: t('faq_a3') },
    { q: t('faq_q4'), a: t('faq_a4') },
    { q: t('faq_q5'), a: t('faq_a5') },
  ];

  const featureKeys = [
    'feat_orders', 'feat_loading', 'feat_accounting', 'feat_gps',
    'feat_debts', 'feat_treasury', 'feat_promos', 'feat_expenses',
    'feat_activity', 'feat_rewards', 'feat_branches', 'feat_reports',
    'feat_customers', 'feat_permissions', 'feat_backup', 'feat_chat',
  ];

  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen bg-background text-foreground" dir={dir}>
      {/* Language Toggle - Fixed */}
      <div className="sticky top-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm px-4 py-2 border-b">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
        >
          <Globe className="h-4 w-4" />
          {lang === 'fr' ? 'العربية' : 'Français'}
        </Button>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-bl from-primary/10 via-background to-accent/10 px-4 pb-16 pt-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            {t('hero_badge')}
          </div>
          <h1 className="mb-6 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {t('hero_title_1')}
            <br />
            <span className="bg-gradient-to-l from-primary to-primary/70 bg-clip-text text-transparent">
              {t('hero_title_2')}
            </span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {t('hero_desc')}
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" className="w-full gap-2 text-base sm:w-auto" onClick={() => navigate('/login')}>
              {t('hero_cta')}
              <ArrowIcon className="h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="w-full gap-2 text-base sm:w-auto" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
              {t('hero_features')}
            </Button>
          </div>
        </div>
      </section>

      {/* Problems Section */}
      <section className="bg-destructive/5 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t('problems_title')}</h2>
            <p className="text-muted-foreground">{t('problems_subtitle')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {problems.map((p, i) => (
              <div key={i} className="flex gap-3 rounded-xl border border-destructive/20 bg-card p-4 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                  <p.icon className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h3 className="mb-1 font-bold">{p.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section id="features" className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t('solutions_title')}</h2>
            <p className="text-muted-foreground">{t('solutions_subtitle')}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {solutions.map((s, i) => (
              <div key={i} className="group rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${s.color} text-white shadow-sm`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-bold">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="bg-primary/5 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t('results_title')}</h2>
            <p className="text-muted-foreground">{t('results_subtitle')}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {results.map((r, i) => (
              <div key={i} className="flex flex-col items-center rounded-xl border bg-card p-5 text-center shadow-sm">
                <r.icon className="mb-2 h-8 w-8 text-primary" />
                <span className="text-3xl font-extrabold text-primary">{r.value}</span>
                <span className="mt-1 text-sm text-muted-foreground">{r.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* All Features Grid */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t('features_title')}</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {featureKeys.map((key, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm font-medium shadow-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                {t(key)}
              </div>
            ))}
          </div>
        </div>
      </section>

      <OperationalGapsSection />
      <AdvancedFeaturesSection />

      {/* Security Section */}
      <section className="bg-accent/5 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Shield className="h-4 w-4" />
              {t('security_badge')}
            </div>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t('security_title')}</h2>
            <p className="text-muted-foreground">{t('security_subtitle')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {securityFeatures.map((s, i) => (
              <div key={i} className="flex gap-3 rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="mb-1 font-bold">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t('faq_title')}</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border bg-card shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className={`flex w-full items-center justify-between gap-3 p-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                >
                  <span>{faq.q}</span>
                  {openFaq === i ? <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />}
                </button>
                {openFaq === i && (
                  <div className="border-t px-4 pb-4 pt-3 text-sm leading-relaxed text-muted-foreground">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-bl from-primary to-primary/80 px-4 py-16 text-primary-foreground">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-2xl font-extrabold sm:text-3xl">{t('cta_title')}</h2>
          <p className="mb-8 text-lg opacity-90">{t('cta_desc')}</p>
          <div className="flex justify-center">
            <Button size="lg" variant="secondary" className="w-full gap-2 text-base sm:w-auto" onClick={() => navigate('/login')}>
              {t('cta_button')}
              <ArrowIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} {t('footer')}</p>
      </footer>
    </div>
  );
};

const Landing: React.FC = () => {
  return (
    <LandingLanguageProvider>
      <LandingContent />
    </LandingLanguageProvider>
  );
};

export default Landing;
