import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Providers } from './providers';
import { auth } from '@/auth';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Repo Audit — Azure DevOps dependency review',
  description:
    'Audit Azure DevOps repositories across all projects for vulnerable and suspicious packages.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="font-sans flex min-h-full flex-col bg-background text-foreground">
        <Providers session={session}>
          <Navbar />
          <main className="flex flex-1 flex-col">{children}</main>
          <footer className="mt-12 border-t border-hairline bg-card/40">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row md:px-8">
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span className="font-medium text-foreground/80">Repo Audit</span>
                <span aria-hidden>·</span>
                <span>
                  Vulnerability data from{' '}
                  <a
                    href="https://osv.dev"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    OSV.dev
                  </a>
                </span>
              </p>
              <p className="text-[11px]">
                Azure credentials are read from server environment variables only.
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
