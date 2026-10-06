import { Suspense } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Spinner } from '@/components/ui/misc';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={<Spinner />}>{children}</Suspense>
    </AppShell>
  );
}
