'use client';

import type { UserDto } from '@postroll/contracts';
import { Alert, AlertTitle, AlertDescription } from '@postroll/ui/components/alert';
import { Button } from '@postroll/ui/components/button';
import { Field, FieldError, FieldLabel } from '@postroll/ui/components/field';
import { Input } from '@postroll/ui/components/input';
import { IconAlertSquareRounded } from '@tabler/icons-react';
import { useState, useEffect, useActionState } from 'react';

import { PendingButton } from '#components/pending-button';
import { updateSettingsAction, type SettingsFormState } from '#lib/actions';

export const profileInitialState: SettingsFormState = { status: 'idle' };

const profileFields = [
  {
    autoComplete: 'email',
    label: 'Email',
    name: 'email',
    placeholder: 'me@email.com',
    type: 'email',
  },
  {
    autoComplete: 'name',
    label: 'Name',
    name: 'name',
    placeholder: 'Not set',
    type: 'text',
  },
  {
    autoComplete: 'username',
    label: 'Username',
    name: 'username',
    placeholder: 'Not set',
    type: 'text',
  },
] as const;

export function ProfileForm({ user }: { user: UserDto }) {
  const [state, formAction] = useActionState(updateSettingsAction, profileInitialState);
  const [editing, setEditing] = useState(false);

  const values =
    state.status === 'idle'
      ? {
          email: user.email,
          name: user.name ?? '',
          username: user.username ?? '',
        }
      : state.values;

  useEffect(() => {
    if (state.status === 'success') {
      setEditing(false);
    }
  }, [state]);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  if (!editing) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => setEditing(true)}>
          Edit details
        </Button>
        <dl className="space-y-4">
          {profileFields.map((field) => {
            const value = values[field.name];

            return (
              <div key={field.name} className="space-y-1">
                <dt className="text-muted-foreground text-sm">{field.label}</dt>
                <dd className={value ? 'text-foreground' : 'text-muted-foreground'}>{value || field.placeholder}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    );
  }

  return (
    <form noValidate action={formAction} className="space-y-6">
      <div className="flex gap-2">
        <PendingButton idle="Save" pendingLabel="Saving" />
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      <div className="space-y-4">
        {profileFields.map((field) => {
          const error = fieldErrors?.[field.name];

          return (
            <Field key={field.name} data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                type={field.type}
                placeholder={field.placeholder}
                autoComplete={field.autoComplete}
                defaultValue={values[field.name]}
                aria-invalid={error ? true : undefined}
              />
              {error && <FieldError errors={[{ message: error }]} />}
            </Field>
          );
        })}
      </div>
      {state.status === 'error' && !fieldErrors && (
        <Alert variant="destructive">
          <IconAlertSquareRounded />
          <AlertTitle>Failed to sign create workspace</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
