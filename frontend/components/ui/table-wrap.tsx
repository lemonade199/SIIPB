'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/**
 * Pembungkus tabel yang bisa digeser ke samping.
 * - Scrollbar horizontal selalu terlihat saat tabel lebih lebar dari layar.
 * - Tombol panah kiri/kanan + bayangan di tepi menandakan masih ada kolom lain.
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

  const slide = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.6, behavior: 'smooth' });

  return (
    <div className={cn('table-scroll', edge.left && 'can-left', edge.right && 'can-right')}>
      <div ref={ref} className={cn('table-wrap', className)}>
        {children}
      </div>
      {edge.left && (
        <button type="button" className="tscroll-btn left no-print" onClick={() => slide(-1)} aria-label="Geser tabel ke kiri" title="Geser ke kiri">
          <Icon name="chevLeft" size={16} />
        </button>
      )}
      {edge.right && (
        <button type="button" className="tscroll-btn right no-print" onClick={() => slide(1)} aria-label="Geser tabel ke kanan" title="Geser ke kanan">
          <Icon name="chev" size={16} />
        </button>
      )}
    </div>
  );
}
