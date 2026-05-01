import { prisma } from '@postroll/database';

export default async function Home() {
  const userCount = await prisma.user.count();

  return (
    <main className="flex flex-1 w-full flex-col items-center gap-4 py-24 px-16 bg-gray-100 dark:bg-gray-800 sm:items-start text-center">
      <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
        Postroll
      </h1>
      <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        Coming soon to a browser near you.
      </p>
      <p>There are {userCount} users in the database.</p>
    </main>
  );
}
