import { redirect } from 'next/navigation';
import { RegisterForm } from '#components/register-form';
import { verifySession } from '#lib/dal';

export const metadata = {
  title: 'Postroll | Create account',
  description: 'Create a new account on Postroll',
};

export default async function RegisterPage() {
  const session = await verifySession();
  if (session) {
    redirect('/dashboard');
  }
  return <RegisterForm />;
}
