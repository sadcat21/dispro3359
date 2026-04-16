import React, { useState } from 'react';
import {
  ShieldAlert, MapPin, HandshakeIcon, Eye, Gift, DollarSign,
  MessageCircleOff, Users, ClipboardCheck, Lock, ChevronDown, ChevronUp,
  UserCheck, PackageCheck, FileCheck, Smartphone, ScanLine
} from 'lucide-react';
import { useLandingLang } from '@/contexts/LandingLanguageContext';

const OperationalGapsSection: React.FC = () => {
  const { t } = useLandingLang();
  const [expandedGap, setExpandedGap] = useState<number | null>(null);

  const selfServiceFeatures = [
    { icon: Smartphone, title: t('ss_sales_title'), desc: t('ss_sales_desc') },
    { icon: Gift, title: t('ss_promos_title'), desc: t('ss_promos_desc') },
    { icon: Users, title: t('ss_achievements_title'), desc: t('ss_achievements_desc') },
    { icon: ScanLine, title: t('ss_stock_title'), desc: t('ss_stock_desc') },
  ];

  const dualAuthFeatures = [
    { icon: PackageCheck, title: t('da_loading_title'), desc: t('da_loading_desc'), benefit: t('da_loading_benefit') },
    { icon: ClipboardCheck, title: t('da_unloading_title'), desc: t('da_unloading_desc'), benefit: t('da_unloading_benefit') },
    { icon: FileCheck, title: t('da_accounting_title'), desc: t('da_accounting_desc'), benefit: t('da_accounting_benefit') },
  ];

  const fraudGaps = [
    { icon: MapPin, threat: t('fraud_visit_threat'), title: t('fraud_visit_title'), desc: t('fraud_visit_desc'), solution: t('fraud_visit_solution') },
    { icon: MapPin, threat: t('fraud_delivery_threat'), title: t('fraud_delivery_title'), desc: t('fraud_delivery_desc'), solution: t('fraud_delivery_solution') },
    { icon: Gift, threat: t('fraud_gift_threat'), title: t('fraud_gift_title'), desc: t('fraud_gift_desc'), solution: t('fraud_gift_solution') },
    { icon: DollarSign, threat: t('fraud_price_threat'), title: t('fraud_price_title'), desc: t('fraud_price_desc'), solution: t('fraud_price_solution') },
    { icon: Eye, threat: t('fraud_collection_threat'), title: t('fraud_collection_title'), desc: t('fraud_collection_desc'), solution: t('fraud_collection_solution') },
    { icon: ShieldAlert, threat: t('fraud_expense_threat'), title: t('fraud_expense_title'), desc: t('fraud_expense_desc'), solution: t('fraud_expense_solution') },
    { icon: UserCheck, threat: t('fraud_fake_customer_threat'), title: t('fraud_fake_customer_title'), desc: t('fraud_fake_customer_desc'), solution: t('fraud_fake_customer_solution') },
    { icon: Lock, threat: t('fraud_retroactive_threat'), title: t('fraud_retroactive_title'), desc: t('fraud_retroactive_desc'), solution: t('fraud_retroactive_solution') },
  ];

  return (
    <>
      {/* Self-Service Section */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <MessageCircleOff className="h-4 w-4" />
              {t('selfservice_badge')}
            </div>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t('selfservice_title')}</h2>
            <p className="text-muted-foreground">{t('selfservice_subtitle')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {selfServiceFeatures.map((f, i) => (
              <div key={i} className="flex gap-3 rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
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

      {/* Dual Authentication Section */}
      <section className="bg-primary/5 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <HandshakeIcon className="h-4 w-4" />
              {t('dualauth_badge')}
            </div>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t('dualauth_title')}</h2>
            <p className="text-muted-foreground">{t('dualauth_subtitle')}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {dualAuthFeatures.map((f, i) => (
              <div key={i} className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-bold">{f.title}</h3>
                <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                <div className="rounded-lg bg-emerald-500/10 p-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  ✓ {f.benefit}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fraud Prevention Section */}
      <section className="bg-destructive/5 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-destructive/20 bg-destructive/5 px-4 py-1.5 text-sm font-medium text-destructive">
              <ShieldAlert className="h-4 w-4" />
              {t('fraud_badge')}
            </div>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t('fraud_title')}</h2>
            <p className="text-muted-foreground">{t('fraud_subtitle')}</p>
          </div>
          <div className="space-y-3">
            {fraudGaps.map((g, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-destructive/20 bg-card shadow-sm">
                <button
                  onClick={() => setExpandedGap(expandedGap === i ? null : i)}
                  className="flex w-full items-center gap-3 p-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                    <g.icon className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex-1 text-start">
                    <p className="text-sm font-bold text-destructive">{g.threat}</p>
                  </div>
                  {expandedGap === i
                    ? <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
                    : <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                  }
                </button>
                {expandedGap === i && (
                  <div className="border-t px-4 pb-4 pt-3 space-y-3">
                    <div>
                      <span className="text-xs font-bold text-destructive">{t('gap_label')}</span>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{g.desc}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/10 p-3">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{t('gap_solution_label')}</span>
                      <p className="mt-1 text-sm leading-relaxed text-emerald-700 dark:text-emerald-400">{g.solution}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default OperationalGapsSection;
