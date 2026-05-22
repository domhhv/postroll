'use server';

import { registerRequestSchema } from '@postroll/contracts';
import { z } from 'zod';
import { GatewayError, registerUser } from '@/lib/api';

export type RegisterFormState =
  | { status: 'idle' }
  | {
      status: 'error';
      message: string;
      fieldErrors?: Record<string, string>;
      values: { email: string; password?: string };
    }
  | { status: 'success'; email: string };

export async function registerAction(
  _previous: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const email = formData.get('email');
  const password = formData.get('password');
  const values = {
    email: typeof email === 'string' ? email : '',
    password: typeof password === 'string' ? password : '',
  };

  const parsed = registerRequestSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return {
      status: 'error',
      message: 'Please fix the errors below.',
      fieldErrors,
      values,
    };
  }

  try {
    await registerUser(parsed.data);
    return { status: 'success', email: parsed.data.email };
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
}
