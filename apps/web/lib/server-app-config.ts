import { cache } from 'react';
import { headers } from 'next/headers';
import 'server-only';
import { APP_CONFIG_DEFAULTS } from '@/app-config';
import { CONFIG_ENDPOINT, getAppConfig } from '@/lib/utils';

/** Request headers matter only for optional remote sandbox configuration.
 * Keep public shells statically renderable in the ordinary deployment. */
export const getServerAppConfig = cache(async () =>
  CONFIG_ENDPOINT ? getAppConfig(await headers()) : APP_CONFIG_DEFAULTS
);
