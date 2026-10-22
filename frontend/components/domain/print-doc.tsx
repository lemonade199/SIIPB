/** Kerangka dokumen cetak resmi (hanya tampil saat dicetak): kop instansi, judul & nomor, tabel data, tanda tangan. */
import { Fragment, type ReactNode } from 'react';
import { db } from '@/lib/mock/db';
import { fmtDate, today } from '@/lib/date';

interface HeaderProps {
  title: string;
  number?: string;
  subtitle?: ReactNode;
}

function Header({ title, number, subtitle }: HeaderProps) {
  const s = db.data.settings;
  const contact = [s.return_location, s.staff_email, s.staff_phone].filter(Boolean).join(' · ');
  return (
    <>
      <header className="pd-kop">
        <div className="pd-inst">{s.institution}</div>
        <div className="pd-unit">{s.unit_sarpras}</div>
        {contact && <div className="pd-contact">{contact}</div>}
      </header>
      <div className="pd-title">
        <div className="pd-title-main">{title}</div>
        {number && <div>Nomor: {number}</div>}
        {subtitle && <div className="pd-title-sub">{subtitle}</div>}
      </div>
    </>
  );
}

/** Kop + judul saja, untuk halaman yang isinya (mis. tabel laporan) sama di layar dan kertas. */
export function PrintHeader(props: HeaderProps) {
  return (
    <div className="print-only print-doc">
      <Header {...props} />
    </div>
  );
}

export function PrintDoc({ children, ...props }: HeaderProps & { children: ReactNode }) {
  return (
    <div className="print-only print-doc">
      <Header {...props} />
      {children}
    </div>
  );
}

export function PrintSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pd-section">
      <div className="pd-section-title">{title}</div>
      {children}
    </section>
  );
}

/** Data label–nilai, dua pasang per baris agar ringkas di kertas A4. */
export function PrintInfo({ rows }: { rows: [string, ReactNode][] }) {
  const lines: [string, ReactNode][][] = [];
  for (let i = 0; i < rows.length; i += 2) lines.push(rows.slice(i, i + 2));
  return (
    <table className="pd-info">
      <tbody>
        {lines.map((line, i) => (
          <tr key={i}>
            {line.map(([k, v]) => (
              <Fragment key={k}>
                <th>{k}</th>
                <td>{v === '' || v === null || v === undefined ? '—' : v}</td>
              </Fragment>
            ))}
            {line.length === 1 && <td colSpan={2} />}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PrintSign({ cols }: { cols: { role: string; name?: string }[] }) {
  return (
    <div className="pd-sign">
      <div className="pd-sign-date">{fmtDate(today(), true)}</div>
      <div className="pd-sign-row">
        {cols.map((c) => (
          <div key={c.role} className="pd-sign-col">
            <div className="pd-sign-role">{c.role}</div>
            <div className="pd-sign-space" />
            <div className="pd-sign-name">{c.name || '(..............................)'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const humanize = (v?: string | null) => (v ? v.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : '—');
