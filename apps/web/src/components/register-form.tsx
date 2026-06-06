'use client';

import { Field, FieldSet, FieldError, FieldGroup, FieldLabel, FieldDescription } from '@postroll/ui/components/field';
import { Input } from '@postroll/ui/components/input';
import { PasswordInput } from '@postroll/ui/components/password-input';
import Link from 'next/link';
import { useActionState } from 'react';

import { registerAction, type AuthFormState } from '#lib/actions';

import { PendingButton } from './pending-button';

const initialState: AuthFormState = { status: 'idle' };

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;
  const emailError = fieldErrors?.['email'];
  const passwordError = fieldErrors?.['password'];
  const emailValue = state.status === 'error' ? state.values.email : undefined;
  const passwordValue = state.status === 'error' ? state.values.password : undefined;

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
            <FieldDescription>Enter your email address.</FieldDescription>
            {emailError && <FieldError errors={[{ message: emailError }]} />}
          </Field>
          <Field data-invalid={passwordError ? true : undefined}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <FieldDescription>Must be at least 8 characters long.</FieldDescription>
            <PasswordInput
              required
              id="password"
              minLength={8}
              name="password"
              placeholder="••••••••"
              autoComplete="new-password"
              defaultValue={passwordValue}
              aria-invalid={passwordError ? true : undefined}
            />
            {passwordError && <FieldError errors={[{ message: passwordError }]} />}
          </Field>
          {state.status === 'error' && !fieldErrors && (
            <p role="alert" className="text-destructive text-sm">
              {state.message}
            </p>
          )}
          <PendingButton size="lg" idle="Create account" pendingLabel="Creating account" />
          <FieldDescription className="text-center">
            Already have an account? <Link href="/login">Log in</Link>.
          </FieldDescription>
        </FieldGroup>
      </FieldSet>
    </form>
  );
}
