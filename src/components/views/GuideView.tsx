import { ArrowRight } from 'lucide-react';
import { useI18n } from '../../i18n/translations';
import type { NavSection } from '../../types/nexora';

interface GuideViewProps {
  onNavigate: (section: NavSection) => void;
}

export default function GuideView({ onNavigate }: GuideViewProps) {
  const { t } = useI18n();

  const chapters: Array<{
    num: string;
    title: string;
    summary: string;
    bullets: string[];
    actionLabel: string;
    target: NavSection;
  }> = [
    {
      num: '01.',
      title: t('guideCh1Title'),
      summary: t('guideCh1Summary'),
      bullets: [t('guideCh1Bullet1'), t('guideCh1Bullet2')],
      actionLabel: t('guideCh1Action'),
      target: 'cockpit',
    },
    {
      num: '02.',
      title: t('guideCh2Title'),
      summary: t('guideCh2Summary'),
      bullets: [t('guideCh2Bullet1'), t('guideCh2Bullet2')],
      actionLabel: t('guideCh2Action'),
      target: 'city',
    },
    {
      num: '03.',
      title: t('guideCh3Title'),
      summary: t('guideCh3Summary'),
      bullets: [t('guideCh3Bullet1'), t('guideCh3Bullet2')],
      actionLabel: t('guideCh3Action'),
      target: 'missions',
    },
    {
      num: '04.',
      title: t('guideCh4Title'),
      summary: t('guideCh4Summary'),
      bullets: [t('guideCh4Bullet1'), t('guideCh4Bullet2')],
      actionLabel: t('guideCh4Action'),
      target: 'voice',
    },
    {
      num: '05.',
      title: t('guideCh5Title'),
      summary: t('guideCh5Summary'),
      bullets: [t('guideCh5Bullet1'), t('guideCh5Bullet2')],
      actionLabel: t('guideCh5Action'),
      target: 'terminal',
    },
    {
      num: '06.',
      title: t('guideCh6Title'),
      summary: t('guideCh6Summary'),
      bullets: [t('guideCh6Bullet1'), t('guideCh6Bullet2'), t('guideCh6Bullet3')],
      actionLabel: t('guideCh6Action'),
      target: 'integrations',
    },
  ];

  return (
    <div className="space-y-6 pb-8 max-w-4xl">
      <div className="border-b border-[var(--nx-border)] pb-5">
        <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
          {t('guideEyebrow')}
        </p>
        <h1 className="font-editorial text-4xl leading-tight mt-1 text-[var(--nx-text)]">
          {t('guideTitlePrefix')}{' '}
          <span className="italic text-[var(--nx-accent)]">{t('guideTitleAccent')}</span>
        </h1>
        <p className="mt-1.5 text-sm text-[var(--nx-text-muted)]">{t('guideSubtitle')}</p>
      </div>

      <div className="space-y-4">
        {chapters.map((ch) => (
          <section
            key={ch.num}
            className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <h2 className="font-editorial text-2xl text-[var(--nx-text)]">
                  <span className="text-[var(--nx-accent)] mr-2">{ch.num}</span>
                  {ch.title}
                </h2>
                <p className="mt-2 text-sm text-[var(--nx-text-muted)] leading-relaxed">
                  {ch.summary}
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-[var(--nx-text-muted)] list-disc pl-4">
                  {ch.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => onNavigate(ch.target)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nx-border-strong)] px-3.5 py-2 text-xs font-medium text-[var(--nx-text)] hover:border-[var(--nx-accent)] hover:text-[var(--nx-accent)] whitespace-nowrap cursor-pointer"
              >
                <span>{ch.actionLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
