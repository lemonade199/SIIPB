'use client';

import { useCallback, useState } from 'react';

const memory = new Map<string, unknown>();

/**
 * State yang bertahan saat berpindah halaman (selama tab browser terbuka).
 * Dipakai untuk filter & pencarian daftar, seperti perilaku mockup.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => (memory.has(key) ? (memory.get(key) as T) : initial));
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
        memory.set(key, next);
        return next;
      });
    },
    [key],
  );
  return [value, set] as const;
}

/** Ubah sebagian objek state (filter) + reset halaman ke 1. */
export function patchFilter<T extends { page: number }>(set: (fn: (p: T) => T) => void) {
  return <K extends keyof T>(k: K, v: T[K]) => set((p) => ({ ...p, [k]: v, page: k === 'page' ? (v as number) : 1 }));
}
