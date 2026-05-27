'use server';

import { loginRequestSchema, registerRequestSchema } from '@postroll/contracts';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  GatewayError,
  loginAndCreateSession,
  logoutGateway,
  registerUser,
} from './api';
import { deleteSession, readSessionCookie } from './session';

export type AuthFormState =
  | { status: 'idle' }
  | {
      status: 'error';
      message: string;
      fieldErrors?: Record<string, string>;
      values: { email: string; password?: string };
    };

type Credentials = { email: string; password: string };

function extractFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (typeof field === 'string' && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

function readCredentials(formData: FormData): Credentials {
  const email = formData.get('email');
  const password = formData.get('password');

  return {
    email: typeof email === 'string' ? email : '',
    password: typeof password === 'string' ? password : '',
  };
}

function toFormError(
  error: unknown,
  values: Credentials,
): Extract<AuthFormState, { status: 'error' }> {
  if (error instanceof GatewayError) {
    return { status: 'error', message: error.message, values };
  }

  if (error instanceof z.ZodError) {
    return {
      status: 'error',
      message: 'Unexpected response from gateway.',
      values,
    };
  }

  return {
    status: 'error',
    message: 'Something went wrong. Please try again.',
    values,
  };
}

export async function registerAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = readCredentials(formData);
  const parsed = registerRequestSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please fix the errors below.',
      fieldErrors: extractFieldErrors(parsed.error),
      values,
    };
  }

  try {
    await registerUser(parsed.data);
    await loginAndCreateSession(parsed.data);
  } catch (error) {
    return toFormError(error, values);
  }

  redirect('/dashboard');
}

export async function loginAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = readCredentials(formData);
  const parsed = loginRequestSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please fix the errors below.',
      fieldErrors: extractFieldErrors(parsed.error),
      values,
    };
  }

  try {
    await loginAndCreateSession(parsed.data);
  } catch (error) {
    return toFormError(error, values);
  }

  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  const session = await readSessionCookie();

  if (session) {
    await logoutGateway(session);
  }

  await deleteSession();
  redirect('/login');
}
