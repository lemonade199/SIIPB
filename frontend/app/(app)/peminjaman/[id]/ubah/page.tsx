'use client';

import { useParams } from 'next/navigation';
import { BorrowForm } from '@/components/domain/borrow-form';

export default function EditBorrowingPage() {
  const { id } = useParams<{ id: string }>();
  return <BorrowForm key={id} id={Number(id)} />;
}
