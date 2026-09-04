import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ComponentProps } from 'react';

import { cn } from '../../lib/utils';

export function Tabs(props: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root {...props} />;
}

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('flex h-8 border-b border-[var(--pf-stroke)] bg-[var(--pf-layer)] px-2', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'min-w-20 border-b-2 border-transparent px-3 text-xs text-[var(--pf-text-secondary)] data-[state=active]:border-[var(--pf-accent)] data-[state=active]:font-semibold data-[state=active]:text-[var(--pf-accent)]',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('min-h-0 flex-1 outline-none', className)} {...props} />;
}
