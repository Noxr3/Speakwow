import { headers } from 'next/headers';
import Link from 'next/link';
import { AccountLinks } from '@/components/app/account-links';
import { AuthProvider } from '@/components/auth/auth-provider';
import { GuestMerge } from '@/components/auth/guest-merge';
import { getAppConfig, getStyles } from '@/lib/utils';
import '@/styles/globals.css';

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);
  const styles = getStyles(appConfig);
  const { pageTitle, pageDescription, logo } = appConfig;

  return (
    <html lang="en" className="dark font-sans antialiased">
      <head>
        {styles && <style>{styles}</style>}
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
      </head>
      <body className="overflow-x-hidden">
        <AuthProvider>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <header className="app-header">
            <div className="app-header-inner">
              <Link href="/" className="brand-link" aria-label="Speakwow home">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt="" className="h-7 w-7" />
                <span className="text-xl font-semibold tracking-tight">Speakwow</span>
              </Link>
              <AccountLinks />
            </div>
          </header>

          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <GuestMerge />
        </AuthProvider>
      </body>
    </html>
  );
}
