import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Icon, type IconName } from '@/components/ui/icon';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'success';

interface BaseProps {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  icon?: IconName;
  /** Tombol berisi ikon saja (tetap wajib diberi `title` untuk aksesibilitas). */
  iconOnly?: boolean;
  block?: boolean;
  className?: string;
  children?: ReactNode;
  title?: string;
}

type ButtonProps = BaseProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children' | 'title'> & { href?: undefined };
type LinkProps = BaseProps & { href: string; onClick?: () => void };

export function buttonClass({ variant = 'outline', size = 'md', iconOnly, block, className }: BaseProps) {
  return cn('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', iconOnly && 'btn-icon', block && 'btn-block', className);
}

export function Button(props: ButtonProps | LinkProps) {
  const { variant, size, icon, iconOnly, block, className, children, title } = props;
  const cls = buttonClass({ variant, size, iconOnly, block, className });
  const inner = (
    <>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
      {children !== undefined && children !== null && children !== false && <span>{children}</span>}
    </>
  );
  if (props.href !== undefined) {
    return (
      <Link href={props.href} className={cls} title={title} aria-label={iconOnly ? title : undefined} onClick={props.onClick}>
        {inner}
      </Link>
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { variant: _v, size: _s, icon: _i, iconOnly: _io, block: _b, className: _c, children: _ch, href: _h, type, ...rest } = props as ButtonProps;
  return (
    <button type={type || 'button'} className={cls} title={title} aria-label={iconOnly ? title : undefined} {...rest}>
      {inner}
    </button>
  );
}
