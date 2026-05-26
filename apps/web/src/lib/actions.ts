'use server';

import { loginRequestSchema, registerRequestSchema } from '@postroll/contracts';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  GatewayError,
  loginAndCreateSession,
  logoutGateway,
  registerUser,
} from '@/lib/api';
import { deleteSession, readSessionCookie } from '@/lib/session';

export type AuthFormState =
  | { status: 'idle' }
  | {
      status: 'error';
      message: string;
      fieldErrors?: Record<string, string>;
      values: { email: string; password?: string };
    };

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

function readCredentials(formData: FormData): {
  email: string;
  password: string;
} {
  const email = formData.get('email');
  const password = formData.get('password');
  return {
    email: typeof email === 'string' ? email : '',
    password: typeof password === 'string' ? password : '',
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

  let registered = false;
  try {
    await registerUser(parsed.data);
    registered = true;
    await loginAndCreateSession(parsed.data);
  } catch (error) {
    if (registered) {
      return {
        status: 'error',
        message: 'Account created. Please sign in to continue.',
        values,
      };
    }
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
