import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Icon, type IconName } from '@/components/ui/icon';

interface CardProps {
  title?: ReactNode;
  desc?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  /** Body tanpa padding samping (untuk tabel). */
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Card({ title, desc, actions, footer, flush, className, bodyClassName, style, children }: CardProps) {
  return (
    <section className={cn('card', className)} style={style}>
      {title !== undefined && (
        <div className="card-header">
          <div>
            <div className="card-title">{title}</div>
            {desc && <div className="card-desc">{desc}</div>}
          </div>
          {actions && <div className="actions">{actions}</div>}
        </div>
      )}
      <div className={cn('card-body', flush && 'flush', bodyClassName)}>{children}</div>
      {footer && <div className="card-foot">{footer}</div>}
    </section>
  );
}

const TONE: Record<string, [string, string]> = {
  primary: ['var(--primary-soft)', 'var(--primary)'],
  ok: ['var(--ok-bg)', 'var(--ok)'],
  info: ['var(--info-bg)', 'var(--info)'],
  warn: ['var(--warn-bg)', 'var(--warn)'],
  late: ['var(--late-bg)', 'var(--late)'],
  danger: ['var(--danger-bg)', 'var(--danger)'],
  purple: ['var(--purple-bg)', 'var(--purple)'],
  gray: ['var(--gray-bg)', 'var(--gray)'],
};
export type Tone = keyof typeof TONE;

export function StatIcon({ icon, tone = 'primary', size = 17 }: { icon: IconName; tone?: Tone; size?: number }) {
  const [bg, fg] = TONE[tone];
  return (
    <span className="stat-ico" style={{ background: bg, color: fg }}>
      <Icon name={icon} size={size} />
    </span>
  );
}

export function StatTile({
  label,
  value,
  sub,
  icon,
  tone,
  href,
  valueStyle,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon: IconName;
  tone?: Tone;
  href?: string;
  valueStyle?: CSSProperties;
}) {
  const content = (
    <>
      <div className="stat-top">
        <span>{label}</span>
        <StatIcon icon={icon} tone={tone} />
      </div>
      <div className="stat-val" style={valueStyle}>
        {value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </>
  );
  return href ? (
    <Link className="card stat" href={href}>
      {content}
    </Link>
  ) : (
    <div className="card stat">{content}</div>
  );
}
