'use server';

import {
  changePasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  type UpdateUserRequest,
  updateUserRequestSchema,
} from '@postroll/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  GatewayError,
  loginAndCreateSession,
  logoutGateway,
  registerUser,
  updateMe,
  updatePassword,
} from './api';
import { deleteSession, readSessionCookie } from './session';
import { getFormValue } from './utils';

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

function toFormError(
  error: unknown,
  values: { email: string; password: string },
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
  const values = {
    email: getFormValue(formData, 'email'),
    password: getFormValue(formData, 'password'),
  };
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
  const values = {
    email: getFormValue(formData, 'email'),
    password: getFormValue(formData, 'password'),
  };
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

export type AccountValues = { email: string; name: string; username: string };

export type AccountFormState =
  | { status: 'idle' }
  | { status: 'success'; values: AccountValues }
  | {
      status: 'error';
      message: string;
      fieldErrors?: Record<string, string>;
      values: AccountValues;
    };

export async function updateAccountAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
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
      status: 'error',
      message: 'Please fix the errors below.',
      fieldErrors: extractFieldErrors(parsed.error),
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
      return { status: 'error', message: error.message, values };
    }

    return {
      status: 'error',
      message: 'Something went wrong. Please try again.',
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
      status: 'error';
      message: string;
      fieldErrors?: Record<string, string>;
    };

export async function changePasswordAction(
  _previous: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const parsed = changePasswordRequestSchema.safeParse({
    currentPassword: getFormValue(formData, 'currentPassword'),
    newPassword: getFormValue(formData, 'newPassword'),
    confirmPassword: getFormValue(formData, 'confirmPassword'),
    revokeOtherSessions: getFormValue(formData, 'revokeOtherSessions') === 'on',
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please fix the errors below.',
      fieldErrors: extractFieldErrors(parsed.error),
    };
  }

  try {
    await updatePassword(parsed.data);
  } catch (error) {
    if (error instanceof GatewayError) {
      if (error.status === 401) {
        return {
          status: 'error',
          message: 'Please fix the errors below.',
          fieldErrors: { currentPassword: error.message },
        };
      }

      return { status: 'error', message: error.message };
    }

    return {
      status: 'error',
      message: 'Something went wrong. Please try again.',
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
