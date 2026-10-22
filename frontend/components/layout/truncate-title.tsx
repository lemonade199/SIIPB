'use client';

import { useEffect } from 'react';

/**
 * Teks yang terpotong "…" (karena terlalu panjang) otomatis diberi tooltip
 * berisi teks lengkapnya saat kursor diarahkan.
 */
export function TruncateTitle() {
  useEffect(() => {
    const onOver = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || !(el instanceof HTMLElement) || el.hasAttribute('title')) return;
      // hanya teks yang memang dipotong (ellipsis / line-clamp); area yang sekadar bisa di-scroll diabaikan
      const cs = getComputedStyle(el);
      const ellipsis = cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1;
      const clamp = cs.webkitLineClamp !== 'none' && cs.webkitLineClamp !== '' && el.scrollHeight > el.clientHeight + 1;
      if (!ellipsis && !clamp) return;
      const text = el.innerText.trim();
      if (text && text.length <= 500) el.setAttribute('title', text);
    };
    document.addEventListener('mouseover', onOver);
    return () => document.removeEventListener('mouseover', onOver);
  }, []);
  return null;
}
