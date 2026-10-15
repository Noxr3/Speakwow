import { Bricolage_Grotesque, Hanken_Grotesk } from 'next/font/google';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import Link from 'next/link';
import { AccountLinks } from '@/components/app/account-links';
import { AuthProvider } from '@/components/auth/auth-provider';
import { cn } from '@/lib/shadcn/utils';
import { getAppConfig, getStyles } from '@/lib/utils';
import '@/styles/globals.css';

// Type system: Bricolage Grotesque for headings (warm, a little characterful),
// Hanken Grotesk for reading, CommitMono for labels and teacher names.
const display = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const sans = Hanken_Grotesk({
  variable: '--font-hanken',
  subsets: ['latin'],
});

const commitMono = localFont({
  display: 'swap',
  variable: '--font-commit-mono',
  src: [
    {
      path: '../fonts/CommitMono-400-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/CommitMono-700-Regular.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../fonts/CommitMono-400-Italic.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../fonts/CommitMono-700-Italic.otf',
      weight: '700',
      style: 'italic',
    },
  ],
});

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);
  const styles = getStyles(appConfig);
  const { pageTitle, pageDescription, logo } = appConfig;

  return (
    <html
      lang="en"
      className={cn(
        display.variable,
        sans.variable,
        commitMono.variable,
        'dark scroll-smooth font-sans antialiased'
      )}
    >
      <head>
        {styles && <style>{styles}</style>}
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
      </head>
      <body className="overflow-x-hidden">
        <AuthProvider>
          <header className="fixed top-0 left-0 z-50 flex w-full flex-row items-center justify-between p-4 md:p-6">
            <Link href="/" className="scale-100 transition-transform duration-300 hover:scale-110">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="Speakwow Logo" className="h-6 w-auto" />
            </Link>
            <AccountLinks />
          </header>

          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
