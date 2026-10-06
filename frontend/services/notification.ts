/** Notifikasi email (padanan Celery Worker + SMTP). Satu notifikasi per (transaksi, kejadian). */
import { db } from '@/lib/mock/db';
import { diffDays, fmtDate, localDate, nowISO, today as todayStr } from '@/lib/date';
import { RETURN_CONDITIONS } from '@/lib/constants';
import { audit } from '@/services/audit';
import { emp, item, itemsOf, returnDetails, role, user } from '@/services/lookup';
import { currentUser } from '@/services/session';
import type { Borrowing, ID, Notification, NotificationEvent, Recipient, RecipientKind, Return, User } from '@/types';

export function recipientsFor(b: Borrowing, to: RecipientKind[]): Recipient[] {
  const out: Recipient[] = [];
  const e = emp(b.employee_id);
  if (to.includes('peminjam') && e) out.push({ type: 'Peminjam', name: e.name, email: e.email });
  if (to.includes('petugas')) {
    const u = user(b.checked_out_by || b.created_by);
    if (u) out.push({ type: 'Petugas', name: u.name, email: u.email, user_id: u.id });
  }
  if (to.includes('pimpinan')) {
    db.where('users', (u) => u.active && role(u.role_id)?.code === 'pimpinan').forEach((u) =>
      out.push({ type: 'Pimpinan', name: u.name, email: u.email, user_id: u.id }),
    );
  }
  return out;
}

export type TemplateVars = Record<string, string | number | undefined>;

export function templateVars(b: Borrowing, extra?: { ret?: Return }, today = todayStr()): TemplateVars {
  const e = emp(b.employee_id);
  const s = db.data.settings;
  const officer = user(b.checked_out_by || b.created_by);
  const items = itemsOf(b);
  const vars: TemplateVars = {
    nama_peminjam: e?.name,
    kode_transaksi: b.code,
    daftar_barang: items.map((it, i) => `${i + 1}. ${it.item_name} (${it.item_code})`).join('\n'),
    tanggal_pinjam: fmtDate(b.borrow_date, true),
    batas_kembali: fmtDate(b.due_date, true),
    tujuan: b.purpose,
    hari_terlambat: Math.max(0, diffDays(b.due_date, today)),
    nama_petugas: officer?.name || 'Petugas Sarpras/IT',
    kontak_petugas: [officer?.email, officer?.phone || s.staff_phone].filter(Boolean).join(', '),
    lokasi_pengembalian: s.return_location,
    nama_instansi: s.institution,
  };
  if (extra?.ret) {
    const r = extra.ret;
    vars.tanggal_kembali = fmtDate(r.return_date, true);
    vars.daftar_barang_kembali = returnDetails(r)
      .map((d, i) => {
        const it = item(d.item_id)!;
        const c = RETURN_CONDITIONS.find((x) => x.key === d.condition_after);
        return `${i + 1}. ${it.item_name} (${it.item_code}) — ${c ? c.label : d.condition_after}`;
      })
      .join('\n');
  }
  return vars;
}

export const fillTemplate = (str: string, vars: TemplateVars) =>
  str.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));

export function renderTemplate(code: string, vars: TemplateVars) {
  const t = db.find('email_templates', (x) => x.code === code);
  if (!t) return { subject: '(template tidak ditemukan)', body: '' };
  return { subject: fillTemplate(t.subject, vars), body: fillTemplate(t.body, vars) };
}

function smtpSend() {
  const s = db.data.settings.smtp;
  if (!s.host) return { ok: false, message: 'SMTP host belum dikonfigurasi' };
  if (s.simulate_failure) return { ok: false, message: 'Koneksi SMTP ditolak (simulasi kegagalan)' };
  return { ok: true, message: '250 OK — diterima server SMTP' };
}

export function deliver(n: Notification, at = nowISO()) {
  n.attempts += 1;
  let allOk = true;
  n.recipients.forEach((r) => {
    const res = smtpSend();
    if (!res.ok) allOk = false;
    db.insert('notification_logs', {
      notification_id: n.id,
      borrowing_id: n.borrowing_id,
      event: n.event,
      recipient: r.email,
      recipient_type: r.type,
      status: res.ok ? 'TERKIRIM' : 'GAGAL',
      attempt: n.attempts,
      message: res.message,
      at,
    });
  });
  n.status = allOk ? 'TERKIRIM' : 'GAGAL';
  if (allOk) n.sent_at = at;
  return allOk;
}

export interface NotifyOptions {
  at?: string;
  user_id?: ID;
  today?: string;
  trigger?: string;
  ret?: Return;
}

export function notify(b: Borrowing, event: NotificationEvent, opts: NotifyOptions = {}) {
  const exists = db.find('notifications', (n) => n.borrowing_id === b.id && n.event === event);
  if (exists) return { skipped: true, notification: exists };
  let to: RecipientKind[] = ['peminjam'];
  let tplCode = event === 'CHECKOUT' ? 'tpl_checkout' : event === 'PENGEMBALIAN' ? 'tpl_return' : '';
  const rule = db.data.settings.rules.find((r) => r.event === event);
  if (rule) {
    to = rule.to;
    tplCode = rule.template;
  }
  const at = opts.at || nowISO();
  const vars = templateVars(b, opts, opts.today || localDate(at));
  const msg = renderTemplate(tplCode, vars);
  const n = db.insert('notifications', {
    borrowing_id: b.id,
    event,
    template: tplCode,
    subject: msg.subject,
    body: msg.body,
    recipients: recipientsFor(b, to),
    status: 'MENUNGGU',
    attempts: 0,
    created_at: at,
    sent_at: null,
    read_by: [],
    trigger: opts.trigger || (opts.user_id === 0 ? 'scheduler' : 'transaksi'),
  });
  deliver(n, at);
  return { skipped: false, notification: n };
}

export function retryNotification(id: ID) {
  const n = db.get('notifications', id);
  if (!n || n.status === 'TERKIRIM') return { ok: false, notification: n };
  const ok = deliver(n);
  audit('notification.retry', 'notifications', n.id, null, { hasil: n.status, percobaan: n.attempts });
  db.save();
  return { ok, notification: n };
}

export function markRead(id: ID, userId: ID, save = true) {
  const n = db.get('notifications', id);
  if (n && !n.read_by.includes(userId)) {
    n.read_by.push(userId);
    if (save) db.save();
  }
}

/** Notifikasi di aplikasi untuk pengguna internal (eskalasi yang menyertakan dirinya). */
export function inbox(u: User | null = currentUser()): Notification[] {
  if (!u) return [];
  const isAdmin = role(u.role_id)?.code === 'admin';
  return db
    .where(
      'notifications',
      (n) => n.recipients.some((r) => r.user_id === u.id) || (isAdmin && (n.event === 'H+3' || n.event === 'H+7' || n.status === 'GAGAL')),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function markAllRead(u: User) {
  inbox(u).forEach((n) => markRead(n.id, u.id, false));
  db.save();
}
