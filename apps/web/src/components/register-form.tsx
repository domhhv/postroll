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
import { type RegisterFormState, registerAction } from '#lib/actions';

const initialState: RegisterFormState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Creating account…' : 'Create account'}
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState);

  if (state.status === 'success') {
    return (
      <div className="w-full mx-auto max-w-xs self-center space-y-2">
        <h2 className="text-xl font-semibold">Account created</h2>
        <p className="text-muted-foreground">Welcome aboard, {state.email}.</p>
      </div>
    );
  }

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
            <Input
              id="password"
              name="password"
              type="password"
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
          <SubmitButton />
        </FieldGroup>
      </FieldSet>
    </form>
  );
}
