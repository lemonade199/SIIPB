'use client';

import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ---------- Primitif shadcn/ui Dialog (Radix) ---------- */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-slot="dialog-overlay" className="fixed inset-0 z-100 bg-[rgba(15,23,42,.45)] data-[state=open]:animate-[fade_.12s_ease-out]" />
      <div className="pointer-events-none fixed inset-0 z-100 overflow-y-auto px-4 py-[6vh]">
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={cn('modal pointer-events-auto mx-auto w-full outline-none data-[state=open]:animate-[pop_.14s_ease-out]', className)}
          {...props}
        >
          {children}
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ title, desc }: { title: ReactNode; desc?: ReactNode }) {
  return (
    <div className="modal-head">
      <div>
        <DialogPrimitive.Title data-slot="dialog-title">{title}</DialogPrimitive.Title>
        {desc ? <DialogPrimitive.Description data-slot="dialog-description">{desc}</DialogPrimitive.Description> : <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>}
      </div>
      <DialogPrimitive.Close className="grid size-8 place-items-center rounded-lg hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/25 outline-none" aria-label="Tutup">
        <X size={18} strokeWidth={1.8} />
      </DialogPrimitive.Close>
    </div>
  );
}

/* ---------- Pembungkus praktis yang dipakai halaman ---------- */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  desc?: ReactNode;
  size?: 'md' | 'lg';
  footer?: ReactNode;
  children?: ReactNode;
}

/** Modal SIIPB di atas shadcn Dialog: Esc/klik latar menutup, fokus terkunci & kembali ke pemicu. */
export function Modal({ open, onClose, title, desc, size = 'md', footer, children }: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(size === 'lg' && 'lg')}>
        <DialogHeader title={title} desc={desc} />
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}
