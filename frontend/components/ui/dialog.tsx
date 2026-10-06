'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  desc?: ReactNode;
  size?: 'md' | 'lg';
  footer?: ReactNode;
  children?: ReactNode;
}

/** Dialog modal (setara shadcn <Dialog>): Esc & klik latar menutup, fokus kembali ke pemicu. */
export function Modal({ open, onClose, title, desc, size = 'md', footer, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      const f = ref.current?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), select, textarea, .modal-foot .btn-primary');
      f?.focus();
    }, 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={ref} className={cn('modal', size === 'lg' && 'lg')} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {desc && <p>{desc}</p>}
          </div>
          <Button variant="ghost" size="sm" iconOnly icon="x" title="Tutup" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
