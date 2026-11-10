import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { AppBackdrop } from '@/components/app/app-backdrop';

export function PageBackdrop() {
  return <AppBackdrop muted />;
}

interface PageShellProps {
  wide?: boolean;
  eyebrow?: string;
  breadcrumb?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}

export function PageShell({
  eyebrow,
  breadcrumb,
  title,
  subtitle,
  children,
  wide = false,
}: PageShellProps) {
  return (
    <div className={'page-grid ' + (wide ? '' : 'page-grid-narrow')}>
      <PageBackdrop />
      {breadcrumb ?? (
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-1 text-[15px]"
        >
          <ChevronLeft size={18} aria-hidden="true" /> Home
        </Link>
      )}
      <header className="page-heading space-y-3">
        {eyebrow && <p className="label-caption text-muted-foreground">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {subtitle && (
          <p className="text-muted-foreground max-w-prose text-base leading-relaxed">{subtitle}</p>
        )}
      </header>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

interface GlassPanelProps {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}

// Kept as the shared panel API; content uses an opaque standard material.
export function GlassPanel({ title, description, children }: GlassPanelProps) {
  return (
    <div className="content-panel">
      <section className="panel-padding space-y-5">
        <div className="space-y-2">
          <h2 className="section-title">{title}</h2>
          {description && (
            <p className="text-muted-foreground text-base leading-relaxed">{description}</p>
          )}
        </div>
        {children}
      </section>
    </div>
  );
}
