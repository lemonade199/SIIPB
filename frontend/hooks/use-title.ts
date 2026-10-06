'use client';

import { useEffect } from 'react';

/** Set judul tab browser untuk halaman client-side. */
export function useTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} — SIIPB` : 'SIIPB';
  }, [title]);
}
