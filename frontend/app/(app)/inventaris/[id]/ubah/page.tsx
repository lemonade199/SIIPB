'use client';

import { useParams } from 'next/navigation';
import { ItemForm } from '@/components/domain/item-form';

export default function EditItemPage() {
  const { id } = useParams<{ id: string }>();
  return <ItemForm key={id} id={Number(id)} />;
}
