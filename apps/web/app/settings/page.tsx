import { PageShell } from '@/components/app/page-shell';
import { ByokForm } from '@/components/settings/byok-form';
import { PhoneForm } from '@/components/settings/phone-form';

export const metadata = { title: 'Settings · Speakwow' };

export default function SettingsPage() {
  return (
    <PageShell title="Settings">
      <div className="space-y-6">
        <PhoneForm />
        <ByokForm />
      </div>
    </PageShell>
  );
}
