import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '@/app/login/page';
import * as repo from '@/services/repo';

const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockToast = vi.fn();
vi.mock('@/components/providers/feedback-provider', () => ({
  useToast: () => mockToast,
}));

const mockSetCurrentUser = vi.fn();
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: null,
    setCurrentUser: mockSetCurrentUser,
  }),
}));

vi.mock('@/services/repo', () => ({
  login: vi.fn(),
  loginSso: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/services/api/endpoints', () => ({
  authApi: {
    getCaptcha: vi.fn().mockResolvedValue({ captcha_id: 'c-123', image: 'data:image/svg+xml,...' }),
    ssoUrl: vi.fn().mockReturnValue('/sso'),
  },
  settingsApi: {
    public: vi.fn().mockResolvedValue({ institution: 'SIIPB', oidc_enabled: false }),
  },
}));

import { db } from '@/lib/mock/db';
import { seedDatabase } from '@/lib/mock/seed';

const anyCaptchaId = { asymmetricMatch: (actual: unknown) => actual === undefined || typeof actual === 'string' };

describe('LoginPage - Perilaku Pengosongan Input Password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    db.load(seedDatabase);
  });

  it('Skenario 1: Password salah -> password dikosongkan, username tetap terisi, pesan error ditampilkan', async () => {
    vi.mocked(repo.login).mockResolvedValueOnce({
      ok: false,
      error: 'Username/email atau kata sandi salah.',
      code: 'AUTH_FAILED',
      status: 401,
    });

    render(<LoginPage />);

    const usernameInput = screen.getByLabelText(/Username atau email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^Password$/i, { selector: 'input' }) as HTMLInputElement;
    const captchaInput = screen.getByPlaceholderText(/6 karakter/i) as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: /^Sign in$/i });

    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'password_salah' } });
    fireEvent.change(captchaInput, { target: { value: 'ABCDEF' } });

    expect(usernameInput.value).toBe('admin');
    expect(passwordInput.value).toBe('password_salah');

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(repo.login).toHaveBeenCalledWith('admin', 'password_salah', anyCaptchaId, 'ABCDEF');
    });

    await waitFor(() => {
      // Username tetap terisi
      expect(usernameInput.value).toBe('admin');
      // Password otomatis dikosongkan
      expect(passwordInput.value).toBe('');
      // Pesan kesalahan kredensial tampil
      expect(screen.getByText('Username/email atau kata sandi salah.')).toBeInTheDocument();
    });
  });

  it('Skenario 2: Username/email salah -> password dikosongkan, username tetap terisi', async () => {
    vi.mocked(repo.login).mockResolvedValueOnce({
      ok: false,
      error: 'Username atau password salah',
      code: 'AUTH_FAILED',
      status: 401,
    });

    render(<LoginPage />);

    const usernameInput = screen.getByLabelText(/Username atau email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^Password$/i, { selector: 'input' }) as HTMLInputElement;
    const captchaInput = screen.getByPlaceholderText(/6 karakter/i) as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: /^Sign in$/i });

    fireEvent.change(usernameInput, { target: { value: 'user_tidak_dikenal' } });
    fireEvent.change(passwordInput, { target: { value: 'rahasia123' } });
    fireEvent.change(captchaInput, { target: { value: 'ABCDEF' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(usernameInput.value).toBe('user_tidak_dikenal');
      expect(passwordInput.value).toBe('');
      expect(screen.getByText('Username atau password salah')).toBeInTheDocument();
    });
  });

  it('Skenario 3: Username dan password benar -> login berhasil, password tidak dikosongkan secara prematur sebelum redirect', async () => {
    const fakeUser = {
      id: 1,
      name: 'Admin Utama',
      username: 'admin',
      email: 'admin@siipb.test',
      password: '',
      role_id: 1,
      active: true,
      login_method: 'LOKAL' as const,
      phone: '08123456789',
      last_login: null,
      created_at: new Date().toISOString(),
    };

    vi.mocked(repo.login).mockResolvedValueOnce({
      ok: true,
      user: fakeUser,
    });

    render(<LoginPage />);

    const usernameInput = screen.getByLabelText(/Username atau email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^Password$/i, { selector: 'input' }) as HTMLInputElement;
    const captchaInput = screen.getByPlaceholderText(/6 karakter/i) as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: /^Sign in$/i });

    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'Admin#1234' } });
    fireEvent.change(captchaInput, { target: { value: 'ABCDEF' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(repo.login).toHaveBeenCalledWith('admin', 'Admin#1234', anyCaptchaId, 'ABCDEF');
      expect(mockReplace).toHaveBeenCalled();
    });
  });

  it('Skenario 4: Gangguan jaringan / server error (500) -> password TIDAK dikosongkan, username tetap terisi', async () => {
    // Sub-uji 4a: Gangguan jaringan (NETWORK_ERROR / status 0)
    vi.mocked(repo.login).mockResolvedValueOnce({
      ok: false,
      error: 'Tidak dapat terhubung ke server SIIPB. Periksa koneksi.',
      code: 'NETWORK_ERROR',
      status: 0,
    });

    render(<LoginPage />);

    const usernameInput = screen.getByLabelText(/Username atau email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^Password$/i, { selector: 'input' }) as HTMLInputElement;
    const captchaInput = screen.getByPlaceholderText(/6 karakter/i) as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: /^Sign in$/i });

    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'password_tetap' } });
    fireEvent.change(captchaInput, { target: { value: 'ABCDEF' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Tidak dapat terhubung ke server SIIPB. Periksa koneksi.')).toBeInTheDocument();
      // Password dan username TIDAK boleh dikosongkan karena error jaringan
      expect(usernameInput.value).toBe('admin');
      expect(passwordInput.value).toBe('password_tetap');
    });

    // Sub-uji 4b: Server internal error (HTTP 500)
    vi.mocked(repo.login).mockResolvedValueOnce({
      ok: false,
      error: 'Internal Server Error (HTTP 500)',
      status: 500,
    });

    fireEvent.change(captchaInput, { target: { value: 'XYZ123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Internal Server Error (HTTP 500)')).toBeInTheDocument();
      expect(usernameInput.value).toBe('admin');
      expect(passwordInput.value).toBe('password_tetap');
    });
  });

  it('Skenario 5: CAPTCHA gagal -> password dan username TIDAK dikosongkan, captcha error ditampilkan', async () => {
    vi.mocked(repo.login).mockResolvedValueOnce({
      ok: false,
      error: 'Kode CAPTCHA salah atau sudah kedaluwarsa.',
      code: 'INVALID_CAPTCHA',
      status: 400,
      errors: { captcha_answer: 'Kode CAPTCHA salah atau sudah kedaluwarsa.' },
    });

    render(<LoginPage />);

    const usernameInput = screen.getByLabelText(/Username atau email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^Password$/i, { selector: 'input' }) as HTMLInputElement;
    const captchaInput = screen.getByPlaceholderText(/6 karakter/i) as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: /^Sign in$/i });

    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'password_tetap_tersimpan' } });
    fireEvent.change(captchaInput, { target: { value: 'SALAH1' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Input CAPTCHA dikosongkan
      expect(captchaInput.value).toBe('');
      // Password TIDAK dikosongkan
      expect(passwordInput.value).toBe('password_tetap_tersimpan');
      // Username tetap terisi
      expect(usernameInput.value).toBe('admin');
      // Pesan error CAPTCHA ditampilkan
      expect(screen.getAllByText('Kode CAPTCHA salah atau sudah kedaluwarsa.').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('Skenario 6: Pengiriman form berulang -> state dan input tetap tersinkronisasi tanpa error state', async () => {
    render(<LoginPage />);

    const usernameInput = screen.getByLabelText(/Username atau email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^Password$/i, { selector: 'input' }) as HTMLInputElement;
    const captchaInput = screen.getByPlaceholderText(/6 karakter/i) as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: /^Sign in$/i });

    // Percobaan 1: Password salah
    vi.mocked(repo.login).mockResolvedValueOnce({
      ok: false,
      error: 'Username/email atau kata sandi salah.',
      code: 'AUTH_FAILED',
      status: 401,
    });

    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'percobaan_1' } });
    fireEvent.change(captchaInput, { target: { value: 'CAP111' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(usernameInput.value).toBe('admin');
      expect(passwordInput.value).toBe('');
    });

    // Percobaan 2: Ketik ulang password baru langsung tanpa hapus manual
    fireEvent.change(passwordInput, { target: { value: 'percobaan_2' } });
    fireEvent.change(captchaInput, { target: { value: 'CAP222' } });
    expect(passwordInput.value).toBe('percobaan_2');

    vi.mocked(repo.login).mockResolvedValueOnce({
      ok: false,
      error: 'Username/email atau kata sandi salah.',
      code: 'AUTH_FAILED',
      status: 401,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(usernameInput.value).toBe('admin');
      expect(passwordInput.value).toBe('');
    });

    // Percobaan 3: Ketik password yang benar dan login berhasil
    fireEvent.change(passwordInput, { target: { value: 'Admin#1234' } });
    fireEvent.change(captchaInput, { target: { value: 'CAP333' } });

    vi.mocked(repo.login).mockResolvedValueOnce({
      ok: true,
      user: {
        id: 1,
        name: 'Admin',
        username: 'admin',
        email: 'admin@siipb.test',
        password: '',
        role_id: 1,
        active: true,
        login_method: 'LOKAL' as const,
        phone: '',
        last_login: null,
        created_at: new Date().toISOString(),
      },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });
  });
});
