import type { Metadata } from 'next';
import { Roboto_Slab, Source_Sans_3 } from 'next/font/google';
import { Header } from '#components/header';
import { ThemeProvider } from '#components/theme-provider';

import '@postroll/ui/globals.css';

const robotoSlab = Roboto_Slab({
  variable: '--font-roboto-slab',
  subsets: ['latin'],
});

const sourceSans3 = Source_Sans_3({
  variable: '--font-source-sans-3',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Postroll',
  description: 'Video files uploader, processor and analyzer',
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
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <Header />
          <main className="flex flex-1 p-16 bg-background">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
