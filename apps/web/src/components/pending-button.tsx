import { Button, type ButtonProps } from '@postroll/ui/components/button';
import { HourglassLoader } from '@postroll/ui/components/hourglass-loader';
import { cn } from '@postroll/ui/lib/utils';
import { useFormStatus } from 'react-dom';

type PendingButtonProps = {
  idle: string;
  pendingLabel: string;
} & ButtonProps;

export function PendingButton({
  idle,
  pendingLabel,
  className,
  ...props
}: PendingButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      {...props}
      type="submit"
      className={cn('flex items-center gap-2', className)}
      disabled={pending}
    >
      {pending ? pendingLabel : idle}
      {pending && <HourglassLoader />}
    </Button>
  );
}
