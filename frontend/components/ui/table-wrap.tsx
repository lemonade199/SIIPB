'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/**
 * Pembungkus tabel yang bisa digeser ke samping.
 * - Scrollbar horizontal selalu terlihat saat tabel lebih lebar dari layar.
 * - Bar di atas tabel berisi tombol panah kiri/kanan + scrollbar; bayangan di tepi menandakan masih ada kolom lain.
 * - Bisa juga digeser pakai Shift + scroll mouse, atau geser touchpad.
 */
export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const left = el.scrollLeft > 2;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setEdge((p) => (p.left === left && p.right === right ? p : { left, right }));
      setWidth(el.scrollWidth > el.clientWidth + 2 ? el.scrollWidth : 0);
      if (topRef.current && Math.abs(topRef.current.scrollLeft - el.scrollLeft) > 1) topRef.current.scrollLeft = el.scrollLeft;
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

  // Scrollbar tambahan di atas tabel (sinkron dengan scrollbar bawah), supaya tidak perlu turun ke bawah dulu
  const onTopScroll = () => {
    const el = ref.current;
    const top = topRef.current;
    if (el && top && Math.abs(el.scrollLeft - top.scrollLeft) > 1) el.scrollLeft = top.scrollLeft;
  };

  const slide = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.6, behavior: 'smooth' });

  return (
    <div className={cn('table-scroll', edge.left && 'can-left', edge.right && 'can-right', width > 0 && 'is-scrollable')}>
      {width > 0 && (
        <div className="tscroll-bar no-print">
          <span className="tscroll-hint">Tabel bisa digeser ke samping</span>
          <button type="button" className="tscroll-mini" onClick={() => slide(-1)} disabled={!edge.left} aria-label="Geser tabel ke kiri">
            <Icon name="chevLeft" size={14} />
          </button>
          <div ref={topRef} className="tscroll-top" onScroll={onTopScroll} aria-hidden="true">
            <div style={{ width, height: 1 }} />
          </div>
          <button type="button" className="tscroll-mini" onClick={() => slide(1)} disabled={!edge.right} aria-label="Geser tabel ke kanan">
            <Icon name="chev" size={14} />
          </button>
        </div>
      )}
      <div ref={ref} className={cn('table-wrap', className)}>
        {children}
      </div>
    </div>
  );
}
