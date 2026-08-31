import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // C1-C: eslint 不再跳过 —— lint 是 CI 门禁（.github/workflows/web.yml），
  // build 同时承担类型检查门禁职责。
};

export default nextConfig;
