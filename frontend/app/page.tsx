'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { homeFor } from '@/lib/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Spinner } from '@/components/ui/misc';

/** Arahkan ke halaman awal sesuai peran, atau ke login. */
export default function IndexPage() {
  const { user, can } = useAuth();
  const router = useRouter();
  useEffect(() => {
    router.replace(user ? homeFor(can) : '/login');
  });
  return <Spinner />;
}
