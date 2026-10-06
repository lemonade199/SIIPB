/** Pengaturan sistem: umum, SMTP, penjadwal, aturan notifikasi, template, keamanan, backup, demo. */
import { db } from '@/lib/mock/db';
import { atTime, nowISO, today as todayStr } from '@/lib/date';
import { audit } from '@/services/audit';
import { reconcileStatus, runScheduler } from '@/services/scheduler';
import type { ID, RecipientKind, Settings } from '@/types';

export const settings = (): Settings => db.data.settings;

/** Terapkan perubahan lalu catat di audit log. */
export function updateSettings(mutate: (s: Settings) => void, label: string, changes: Record<string, unknown>) {
  mutate(db.data.settings);
  audit('settings.update', 'settings', null, null, { bagian: label, ...changes });
  db.save();
}

export function setRuleRecipient(index: number, to: RecipientKind, on: boolean) {
  const r = db.data.settings.rules[index];
  r.to = on ? [...new Set([...r.to, to])] : r.to.filter((x) => x !== to);
  audit('settings.rule', 'settings', null, null, { kejadian: r.event, penerima: r.to.join('+') });
  db.save();
  return r;
}

export function setRuleActive(index: number, active: boolean) {
  const r = db.data.settings.rules[index];
  r.active = active;
  audit('settings.rule', 'settings', null, { kejadian: r.event, aktif: !active }, { kejadian: r.event, aktif: active });
  db.save();
  return r;
}

export function saveTemplate(id: ID, subject: string, body: string) {
  const t = db.get('email_templates', id);
  if (!t) return;
  const old = { subjek: t.subject };
  t.subject = subject;
  t.body = body;
  t.updated_at = nowISO();
  audit('template.update', 'email_templates', t.id, old, { subjek: t.subject });
  db.save();
}

export function testSmtp() {
  const s = db.data.settings.smtp;
  const ok = !!s.host && !s.simulate_failure;
  audit('smtp.test', 'settings', null, null, { hasil: ok ? 'berhasil' : 'gagal' });
  db.save();
  return ok;
}

export function recordBackup(sizeKb: number, by: string) {
  db.data.settings.backup.history.push({ at: nowISO(), type: 'Manual', size_kb: sizeKb, status: 'SUKSES', by });
  audit('backup.create', 'settings', null, null, { ukuran_kb: sizeKb });
  db.save();
}

export function recordRestoreTest() {
  db.data.settings.backup.last_restore_test = nowISO();
  audit('backup.restore_test', 'settings', null, null, { hasil: 'berhasil' });
  db.save();
}

/** Mode demo: geser "hari ini". Opsional jalankan scheduler setelahnya. */
export function shiftDemoDays(shift: number | 'reset', runAfter: boolean, userId: ID) {
  const s = db.data.settings;
  s.demo_offset_days = shift === 'reset' ? 0 : Number(s.demo_offset_days || 0) + shift;
  db.save();
  reconcileStatus();
  if (runAfter && shift !== 'reset' && shift > 0) {
    return runScheduler({ trigger: 'manual (mode demo)', user_id: userId, at: atTime(todayStr(), s.scheduler.time) });
  }
  return null;
}
