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
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
        const text = el.innerText.trim();
        if (text) el.setAttribute('title', text);
      }
    };
    document.addEventListener('mouseover', onOver);
    return () => document.removeEventListener('mouseover', onOver);
  }, []);
  return null;
}
