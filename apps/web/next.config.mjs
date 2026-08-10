import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDirectory = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(appDirectory, '../..'),
  transpilePackages: ['@thats-life/core'],
  async rewrites() {
    if (!process.env.VERCEL) return [];
    return {
      beforeFiles: [
        {
          source: '/:path*',
          destination: 'https://app.vivermaispsicologia.com.br/:path*',
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
