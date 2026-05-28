'use client';

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@postroll/ui/components/field';
import { Input } from '@postroll/ui/components/input';
import { PasswordInput } from '@postroll/ui/components/password-input';
import Link from 'next/link';
import { useActionState } from 'react';
import { type AuthFormState, loginAction } from '#lib/actions';
import { PendingButton } from './pending-button';

const initialState: AuthFormState = { status: 'idle' };

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;
  const emailError = fieldErrors?.['email'];
  const passwordError = fieldErrors?.['password'];
  const emailValue = state.status === 'error' ? state.values.email : undefined;

  return (
    <form
      action={formAction}
      className="w-full mx-auto max-w-xs self-center"
      noValidate
    >
      <FieldSet>
        <FieldGroup>
          <Field data-invalid={emailError ? true : undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="me@email.com"
              required
              defaultValue={emailValue}
              aria-invalid={emailError ? true : undefined}
            />
            {emailError && <FieldError errors={[{ message: emailError }]} />}
          </Field>
          <Field data-invalid={passwordError ? true : undefined}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              aria-invalid={passwordError ? true : undefined}
            />
            {passwordError && (
              <FieldError errors={[{ message: passwordError }]} />
            )}
          </Field>
          {state.status === 'error' && !fieldErrors && (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}
          <PendingButton idle="Sign in" pendingLabel="Signing in" size="lg" />
          <FieldDescription className="text-center">
            New here? <Link href="/register">Create an account</Link>.
          </FieldDescription>
        </FieldGroup>
      </FieldSet>
    </form>
  );
}
