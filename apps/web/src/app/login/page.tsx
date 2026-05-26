import { redirect } from 'next/navigation';
import { LoginForm } from '#components/login-form';
import { verifySession } from '#lib/dal';

export const metadata = {
  title: 'Postroll | Sign in',
  description: 'Sign in to Postroll',
};

export default async function LoginPage() {
  const session = await verifySession();
  if (session) {
    redirect('/dashboard');
  }
  return <LoginForm />;
}
