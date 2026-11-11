import { personaSummaries } from '@speakwow/shared';
import { App } from '@/components/app/app';
import { homeCourses } from '@/lib/home-courses';
import { getServerAppConfig } from '@/lib/server-app-config';

export default async function Page() {
  const [appConfig, library] = await Promise.all([
    getServerAppConfig(),
    homeCourses({ selectedOnly: true }).catch(() => ({
      courses: [],
      selectedId: null,
      configured: true,
      error: 'Courses could not be loaded. Refresh to try again.',
    })),
  ]);
  return <App appConfig={appConfig} personas={personaSummaries()} library={library} />;
}
