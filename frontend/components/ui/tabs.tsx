'use client';

import { Tabs as TabsPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabDef<K extends string> {
  key: K;
  label: ReactNode;
  count?: number;
}

/** shadcn/ui Tabs (Radix) — dipakai sebagai filter daftar (konten dirender di luar). */
export function Tabs<K extends string>({ tabs, value, onChange, className, label }: { tabs: TabDef<K>[]; value: K; onChange: (k: K) => void; className?: string; label?: string }) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={(v) => onChange(v as K)} activationMode="manual">
      <TabsPrimitive.List data-slot="tabs-list" aria-label={label} className={cn('tabs', className)} style={{ padding: '0 12px' }}>
        {tabs.map((t) => (
          <TabsPrimitive.Trigger key={t.key} value={t.key} data-slot="tabs-trigger" className="data-[state=active]:active">
            {t.label} {t.count !== undefined && <span className="pill">{t.count}</span>}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}
