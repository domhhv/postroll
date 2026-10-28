import { Toaster } from '@postroll/ui/components/toast';
import { cn } from '@postroll/ui/lib/utils';
import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import { Roboto_Slab, Source_Sans_3 } from 'next/font/google';

import { Header } from '#components/header';

import '@postroll/ui/globals.css';

import { ThemeProvider } from '#components/theme-provider';

const robotoSlab = Roboto_Slab({
  subsets: ['latin'],
  variable: '--font-roboto-slab',
});

const sourceSans3 = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-source-sans-3',
});

export const metadata: Metadata = {
  description: 'Video files uploader, processor and analyzer',
  title: 'Postroll',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(robotoSlab.variable, sourceSans3.variable, 'h-full antialiased')}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <Toaster>
            <Header />
            <main className="bg-background flex flex-1 p-8 sm:p-16">{children}</main>
          </Toaster>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
