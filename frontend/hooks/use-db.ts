'use client';

import { useSyncExternalStore } from 'react';
import { db } from '@/lib/mock/db';

/**
 * Berlangganan perubahan lapisan data. Komponen yang memanggil hook ini akan
 * dirender ulang setiap kali data disimpan (setara invalidasi query).
 */
export function useDbVersion() {
  return useSyncExternalStore(db.subscribe, db.getVersion, () => 0);
}
