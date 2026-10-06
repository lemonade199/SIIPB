'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { db } from '@/lib/mock/db';
import { seedDatabase } from '@/lib/mock/seed';
import { Spinner } from '@/components/ui/misc';
import { useToast } from '@/components/providers/feedback-provider';
import { autoScheduler, type SchedulerResult } from '@/services/scheduler';
import { currentUser } from '@/services/session';

export function schedulerToastText(r: SchedulerResult, time: string) {
  return `Pemeriksaan terjadwal ${time}: ${r.late_marked} transaksi menjadi TERLAMBAT, ${r.sent} email terkirim.`;
}

/**
 * Memuat lapisan data (mockup: localStorage) sebelum aplikasi dirender.
 * Saat terhubung ke Flask API, provider ini cukup diganti dengan QueryClientProvider / SWR.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(db.ready);
  const toast = useToast();

  useEffect(() => {
    if (db.ready) return;
    db.onSaveError((m) => toast(m, 'err'));
    const fresh = db.load(seedDatabase);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inisialisasi satu kali dari storage browser
    setReady(true);
    const res = currentUser() ? autoScheduler() : null;
    if (fresh) setTimeout(() => toast('Data contoh SIIPB telah disiapkan. Gunakan akun demo untuk masuk.'), 300);
    if (res && (res.sent || res.late_marked)) setTimeout(() => toast(schedulerToastText(res, db.data.settings.scheduler.time), 'warn'), 600);
  }, [toast]);

  if (!ready) return <Spinner label="Menyiapkan data SIIPB…" />;
  return <>{children}</>;
}
