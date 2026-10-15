import Link from 'next/link';
import { ByokForm } from '@/components/settings/byok-form';

export const metadata = { title: 'Settings · Speakwow' };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-xl space-y-8 px-4 py-24">
      <div>
        <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
          ← Back to your teacher
        </Link>
        <h1 className="text-foreground mt-4 text-3xl font-bold">Settings</h1>
      </div>
      <ByokForm />
    </div>
  );
}
