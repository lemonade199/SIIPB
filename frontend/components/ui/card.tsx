import Link from 'next/link';
import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Icon, type IconName } from '@/components/ui/icon';

/* ---------- Primitif shadcn/ui Card ---------- */
export function CardRoot({ className, ...props }: ComponentProps<'section'>) {
  return <section data-slot="card" className={cn('card min-w-0 rounded-xl border border-border bg-card text-card-foreground shadow-[var(--shadow)]', className)} {...props} />;
}
export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('flex flex-wrap items-start justify-between gap-2.5 px-5 pt-4', className)} {...props} />;
}
export function CardTitle({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-title" className={cn('text-[15.5px] font-semibold', className)} {...props} />;
}
export function CardDescription({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-description" className={cn('mt-0.5 text-[13px] text-muted-foreground', className)} {...props} />;
}
export function CardAction({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-action" className={cn('actions', className)} {...props} />;
}
export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-5 pt-4 pb-5', className)} {...props} />;
}
export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-footer" className={cn('flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3', className)} {...props} />;
}

/* ---------- Pembungkus praktis ---------- */
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
    <CardRoot className={className} style={style}>
      {title !== undefined && (
        <CardHeader>
          <div>
            <CardTitle>{title}</CardTitle>
            {desc && <CardDescription>{desc}</CardDescription>}
          </div>
          {actions && <CardAction>{actions}</CardAction>}
        </CardHeader>
      )}
      <CardContent className={cn(flush && 'px-0 pt-3 pb-0', bodyClassName)}>{children}</CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </CardRoot>
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
    <Link className="card stat" href={href} data-slot="card">
      {content}
    </Link>
  ) : (
    <div className="card stat" data-slot="card">
      {content}
    </div>
  );
}
