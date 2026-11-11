import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { AccountLinks } from '@/components/app/account-links';
import { AuthProvider } from '@/components/auth/auth-provider';
import { GuestMerge } from '@/components/auth/guest-merge';
import { getAppConfig, getStyles } from '@/lib/utils';
import '@/styles/globals.css';

export const viewport: Viewport = { themeColor: '#0c1715' };

export async function generateMetadata(): Promise<Metadata> {
  const appConfig = await getAppConfig(await headers());
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://speakwow.ai';
  return {
    metadataBase: new URL(siteUrl),
    applicationName: appConfig.companyName,
    title: appConfig.pageTitle,
    description: appConfig.pageDescription,
    appleWebApp: { capable: true, title: appConfig.companyName, statusBarStyle: 'default' },
    openGraph: {
      type: 'website',
      siteName: appConfig.companyName,
      title: appConfig.pageTitle,
      description: appConfig.pageDescription,
    },
    twitter: { card: 'summary_large_image', images: ['/opengraph-image'] },
  };
}

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);
  const styles = getStyles(appConfig);
  const logo = appConfig.logoDark || appConfig.logo;

  return (
    <html lang="en" className="dark font-sans antialiased">
      <head>{styles && <style>{styles}</style>}</head>
      <body className="overflow-x-hidden">
        <AuthProvider>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <header className="app-header">
            <div className="app-header-inner">
              <Link href="/" className="brand-link" aria-label="Speakwow home">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt="" width={28} height={28} className="h-7 w-7" />
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
