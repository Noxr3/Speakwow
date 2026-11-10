import { headers } from 'next/headers';
import { personaSummaries } from '@speakwow/shared';
import { App } from '@/components/app/app';
import { homeCourses } from '@/lib/home-courses';
import { getAppConfig } from '@/lib/utils';

export default async function Page() {
  const appConfig = await getAppConfig(await headers());
  const library = await homeCourses().catch(() => ({
    courses: [],
    selectedId: null,
    configured: true,
    error: 'Courses could not be loaded. Refresh to try again.',
  }));
  return <App appConfig={appConfig} personas={personaSummaries()} library={library} />;
}
