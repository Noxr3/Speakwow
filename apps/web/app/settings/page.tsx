import { PageShell } from '@/components/app/page-shell';
import { ByokForm } from '@/components/settings/byok-form';

export const metadata = { title: 'Settings · Speakwow' };

export default function SettingsPage() {
  return (
    <PageShell title="Settings">
      <ByokForm />
    </PageShell>
  );
}
