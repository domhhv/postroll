import type { ButtonProps } from '@postroll/ui/components/button';
import { cn } from '@postroll/ui/lib/utils';
import Form from 'next/form';

import { PendingButton } from '#components/pending-button';
import { logoutAction } from '#lib/actions';

type LogoutFormProps = {
  className?: string;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
};

export function LogoutForm({ className, size = 'default', variant = 'ghost' }: LogoutFormProps) {
  return (
    <Form action={logoutAction}>
      <PendingButton
        size={size}
        type="submit"
        idle="Sign Out"
        variant={variant}
        pendingLabel="Signing Out"
        className={cn(
          'hover:bg-muted hover:text-foreground focus-visible:bg-muted text-destructive hover:text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10',
          'flex w-full items-center justify-start rounded-sm px-2 py-1.5 text-sm focus-visible:outline-none',
          className
        )}
      />
    </Form>
  );
}
