import Link from 'next/link';

/** Two slow colour glows behind a page, so its glass panels have something to show through. */
export function PageBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-[#00ff6a]/15 blur-[120px]" />
      <div className="absolute top-1/3 -right-40 h-[560px] w-[560px] rounded-full bg-[#2c7be2]/20 blur-[140px]" />
      <div className="absolute -bottom-48 left-1/4 h-[420px] w-[420px] rounded-full bg-[#9b5de5]/12 blur-[130px]" />
    </div>
  );
}

interface PageShellProps {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}

/** The layout every inner page shares: back link, heading block, a column of panels. */
export function PageShell({ eyebrow, title, subtitle, children }: PageShellProps) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-28 pb-24 md:pt-32">
      <PageBackdrop />
      <Link href="/" className="label-mono hover:text-foreground text-white/50 transition-colors">
        ← Back
      </Link>
      <header className="mt-8 mb-10 space-y-3">
        {eyebrow && <p className="label-mono text-white/45">{eyebrow}</p>}
        <h1 className="text-foreground text-4xl leading-[1.05] font-medium md:text-5xl">{title}</h1>
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
    <section className="glass space-y-5 rounded-3xl p-6 md:p-7">
      <div className="space-y-1.5">
        <h2 className="text-foreground text-lg font-medium">{title}</h2>
        {description && (
          <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
