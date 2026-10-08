'use client';

import { db } from '@/lib/mock/db';
import * as repo from '@/services/repo';
import { fmtDateTime } from '@/lib/date';
import { EVENT_LABEL } from '@/lib/constants';
import { useAuth } from '@/hooks/use-auth';
import { Badge, Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { useToast } from '@/components/providers/feedback-provider';
import type { ID } from '@/types';
import { TableWrap } from '@/components/ui/table-wrap';

/** Pratinjau email yang diterima peminjam / petugas / pimpinan + log pengiriman SMTP. */
export function EmailPreview({ id, onClose }: { id: ID | null; onClose: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const n = id ? db.get('notifications', id) : null;
  if (!n) return null;
  const s = db.data.settings;
  const logs = db.where('notification_logs', (l) => l.notification_id === n.id);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={EVENT_LABEL[n.event] || n.event}
      desc={`Notifikasi #${n.id} · ${fmtDateTime(n.created_at)}`}
      footer={
        <>
          {n.status === 'GAGAL' && can('notification.manage') && (
            <Button
              variant="primary"
              icon="send"
              onClick={async () => {
                const res = await repo.retryNotification(n.id);
                onClose();
                toast(res.ok ? 'Email berhasil dikirim ulang.' : 'Pengiriman ulang masih gagal. Periksa konfigurasi SMTP.', res.ok ? 'ok' : 'err');
              }}
            >
              Kirim ulang
            </Button>
          )}
          <Button onClick={onClose}>Tutup</Button>
        </>
      }
    >
      <div className="email">
        <div className="email-head">
          <span>
            <span className="muted">Dari:</span> {s.smtp.from_name} &lt;{s.smtp.from_email}&gt;
          </span>
          <span>
            <span className="muted">Kepada:</span> {n.recipients.map((r) => `${r.name} <${r.email}>`).join(', ')}
          </span>
          <span className="subj">{n.subject}</span>
        </div>
        <div className="email-brand">
          <Icon name="box" /> SIIPB <span style={{ fontWeight: 400, color: '#c8d9e6', fontSize: 13 }}>{s.institution}</span>
        </div>
        <div className="email-body">{n.body}</div>
      </div>
      <div className="label" style={{ margin: '16px 0 8px' }}>
        Log pengiriman (notification_logs)
      </div>
      <TableWrap>
        <table className="table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Penerima</th>
              <th>Percobaan</th>
              <th>Status</th>
              <th>Respons SMTP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="nowrap small">{fmtDateTime(l.at)}</td>
                <td className="small">
                  {l.recipient} <Tag>{l.recipient_type}</Tag>
                </td>
                <td className="mono">{l.attempt}</td>
                <td>
                  <Badge status={l.status} />
                </td>
                <td className="small muted">{l.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Modal>
  );
}
