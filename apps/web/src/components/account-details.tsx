'use client';

import type { UserDto } from '@postroll/contracts';
import { Button } from '@postroll/ui/components/button';
import { Field, FieldError, FieldLabel } from '@postroll/ui/components/field';
import { Input } from '@postroll/ui/components/input';
import { PasswordInput } from '@postroll/ui/components/password-input';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@postroll/ui/components/tabs';
import { useActionState, useEffect, useState } from 'react';
import {
  type AccountFormState,
  changePasswordAction,
  type PasswordFormState,
  updateAccountAction,
} from '#lib/actions';
import { PendingButton } from './pending-button';

type AccountDetailsProps = {
  user: UserDto;
};

export const profileInitialState: AccountFormState = { status: 'idle' };
const passwordInitialState: PasswordFormState = { status: 'idle' };

const profileFields = [
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    autoComplete: 'email',
    placeholder: 'me@email.com',
  },
  {
    name: 'name',
    label: 'Name',
    type: 'text',
    autoComplete: 'name',
    placeholder: 'Not set',
  },
  {
    name: 'username',
    label: 'Username',
    type: 'text',
    autoComplete: 'username',
    placeholder: 'Not set',
  },
] as const;

function ProfileTab({ user }: { user: UserDto }) {
  const [state, formAction] = useActionState(
    updateAccountAction,
    profileInitialState,
  );
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
  }, [state.status]);

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
                <dt className="text-sm text-muted-foreground">{field.label}</dt>
                <dd
                  className={
                    value ? 'text-foreground' : 'text-muted-foreground'
                  }
                >
                  {value || field.placeholder}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
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
                autoComplete={field.autoComplete}
                placeholder={field.placeholder}
                defaultValue={values[field.name]}
                aria-invalid={error ? true : undefined}
              />
              {error && <FieldError errors={[{ message: error }]} />}
            </Field>
          );
        })}
      </div>
      {state.status === 'error' && !fieldErrors && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}

function SecurityTab() {
  const [state, formAction] = useActionState(
    changePasswordAction,
    passwordInitialState,
  );
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (state.status === 'success') {
      setEditing(false);
    }
  }, [state.status]);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  if (!editing) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => setEditing(true)}>
          Update password
        </Button>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Password</p>
          <p className="text-foreground tracking-widest">{'•'.repeat(8)}</p>
        </div>
      </div>
    );
  }

  const newPasswordError = fieldErrors?.['newPassword'];
  const confirmPasswordError = fieldErrors?.['confirmPassword'];

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="flex gap-2">
        <PendingButton idle="Save" pendingLabel="Saving…" />
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      <div className="space-y-4">
        <Field data-invalid={newPasswordError ? true : undefined}>
          <FieldLabel htmlFor="newPassword">New password</FieldLabel>
          <PasswordInput
            id="newPassword"
            name="newPassword"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={newPasswordError ? true : undefined}
          />
          {newPasswordError && (
            <FieldError errors={[{ message: newPasswordError }]} />
          )}
        </Field>
        <Field data-invalid={confirmPasswordError ? true : undefined}>
          <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={confirmPasswordError ? true : undefined}
          />
          {confirmPasswordError && (
            <FieldError errors={[{ message: confirmPasswordError }]} />
          )}
        </Field>
      </div>
      {state.status === 'error' && !fieldErrors && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function AccountDetails({ user }: AccountDetailsProps) {
  return (
    <Tabs defaultValue="profile">
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
      </TabsList>
      <TabsContent value="profile" className="pt-4">
        <ProfileTab user={user} />
      </TabsContent>
      <TabsContent value="security" className="pt-4">
        <SecurityTab />
      </TabsContent>
    </Tabs>
  );
}
