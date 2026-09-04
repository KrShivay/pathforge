import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] border px-2.5 text-[13px] font-normal transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--pf-accent)] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4',
  {
    variants: {
      variant: {
        default:
          'border-[var(--pf-accent)] bg-[var(--pf-accent)] text-white hover:bg-[var(--pf-accent-hover)]',
        secondary:
          'border-[var(--pf-stroke)] bg-[var(--pf-control)] text-[var(--pf-text)] hover:bg-[var(--pf-control-hover)]',
        ghost:
          'border-transparent bg-transparent text-[var(--pf-text)] hover:border-[var(--pf-stroke)] hover:bg-[var(--pf-control-hover)]',
      },
      size: {
        default: 'h-8 px-2.5',
        icon: 'size-8 p-0',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'default' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
