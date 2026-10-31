import { Button } from '@postroll/ui/components/button';
import {
  Dialog,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogContent,
  DialogDescription,
} from '@postroll/ui/components/dialog';
import { toast } from '@postroll/ui/components/toast';
import { useState, useTransition } from 'react';

import { revokeSessionAction } from '#lib/actions';

export function TerminateSessionDialog({
  device,
  onOpenChange,
  open,
  sessionId,
}: {
  device: string;
  open: boolean;
  sessionId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function terminate() {
    setError(null);
    startTransition(async () => {
      const result = await revokeSessionAction(sessionId);

      if (result.status === 'error') {
        setError(result.message);

        return;
      }

      onOpenChange(false);
      toast.add({
        description: `${device} has been signed out.`,
        title: 'Session terminated',
        type: 'success',
      });
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) {
          return;
        }

        setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Terminate session</DialogTitle>
          <DialogDescription>
            Are you sure you want to terminate this session? The device will lose access to your account.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              return onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button disabled={pending} onClick={terminate} variant="destructive">
            {pending ? 'Terminating…' : 'Terminate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
