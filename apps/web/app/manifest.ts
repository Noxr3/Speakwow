import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Speakwow',
    short_name: 'Speakwow',
    description:
      'A voice teacher who remembers you. Learn through conversation and guided courses.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0c1715',
    theme_color: '#0c1715',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/brand/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
