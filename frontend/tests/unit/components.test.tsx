import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Modal } from '@/components/ui/dialog';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('komponen shadcn/ui', () => {
  it('Badge memilih warna sesuai status', () => {
    render(<Badge status="TERLAMBAT" />);
    expect(screen.getByText('TERLAMBAT')).toHaveClass('text-late');
  });

  it('Button dengan href dirender sebagai tautan; tombol ikon memiliki aria-label', () => {
    render(
      <>
        <Button href="/inventaris">Inventaris</Button>
        <Button iconOnly icon="pencil" title="Ubah" />
      </>,
    );
    expect(screen.getByRole('link', { name: 'Inventaris' })).toHaveAttribute('href', '/inventaris');
    expect(screen.getByRole('button', { name: 'Ubah' })).toBeInTheDocument();
  });

  it('Checkbox (Radix) memanggil onCheckedChange', () => {
    const fn = vi.fn();
    render(<Checkbox aria-label="pilih" checked={false} onCheckedChange={fn} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'pilih' }));
    expect(fn).toHaveBeenCalledWith(true);
  });

  it('Modal (Radix Dialog) dapat ditutup dengan tombol Tutup', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Judul uji">
        isi
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Judul uji' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tutup' }));
    expect(onClose).toHaveBeenCalled();
  });
});
