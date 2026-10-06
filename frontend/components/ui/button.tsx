import Link from 'next/link';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Icon, type IconName } from '@/components/ui/icon';

/**
 * shadcn/ui Button (cva + Radix Slot), dengan varian disesuaikan desain SIIPB.
 * Varian bawaan shadcn (`default`, `destructive`, `secondary`, `link`) tetap tersedia.
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-[7px] whitespace-nowrap rounded-lg border border-transparent font-semibold transition-[background-color,border-color,box-shadow] outline-none no-underline hover:no-underline focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        outline: 'border-input bg-card text-foreground hover:bg-accent',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-muted',
        ghost: 'bg-transparent text-foreground hover:bg-accent',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        danger: 'border-[#efc1c1] bg-card text-danger hover:bg-danger-bg',
        success: 'bg-ok text-white hover:bg-[#116a33]',
        link: 'h-auto! px-0! text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-[38px] px-3.5 text-[13.5px]',
        sm: 'h-8 px-2.5 text-[12.5px]',
        icon: 'size-[38px] p-0',
        'icon-sm': 'size-8 p-0',
      },
    },
    defaultVariants: { variant: 'outline', size: 'default' },
  },
);

type Variant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
export type ButtonVariant = Variant;

interface ExtraProps {
  variant?: Variant;
  size?: 'md' | 'sm';
  /** Ikon di kiri label. */
  icon?: IconName;
  /** Tombol ikon saja — wajib diberi `title` untuk aksesibilitas. */
  iconOnly?: boolean;
  block?: boolean;
  /** Bila diisi, tombol dirender sebagai <Link> Next.js. */
  href?: string;
  asChild?: boolean;
  children?: ReactNode;
}

export type ButtonProps = ExtraProps & Omit<ComponentProps<'button'>, keyof ExtraProps>;

export function buttonClass({ variant = 'outline', size = 'md', iconOnly, block, className }: Pick<ExtraProps, 'variant' | 'size' | 'iconOnly' | 'block'> & { className?: string }) {
  const s = iconOnly ? (size === 'sm' ? 'icon-sm' : 'icon') : size === 'sm' ? 'sm' : 'default';
  return cn(buttonVariants({ variant, size: s }), block && 'w-full', className);
}

export function Button({ variant, size, icon, iconOnly, block, href, asChild, className, children, title, type, onClick, ...rest }: ButtonProps) {
  const cls = buttonClass({ variant, size, iconOnly, block, className });
  const content = (
    <>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
      {children !== undefined && children !== null && children !== false && <span>{children}</span>}
    </>
  );
  if (href !== undefined) {
    return (
      <Link
        href={href}
        data-slot="button"
        className={cls}
        title={title}
        aria-label={iconOnly ? title : undefined}
        onClick={onClick as unknown as React.MouseEventHandler<HTMLAnchorElement>}
      >
        {content}
      </Link>
    );
  }
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : type || 'button'}
      className={cls}
      title={title}
      aria-label={iconOnly ? title : undefined}
      onClick={onClick}
      {...rest}
    >
      {asChild ? children : content}
    </Comp>
  );
}
