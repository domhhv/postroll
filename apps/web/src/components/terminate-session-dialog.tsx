import type { SessionDto } from '@postroll/contracts';
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

import { PendingButton } from '#components/pending-button';
import { logoutAction, revokeSessionAction } from '#lib/actions';

type TerminateSessionDialogProps = {
  device: string;
  open: boolean;
  session: SessionDto;
  onOpenChange: (open: boolean) => void;
};

export function TerminateSessionDialog({ device, onOpenChange, open, session }: TerminateSessionDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function terminate() {
    setError(null);
    startTransition(async () => {
      if (session.current) {
        await logoutAction();

        return;
      }

      const result = await revokeSessionAction(session.id);

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
          <DialogTitle>{session.current ? 'Sign Out' : 'Terminate session'}</DialogTitle>
          <DialogDescription>
            Are you sure you want to {session.current ? 'sign out? This' : 'terminate this session? The'} device will
            lose access to your account.
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
          <PendingButton
            pending={pending}
            onClick={terminate}
            variant="destructive"
            idle={session.current ? 'Sign Out' : 'Terminate'}
            pendingLabel={session.current ? 'Signing Out' : 'Terminating'}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
