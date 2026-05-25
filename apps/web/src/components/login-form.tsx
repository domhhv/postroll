'use client';

import { Button } from '@postroll/ui/components/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@postroll/ui/components/field';
import { Input } from '@postroll/ui/components/input';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AuthFormState, loginAction } from '#lib/actions';

const initialState: AuthFormState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </Button>
  );
}

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
            <Input
              id="password"
              name="password"
              type="password"
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
          <SubmitButton />
          <FieldDescription className="text-center">
            New here? <a href="/register">Create an account</a>.
          </FieldDescription>
        </FieldGroup>
      </FieldSet>
    </form>
  );
}
