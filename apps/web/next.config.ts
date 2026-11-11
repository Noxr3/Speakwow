import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // C1-C: eslint 不再跳过 —— lint 是 CI 门禁（.github/workflows/web.yml），
  // build 同时承担类型检查门禁职责。
  // @speakwow/shared ships TypeScript source and JSON, not a build.
  async headers() {
    return [
      {
        source: '/teachers/dylan-v1/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
  transpilePackages: ['@speakwow/shared'],
};

export default nextConfig;
