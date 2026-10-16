import Link from 'next/link';
import { GlassPanel, PageShell } from '@/components/app/page-shell';

export const metadata = { title: 'Privacy Policy · Speakwow' };

const CONTACT = '0xbrad.agi@gmail.com';
const UPDATED = '17 October 2026';

const p = 'text-muted-foreground text-sm leading-relaxed';
const list = 'text-muted-foreground list-disc space-y-2 pl-5 text-sm leading-relaxed';

/** What Speakwow keeps about you, who handles it, and how to have it erased. */
export default function PrivacyPage() {
  return (
    <PageShell eyebrow={`Updated ${UPDATED}`} title="Privacy Policy">
      <GlassPanel title="Who we are">
        <p className={p}>
          Speakwow (speakwow.ai) is an open-source voice teacher: you talk with an AI teacher who
          remembers you from one lesson to the next. It is run by the Speakwow contributors. Write
          to <a href={`mailto:${CONTACT}`}>{CONTACT}</a> about anything on this page.
        </p>
      </GlassPanel>

      <GlassPanel title="What we keep">
        <ul className={list}>
          <li>
            <strong>Your account.</strong> Your email address. If you sign in with Google, we
            receive your name, email address and profile picture from Google, and nothing else.
          </li>
          <li>
            <strong>Your learning record.</strong> What you want the teacher to call you, your
            grade, level and goal, the course you chose and your progress in it.
          </li>
          <li>
            <strong>Your lessons.</strong> The text of what you and the teacher said, a short
            summary of each lesson, and the things the teacher remembers about you (for example that
            you have a cat, or a mistake you are working on). We do not record or keep the audio of
            your calls.
          </li>
          <li>
            <strong>Your phone, if you link one.</strong> The number, and the text or WhatsApp
            messages you exchange with the teacher.
          </li>
          <li>
            <strong>Your own model key, if you add one.</strong> It is encrypted and stored only in
            your browser; it is sent, still encrypted, with each call that uses it.
          </li>
        </ul>
        <p className={p}>
          If you talk to a teacher without signing in, nothing about the conversation is kept.
        </p>
      </GlassPanel>

      <GlassPanel title="How we use it">
        <p className={p}>
          Only to run your lessons: so the teacher can talk with you, remember you next time, and
          follow your progress. We do not sell your information, use it for advertising, or share it
          with anyone except the services below that run Speakwow.
        </p>
      </GlassPanel>

      <GlassPanel title="Services that handle it">
        <ul className={list}>
          <li>Supabase: database and sign-in. Your data is stored in Tokyo, Japan.</li>
          <li>Vercel: hosts the website.</li>
          <li>Railway: runs the teacher.</li>
          <li>LiveKit: carries the live audio of a call.</li>
          <li>
            xAI or OpenAI: the voice model. The audio and words of a call pass through it so the
            teacher can hear you and answer.
          </li>
          <li>
            Text models reached through the Vercel AI Gateway (such as DeepSeek): write lesson
            summaries and text-message replies.
          </li>
          <li>Twilio: phone calls and text messages, only if you use them.</li>
          <li>Google: sign-in, only if you choose it.</li>
        </ul>
      </GlassPanel>

      <GlassPanel title="Data from Google">
        <p className={p}>
          When you sign in with Google we use your name, email address and profile picture only to
          create and show your account. Speakwow&apos;s use of information received from Google APIs
          adheres to the{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. We do not use it to train AI models.
        </p>
      </GlassPanel>

      <GlassPanel title="Keeping and deleting">
        <p className={p}>
          We keep your information while you use Speakwow. You can erase what the teacher remembers
          about you at any time in your <Link href="/profile">Learning record</Link>, and unlink a
          phone in <Link href="/settings">Settings</Link>. To delete your account and everything in
          it, write to <a href={`mailto:${CONTACT}`}>{CONTACT}</a> from your account&apos;s email
          address; we delete it within 30 days.
        </p>
      </GlassPanel>

      <GlassPanel title="Children">
        <p className={p}>
          Many of our learners are school students. If you are younger than the age at which you can
          agree to this on your own where you live (14 in mainland China, 13 in the United States,
          up to 16 in parts of Europe), use Speakwow only with a parent&apos;s or guardian&apos;s
          permission. A parent or guardian can ask us to delete a child&apos;s information at any
          time.
        </p>
      </GlassPanel>

      <GlassPanel title="Security and changes">
        <p className={p}>
          Information travels encrypted, and each account can read only its own records. If we
          change this policy, we will update the date at the top and say what changed.
        </p>
      </GlassPanel>
    </PageShell>
  );
}
