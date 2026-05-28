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
import { type AuthFormState, registerAction } from '#lib/actions';
import { PendingButton } from './pending-button';

const initialState: AuthFormState = { status: 'idle' };

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;
  const emailError = fieldErrors?.['email'];
  const passwordError = fieldErrors?.['password'];
  const emailValue = state.status === 'error' ? state.values.email : undefined;
  const passwordValue =
    state.status === 'error' ? state.values.password : undefined;

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
            <FieldDescription>Enter your email address.</FieldDescription>
            {emailError && <FieldError errors={[{ message: emailError }]} />}
          </Field>
          <Field data-invalid={passwordError ? true : undefined}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <FieldDescription>
              Must be at least 8 characters long.
            </FieldDescription>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              placeholder="••••••••"
              minLength={8}
              required
              aria-invalid={passwordError ? true : undefined}
              defaultValue={passwordValue}
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
          <PendingButton
            idle="Create account"
            pendingLabel="Creating account"
            size="lg"
          />
          <FieldDescription className="text-center">
            Already have an account? <Link href="/login">Log in</Link>.
          </FieldDescription>
        </FieldGroup>
      </FieldSet>
    </form>
  );
}
