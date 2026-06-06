import { redirect } from 'next/navigation';

import { RegisterForm } from '#components/register-form';
import { verifySession } from '#lib/dal';

export const metadata = {
  description: 'Create a new account on Postroll',
  title: 'Postroll | Create Account',
};

export default async function RegisterPage() {
  const session = await verifySession();

  if (session) {
    redirect('/dashboard');
  }

  return <RegisterForm />;
}
