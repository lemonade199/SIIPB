import type { Metadata, Viewport } from 'next';
import { FeedbackProvider } from '@/components/providers/feedback-provider';
import { DataProvider } from '@/components/providers/data-provider';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'SIIPB', template: '%s — SIIPB' },
  description: 'Sistem Informasi Inventaris Barang, Peminjaman, dan Pengembalian Barang',
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23567c8d' stroke-width='2'%3E%3Cpath d='M21 8l-9-5-9 5 9 5 9-5z'/%3E%3Cpath d='M3 8v8l9 5 9-5V8'/%3E%3Cpath d='M12 13v8'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#2f4156' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <FeedbackProvider>
          <DataProvider>{children}</DataProvider>
        </FeedbackProvider>
      </body>
    </html>
  );
}
