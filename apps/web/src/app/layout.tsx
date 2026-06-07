import type { Metadata } from 'next';
import { Roboto_Slab, Source_Sans_3 } from 'next/font/google';

import { Header } from '#components/header';
import { ThemeProvider } from '#components/theme-provider';

import '@postroll/ui/globals.css';

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
      className={`${robotoSlab.variable} ${sourceSans3.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <Header />
          <main className="bg-background flex flex-1 p-16">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
