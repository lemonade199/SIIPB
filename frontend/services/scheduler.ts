/** Scheduler keterlambatan (padanan Celery Beat): tandai TERLAMBAT & kirim pengingat/eskalasi. */
import { db } from '@/lib/mock/db';
import { atTime, diffDays, localDate, now, nowISO, today as todayStr } from '@/lib/date';
import { audit } from '@/services/audit';
import { notify } from '@/services/notification';
import { activeBorrowings, isActive } from '@/services/lookup';
import type { ID, SchedulerDetail } from '@/types';

export interface SchedulerResult {
  at: string;
  today: string;
  trigger: string;
  checked: number;
  late_marked: number;
  sent: number;
  skipped: number;
  failed: number;
  details: SchedulerDetail[];
}

export function runScheduler(opts: { today?: string; at?: string; trigger?: string; silent?: boolean; user_id?: ID } = {}): SchedulerResult {
  const today = opts.today || todayStr();
  const at = opts.at || nowISO();
  const res: SchedulerResult = { at, today, trigger: opts.trigger || 'manual', checked: 0, late_marked: 0, sent: 0, skipped: 0, failed: 0, details: [] };
  const rules = db.data.settings.rules.filter((r) => r.active).sort((a, b) => b.days - a.days);
  db.where('borrowings', (b) => isActive(b) && !!b.checked_out_at && localDate(b.checked_out_at) <= today).forEach((b) => {
    res.checked++;
    const lateDays = diffDays(b.due_date, today);
    if (lateDays <= 0 && b.status === 'TERLAMBAT') b.status = 'DIPINJAM'; // hanya bila tanggal demo dimundurkan
    if (lateDays > 0 && b.status === 'DIPINJAM') {
      b.status = 'TERLAMBAT';
      res.late_marked++;
      audit('borrowing.status', 'borrowings', b.id, { status: 'DIPINJAM' }, { status: 'TERLAMBAT', terlambat_hari: lateDays }, 0, at);
      res.details.push({ code: b.code, action: `Status → TERLAMBAT (${lateDays} hari)` });
    }
    const rule = rules.find((r) => r.days <= lateDays);
    if (!rule) return;
    const out = notify(b, rule.event, { at, user_id: 0, today, trigger: 'scheduler' });
    if (out.skipped) {
      res.skipped++;
      res.details.push({ code: b.code, action: `${rule.event} sudah pernah dikirim — dilewati` });
    } else if (out.notification.status === 'TERKIRIM') {
      res.sent++;
      res.details.push({ code: b.code, action: `${rule.event} dikirim ke ${out.notification.recipients.map((r) => r.type).join(', ')}` });
    } else {
      res.failed++;
      res.details.push({ code: b.code, action: `${rule.event} gagal dikirim` });
    }
  });
  db.data.settings.scheduler.last_run_date = today;
  db.insert('scheduler_runs', { ...res });
  if (!opts.silent)
    audit(
      'scheduler.run',
      'scheduler',
      null,
      null,
      { pemicu: res.trigger, diperiksa: res.checked, terlambat_baru: res.late_marked, terkirim: res.sent, dilewati: res.skipped },
      opts.user_id !== undefined ? opts.user_id : 0,
      at,
    );
  db.save();
  return res;
}

/** Mode demo: bila tanggal dimundurkan, transaksi yang belum lewat batas kembali ke DIPINJAM. */
export function reconcileStatus() {
  const today = todayStr();
  activeBorrowings().forEach((b) => {
    if (b.status === 'TERLAMBAT' && diffDays(b.due_date, today) <= 0) b.status = 'DIPINJAM';
  });
  db.save();
}

/** Dipanggil saat aplikasi dibuka: meniru Celery Beat yang berjalan tiap hari pada jam terjadwal. */
export function autoScheduler(): SchedulerResult | null {
  const sc = db.data.settings.scheduler;
  if (!sc.enabled) return null;
  const today = todayStr();
  if (sc.last_run_date && sc.last_run_date >= today) return null;
  const n = now();
  const [h, m] = sc.time.split(':').map(Number);
  if (n.getHours() * 60 + n.getMinutes() < h * 60 + m) return null;
  return runScheduler({ trigger: 'otomatis (Celery Beat)', at: atTime(today, sc.time) });
}

export const lastSchedulerRun = () => db.all('scheduler_runs').slice(-1)[0] ?? null;
