'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Pembungkus tabel yang bisa digeser ke samping.
 * - Satu scrollbar horizontal di bawah tabel (muncul kalau tabel lebih lebar dari layar).
 * - Bayangan tipis di tepi kiri/kanan menandakan masih ada kolom lain.
 * - Bisa juga digeser pakai Shift + scroll mouse, atau geser touchpad.
 */
export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const left = el.scrollLeft > 2;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setEdge((p) => (p.left === left && p.right === right ? p : { left, right }));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);

  return (
    <div className={cn('table-scroll', edge.left && 'can-left', edge.right && 'can-right')}>
      <div ref={ref} className={cn('table-wrap', className)}>
        {children}
      </div>
    </div>
  );
}
