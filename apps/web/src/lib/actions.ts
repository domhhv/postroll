'use server';

import {
  loginRequestSchema,
  registerRequestSchema,
  type UpdateUserRequest,
  updateUserRequestSchema,
  changePasswordRequestSchema,
} from '@postroll/contracts';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import {
  updateMe,
  GatewayError,
  registerUser,
  logoutGateway,
  revokeSession,
  updatePassword,
  loginAndCreateSession,
} from './api';
import { readRequestMeta } from './refresh';
import { deleteSession, readSessionCookie } from './session';
import { getFormValue } from './utils';

export type AuthFormState =
  | { status: 'idle' }
  | {
      fieldErrors?: Record<string, string>;
      message: string;
      status: 'error';
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

function toFormError(
  error: unknown,
  values: { email: string; password: string }
): Extract<AuthFormState, { status: 'error' }> {
  if (error instanceof GatewayError) {
    return { message: error.message, status: 'error', values };
  }

  if (error instanceof z.ZodError) {
    return {
      message: 'Unexpected response from gateway.',
      status: 'error',
      values,
    };
  }

  return {
    message: 'Something went wrong. Please try again.',
    status: 'error',
    values,
  };
}

export async function registerAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = {
    email: getFormValue(formData, 'email'),
    password: getFormValue(formData, 'password'),
  };
  const parsed = registerRequestSchema.safeParse(values);

  if (!parsed.success) {
    return {
      fieldErrors: extractFieldErrors(parsed.error),
      message: 'Please fix the errors below.',
      status: 'error',
      values,
    };
  }

  try {
    const meta = readRequestMeta(await headers());
    await registerUser(parsed.data);
    await loginAndCreateSession(parsed.data, meta);
  } catch (error) {
    return toFormError(error, values);
  }

  redirect('/dashboard');
}

export async function loginAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = {
    email: getFormValue(formData, 'email'),
    password: getFormValue(formData, 'password'),
  };
  const parsed = loginRequestSchema.safeParse(values);

  if (!parsed.success) {
    return {
      fieldErrors: extractFieldErrors(parsed.error),
      message: 'Please fix the errors below.',
      status: 'error',
      values,
    };
  }

  try {
    const meta = readRequestMeta(await headers());
    await loginAndCreateSession(parsed.data, meta);
  } catch (error) {
    return toFormError(error, values);
  }

  redirect('/dashboard');
}

export type AccountValues = { email: string; name: string; username: string };

export type AccountFormState =
  | { status: 'idle' }
  | { status: 'success'; values: AccountValues }
  | {
      fieldErrors?: Record<string, string>;
      message: string;
      status: 'error';
      values: AccountValues;
    };

export async function updateAccountAction(_previous: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const values = {
    email: getFormValue(formData, 'email'),
    name: getFormValue(formData, 'name'),
    username: getFormValue(formData, 'username'),
  };
  const input: UpdateUserRequest = {
    email: values.email,
    name: values.name === '' ? null : values.name,
    username: values.username === '' ? null : values.username,
  };
  const parsed = updateUserRequestSchema.safeParse(input);

  if (!parsed.success) {
    return {
      fieldErrors: extractFieldErrors(parsed.error),
      message: 'Please fix the errors below.',
      status: 'error',
      values,
    };
  }

  let updated: AccountValues;

  try {
    const user = await updateMe(parsed.data);
    updated = {
      email: user.email,
      name: user.name ?? '',
      username: user.username ?? '',
    };
  } catch (error) {
    if (error instanceof GatewayError) {
      return { message: error.message, status: 'error', values };
    }

    return {
      message: 'Something went wrong. Please try again.',
      status: 'error',
      values,
    };
  }

  revalidatePath('/account');

  return { status: 'success', values: updated };
}

export type PasswordFormState =
  | { status: 'idle' }
  | { status: 'success' }
  | {
      fieldErrors?: Record<string, string>;
      message: string;
      status: 'error';
    };

export async function changePasswordAction(
  _previous: PasswordFormState,
  formData: FormData
): Promise<PasswordFormState> {
  const parsed = changePasswordRequestSchema.safeParse({
    confirmPassword: getFormValue(formData, 'confirmPassword'),
    currentPassword: getFormValue(formData, 'currentPassword'),
    newPassword: getFormValue(formData, 'newPassword'),
    revokeOtherSessions: getFormValue(formData, 'revokeOtherSessions') === 'on',
  });

  if (!parsed.success) {
    return {
      fieldErrors: extractFieldErrors(parsed.error),
      message: 'Please fix the errors below.',
      status: 'error',
    };
  }

  try {
    await updatePassword(parsed.data);
  } catch (error) {
    if (error instanceof GatewayError) {
      if (error.status === 401) {
        return {
          fieldErrors: { currentPassword: error.message },
          message: 'Please fix the errors below.',
          status: 'error',
        };
      }

      return { message: error.message, status: 'error' };
    }

    return {
      message: 'Something went wrong. Please try again.',
      status: 'error',
    };
  }

  return { status: 'success' };
}

export async function logoutAction(): Promise<void> {
  const session = await readSessionCookie();

  if (session) {
    await logoutGateway(session);
  }

  await deleteSession();
  redirect('/login');
}

export type RevokeSessionResult = { status: 'success' } | { message: string; status: 'error' };

export async function revokeSessionAction(id: string): Promise<RevokeSessionResult> {
  try {
    await revokeSession(id);
  } catch (error) {
    if (error instanceof GatewayError) {
      return { message: error.message, status: 'error' };
    }

    return {
      message: 'Something went wrong. Please try again.',
      status: 'error',
    };
  }

  revalidatePath('/account');

  return { status: 'success' };
}
