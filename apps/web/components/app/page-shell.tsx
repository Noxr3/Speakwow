import Link from 'next/link';
import { AppBackdrop } from '@/components/app/app-backdrop';
import { LiquidGlass } from '@/components/ui/liquid-glass';

/** The shared Aurora background for home and inner pages. */
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

/** The layout every inner page shares: back link, heading block, a column of panels. */
export function PageShell({
  eyebrow,
  breadcrumb,
  title,
  subtitle,
  children,
  wide = false,
}: PageShellProps) {
  return (
    <div className={`mx-auto w-full ${wide ? 'max-w-6xl' : 'max-w-2xl'} px-4 pt-28 pb-24 md:pt-32`}>
      <PageBackdrop />
      {breadcrumb ?? (
        <Link href="/" className="label-mono hover:text-foreground text-white/50 transition-colors">
          ← Back
        </Link>
      )}
      <header className="mt-8 mb-10 space-y-3">
        {eyebrow && <p className="label-mono text-white/45">{eyebrow}</p>}
        <h1 className="text-foreground text-2xl font-medium md:text-3xl">{title}</h1>
        {subtitle && (
          <p className="text-muted-foreground max-w-prose text-[15px] leading-relaxed">
            {subtitle}
          </p>
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

export function GlassPanel({ title, description, children }: GlassPanelProps) {
  return (
    <LiquidGlass radius={28} tint={0.88}>
      <section className="space-y-5 p-6 md:p-7">
        <div className="space-y-1.5">
          <h2 className="text-foreground text-lg font-medium">{title}</h2>
          {description && (
            <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
          )}
        </div>
        {children}
      </section>
    </LiquidGlass>
  );
}
