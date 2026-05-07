import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartPulse,
  Hospital,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { cn } from '../lib/cn';
import { useLanguage } from '../hooks/useLanguage';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const ctaBase =
  'inline-flex h-12 items-center justify-center gap-2.5 rounded-lg px-6 text-base font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98]';

function SectionHeader({ eyebrow, title, description, align = 'center' }) {
  return (
    <div className={cn('mx-auto max-w-2xl', align === 'center' ? 'text-center' : 'text-left')}>
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-text-primary dark:text-text-dark sm:text-3xl">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-sm leading-6 text-text-muted dark:text-slate-400">{description}</p>
      )}
    </div>
  );
}

function FeatureCard({ title, description, icon: Icon, tone }) {
  const { t } = useLanguage();
  return (
    <motion.div variants={item} whileHover={{ y: -4, scale: 1.01 }} transition={{ duration: 0.18 }}>
      <Card className="group h-full bg-white/85 shadow-sm backdrop-blur dark:bg-surface-dark/80">
        <div className="flex h-full flex-col gap-4">
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', tone)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary dark:text-text-dark">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-text-muted dark:text-slate-400">{description}</p>
          </div>
          <div className="mt-auto flex items-center gap-2 text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
            {t.exploreWorkflow} <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function HeroVisual({ t }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15 }}
      className="relative mx-auto w-full max-w-md lg:max-w-none"
      aria-hidden="true"
    >
      <div className="absolute -inset-6 rounded-full bg-primary/20 blur-3xl dark:bg-primary/25" />
      <div className="absolute right-6 top-8 h-24 w-24 rounded-full bg-accent/20 blur-2xl" />

      <Card
        padding="lg"
        className="relative overflow-hidden border-primary/20 bg-white/85 shadow-xl backdrop-blur-xl dark:border-primary/20 dark:bg-surface-dark/85"
      >
        <div className="absolute right-0 top-0 h-32 w-32 bg-primary/10 blur-2xl" />

        <div className="relative flex items-center justify-between gap-4 border-b border-border/70 pb-5 dark:border-border-dark/70">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {t.liveAssessment}
            </p>
            <h3 className="mt-1 text-lg font-bold text-text-primary dark:text-text-dark">
              {t.careGuidance}
            </h3>
          </div>
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20"
          >
            <HeartPulse className="h-6 w-6" />
          </motion.div>
        </div>

        <div className="relative mt-6 space-y-4">
          {[
            [t.symptomContextLabel, 'Chest tightness, cough, fatigue', '92%'],
            [t.riskReviewLabel,     'Moderate priority, monitor closely', '68%'],
            [t.recommendedActionLabel, 'Book consultation if worsening', t.triage],
          ].map(([label, value, meta], index) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + index * 0.1, duration: 0.32 }}
              className="rounded-lg border border-border bg-background/80 p-4 dark:border-border-dark dark:bg-background-dark/80"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{label}</p>
                  <p className="mt-1 truncate text-sm font-medium text-text-primary dark:text-text-dark">{value}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{meta}</span>
              </div>
              {index < 2 && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border dark:bg-border-dark">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: index === 0 ? '92%' : '68%' }}
                    transition={{ delay: 0.55 + index * 0.1, duration: 0.55 }}
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-3">
          {[
            [Stethoscope, t.triage],
            [FileText,    t.reports],
            [CheckCircle2, t.history],
          ].map(([Icon, label]) => (
            <div
              key={label}
              className="rounded-lg border border-border bg-white/70 p-3 text-center dark:border-border-dark dark:bg-surface-dark/70"
            >
              <Icon className="mx-auto h-4 w-4 text-primary" />
              <p className="mt-1 text-xs font-medium text-text-muted">{label}</p>
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

function StepCard({ step, title, description, icon: Icon, isLast, t }) {
  return (
    <motion.div variants={item} className="relative flex-1">
      {!isLast && (
        <div className="absolute left-9 top-9 hidden h-px w-[calc(100%-1rem)] bg-gradient-to-r from-primary/50 to-border dark:to-border-dark lg:block" />
      )}
      <Card className="relative h-full bg-white/85 shadow-sm backdrop-blur dark:bg-surface-dark/80">
        <div className="flex items-start gap-4 lg:flex-col">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/20">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              {t.stepLabel} {step}
            </span>
            <h3 className="mt-1 text-base font-semibold text-text-primary dark:text-text-dark">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-text-muted dark:text-slate-400">{description}</p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function LandingPage() {
  const { t } = useLanguage();

  const features = [
    { title: t.feature_aiChat_title,            description: t.feature_aiChat_desc,            icon: MessageSquare, tone: 'bg-primary/15 text-primary'  },
    { title: t.feature_symptomChecker_title,    description: t.feature_symptomChecker_desc,    icon: Activity,      tone: 'bg-accent/15 text-accent'     },
    { title: t.feature_hospitalDiscovery_title, description: t.feature_hospitalDiscovery_desc, icon: Hospital,      tone: 'bg-warning/15 text-warning'   },
    { title: t.feature_healthReports_title,     description: t.feature_healthReports_desc,     icon: BarChart2,     tone: 'bg-success/15 text-success'   },
    { title: t.feature_medicalHistory_title,    description: t.feature_medicalHistory_desc,    icon: ClipboardList, tone: 'bg-primary/15 text-primary'   },
    { title: t.feature_healthInsights_title,    description: t.feature_healthInsights_desc,    icon: TrendingUp,    tone: 'bg-accent/15 text-accent'     },
  ];

  const steps = [
    { title: t.step1_title, description: t.step1_desc, icon: UserRound },
    { title: t.step2_title, description: t.step2_desc, icon: ShieldCheck },
    { title: t.step3_title, description: t.step3_desc, icon: Hospital },
  ];

  return (
    <main className="min-h-[calc(100vh-56px)] overflow-hidden bg-background font-sans text-text-primary dark:bg-background-dark dark:text-text-dark">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(15,118,110,0.18),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(99,102,241,0.16),transparent_28%)] dark:bg-[radial-gradient(circle_at_15%_20%,rgba(15,118,110,0.24),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(99,102,241,0.18),transparent_28%)]" />
        <div className="relative mx-auto grid max-w-screen-xl gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
          <motion.div initial="hidden" animate="show" variants={container} className="max-w-2xl">

            <motion.div variants={item} className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary dark:border-primary/25 dark:bg-primary/15">
              <Sparkles className="h-3.5 w-3.5" />
              {t.landingTagline}
            </motion.div>

            <motion.h1 variants={item} className="mt-5 text-4xl font-bold tracking-tight text-text-primary dark:text-text-dark sm:text-5xl lg:text-6xl">
              {t.landingTitle}
            </motion.h1>

            <motion.p variants={item} className="mt-5 max-w-xl text-base leading-7 text-text-muted dark:text-slate-400 sm:text-lg">
              {t.landingSubtitle}
            </motion.p>

            <motion.div variants={item} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className={cn(ctaBase, 'group bg-primary text-white shadow-sm hover:bg-primary-hover hover:shadow-md')}
              >
                {t.getStarted} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/login"
                className={cn(ctaBase, 'border border-primary bg-white text-primary shadow-sm hover:bg-primary-light dark:border-border-dark dark:bg-surface-dark dark:hover:bg-primary/10')}
              >
                {t.signInToChat}
              </Link>
            </motion.div>

            <motion.div variants={item} className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {[
                [t.aiGuidance247, t.aiGuidanceLabel],
                [t.riskStatLabel,  t.riskAwareLabel],
                [t.secureLabel,    t.historyLabel],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-lg border border-border bg-white/70 p-3 backdrop-blur dark:border-border-dark dark:bg-surface-dark/70"
                >
                  <p className="text-lg font-bold text-text-primary dark:text-text-dark">{value}</p>
                  <p className="text-xs text-text-muted">{label}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <HeroVisual t={t} />
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-screen-xl px-4 py-12 sm:px-6">
        <SectionHeader
          eyebrow={t.platformFeaturesEyebrow}
          title={t.platformFeaturesTitle}
          description={t.platformFeaturesDesc}
        />
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={container}
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </motion.div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-white/55 py-12 dark:border-border-dark dark:bg-surface-dark/30">
        <div className="mx-auto max-w-screen-xl px-4 sm:px-6">
          <SectionHeader
            eyebrow={t.howItWorksEyebrow}
            title={t.howItWorksTitle}
            description={t.howItWorksDesc}
          />
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            variants={container}
            className="mt-8 grid gap-4 lg:grid-cols-3"
          >
            {steps.map((step, index) => (
              <StepCard
                key={step.title}
                step={index + 1}
                isLast={index === steps.length - 1}
                t={t}
                {...step}
              />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-screen-xl px-4 py-12 sm:px-6 sm:py-16">
        <Card
          padding="lg"
          className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary to-[#0D5F58] text-white shadow-xl"
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                {t.readyWhenYouAre}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                {t.startHealthTrail}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
                {t.createAccountDesc}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Link to="/register" className={cn(ctaBase, 'bg-white text-primary hover:bg-white/90')}>
                {t.createAccount}
              </Link>
              <Link to="/login" className={cn(ctaBase, 'text-white hover:bg-white/15')}>
                {t.signIn}
              </Link>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
