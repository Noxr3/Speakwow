import Link from 'next/link';
import { GlassPanel, PageShell } from '@/components/app/page-shell';

export const metadata = { title: 'Terms of Service · Speakwow' };

const CONTACT = '0xbrad.agi@gmail.com';
const UPDATED = '17 October 2026';

const p = 'text-muted-foreground text-sm leading-relaxed';
const list = 'text-muted-foreground list-disc space-y-2 pl-5 text-sm leading-relaxed';

/** The rules for using the Speakwow service at speakwow.ai. */
export default function TermsPage() {
  return (
    <PageShell eyebrow={`Updated ${UPDATED}`} title="Terms of Service">
      <GlassPanel title="What Speakwow is">
        <p className={p}>
          Speakwow (speakwow.ai) lets you learn by talking with an AI teacher. The teachers are AI,
          not people. They can be wrong, so check anything important, and do not rely on them for
          medical, legal, financial or other professional advice. By using Speakwow you agree to
          these terms and to our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </GlassPanel>

      <GlassPanel title="Your account">
        <p className={p}>
          Keep your sign-in details to yourself; you are responsible for what happens in your
          account. If you are younger than the age at which you can agree to this on your own where
          you live, use Speakwow only with a parent&apos;s or guardian&apos;s permission.
        </p>
      </GlassPanel>

      <GlassPanel title="Using it fairly">
        <ul className={list}>
          <li>Do not use Speakwow to harm, harass or deceive anyone.</li>
          <li>Do not try to break, overload or get around the limits of the service.</li>
          <li>Do not use it for anything illegal where you live.</li>
        </ul>
      </GlassPanel>

      <GlassPanel title="Your words">
        <p className={p}>
          What you say and write stays yours. You let us process it to run your lessons, as the
          Privacy Policy describes.
        </p>
      </GlassPanel>

      <GlassPanel title="Open source">
        <p className={p}>
          Speakwow&apos;s code is open source under the MIT License, and you may run your own copy.
          These terms cover the service we run at speakwow.ai.
        </p>
      </GlassPanel>

      <GlassPanel title="Price">
        <p className={p}>
          Speakwow is free to use today. If you add your own model key, your model provider may
          charge you for what you use. If we ever introduce paid plans, we will tell you first.
        </p>
      </GlassPanel>

      <GlassPanel title="No guarantees">
        <p className={p}>
          We work to keep Speakwow running and accurate, but we provide it as it is, without
          warranties, and to the extent the law allows we are not liable for losses from using it.
          We may change or stop features, and we may suspend an account that breaks these terms. You
          can stop using Speakwow at any time and ask us to delete your account.
        </p>
      </GlassPanel>

      <GlassPanel title="Changes and contact">
        <p className={p}>
          If we change these terms, we will update the date at the top and say what changed.
          Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </GlassPanel>
    </PageShell>
  );
}
