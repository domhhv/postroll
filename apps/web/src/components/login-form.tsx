'use client';

import { Field, FieldSet, FieldError, FieldGroup, FieldLabel, FieldDescription } from '@postroll/ui/components/field';
import { Input } from '@postroll/ui/components/input';
import { PasswordInput } from '@postroll/ui/components/password-input';
import Link from 'next/link';
import { useActionState } from 'react';

import { loginAction, type AuthFormState } from '#lib/actions';

import { PendingButton } from './pending-button';

const initialState: AuthFormState = { status: 'idle' };

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;
  const emailError = fieldErrors?.['email'];
  const passwordError = fieldErrors?.['password'];
  const emailValue = state.status === 'error' ? state.values.email : undefined;

  return (
    <form noValidate action={formAction} className="mx-auto w-full max-w-xs self-center">
      <FieldSet>
        <FieldGroup>
          <Field data-invalid={emailError ? true : undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              required
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={emailValue}
              placeholder="me@email.com"
              aria-invalid={emailError ? true : undefined}
            />
            {emailError && <FieldError errors={[{ message: emailError }]} />}
          </Field>
          <Field data-invalid={passwordError ? true : undefined}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput
              required
              id="password"
              name="password"
              placeholder="••••••••"
              autoComplete="current-password"
              aria-invalid={passwordError ? true : undefined}
            />
            {passwordError && <FieldError errors={[{ message: passwordError }]} />}
          </Field>
          {state.status === 'error' && !fieldErrors && (
            <p role="alert" className="text-destructive text-sm">
              {state.message}
            </p>
          )}
          <PendingButton size="lg" idle="Sign in" pendingLabel="Signing in" />
          <FieldDescription className="text-center">
            New here? <Link href="/register">Create an account</Link>.
          </FieldDescription>
        </FieldGroup>
      </FieldSet>
    </form>
  );
}
